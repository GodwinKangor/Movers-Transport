import os
from datetime import date, timedelta
from decimal import Decimal
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, current_app, jsonify, request, send_from_directory
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
import mysql.connector
from mysql.connector import Error
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_MAX_AGE_SECONDS = int(os.getenv("MOVERS_TOKEN_MAX_AGE_SECONDS", "28800"))
BASE_RATE = Decimal(os.getenv("MOVERS_BASE_RATE", "0.75"))
LOGIN_ROLES = {
    "system_admin",
    "ops_manager",
    "accountant",
    "hr_manager",
    "driver",
    "farmer",
}
STAFF_ROLES = {"system_admin", "ops_manager", "accountant", "hr_manager"}


def create_app():
    app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")
    app.config["SECRET_KEY"] = os.getenv("MOVERS_SECRET_KEY", "dev-change-this-secret")

    @app.get("/")
    def index():
        return send_from_directory(BASE_DIR, "frontend.html")

    @app.get("/frontend_styles.css")
    def styles():
        return send_from_directory(BASE_DIR, "frontend_styles.css")

    @app.get("/frontend_app.js")
    def script():
        return send_from_directory(BASE_DIR, "frontend_app.js")

    @app.get("/api/health")
    def health():
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
            return jsonify({"ok": True, "database": "connected"})
        except Error as exc:
            return jsonify({"ok": False, "database": "unavailable", "error": str(exc)}), 503

    @app.post("/api/login")
    def login():
        data = request.get_json(force=True)
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        role = (data.get("role") or "").strip()
        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400
        if role and role not in LOGIN_ROLES:
            return jsonify({"error": "Choose a valid login role."}), 400

        try:
            with get_connection() as conn:
                user = find_user_by_username(conn, username)
                if not user:
                    ensure_demo_admin(conn, username, password)
                    user = find_user_by_username(conn, username)
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

        if not user or not password_matches(user["password_hash"], password):
            return jsonify({"error": "Invalid username or password."}), 401
        if role and user["role"] != role:
            return jsonify({"error": f"That account is registered as {user['role'].replace('_', ' ')}."}), 403
        try:
            if driver_account_terminated(user):
                return jsonify({"error": "This driver account has been terminated."}), 403
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

        user_public = public_user(user)
        return jsonify({
            "token": make_auth_token(app, user_public),
            "expiresIn": TOKEN_MAX_AGE_SECONDS,
            "user": user_public,
        })

    @app.post("/api/signup/farmer")
    def farmer_signup():
        data = request.get_json(force=True)
        required = ["username", "password", "firstName", "lastName", "phone", "address", "farmerType"]
        missing = [field for field in required if not str(data.get(field) or "").strip()]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        username = data["username"].strip()
        password = data["password"]
        farmer_type = data["farmerType"].strip()
        if farmer_type not in {"large_scale", "small_scale"}:
            return jsonify({"error": "Farmer type must be large_scale or small_scale."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    if find_user_by_username(conn, username):
                        conn.rollback()
                        return jsonify({"error": "Username is already taken."}), 409
                    farmer_id = insert_farmer(conn, data)
                    user_id = insert_app_user(
                        conn,
                        username=username,
                        password=password,
                        role="farmer",
                        farmer_id=farmer_id,
                        driver_id=None,
                    )
                    conn.commit()
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400

                user = find_user_by_id(conn, user_id)
                user_public = public_user(user)
                return jsonify({
                    "token": make_auth_token(app, user_public),
                    "expiresIn": TOKEN_MAX_AGE_SECONDS,
                    "user": user_public,
                }), 201
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.get("/api/me")
    @require_auth
    def me():
        return jsonify({"user": request.user})

    @app.get("/api/bootstrap")
    @require_auth
    def bootstrap():
        with get_connection() as conn:
            return jsonify(load_bootstrap(conn, request.user))

    @app.post("/api/trips")
    @require_auth
    @require_roles("system_admin", "ops_manager", "farmer")
    def create_trip():
        data = request.get_json(force=True)
        required = [
            "origin",
            "destination",
            "distanceKm",
            "tripDate",
            "deliveryDate",
            "cargoType",
            "loadWeight",
        ]
        if request.user["role"] != "farmer":
            required.extend(["vehicleId", "driverId", "loaders"])
        missing = [field for field in required if field not in data]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        farmer_id = data.get("farmerId")
        group_id = data.get("groupId")
        data["baseRate"] = BASE_RATE
        if request.user["role"] == "farmer":
            data["vehicleId"] = None
            data["driverId"] = None
            loaders = []
        else:
            loaders = normalize_loader_ids(data.get("loaders") or [])

        if bool(farmer_id) == bool(group_id):
            return jsonify({"error": "Trip must use exactly one customer source."}), 400
        if request.user["role"] != "farmer":
            loader_error = validate_loader_count(data.get("loadWeight"), len(loaders))
            if loader_error:
                return jsonify({"error": loader_error}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    date_error = validate_trip_dates(conn, data)
                    if date_error:
                        conn.rollback()
                        return jsonify({"error": date_error}), 400

                    if farmer_id and farmer_type(conn, farmer_id) != "large_scale":
                        conn.rollback()
                        return jsonify({"error": "Small-scale farmers must request transport through a farmer group."}), 400

                    if group_id and group_member_count(conn, group_id) < 5:
                        conn.rollback()
                        return jsonify({"error": "A farmer group needs at least 5 members before requesting a trip."}), 400

                    if group_id and data.get("requestedByFarmerId") and not farmer_is_group_chair(conn, data.get("requestedByFarmerId"), group_id):
                        conn.rollback()
                        return jsonify({"error": "Group trips must be requested by the group chair."}), 403

                    if request.user["role"] == "farmer":
                        requester_id = request.user.get("farmerId")
                        if farmer_id:
                            if farmer_id != requester_id:
                                conn.rollback()
                                return jsonify({"error": "Farmer accounts can only request trips for their own farmer profile."}), 403
                            data["requestedByFarmerId"] = requester_id
                        if group_id:
                            if not farmer_is_group_chair(conn, requester_id, group_id):
                                conn.rollback()
                                return jsonify({"error": "Only the group chair can request transport for a farmer group."}), 403
                            data["requestedByFarmerId"] = requester_id

                    if request.user["role"] == "farmer":
                        assignment_error = auto_assign_trip_resources(conn, data)
                        if assignment_error:
                            conn.rollback()
                            return jsonify({"error": assignment_error}), 400
                        loaders = data["loaders"]

                    assignment_error = validate_trip_assignment(conn, data, loaders)
                    if assignment_error:
                        conn.rollback()
                        return jsonify({"error": assignment_error}), 400

                    trip_id = insert_trip(conn, data)
                    insert_trip_loaders(conn, trip_id, loaders)
                    conn.commit()
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400

                return jsonify({"tripId": trip_id, "state": load_bootstrap(conn, request.user)}), 201
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.patch("/api/trips/<int:trip_id>/status")
    @require_auth
    @require_roles("system_admin", "ops_manager")
    def update_trip_status(trip_id):
        data = request.get_json(force=True)
        next_status = (data.get("status") or "").strip()
        if next_status not in {"scheduled", "in_progress", "completed", "cancelled"}:
            return jsonify({"error": "Choose a valid trip status."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    current_status = trip_status(conn, trip_id)
                    if current_status is None:
                        conn.rollback()
                        return jsonify({"error": "Trip not found."}), 404

                    transition_error = validate_trip_status_transition(current_status, next_status)
                    if transition_error:
                        conn.rollback()
                        return jsonify({"error": transition_error}), 400

                    with conn.cursor() as cursor:
                        cursor.execute(
                            "UPDATE Trip SET trip_status = %s WHERE trip_id = %s",
                            (next_status, trip_id),
                        )
                    conn.commit()
                    return jsonify({"tripId": trip_id, "state": load_bootstrap(conn, request.user)})
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.delete("/api/trips/<int:trip_id>/loaders/<int:loader_id>")
    @require_auth
    @require_roles("system_admin", "ops_manager")
    def remove_trip_loader(trip_id, loader_id):
        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "SELECT COUNT(*) FROM Trip WHERE trip_id = %s",
                            (trip_id,),
                        )
                        if cursor.fetchone()[0] == 0:
                            conn.rollback()
                            return jsonify({"error": "Trip not found."}), 404

                        cursor.execute(
                            """
                            SELECT t.load_weight, COUNT(tl.loader_id)
                            FROM Trip t
                            LEFT JOIN TripLoader tl ON t.trip_id = tl.trip_id
                            WHERE t.trip_id = %s
                            GROUP BY t.trip_id, t.load_weight
                            """,
                            (trip_id,),
                        )
                        trip_row = cursor.fetchone()
                        if not trip_row:
                            conn.rollback()
                            return jsonify({"error": "Trip not found."}), 404
                        load_weight, loader_total = trip_row

                        cursor.execute(
                            "SELECT COUNT(*) FROM TripLoader WHERE trip_id = %s AND loader_id = %s",
                            (trip_id, loader_id),
                        )
                        if cursor.fetchone()[0] == 0:
                            conn.rollback()
                            return jsonify({"error": "That loader is not assigned to this trip."}), 404

                        minimum_loaders = required_loader_count(load_weight)
                        if loader_total - 1 < minimum_loaders:
                            conn.rollback()
                            return jsonify({"error": f"This trip must keep at least {minimum_loaders} loader(s) for its load weight."}), 400

                        cursor.execute(
                            "DELETE FROM TripLoader WHERE trip_id = %s AND loader_id = %s",
                            (trip_id, loader_id),
                        )
                    conn.commit()
                    return jsonify(
                        {
                            "tripId": trip_id,
                            "loaderId": loader_id,
                            "state": load_bootstrap(conn, request.user),
                        }
                    )
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.post("/api/payments")
    @require_auth
    @require_roles("system_admin", "ops_manager", "accountant")
    def create_payment():
        data = request.get_json(force=True)
        if not data.get("tripId"):
            return jsonify({"error": "tripId is required."}), 400

        try:
            amount = Decimal(str(data.get("amount", 0)))
        except Exception:
            return jsonify({"error": "Payment amount must be a number."}), 400
        if amount <= 0:
            return jsonify({"error": "Payment amount must be greater than zero."}), 400

        method = (data.get("method") or "cash").strip()
        if not method:
            return jsonify({"error": "Payment method is required."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    payment_error = validate_payment(conn, data["tripId"], amount)
                    if payment_error:
                        conn.rollback()
                        return jsonify({"error": payment_error}), 400

                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            INSERT INTO Payment (trip_id, payment_date, amount_paid, payment_method)
                            VALUES (%s, CURRENT_DATE, %s, %s)
                            """,
                            (data["tripId"], amount, method),
                        )
                        payment_id = cursor.lastrowid
                    conn.commit()
                    return jsonify({"paymentId": payment_id, "state": load_bootstrap(conn, request.user)}), 201
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.patch("/api/drivers/<int:driver_id>/pay")
    @require_auth
    @require_roles("system_admin", "ops_manager")
    def update_driver_pay(driver_id):
        data = request.get_json(force=True)
        pay_rate = parse_nonnegative_amount(data.get("salaryRate"), "Salary rate")
        if isinstance(pay_rate, tuple):
            return jsonify({"error": pay_rate[0]}), pay_rate[1]

        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "UPDATE Driver SET salary_rate = %s WHERE driver_id = %s",
                        (pay_rate, driver_id),
                    )
                    if cursor.rowcount == 0:
                        conn.rollback()
                        return jsonify({"error": "Driver not found."}), 404
                conn.commit()
                return jsonify({"driverId": driver_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.patch("/api/loaders/<int:loader_id>/pay")
    @require_auth
    @require_roles("system_admin", "ops_manager")
    def update_loader_pay(loader_id):
        data = request.get_json(force=True)
        pay_rate = parse_nonnegative_amount(data.get("rate"), "Loader rate")
        if isinstance(pay_rate, tuple):
            return jsonify({"error": pay_rate[0]}), pay_rate[1]

        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "UPDATE Loader SET payment_rate = %s WHERE loader_id = %s",
                        (pay_rate, loader_id),
                    )
                    if cursor.rowcount == 0:
                        conn.rollback()
                        return jsonify({"error": "Loader not found."}), 404
                conn.commit()
                return jsonify({"loaderId": loader_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.patch("/api/drivers/<int:driver_id>/terminate")
    @require_auth
    @require_roles("system_admin")
    def terminate_driver(driver_id):
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "UPDATE Driver SET status = 'terminated' WHERE driver_id = %s",
                        (driver_id,),
                    )
                    if cursor.rowcount == 0:
                        conn.rollback()
                        return jsonify({"error": "Driver not found."}), 404
                conn.commit()
                return jsonify({"driverId": driver_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.patch("/api/loaders/<int:loader_id>/terminate")
    @require_auth
    @require_roles("system_admin")
    def terminate_loader(loader_id):
        try:
            with get_connection() as conn:
                if not table_has_column(conn, "Loader", "status"):
                    return jsonify({"error": "Loader termination needs a Loader.status column so historical trip records are preserved."}), 400
                with conn.cursor() as cursor:
                    cursor.execute(
                        "UPDATE Loader SET status = 'terminated' WHERE loader_id = %s",
                        (loader_id,),
                    )
                    if cursor.rowcount == 0:
                        conn.rollback()
                        return jsonify({"error": "Loader not found."}), 404
                conn.commit()
                return jsonify({"loaderId": loader_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/offences")
    @require_auth
    @require_roles("system_admin", "ops_manager", "hr_manager")
    def create_offence():
        data = request.get_json(force=True)
        if not data.get("driverId") or not data.get("type"):
            return jsonify({"error": "driverId and type are required."}), 400

        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO Offence (driver_id, trip_id, offence_date, offence_type, surcharge_amount)
                        VALUES (%s, %s, CURRENT_DATE, %s, %s)
                        """,
                        (
                            data["driverId"],
                            data.get("tripId"),
                            data["type"],
                            data.get("surcharge", 0),
                        ),
                    )
                    offence_id = cursor.lastrowid
                conn.commit()
                return jsonify({"offenceId": offence_id, "state": load_bootstrap(conn, request.user)}), 201
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.patch("/api/offences/<int:offence_id>")
    @require_auth
    @require_roles("system_admin", "hr_manager")
    def update_offence(offence_id):
        data = request.get_json(force=True)
        offence_type = (data.get("type") or "").strip()
        if not offence_type:
            return jsonify({"error": "Offence type is required."}), 400

        try:
            surcharge = Decimal(str(data.get("surcharge", 0)))
        except Exception:
            return jsonify({"error": "Surcharge must be a number."}), 400
        if surcharge < 0:
            return jsonify({"error": "Surcharge cannot be negative."}), 400

        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE Offence
                        SET offence_type = %s,
                            surcharge_amount = %s
                        WHERE offence_id = %s
                        """,
                        (offence_type, surcharge, offence_id),
                    )
                    if cursor.rowcount == 0:
                        conn.rollback()
                        return jsonify({"error": "Offence not found."}), 404
                conn.commit()
                return jsonify({"offenceId": offence_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.delete("/api/offences/<int:offence_id>")
    @require_auth
    @require_roles("system_admin", "hr_manager")
    def delete_offence(offence_id):
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM Offence WHERE offence_id = %s",
                        (offence_id,),
                    )
                    if cursor.rowcount == 0:
                        conn.rollback()
                        return jsonify({"error": "Offence not found."}), 404
                conn.commit()
                return jsonify({"offenceId": offence_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/service-records")
    @require_auth
    @require_roles("system_admin", "ops_manager", "driver")
    def create_service_record():
        data = request.get_json(force=True)
        if not data.get("vehicleId") or not data.get("description"):
            return jsonify({"error": "vehicleId and description are required."}), 400

        cost = data.get("serviceCost", 0)
        try:
            cost = Decimal(str(cost))
        except Exception:
            return jsonify({"error": "serviceCost must be a number."}), 400
        if cost < 0:
            return jsonify({"error": "serviceCost cannot be negative."}), 400

        try:
            with get_connection() as conn:
                if request.user["role"] == "driver" and not driver_assigned_to_vehicle(conn, request.user.get("driverId"), data["vehicleId"]):
                    return jsonify({"error": "Drivers can only record maintenance for their assigned vehicle."}), 403

                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO ServiceRecord (vehicle_id, trip_id, service_date, service_cost, description)
                        VALUES (%s, %s, CURRENT_DATE, %s, %s)
                        """,
                        (
                            data["vehicleId"],
                            data.get("tripId"),
                            cost,
                            data["description"].strip(),
                        ),
                    )
                    service_id = cursor.lastrowid
                conn.commit()
                return jsonify({"serviceId": service_id, "state": load_bootstrap(conn, request.user)}), 201
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/groups")
    @require_auth
    @require_roles("farmer")
    def create_group():
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        region = (data.get("region") or "").strip()
        if not name or not region:
            return jsonify({"error": "Group name and region are required."}), 400

        try:
            with get_connection() as conn:
                farmer_id = request.user.get("farmerId")
                if farmer_type(conn, farmer_id) != "small_scale":
                    return jsonify({"error": "Only small-scale farmers can create farmer groups."}), 403

                conn.start_transaction()
                try:
                    group_id = insert_farmer_group(conn, name, region)
                    insert_group_membership(conn, group_id, farmer_id, "chair")
                    conn.commit()
                    return jsonify({"groupId": group_id, "state": load_bootstrap(conn, request.user)}), 201
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.post("/api/groups/<int:group_id>/join")
    @require_auth
    @require_roles("farmer")
    def join_group(group_id):
        try:
            with get_connection() as conn:
                farmer_id = request.user.get("farmerId")
                if farmer_type(conn, farmer_id) != "small_scale":
                    return jsonify({"error": "Only small-scale farmers can join farmer groups."}), 403
                if not group_exists(conn, group_id):
                    return jsonify({"error": "Farmer group not found."}), 404
                if farmer_is_group_member(conn, farmer_id, group_id):
                    return jsonify({"error": "You are already a member of this group."}), 400

                insert_group_membership(conn, group_id, farmer_id, "member")
                conn.commit()
                return jsonify({"groupId": group_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/reviews")
    @require_auth
    @require_roles("farmer")
    def create_review():
        data = request.get_json(force=True)
        required = ["tripId", "targetType", "rating"]
        missing = [field for field in required if data.get(field) in (None, "")]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        target_type = data["targetType"]
        if target_type not in {"driver", "loader"}:
            return jsonify({"error": "targetType must be driver or loader."}), 400
        try:
            rating = int(data["rating"])
        except (TypeError, ValueError):
            return jsonify({"error": "Rating must be a number from 1 to 5."}), 400
        if rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be from 1 to 5."}), 400

        try:
            with get_connection() as conn:
                review_id = insert_trip_review(conn, request.user["farmerId"], data, target_type, rating)
                conn.commit()
                return jsonify({"reviewId": review_id, "state": load_bootstrap(conn, request.user)}), 201
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/users/staff")
    @require_auth
    @require_roles("system_admin")
    def create_staff_user():
        data = request.get_json(force=True)
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        role = (data.get("role") or "").strip()
        if not username or not password or not role:
            return jsonify({"error": "Username, password, and role are required."}), 400
        if role not in STAFF_ROLES:
            return jsonify({"error": "Staff role must be system_admin, ops_manager, accountant, or hr_manager."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    if find_user_by_username(conn, username):
                        conn.rollback()
                        return jsonify({"error": "Username is already taken."}), 409
                    user_id = insert_app_user(
                        conn,
                        username=username,
                        password=password,
                        role=role,
                        farmer_id=None,
                        driver_id=None,
                    )
                    conn.commit()
                    return jsonify({"userId": user_id, "state": load_bootstrap(conn, request.user)}), 201
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.post("/api/drivers")
    @require_auth
    @require_roles("system_admin", "ops_manager")
    def create_driver():
        data = request.get_json(force=True)
        required = ["firstName", "lastName", "phone", "hireDate", "salaryRate", "username", "password"]
        missing = [field for field in required if data.get(field) in (None, "")]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        first_name = (data.get("firstName") or "").strip()
        last_name = (data.get("lastName") or "").strip()
        phone = (data.get("phone") or "").strip()
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        if not first_name or not last_name or not phone or not username:
            return jsonify({"error": "Driver name, phone, and username cannot be blank."}), 400
        pay_rate = parse_nonnegative_amount(data.get("salaryRate"), "Salary rate")
        if isinstance(pay_rate, tuple):
            return jsonify({"error": pay_rate[0]}), pay_rate[1]
        try:
            hire_date = date.fromisoformat(str(data.get("hireDate")))
        except (TypeError, ValueError):
            return jsonify({"error": "Hire date must use YYYY-MM-DD format."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    if find_user_by_username(conn, username):
                        conn.rollback()
                        return jsonify({"error": "Username is already taken."}), 409
                    driver_id = insert_driver(conn, data, hire_date, pay_rate)
                    user_id = insert_app_user(
                        conn,
                        username=username,
                        password=password,
                        role="driver",
                        farmer_id=None,
                        driver_id=driver_id,
                    )
                    conn.commit()
                    return jsonify({"driverId": driver_id, "userId": user_id, "state": load_bootstrap(conn, request.user)}), 201
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.post("/api/vehicles")
    @require_auth
    @require_roles("system_admin", "ops_manager")
    def create_vehicle():
        data = request.get_json(force=True)
        required = ["plate", "type", "capacity", "fuel", "status"]
        missing = [field for field in required if data.get(field) in (None, "")]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        plate = (data.get("plate") or "").strip().upper()
        vehicle_type = (data.get("type") or "").strip()
        fuel_type = (data.get("fuel") or "").strip()
        status = (data.get("status") or "").strip()
        if not plate:
            return jsonify({"error": "Plate number cannot be blank."}), 400
        if vehicle_type not in {"van", "pickup", "container_truck"}:
            return jsonify({"error": "Vehicle type must be van, pickup, or container truck."}), 400
        if fuel_type not in {"petrol", "diesel", "electric"}:
            return jsonify({"error": "Fuel type must be petrol, diesel, or electric."}), 400
        if status not in {"available", "assigned", "under_maintenance", "fueling", "out_of_service", "retired"}:
            return jsonify({"error": "Vehicle status is not valid for a new vehicle."}), 400
        try:
            capacity = Decimal(str(data.get("capacity")))
        except Exception:
            return jsonify({"error": "Capacity must be a number."}), 400
        if capacity <= 0:
            return jsonify({"error": "Capacity must be greater than zero."}), 400

        driver_id = data.get("assignedDriverId") or None
        if driver_id:
            try:
                driver_id = int(driver_id)
            except (TypeError, ValueError):
                return jsonify({"error": "Assigned driver must be a valid driver."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    if driver_id:
                        driver_error = validate_vehicle_driver_assignment(conn, driver_id)
                        if driver_error:
                            conn.rollback()
                            return jsonify({"error": driver_error}), 400
                    vehicle_id = insert_vehicle(conn, plate, vehicle_type, capacity, fuel_type, status, driver_id)
                    conn.commit()
                    return jsonify({"vehicleId": vehicle_id, "state": load_bootstrap(conn, request.user)}), 201
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

    @app.patch("/api/users/<int:user_id>/role")
    @require_auth
    @require_roles("system_admin")
    def update_user_role(user_id):
        data = request.get_json(force=True)
        role = (data.get("role") or "").strip()
        if role not in STAFF_ROLES:
            return jsonify({"error": "Staff role must be system_admin, ops_manager, accountant, or hr_manager."}), 400
        if user_id == request.user.get("id"):
            return jsonify({"error": "Use another system admin account to change your own role."}), 400

        try:
            with get_connection() as conn:
                with conn.cursor(dictionary=True) as cursor:
                    cursor.execute(
                        """
                        SELECT user_id, farmer_id, driver_id
                        FROM AppUser
                        WHERE user_id = %s
                        """,
                        (user_id,),
                    )
                    user = cursor.fetchone()
                    if not user:
                        return jsonify({"error": "User not found."}), 404
                    if user["farmer_id"] or user["driver_id"]:
                        return jsonify({"error": "Only staff accounts can be reassigned through admin user management."}), 400
                    cursor.execute(
                        "UPDATE AppUser SET role = %s WHERE user_id = %s",
                        (role, user_id),
                    )
                conn.commit()
                return jsonify({"userId": user_id, "state": load_bootstrap(conn, request.user)})
        except Error as exc:
            return jsonify({"error": str(exc)}), 400

    return app


def make_serializer(app):
    return URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="movers-auth-token")


def make_auth_token(app, user):
    return make_serializer(app).dumps(user)


def read_auth_token(app, token):
    return make_serializer(app).loads(token, max_age=TOKEN_MAX_AGE_SECONDS)


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").strip()
        if not token:
            return jsonify({"error": "Authentication required."}), 401
        try:
            request.user = read_auth_token(current_app, token)
        except SignatureExpired:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except BadSignature:
            return jsonify({"error": "Invalid session. Please log in again."}), 401
        try:
            if driver_account_terminated(request.user):
                return jsonify({"error": "This driver account has been terminated. Please contact HR."}), 401
        except Error as exc:
            return jsonify({"error": str(exc)}), 500
        return view(*args, **kwargs)

    return wrapped


def require_roles(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if request.user.get("role") not in roles:
                return jsonify({"error": "Your role does not have permission for this action."}), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator


def find_user_by_username(conn, username):
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT user_id, username, password_hash, role, farmer_id, driver_id
            FROM AppUser
            WHERE username = %s
            """,
            (username,),
        )
        return cursor.fetchone()


def find_user_by_id(conn, user_id):
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT user_id, username, password_hash, role, farmer_id, driver_id
            FROM AppUser
            WHERE user_id = %s
            """,
            (user_id,),
        )
        return cursor.fetchone()


def driver_account_terminated(user):
    if user.get("role") != "driver":
        return False
    driver_id = user.get("driver_id") or user.get("driverId")
    if not driver_id:
        return False
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT status FROM Driver WHERE driver_id = %s",
                (driver_id,),
            )
            row = cursor.fetchone()
    return bool(row and row[0] == "terminated")


def ensure_demo_admin(conn, username, password):
    demo_username = os.getenv("MOVERS_DEMO_USERNAME", "admin")
    demo_password = os.getenv("MOVERS_DEMO_PASSWORD", "password")
    if username != demo_username or password != demo_password:
        return

    with conn.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM AppUser")
        if cursor.fetchone()[0] > 0:
            return
        cursor.execute(
            """
            INSERT INTO AppUser (username, password_hash, role, farmer_id, driver_id)
            VALUES (%s, %s, 'system_admin', NULL, NULL)
            """,
            (demo_username, generate_password_hash(demo_password)),
        )
    conn.commit()


def insert_farmer(conn, data):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO Farmer (first_name, last_name, phone, address, farmer_type)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                data["firstName"].strip(),
                data["lastName"].strip(),
                data["phone"].strip(),
                data["address"].strip(),
                data["farmerType"].strip(),
            ),
        )
        return cursor.lastrowid


def insert_driver(conn, data, hire_date, salary_rate):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO Driver (first_name, last_name, phone, hire_date, salary_rate, status)
            VALUES (%s, %s, %s, %s, %s, 'active')
            """,
            (
                data["firstName"].strip(),
                data["lastName"].strip(),
                data["phone"].strip(),
                hire_date,
                salary_rate,
            ),
        )
        return cursor.lastrowid


def validate_vehicle_driver_assignment(conn, driver_id):
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            "SELECT status FROM Driver WHERE driver_id = %s",
            (driver_id,),
        )
        driver = cursor.fetchone()
        if not driver:
            return "Assigned driver was not found."
        if driver["status"] != "active":
            return "Assigned driver must be active."

        cursor.execute(
            "SELECT vehicle_id FROM Vehicle WHERE assigned_driver_id = %s",
            (driver_id,),
        )
        vehicle = cursor.fetchone()
        if vehicle:
            return "Assigned driver already has a vehicle."
    return ""


def insert_vehicle(conn, plate, vehicle_type, capacity, fuel_type, status, driver_id):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO Vehicle (plate_number, vehicle_type, load_capacity, fuel_type, status, assigned_driver_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (plate, vehicle_type, capacity, fuel_type, status, driver_id),
        )
        return cursor.lastrowid


def insert_app_user(conn, username, password, role, farmer_id=None, driver_id=None):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO AppUser (username, password_hash, role, farmer_id, driver_id)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (username, generate_password_hash(password), role, farmer_id, driver_id),
        )
        return cursor.lastrowid


def password_matches(stored_hash, password):
    if not stored_hash:
        return False
    if stored_hash == password:
        return True
    if stored_hash == "$2b$12$replace_with_real_bcrypt_hash":
        return password == os.getenv("MOVERS_DEMO_PASSWORD", "password")
    try:
        return check_password_hash(stored_hash, password)
    except ValueError:
        return False


def public_user(user):
    return {
        "id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "farmerId": user.get("farmer_id"),
        "driverId": user.get("driver_id"),
    }


def parse_nonnegative_amount(value, label):
    try:
        amount = Decimal(str(value))
    except Exception:
        return (f"{label} must be a number.", 400)
    if amount < 0:
        return (f"{label} cannot be negative.", 400)
    return amount


def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MOVERS_DB_HOST", "127.0.0.1"),
        port=int(os.getenv("MOVERS_DB_PORT", "3306")),
        user=os.getenv("MOVERS_DB_USER", "root"),
        password=os.getenv("MOVERS_DB_PASSWORD", ""),
        database=os.getenv("MOVERS_DB_NAME", "movers_transport"),
    )


def fetch_all(conn, query, params=None):
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(query, params or ())
        return [normalize_row(row) for row in cursor.fetchall()]


def normalize_row(row):
    normalized = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            normalized[key] = float(value)
        else:
            normalized[key] = value
    return normalized


def table_has_column(conn, table_name, column_name):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = %s
              AND COLUMN_NAME = %s
            """,
            (table_name, column_name),
        )
        return cursor.fetchone()[0] > 0


def load_bootstrap(conn, user=None):
    users = fetch_all(
        conn,
        """
        SELECT user_id AS id,
               username,
               role,
               farmer_id AS farmerId,
               driver_id AS driverId
        FROM AppUser
        ORDER BY user_id
        """,
    )

    farmers = fetch_all(
        conn,
        """
        SELECT farmer_id AS id,
               CONCAT(first_name, ' ', last_name) AS name,
               phone,
               address,
               farmer_type AS type
        FROM Farmer
        ORDER BY farmer_id
        """,
    )

    groups = fetch_all(
        conn,
        """
        SELECT fg.group_id AS id,
               fg.group_name AS name,
               fg.region,
               GROUP_CONCAT(gm.farmer_id ORDER BY gm.farmer_id) AS member_ids,
               GROUP_CONCAT(CONCAT(gm.farmer_id, ':', gm.role) ORDER BY gm.farmer_id) AS member_roles,
               MAX(CASE WHEN gm.role = 'chair' THEN gm.farmer_id END) AS chairId
        FROM FarmerGroup fg
        LEFT JOIN GroupMembership gm ON fg.group_id = gm.group_id
        GROUP BY fg.group_id, fg.group_name, fg.region
        ORDER BY fg.group_id
        """,
    )
    for group in groups:
        group["members"] = parse_id_list(group.pop("member_ids"))
        group["memberRoles"] = parse_member_roles(group.pop("member_roles"))

    drivers = fetch_all(
        conn,
        """
        SELECT driver_id AS id,
               CONCAT(first_name, ' ', last_name) AS name,
               phone,
               status,
               salary_rate AS salaryRate
        FROM Driver
        ORDER BY driver_id
        """,
    )

    loader_status_supported = table_has_column(conn, "Loader", "status")
    loader_status_select = "status" if loader_status_supported else "'active' AS status"
    loaders = fetch_all(
        conn,
        f"""
        SELECT loader_id AS id,
               CONCAT(first_name, ' ', last_name) AS name,
               payment_rate AS rate,
               {loader_status_select}
        FROM Loader
        ORDER BY loader_id
        """,
    )

    vehicles = fetch_all(
        conn,
        """
        SELECT vehicle_id AS id,
               plate_number AS plate,
               vehicle_type AS type,
               vehicle_type AS size,
               load_capacity AS capacity,
               fuel_type AS fuel,
               status,
               assigned_driver_id AS assignedDriverId
        FROM Vehicle
        ORDER BY vehicle_id
        """,
    )

    fuel_records = fetch_all(
        conn,
        """
        SELECT fuel_id AS id,
               vehicle_id AS vehicleId,
               trip_id AS tripId,
               DATE_FORMAT(fuel_date, '%Y-%m-%d') AS fuelDate,
               liters,
               fuel_cost AS cost
        FROM FuelRecord
        ORDER BY fuel_date DESC, fuel_id DESC
        """,
    )

    service_records = fetch_all(
        conn,
        """
        SELECT service_id AS id,
               vehicle_id AS vehicleId,
               trip_id AS tripId,
               DATE_FORMAT(service_date, '%Y-%m-%d') AS serviceDate,
               service_cost AS cost,
               description
        FROM ServiceRecord
        ORDER BY service_date DESC, service_id DESC
        """,
    )

    loader_payments = fetch_all(
        conn,
        """
        SELECT trip_loader_id AS id,
               trip_id AS tripId,
               loader_id AS loaderId,
               payment_amount AS amount
        FROM TripLoader
        ORDER BY trip_loader_id
        """,
    )

    trips = fetch_all(
        conn,
        """
        SELECT t.trip_id AS id,
               t.vehicle_id AS vehicleId,
               t.driver_id AS driverId,
               t.customer_farmer_id AS farmerId,
               t.customer_group_id AS groupId,
               t.requested_by_farmer_id AS requestedByFarmerId,
               COALESCE(CONCAT(f.first_name, ' ', f.last_name), fg.group_name) AS customerName,
               t.origin,
               t.destination,
               t.distance_km AS distanceKm,
               DATE_FORMAT(t.trip_date, '%Y-%m-%d') AS tripDate,
               DATE_FORMAT(t.delivery_date, '%Y-%m-%d') AS deliveryDate,
               t.cargo_type AS cargoType,
               t.load_weight AS loadWeight,
               t.base_rate AS baseRate,
               t.transport_cost AS transportCost,
               t.tax_amount AS taxAmount,
               t.total_cost AS totalCost,
               t.trip_status AS status,
               GROUP_CONCAT(DISTINCT tl.loader_id ORDER BY tl.loader_id) AS loader_ids
        FROM Trip t
        LEFT JOIN TripLoader tl ON t.trip_id = tl.trip_id
        LEFT JOIN Farmer f ON t.customer_farmer_id = f.farmer_id
        LEFT JOIN FarmerGroup fg ON t.customer_group_id = fg.group_id
        GROUP BY t.trip_id
        ORDER BY t.trip_date, t.trip_id
        """,
    )

    payments_by_trip = {}
    for payment in fetch_all(
        conn,
        """
        SELECT payment_id AS id,
               trip_id AS tripId,
               amount_paid AS amount,
               payment_method AS method,
               DATE_FORMAT(payment_date, '%Y-%m-%d') AS paymentDate
        FROM Payment
        ORDER BY payment_id
        """,
    ):
        payments_by_trip.setdefault(payment["tripId"], []).append(payment)

    for trip in trips:
        trip["loaders"] = parse_id_list(trip.pop("loader_ids"))
        trip["payments"] = payments_by_trip.get(trip["id"], [])

    offences = fetch_all(
        conn,
        """
        SELECT offence_id AS id,
               driver_id AS driverId,
               trip_id AS tripId,
               DATE_FORMAT(offence_date, '%Y-%m-%d') AS offenceDate,
               offence_type AS type,
               surcharge_amount AS surcharge
        FROM Offence
        ORDER BY offence_id
        """,
    )

    warnings = fetch_all(
        conn,
        """
        SELECT warning_id AS id,
               driver_id AS driverId,
               reason
        FROM WarningLetter
        ORDER BY warning_id
        """,
    )

    suspensions = fetch_all(
        conn,
        """
        SELECT suspension_id AS id,
               driver_id AS driverId,
               DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
               DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
               reason
        FROM Suspension
        ORDER BY suspension_id
        """,
    )

    reviews = fetch_all(
        conn,
        """
        SELECT review_id AS id,
               trip_id AS tripId,
               farmer_id AS farmerId,
               target_type AS targetType,
               driver_id AS driverId,
               loader_id AS loaderId,
               rating,
               comment,
               DATE_FORMAT(review_date, '%Y-%m-%d') AS reviewDate
        FROM TripReview
        ORDER BY review_date DESC, review_id DESC
        """,
    )

    state = {
        "users": users,
        "farmers": farmers,
        "groups": groups,
        "drivers": drivers,
        "loaders": loaders,
        "vehicles": vehicles,
        "fuelRecords": fuel_records,
        "serviceRecords": service_records,
        "loaderPayments": loader_payments,
        "trips": trips,
        "offences": offences,
        "warnings": warnings,
        "suspensions": suspensions,
        "reviews": reviews,
        "config": {
            "baseRate": float(BASE_RATE),
        },
    }
    return filter_bootstrap_for_user(state, user)


def filter_bootstrap_for_user(state, user):
    if not user:
        return state

    if user.get("role") in {"system_admin", "ops_manager"}:
        if user.get("role") == "system_admin":
            return state
        return {
            **state,
            "users": [],
        }

    if user.get("role") == "accountant":
        return {
            **state,
            "users": [],
            "farmers": [],
            "groups": [],
            "offences": [],
            "warnings": [],
            "suspensions": [],
            "reviews": [],
        }

    if user.get("role") == "hr_manager":
        return {
            **state,
            "users": [],
            "farmers": [],
            "groups": [],
            "fuelRecords": [],
            "serviceRecords": [],
            "loaderPayments": [],
            "reviews": state["reviews"],
        }

    if user.get("role") == "driver":
        driver_id = user.get("driverId")
        driver_vehicles = [vehicle for vehicle in state["vehicles"] if vehicle["assignedDriverId"] == driver_id]
        driver_vehicle_ids = {vehicle["id"] for vehicle in driver_vehicles}
        driver_trips = [trip for trip in state["trips"] if trip["driverId"] == driver_id]
        driver_trip_ids = {trip["id"] for trip in driver_trips}
        return {
            **state,
            "users": [],
            "farmers": [],
            "groups": [],
            "drivers": [driver for driver in state["drivers"] if driver["id"] == driver_id],
            "loaders": [],
            "vehicles": driver_vehicles,
            "fuelRecords": [record for record in state["fuelRecords"] if record["vehicleId"] in driver_vehicle_ids],
            "serviceRecords": [record for record in state["serviceRecords"] if record["vehicleId"] in driver_vehicle_ids],
            "loaderPayments": [],
            "trips": driver_trips,
            "offences": [offence for offence in state["offences"] if offence["driverId"] == driver_id],
            "warnings": [warning for warning in state["warnings"] if warning["driverId"] == driver_id],
            "suspensions": [suspension for suspension in state["suspensions"] if suspension["driverId"] == driver_id],
            "reviews": [
                review for review in state["reviews"]
                if review["driverId"] == driver_id or review["tripId"] in driver_trip_ids
            ],
        }

    farmer_id = user.get("farmerId")
    farmer_groups = [group for group in state["groups"] if farmer_id in group["members"]]
    farmer_group_ids = {group["id"] for group in farmer_groups}
    farmer_trips = [
        trip for trip in state["trips"]
        if trip["farmerId"] == farmer_id or trip["groupId"] in farmer_group_ids
    ]

    return {
        **state,
        "users": [],
        "farmers": [farmer for farmer in state["farmers"] if farmer["id"] == farmer_id],
        "groups": state["groups"],
        "trips": farmer_trips,
        "fuelRecords": [],
        "serviceRecords": [],
        "loaderPayments": [],
        "offences": [],
        "warnings": [],
        "suspensions": [],
        "reviews": [
            review for review in state["reviews"]
            if review["farmerId"] == farmer_id or review["tripId"] in {trip["id"] for trip in farmer_trips}
        ],
    }


def parse_id_list(value):
    if not value:
        return []
    return [int(item) for item in str(value).split(",") if item]


def parse_member_roles(value):
    roles = {}
    if not value:
        return roles
    for item in str(value).split(","):
        if ":" not in item:
            continue
        farmer_id, role = item.split(":", 1)
        if farmer_id:
            roles[str(int(farmer_id))] = role
    return roles


def group_member_count(conn, group_id):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM GroupMembership WHERE group_id = %s",
            (group_id,),
        )
        return cursor.fetchone()[0]


def farmer_type(conn, farmer_id):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT farmer_type FROM Farmer WHERE farmer_id = %s",
            (farmer_id,),
        )
        row = cursor.fetchone()
    return row[0] if row else None


def farmer_is_group_chair(conn, farmer_id, group_id):
    if not farmer_id or not group_id:
        return False
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM GroupMembership
            WHERE farmer_id = %s
              AND group_id = %s
              AND role = 'chair'
            """,
            (farmer_id, group_id),
        )
        return cursor.fetchone()[0] > 0


def normalize_loader_ids(loader_ids):
    normalized = []
    seen = set()
    for loader_id in loader_ids:
        try:
            value = int(loader_id)
        except (TypeError, ValueError):
            continue
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def required_loader_count(load_weight):
    try:
        weight = Decimal(str(load_weight))
    except Exception:
        return 1
    if weight <= Decimal("1000"):
        return 1
    if weight <= Decimal("4000"):
        return 2
    return 3


def validate_loader_count(load_weight, loader_count):
    minimum = required_loader_count(load_weight)
    if loader_count < minimum:
        return f"Load weight requires at least {minimum} loader(s)."
    return ""


def auto_assign_trip_resources(conn, data):
    try:
        load_weight = Decimal(str(data.get("loadWeight", 0)))
    except Exception:
        return "Load weight must be a number."

    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT vehicle_id, assigned_driver_id, load_capacity
            FROM Vehicle
            WHERE status = 'available'
              AND load_capacity >= %s
            ORDER BY load_capacity, vehicle_id
            """,
            (load_weight,),
        )
        vehicles = cursor.fetchall()

        cursor.execute(
            """
            SELECT driver_id
            FROM Driver
            WHERE status = 'active'
            ORDER BY driver_id
            """
        )
        drivers = cursor.fetchall()

        loader_status_filter = "WHERE status <> 'terminated'" if table_has_column(conn, "Loader", "status") else ""
        cursor.execute(
            f"""
            SELECT loader_id
            FROM Loader
            {loader_status_filter}
            ORDER BY loader_id
            """
        )
        loaders = cursor.fetchall()

    driver_ids = [driver["driver_id"] for driver in drivers]
    for vehicle in vehicles:
        candidate_driver_ids = (
            [vehicle["assigned_driver_id"]]
            if vehicle["assigned_driver_id"]
            else driver_ids
        )
        for driver_id in candidate_driver_ids:
            if driver_id not in driver_ids:
                continue
            if assignment_conflict(conn, data["tripDate"], data["deliveryDate"], driver_id=driver_id):
                continue
            if assignment_conflict(conn, data["tripDate"], data["deliveryDate"], vehicle_id=vehicle["vehicle_id"]):
                continue
            data["vehicleId"] = vehicle["vehicle_id"]
            data["driverId"] = driver_id
            break
        if data.get("vehicleId") and data.get("driverId"):
            break

    if not data.get("vehicleId") or not data.get("driverId"):
        return "No available driver and vehicle combination can cover this trip."

    assigned_loaders = []
    minimum_loaders = required_loader_count(load_weight)
    for loader in loaders:
        loader_id = loader["loader_id"]
        if assignment_conflict(conn, data["tripDate"], data["deliveryDate"], loader_id=loader_id):
            continue
        assigned_loaders.append(loader_id)
        if len(assigned_loaders) == minimum_loaders:
            break

    if len(assigned_loaders) < minimum_loaders:
        return f"Load weight requires at least {minimum_loaders} available loader(s)."

    data["loaders"] = assigned_loaders
    return ""


def farmer_is_group_member(conn, farmer_id, group_id):
    if not farmer_id or not group_id:
        return False
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM GroupMembership
            WHERE farmer_id = %s
              AND group_id = %s
            """,
            (farmer_id, group_id),
        )
        return cursor.fetchone()[0] > 0


def group_exists(conn, group_id):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM FarmerGroup WHERE group_id = %s",
            (group_id,),
        )
        return cursor.fetchone()[0] > 0


def insert_farmer_group(conn, name, region):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO FarmerGroup (group_name, region)
            VALUES (%s, %s)
            """,
            (name, region),
        )
        return cursor.lastrowid


def insert_group_membership(conn, group_id, farmer_id, role):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO GroupMembership (group_id, farmer_id, role)
            VALUES (%s, %s, %s)
            """,
            (group_id, farmer_id, role),
        )


def validate_trip_dates(conn, data):
    try:
        pickup_date = date.fromisoformat(str(data.get("tripDate")))
        delivery_date = date.fromisoformat(str(data.get("deliveryDate")))
    except (TypeError, ValueError):
        return "Pickup and delivery dates must use YYYY-MM-DD format."

    with conn.cursor() as cursor:
        cursor.execute("SELECT CURRENT_DATE")
        current_date = cursor.fetchone()[0]
    minimum_pickup_date = current_date + timedelta(days=3)
    if pickup_date < minimum_pickup_date:
        return "Pickup date must be at least 3 days from today."
    if delivery_date < pickup_date:
        return "Delivery date cannot be before pickup date."
    return ""


def validate_trip_assignment(conn, data, loader_ids):
    vehicle_id = data.get("vehicleId")
    driver_id = data.get("driverId")
    try:
        load_weight = Decimal(str(data.get("loadWeight", 0)))
    except Exception:
        return "Load weight must be a number."

    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT vehicle_id, status, load_capacity, assigned_driver_id
            FROM Vehicle
            WHERE vehicle_id = %s
            """,
            (vehicle_id,),
        )
        vehicle = cursor.fetchone()
        if not vehicle:
            return "Vehicle not found."
        if vehicle["status"] != "available":
            return "Vehicle must be available before trip assignment."
        if load_weight > Decimal(str(vehicle["load_capacity"])):
            return "Trip load exceeds vehicle capacity."
        if vehicle["assigned_driver_id"] and int(vehicle["assigned_driver_id"]) != int(driver_id):
            return "Trip driver must match the vehicle assigned driver."

        cursor.execute(
            "SELECT status FROM Driver WHERE driver_id = %s",
            (driver_id,),
        )
        driver = cursor.fetchone()
        if not driver:
            return "Driver not found."
        if driver["status"] != "active":
            return "Driver must be active before trip assignment."

    conflict = assignment_conflict(conn, data["tripDate"], data["deliveryDate"], driver_id=driver_id)
    if conflict:
        return f"Driver is already assigned to trip #{conflict} during those dates."

    conflict = assignment_conflict(conn, data["tripDate"], data["deliveryDate"], vehicle_id=vehicle_id)
    if conflict:
        return f"Vehicle is already assigned to trip #{conflict} during those dates."

    for loader_id in loader_ids:
        if loader_status_terminated(conn, loader_id):
            return f"Loader {loader_id} is terminated and cannot be assigned."
        conflict = assignment_conflict(conn, data["tripDate"], data["deliveryDate"], loader_id=loader_id)
        if conflict:
            return f"Loader {loader_id} is already assigned to trip #{conflict} during those dates."

    return ""


def loader_status_terminated(conn, loader_id):
    if not table_has_column(conn, "Loader", "status"):
        return False
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT status FROM Loader WHERE loader_id = %s",
            (loader_id,),
        )
        row = cursor.fetchone()
    return bool(row and row[0] == "terminated")


def assignment_conflict(conn, pickup_date, delivery_date, driver_id=None, vehicle_id=None, loader_id=None):
    if loader_id:
        query = """
            SELECT t.trip_id
            FROM Trip t
            JOIN TripLoader tl ON t.trip_id = tl.trip_id
            WHERE tl.loader_id = %s
              AND t.trip_status <> 'cancelled'
              AND NOT (t.delivery_date < %s OR t.trip_date > %s)
            LIMIT 1
        """
        params = (loader_id, pickup_date, delivery_date)
    elif driver_id:
        query = """
            SELECT trip_id
            FROM Trip
            WHERE driver_id = %s
              AND trip_status <> 'cancelled'
              AND NOT (delivery_date < %s OR trip_date > %s)
            LIMIT 1
        """
        params = (driver_id, pickup_date, delivery_date)
    else:
        query = """
            SELECT trip_id
            FROM Trip
            WHERE vehicle_id = %s
              AND trip_status <> 'cancelled'
              AND NOT (delivery_date < %s OR trip_date > %s)
            LIMIT 1
        """
        params = (vehicle_id, pickup_date, delivery_date)

    with conn.cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchone()
    return row[0] if row else None


def trip_status(conn, trip_id):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT trip_status FROM Trip WHERE trip_id = %s",
            (trip_id,),
        )
        row = cursor.fetchone()
    return row[0] if row else None


