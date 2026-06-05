# Changes Made

This document summarizes the main project changes made after the initial README was created.

## Documentation

- Added `README.md` with setup, configuration, routes, role access, and project structure.
- Added `BUSINESS_RULES_TODO.md` to track remaining business rules and recommended implementation order.
- Added this `CHANGES_MADE.md` file to summarize completed work.

## Driver Discipline and Access

- Added a MySQL discipline trigger workflow for offence inserts:
  - third surcharge offence creates a warning
  - offence after warning creates a suspension
  - second suspension within six months terminates the driver
- Fixed the warning trigger table mismatch from `WarningLetters` to `WarningLetter`.
- Added backend login protection for terminated drivers.
- Added authenticated-request protection so a terminated driver is logged out on the next API request.
- Verified the discipline trigger with rollback-only database tests.

## Farmer Group Trip Rules

- Added support for group roles from `GroupMembership.role`.
- Added `chairId` and `memberRoles` to group data returned from `/api/bootstrap`.
- Added `Trip.requested_by_farmer_id` support in the backend.
- Enforced that small-scale farmers cannot request individual trips.
- Enforced that group trips must be requested by the group chair.
- Kept regular group members able to view their group trips.
- Updated the frontend trip form:
  - large-scale farmers can request individual trips
  - small-scale chair farmers can request group trips
  - non-chair group members cannot request group trips
- Verified chair/member behavior through Flask API tests and rollback-only MySQL tests.

## Pickup and Delivery Dates

- Added `deliveryDate` support in `app.py` and frontend state.
- Added pickup and delivery date inputs to the trip form.
- Replaced the old single "Trip date" label with "Pickup date".
- Added frontend validation:
  - pickup date must be at least three days from today
  - delivery date cannot be before pickup date
- Added backend validation using MySQL `CURRENT_DATE` so Flask and database triggers use the same clock.
- Updated trip lists/details to display pickup and delivery date ranges.
- Replaced the hardcoded frontend date with the browser's current date.

## Trip Status and Vehicle Status Rules

- Added a MySQL trip status lifecycle trigger:
  - `scheduled` can move to `in_progress` or `cancelled`
  - `in_progress` can move to `completed` or `cancelled`
  - `completed` and `cancelled` are final
- Added a MySQL trigger that updates vehicle status when trip status changes:
  - `in_progress` sets vehicle status to `in_transit`
  - `completed` or `cancelled` sets vehicle status to `available`
- Fixed the frontend trip status filter value from `in_transit` to `in_progress`.
- Verified the lifecycle and vehicle status triggers with rollback-only tests.

## Validation and Testing

- Ran Python syntax checks with `python -m py_compile Frontend/app.py`.
- Ran JavaScript syntax checks with `node --check Frontend/frontend_app.js`.
- Used rollback-only MySQL tests for trigger behavior so test data was not kept.
- Verified `/api/health`, login, bootstrap, trip validation, and business-rule rejection paths.

## Database Changes Required

The current app expects these database updates to exist:

- `Trip.requested_by_farmer_id`
- `Trip.delivery_date`
- updated trip insert/update triggers
- trip vehicle-status update trigger
- offence discipline trigger

The app depends on MySQL triggers as the final source of truth for core business rules, with Flask and frontend validation providing clearer user-facing errors.
