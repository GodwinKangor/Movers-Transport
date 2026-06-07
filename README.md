# Movers Transport System

This is our CS 61 database project. It's a Flask + MySQL web app for managing
agricultural transport: scheduling trips, tracking vehicles and drivers, handling
farmer customers, payments, and driver discipline. The app code lives in the
`Frontend/` directory and the SQL files are in `database/`.

## What it does

- Role-based login for system admins, ops managers, accountants, HR managers, drivers, and farmers
- Farmers can sign up themselves; small-scale farmers join or start a group
- Trip scheduling with cost, tax, and balance calculated automatically
- Fleet view with vehicle capacity, fuel, and maintenance info
- Driver portal for assignments, vehicle, service records, and discipline history
- HR view for offences, warnings, and suspensions
- Payments (including partial payments) and farmer reviews of drivers/loaders

Most of the rules are enforced in MySQL with triggers (see below).

## Main business rules

- Large-scale farmers request trips on their own; small-scale farmers go through a group
- A group needs at least 5 members, and only the group chair can request a trip
- Pickup date must be at least 3 days out, and delivery can't be before pickup
- A trip needs one vehicle, one active driver, and at least one loader
- Vehicles must be `available`, and nothing can be double-booked on overlapping dates
- Trip cost is computed by trigger from base rate, distance, weight, and tax
- Status goes `scheduled -> in_progress -> completed` (or cancelled); completed/cancelled are final
- Vehicle status flips to `in_transit` during a trip and back to `available` after
- Payments can't exceed the remaining balance and can't be made on cancelled trips
- Driver offences can lead to warnings, suspension, or termination; terminated drivers can't log in

## Database setup

The SQL files are in `database/`. Load them into MySQL **in this order**:

1. `schema.sql` — tables and views
2. `seed.sql` — sample data
3. `triggers.sql` — business-rule triggers

Order matters: the trip triggers reject pickup dates less than 3 days from today,
so the historical sample data has to be loaded *before* the triggers.

## Running the app locally

Requirements: Python 3.10+ and a running MySQL server.

Install the Python packages:

```bash
pip install flask python-dotenv mysql-connector-python
```

Create `Frontend/.env` with your database settings:

```env
MOVERS_DB_HOST=127.0.0.1
MOVERS_DB_PORT=3306
MOVERS_DB_USER=root
MOVERS_DB_PASSWORD=your_mysql_password
MOVERS_DB_NAME=movers_transport

MOVERS_SECRET_KEY=change-this-to-a-long-random-secret
MOVERS_BASE_RATE=0.75

MOVERS_DEMO_USERNAME=admin
MOVERS_DEMO_PASSWORD=password
PORT=5001
```

**Do not commit `Frontend/.env`** — it has the database password and app secret.

Then run:

```bash
cd Frontend
python app.py
```

Open http://127.0.0.1:5001 in a browser. (Open it through Flask, not by opening
`frontend.html` directly, or the API calls won't work.) You can check the database
connection at http://127.0.0.1:5001/api/health.

## Test accounts

Demo login details are in `Frontend/account_test_credentials.txt`. Pick the matching
role in the login form's dropdown when signing in. These are for the class demo only.

If the database has no users yet, `app.py` can create a default admin using the
`MOVERS_DEMO_USERNAME` / `MOVERS_DEMO_PASSWORD` values from the `.env`.