def validate_trip_status_transition(current_status, next_status):
    if next_status == current_status:
        return ""
    allowed = {
        "scheduled": {"in_progress", "cancelled"},
        "in_progress": {"completed", "cancelled"},
        "completed": set(),
        "cancelled": set(),
    }
    if next_status not in allowed.get(current_status, set()):
        return f"Cannot change trip status from {current_status.replace('_', ' ')} to {next_status.replace('_', ' ')}."
    return ""


def validate_payment(conn, trip_id, amount):
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT trip_id, trip_status, total_cost
            FROM Trip
            WHERE trip_id = %s
            """,
            (trip_id,),
        )
        trip = cursor.fetchone()
        if not trip:
            return "Trip not found."
        if trip["trip_status"] == "cancelled":
            return "Cancelled trips cannot accept payments."

        cursor.execute(
            """
            SELECT COALESCE(SUM(amount_paid), 0) AS paid
            FROM Payment
            WHERE trip_id = %s
            """,
            (trip_id,),
        )
        paid = cursor.fetchone()["paid"] or Decimal("0")

    total = Decimal(str(trip["total_cost"]))
    paid = Decimal(str(paid))
    if paid + amount > total:
        remaining = max(total - paid, Decimal("0"))
        return f"Payment exceeds the remaining balance of {remaining:.2f}."
    return ""


def driver_assigned_to_vehicle(conn, driver_id, vehicle_id):
    if not driver_id:
        return False
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM Vehicle
            WHERE vehicle_id = %s
              AND assigned_driver_id = %s
            """,
            (vehicle_id, driver_id),
        )
        return cursor.fetchone()[0] > 0


