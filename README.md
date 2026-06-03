# Movers Transport System

Movers Transport System is a Flask and MySQL web application for managing agricultural transport operations. It provides a role-based operations console for trip scheduling, fleet visibility, farmer customers, payroll-oriented summaries, driver discipline records, maintenance entries, and farmer trip reviews.

The project was built as a CS 61 database project and lives in the `Frontend/` directory.

## Features

- Role-based login for system admins, operations managers, accountants, HR managers, drivers, and farmers
- Farmer self-signup with automatic account creation
- Trip scheduling for individual farmers or eligible farmer groups
- Automatic transport cost, tax, and balance calculations
- Fleet dashboard with vehicle capacity, fuel, maintenance, and assigned driver information
- Farmer directory and group eligibility checks
- Driver portal for assignments, assigned vehicle, service records, and discipline history
- HR dashboard for driver status, offences, warnings, suspensions, and trip reviews
- Farmer portal for profile details, trip requests, payments, and driver/loader reviews
- Flask API backed by MySQL, with browser-side demo data used as a fallback shape for the UI

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
