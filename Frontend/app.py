import os
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
            "vehicleId",
            "driverId",
            "origin",
            "destination",
            "distanceKm",
            "tripDate",
            "cargoType",
            "loadWeight",
            "loaders",
        ]
        missing = [field for field in required if field not in data]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        farmer_id = data.get("farmerId")
        group_id = data.get("groupId")
        loaders = data.get("loaders") or []
        data["baseRate"] = BASE_RATE

        if bool(farmer_id) == bool(group_id):
            return jsonify({"error": "Trip must use exactly one customer source."}), 400
        if request.user["role"] == "farmer" and farmer_id != request.user.get("farmerId"):
            return jsonify({"error": "Farmer accounts can only request trips for their own farmer profile."}), 403
        if not loaders:
            return jsonify({"error": "A trip must have at least one loader before completion."}), 400

        try:
            with get_connection() as conn:
                conn.start_transaction()
                try:
                    if group_id and group_member_count(conn, group_id) < 5:
                        conn.rollback()
                        return jsonify({"error": "A farmer group needs at least 5 members before requesting a trip."}), 400

                    trip_id = insert_trip(conn, data)
                    insert_trip_loaders(conn, trip_id, loaders)
                    conn.commit()
                except Error as exc:
                    conn.rollback()
                    return jsonify({"error": str(exc)}), 400

                return jsonify({"tripId": trip_id, "state": load_bootstrap(conn, request.user)}), 201
        except Error as exc:
            return jsonify({"error": str(exc)}), 500

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


def load_bootstrap(conn, user=None):
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
               GROUP_CONCAT(gm.farmer_id ORDER BY gm.farmer_id) AS member_ids
        FROM FarmerGroup fg
        LEFT JOIN GroupMembership gm ON fg.group_id = gm.group_id
        GROUP BY fg.group_id, fg.group_name, fg.region
        ORDER BY fg.group_id
        """,
    )
    for group in groups:
        group["members"] = parse_id_list(group.pop("member_ids"))

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

    loaders = fetch_all(
        conn,
        """
        SELECT loader_id AS id,
               CONCAT(first_name, ' ', last_name) AS name,
               payment_rate AS rate
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
               COALESCE(CONCAT(f.first_name, ' ', f.last_name), fg.group_name) AS customerName,
               t.origin,
               t.destination,
               t.distance_km AS distanceKm,
               DATE_FORMAT(t.trip_date, '%Y-%m-%d') AS tripDate,
               t.cargo_type AS cargoType,
               t.load_weight AS loadWeight,
               t.base_rate AS baseRate,
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
        return state

    if user.get("role") == "accountant":
        return {
            **state,
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
        "farmers": [farmer for farmer in state["farmers"] if farmer["id"] == farmer_id],
        "groups": farmer_groups,
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


def group_member_count(conn, group_id):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM GroupMembership WHERE group_id = %s",
            (group_id,),
        )
        return cursor.fetchone()[0]


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
                origin,
                destination,
                distance_km,
                trip_date,
                cargo_type,
                load_weight,
                base_rate,
                transport_cost,
                tax_amount,
                total_cost,
                trip_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, 0, 'scheduled')
            """,
            (
                data["vehicleId"],
                data["driverId"],
                data.get("farmerId"),
                data.get("groupId"),
                data["origin"],
                data["destination"],
                data["distanceKm"],
                data["tripDate"],
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
