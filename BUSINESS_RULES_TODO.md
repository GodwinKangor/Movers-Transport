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

Implemented:

- `app.py`: added `PATCH /api/trips/<trip_id>/status`
- `app.py`: restricted status changes to `system_admin` and `ops_manager`
- frontend: added status action buttons in trip detail for admin/ops
- frontend: farmer, driver, accountant, and HR status remains read-only

## 2. Payment Rules

Resolved scope:

- Customers can make partial payments.
- Customers cannot overpay.
- Payment is not required before trip completion.
- Payments can be recorded by `accountant`, `system_admin`, and `ops_manager`.
- Cancelled trips cannot accept payments.

Implemented:

- `app.py`: added `POST /api/payments`
- `app.py`: blocks overpayments and payments on cancelled trips before insert
- `app.py`: restricts payment recording to `accountant`, `system_admin`, and `ops_manager`
- frontend: added payment form in trip detail for allowed roles
- frontend: shows payment status as unpaid, partial, or paid; overpayment is blocked before submit

## 3. Scheduling Conflicts

Resolved scope:

- A driver, vehicle, or loader cannot be assigned to more than one non-cancelled trip whose pickup/delivery date ranges overlap.

Implemented:

- `app.py`: added friendly pre-checks before insert
- frontend: filter unavailable vehicles, drivers, and loaders after pickup/delivery date selection
- frontend: rule checks flag overlapping driver, vehicle, or loader assignments

## Small-Scale Farmer Group Onboarding

Resolved scope:

- Small-scale farmers cannot request individual trips.
- Small-scale farmers can join an existing farmer group directly.
- Small-scale farmers can create a new farmer group and become its chair.
- A small-scale farmer can only request transport when they chair a group with at least 5 members.

Implemented:

- `app.py`: added `POST /api/groups`
- `app.py`: added `POST /api/groups/<group_id>/join`
- `app.py`: restricts group onboarding actions to small-scale farmer accounts
- frontend: added group onboarding panel in the farmer portal
- frontend: disables trip creation unless the farmer is large-scale or chairs an eligible group

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
- Current app behavior matches this scope through available-vehicle filtering and backend assignment checks.

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
- Current app behavior matches this scope.

## 6. Admin User Management

The project plan mentions system admin user/role management, but the app currently has:

- login
- farmer signup
- demo/admin account support

Implemented:

- frontend: system-admin-only user list
- frontend: create staff user form
- frontend: role assignment control for staff accounts
- `app.py`: added `POST /api/users/staff`
- `app.py`: added `PATCH /api/users/<user_id>/role`
- `app.py`: keeps farmer-linked and driver-linked accounts out of staff role reassignment

Still recommended at database level:

- MySQL constraints for valid roles and unique usernames.
