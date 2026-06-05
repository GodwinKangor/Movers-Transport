# Remaining Business Rules

This document tracks the larger business rules that are not fully implemented yet, plus where each rule should be enforced.

## Recommended Order

1. Status update API and UI
2. Payment rules and payment recording
3. Scheduling conflict rules
4. Maintenance and fuel workflow details
5. Offence editing/recalculation policy
6. Admin user management

## 1. Status Update API and UI

The MySQL trigger already enforces the trip status lifecycle:

- `scheduled` can move to `in_progress` or `cancelled`
- `in_progress` can move to `completed` or `cancelled`
- `completed` and `cancelled` are final
- vehicle status changes when a trip moves to `in_progress`, `completed`, or `cancelled`

Still needed:

- `app.py`: add `PATCH /api/trips/<trip_id>/status`
- `app.py`: restrict status changes to `system_admin` and `ops_manager`
- frontend: add status action buttons in trip detail for admin/ops
- frontend: keep farmer, driver, accountant, and HR status read-only

## 2. Payment Rules

Rules to clarify:

- Can customers make partial payments?
- Can customers overpay?
- Should payment be required before trip completion?
- Who records payments: accountant only, or admin/ops too?
- Should cancelled trips allow payments?

Recommended enforcement:

- MySQL trigger: block overpayments
- MySQL trigger: block payments on cancelled trips
- `app.py`: add `POST /api/payments`
- `app.py`: restrict payment recording to `accountant`, `system_admin`, and maybe `ops_manager`
- frontend: add accountant payment form
- frontend: show payment status clearly as unpaid, partial, paid, or overpaid-blocked

## 3. Scheduling Conflicts

Rules to clarify:

- Can one driver have more than one active trip on the same pickup date?
- Can one vehicle have more than one active trip on the same pickup date?
- Can one loader have more than one active trip on the same pickup date?
- Should conflicts use only pickup date, or pickup and delivery date range?

Recommended simple rule:

- A driver, vehicle, or loader cannot be assigned to more than one non-cancelled trip whose pickup/delivery date ranges overlap.

Recommended enforcement:

- MySQL trigger on `Trip`: block overlapping driver and vehicle assignments
- MySQL trigger on `TripLoader`: block overlapping loader assignments
- `app.py`: add friendly pre-checks before insert
- frontend: filter unavailable vehicles, drivers, and loaders after pickup/delivery date selection

## 4. Maintenance and Fuel Workflow

Already enforced:

- vehicles must be `available` before trip assignment
- completed and cancelled trips make the vehicle `available`
- in-progress trips make the vehicle `in_transit`

Rules to clarify:

- Should a completed trip make the vehicle `available` immediately, or should it become `under_maintenance` first?
- Should a fuel or maintenance record be required before the vehicle can be reused?
- Who can mark a vehicle as `fueling`, `under_maintenance`, or `available`?
- Can drivers record service while suspended?

Recommended scope for now:

- Keep completed trips returning vehicles to `available`
- Treat `fueling`, `under_maintenance`, `out_of_service`, and `retired` as unavailable for trip assignment
- Add a future maintenance-status workflow only if required for the project demo

## 5. Offence Editing and Recalculation

Already enforced:

- offence insert can create warnings, suspensions, and termination
- terminated drivers cannot log in
- suspended drivers are not assignable to trips

Rules to clarify:

- If HR edits an offence surcharge, should warnings/suspensions be recalculated?
- If an offence is deleted, should warnings/suspensions be undone?
- Should discipline actions be permanent once issued?

Recommended rule:

- Offence edits do not retroactively undo warnings, suspensions, or terminations.
- Discipline actions remain historical records.

Recommended enforcement:

- Keep the current insert-based trigger model
- In `app.py`, only allow HR/admin to edit offence details
- Do not add delete/undo behavior unless the project specifically requires it

## 6. Admin User Management

The project plan mentions system admin user/role management, but the app currently has:

- login
- farmer signup
- demo/admin account support

Still needed if required:

- frontend: admin user list
- frontend: create staff user form
- frontend: role assignment form
- `app.py`: staff user creation endpoint
- `app.py`: role update endpoint
- MySQL constraints: valid roles and unique usernames

Recommended priority:

- Lower priority than status, payments, and scheduling conflicts.
- Add only if the project rubric explicitly expects admin user management.