def insert_trip(conn, data):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO Trip (
                vehicle_id,
                driver_id,
                customer_farmer_id,
                customer_group_id,
                requested_by_farmer_id,
                origin,
                destination,
                distance_km,
                trip_date,
                delivery_date,
                cargo_type,
                load_weight,
                base_rate,
                transport_cost,
                tax_amount,
                total_cost,
                trip_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, 0, 'scheduled')
            """,
            (
                data["vehicleId"],
                data["driverId"],
                data.get("farmerId"),
                data.get("groupId"),
                data.get("requestedByFarmerId"),
                data["origin"],
                data["destination"],
                data["distanceKm"],
                data["tripDate"],
                data["deliveryDate"],
                data["cargoType"],
                data["loadWeight"],
                data["baseRate"],
            ),
        )
        return cursor.lastrowid


def insert_trip_loaders(conn, trip_id, loader_ids):
    with conn.cursor(dictionary=True) as cursor:
        for loader_id in loader_ids:
            cursor.execute(
                "SELECT payment_rate FROM Loader WHERE loader_id = %s",
                (loader_id,),
            )
            loader = cursor.fetchone()
            if not loader:
                raise Error(f"Loader {loader_id} does not exist")
            cursor.execute(
                """
                INSERT INTO TripLoader (trip_id, loader_id, payment_amount)
                VALUES (%s, %s, %s)
                """,
                (trip_id, loader_id, loader["payment_rate"]),
            )


def insert_trip_review(conn, farmer_id, data, target_type, rating):
    trip_id = data["tripId"]
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT trip_id, customer_farmer_id, driver_id, trip_date, trip_status
            FROM Trip
            WHERE trip_id = %s
            """,
            (trip_id,),
        )
        trip = cursor.fetchone()
        if not trip or trip["customer_farmer_id"] != farmer_id:
            raise Error("Farmers can only review their own trips.")
        if str(trip["trip_status"]) != "completed":
            cursor.execute("SELECT CURRENT_DATE AS today")
            today = cursor.fetchone()["today"]
            if trip["trip_date"] > today:
                raise Error("Only completed or past trips can be reviewed.")

        driver_id = None
        loader_id = None
        if target_type == "driver":
            driver_id = trip["driver_id"]
        else:
            loader_id = data.get("loaderId")
            if not loader_id:
                raise Error("Choose a loader to review.")
            cursor.execute(
                """
                SELECT COUNT(*) AS assigned
                FROM TripLoader
                WHERE trip_id = %s AND loader_id = %s
                """,
                (trip_id, loader_id),
            )
            if cursor.fetchone()["assigned"] == 0:
                raise Error("That loader was not assigned to this trip.")

        cursor.execute(
            """
            SELECT COUNT(*) AS existing_reviews
            FROM TripReview
            WHERE trip_id = %s
              AND farmer_id = %s
              AND target_type = %s
              AND (
                  (target_type = 'driver' AND driver_id = %s)
                  OR (target_type = 'loader' AND loader_id = %s)
              )
            """,
            (trip_id, farmer_id, target_type, driver_id, loader_id),
        )
        if cursor.fetchone()["existing_reviews"] > 0:
            raise Error("You already reviewed that person for this trip.")

        cursor.execute(
            """
            INSERT INTO TripReview (
                trip_id,
                farmer_id,
                target_type,
                driver_id,
                loader_id,
                rating,
                comment
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                trip_id,
                farmer_id,
                target_type,
                driver_id,
                loader_id,
                rating,
                (data.get("comment") or "").strip() or None,
            ),
        )
        return cursor.lastrowid


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=int(os.getenv("PORT", "5001")))
