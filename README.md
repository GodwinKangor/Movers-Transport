# Movers Transport System

Movers Transport System is a Flask and MySQL web application for managing agricultural transport operations. It provides a role-based operations console for trip scheduling, fleet visibility, farmer customers, payroll-oriented summaries, driver discipline records, maintenance entries, and farmer trip reviews.

The project was built as a CS 61 database project and lives in the `Frontend/` directory.

## Features

- Role-based login for system admins, operations managers, accountants, HR managers, drivers, and farmers
- Farmer self-signup with automatic account creation
- Trip scheduling for large-scale individual farmers and eligible farmer groups
- Group trip requests limited to the group's chair
- Pickup and delivery date tracking with a minimum three-day pickup buffer
- Automatic transport cost, tax, and balance calculations
- Fleet dashboard with vehicle capacity, fuel, maintenance, and assigned driver information
- Farmer directory and group eligibility checks
- Driver portal for assignments, assigned vehicle, service records, and discipline history
- HR dashboard for driver status, offences, warnings, suspensions, and trip reviews
- Farmer portal for profile details, trip requests, payments, and driver/loader reviews
- Flask API backed by MySQL, with browser-side demo data used as a fallback shape for the UI
- MySQL trigger-backed rules for trip costs, trip status transitions, vehicle status changes, group trip rules, and driver discipline

## Project Structure

```text
Frontend/
├── app.py                         # Flask app, API routes, auth, and MySQL queries
├── frontend.html                  # Main single-page application markup
├── frontend_app.js                # UI state, rendering, validation, and API calls
├── frontend_styles.css            # Application styling
├── account_test_credentials.txt   # Demo/test login accounts
├── .env                           # Local environment variables, not committed
└── Project Plan.pdf               # Project planning document
```

Additional project notes:

```text
BUSINESS_RULES_TODO.md             # Remaining business rules and recommended order
CHANGES_MADE.md                    # Summary of completed rule/app changes
```

## Requirements

- Python 3.10+
- MySQL Server
- A MySQL database with the application tables created

Python packages:

```bash
pip install flask python-dotenv mysql-connector-python
```

## Configuration

Create `Frontend/.env` with your local database and app settings:

```env
MOVERS_DB_HOST=127.0.0.1
MOVERS_DB_PORT=3306
MOVERS_DB_USER=root
MOVERS_DB_PASSWORD=your_mysql_password
MOVERS_DB_NAME=movers_transport

MOVERS_SECRET_KEY=change-this-to-a-long-random-secret
MOVERS_TOKEN_MAX_AGE_SECONDS=28800
MOVERS_BASE_RATE=0.75

MOVERS_DEMO_USERNAME=admin
MOVERS_DEMO_PASSWORD=password
PORT=5001
```

The Flask app expects tables such as `AppUser`, `Farmer`, `FarmerGroup`, `GroupMembership`, `Driver`, `Loader`, `Vehicle`, `Trip`, `TripLoader`, `Payment`, `FuelRecord`, `ServiceRecord`, `Offence`, `WarningLetter`, `Suspension`, and `TripReview`.

The current app also expects `Trip` to include `requested_by_farmer_id` and `delivery_date`, and expects MySQL triggers to enforce core business rules.

## Running Locally

From the repository root:

```bash
cd Frontend
python app.py
```

Then open:

```text
http://127.0.0.1:5001
```

You can also check API/database connectivity at:

```text
http://127.0.0.1:5001/api/health
```

## Test Accounts

Demo account details are listed in:

```text
Frontend/account_test_credentials.txt
```

Use the matching role in the login form's role dropdown when signing in. These credentials are for class-project/demo use only and should not be used in production.

If the database has no users yet, `app.py` can create a default demo system admin when the configured `MOVERS_DEMO_USERNAME` and `MOVERS_DEMO_PASSWORD` are used.

## Main API Routes

- `GET /api/health` checks MySQL connectivity
- `POST /api/login` authenticates a user and returns a signed session token
- `POST /api/signup/farmer` creates a farmer profile and login
- `GET /api/me` returns the authenticated user
- `GET /api/bootstrap` loads role-filtered application data
- `POST /api/trips` creates a trip request
- `POST /api/offences` records a driver offence
- `PATCH /api/offences/<id>` updates an offence
- `POST /api/service-records` creates a maintenance record
- `POST /api/reviews` creates a farmer review for a driver or loader

## Business Rules

- Large-scale farmers can request individual trips.
- Small-scale farmers must request trips through farmer groups.
- Farmer groups must have at least five members before requesting transport.
- Only a farmer group's `chair` can request transport for that group.
- Trips require exactly one customer source: either one farmer or one group.
- Trips require a pickup date at least three days from the database server's current date.
- Delivery date cannot be before pickup date.
- Trips require one vehicle, one active driver, and at least one loader.
- Vehicles must be `available` before trip assignment.
- Trip costs are calculated by database trigger from base rate, distance, load weight, and tax.
- Trip status follows `scheduled -> in_progress -> completed` or cancellation paths.
- `completed` and `cancelled` trips are final.
- Vehicle status becomes `in_transit` when a trip is in progress and `available` when completed or cancelled.
- Driver discipline is trigger-backed: surcharge offences can create warnings, suspensions, and termination.
- Terminated driver accounts cannot log in.

## Role Access

- `system_admin`: full dashboard, trips, fleet, farmers, and discipline access
- `ops_manager`: operations-focused access to trips, fleet, farmers, and discipline
- `accountant`: dashboard, trips, fleet, payroll-style summaries, and balances
- `hr_manager`: HR dashboard and discipline management
- `driver`: assigned trips, assigned vehicle, service records, and discipline history
- `farmer`: own profile, trip requests, payments, and trip reviews

## Notes

- Do not commit `Frontend/.env`; it may contain database passwords and app secrets.
- The frontend should be opened through Flask at `http://127.0.0.1:5001`, not directly from `frontend.html`, so API calls can reach the backend.
- No SQL schema or seed script is currently included in the repository, so the MySQL database must be prepared separately before the full API-backed app can run.
