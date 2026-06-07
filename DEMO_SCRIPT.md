# Demo Script - Movers Transport System

A recommended ~10-minute walkthrough for a database class final presentation.
The goal is to show the schema, relationships, role-based access, CRUD flows,
and the database-enforced business rules (triggers).

---

## 0. Before the demo (setup, ~2 min, do this BEFORE you present)

1. Make sure the MySQL database is loaded. From a clean database, run the
   scripts in this exact order (order matters):

   ```bash
   mysql -h <host> -P <port> -u <user> -p < database/schema.sql
   mysql -h <host> -P <port> -u <user> -p < database/seed.sql       # seed BEFORE triggers
   mysql -h <host> -P <port> -u <user> -p < database/triggers.sql    # triggers LAST
   ```

   Seed must load **before** triggers because the trip triggers reject pickup
   dates earlier than 3 days from today, and the sample data contains
   historical trips.

2. Confirm `Frontend/.env` has the correct database credentials.
3. Start the app:

   ```bash
   cd Frontend
   pip install flask python-dotenv mysql-connector-python   # first time only
   python app.py
   ```

4. Open `http://127.0.0.1:5001` and confirm `http://127.0.0.1:5001/api/health`
   returns OK. The sidebar "Connected" indicator should be green.

### Test accounts (password for every `test.*` account is `password123`)

| Username          | Role          |
| ----------------- | ------------- |
| `test.admin`      | System admin  |
| `test.ops`        | Ops manager   |
| `test.accountant` | Accountant    |
| `test.hr`         | HR manager    |
| `test.driver`     | Driver        |
| `test.farmer`     | Farmer        |

---

## 1. Project intro (1 min)

- Log in as **`test.admin` / `password123`**.
- Point to the dashboard banner: this is a Flask + MySQL transport management
  system for agricultural cargo.
- Name the core entities: **Farmers, Farmer Groups, Drivers, Loaders, Vehicles,
  Trips, Payments, Offences, Reviews** — and mention they map directly to the
  tables in `database/schema.sql`.

## 2. Read / browse data (1.5 min)

- Open **Trips** and show the trip table: customer, route, status, cost, payment.
- Open a trip's detail and highlight the **Transport / Tax / Total** box.
  Note the line under it: *"Calculated and stored by the database (source of
  truth)."* These values come from the `trips_before_insert_rules` trigger.
- Open **Fleet** and **Farmers** to show related entities.

## 3. Create (CRUD - C) (2 min)

- Go to **New trip**.
- Pick a **large-scale farmer** (e.g. Amina Mensah), an available vehicle
  (MV-1001), the assigned driver, a pickup date **at least 3 days out**, and at
  least one loader (note the loader hint).
- Watch the **cost preview** update live (this is the front-end *estimate*).
- Submit. The trip is saved and the table now shows the **database-calculated**
  total (which matches because both use the same formula: base_rate x distance x
  weight, plus 20% tax).

## 4. Update + business rules via triggers (2 min)

- Open a **scheduled** trip and use **Status actions** to move it to
  *in progress*. Show the vehicle status flipping to `in_transit`
  (trigger `trips_after_update_vehicle_status`).
- Try to **cancel** a trip to show the confirmation dialog and the status badge
  changing.
- Talk through one or two enforced rules (good "wow" moments):
  - Trip load cannot exceed vehicle capacity.
  - Pickup date must be at least 3 days out.
  - Driver discipline: 3 surcharge offences -> warning, then suspension, then
    termination (trigger `offences_after_insert_discipline_policy`).

## 5. Role-based views (1.5 min)

- Log out, log in as **`test.accountant`** -> show receivables / payment focus.
- Log in as **`test.driver`** -> driver portal: assigned trips, vehicle, and
  discipline history.
- Log in as **`test.farmer`** -> farmer portal: their trips, payments, and the
  **review form**.

## 6. Reviews (closing, 0.5 min)

- As `test.farmer`, submit a **driver review** on a past individual trip.
- Mention the note on the form: *"Reviews are currently available for individual
  farmer trips only."* (Group-trip reviews are intentionally scoped out.)

---

## Stable features to demo live

- Login with any test account / role-based dashboards
- Browsing trips, fleet, farmers
- Creating a trip (with the 3-days-out, capacity, and loader rules)
- Trip status transitions and the vehicle-status trigger
- Recording a payment and seeing the balance update
- Submitting a review for an individual farmer trip
- Database-calculated cost shown as source of truth

## Features to avoid live-demoing unless seed data supports it

- **Driver termination chain**: needs a driver already at the warning/suspension
  stage. Explain it with the existing offence records rather than triggering a
  full termination live.
- **Group-trip requests**: require a group with >= 5 members and the request to
  come from the group **chair**. The seed group "Riverbend Growers" supports
  this, but it is finicky to set up live — describe it instead of building it.
- **Group-trip reviews**: not supported (form is blocked by design).
- **Editing master data** (drivers, loaders, vehicles): there is no full
  edit/delete UI by design — present these as read + create only.
- **Empty tables** (e.g. payments before you record one) — record one first so
  the screen is not empty during the recording.
