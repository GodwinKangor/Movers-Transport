-- Movers Transport System - Business-Rule Triggers
-- ------------------------------------------------------------------
-- These triggers enforce the core business rules in the database
-- layer (cost calculation, status transitions, vehicle state,
-- group-trip eligibility, and driver discipline).
--
-- IMPORTANT load order:
--   Run this file LAST, AFTER schema.sql and seed.sql.
--   The trip triggers reject pickup dates earlier than 3 days from
--   today, so loading historical sample data with the triggers in
--   place would fail. Always seed first, then create triggers.
-- ------------------------------------------------------------------

USE movers_transport;

DROP TRIGGER IF EXISTS `driver_after_update_suspend_vehicle`;
DROP TRIGGER IF EXISTS `group_memberships_before_insert_small_farmers`;
DROP TRIGGER IF EXISTS `offences_after_insert_discipline_policy`;
DROP TRIGGER IF EXISTS `trips_before_insert_rules`;
DROP TRIGGER IF EXISTS `trips_before_update_rules`;
DROP TRIGGER IF EXISTS `trips_after_update_vehicle_status`;
DROP TRIGGER IF EXISTS `trips_after_insert_audit`;
DROP TRIGGER IF EXISTS `trips_after_update_audit`;
DROP TRIGGER IF EXISTS `payments_after_insert_audit`;
DROP TRIGGER IF EXISTS `trip_loaders_after_delete_audit`;

DELIMITER $$

-- Free a vehicle when its driver is suspended.
CREATE TRIGGER `driver_after_update_suspend_vehicle`
AFTER UPDATE ON `Driver`
FOR EACH ROW
BEGIN
    IF NEW.status = 'suspended' AND OLD.status <> 'suspended' THEN
        UPDATE Vehicle
        SET assigned_driver_id = NULL,
            status = 'available'
        WHERE assigned_driver_id = NEW.driver_id;
    END IF;
END$$

-- Only small-scale farmers may join farmer groups.
CREATE TRIGGER `group_memberships_before_insert_small_farmers`
BEFORE INSERT ON `GroupMembership`
FOR EACH ROW
BEGIN
    DECLARE new_farmer_type VARCHAR(40);

    SELECT farmer_type
    INTO new_farmer_type
    FROM Farmer
    WHERE farmer_id = NEW.farmer_id;

    IF new_farmer_type <> 'small_scale' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only small-scale farmers may join farmer groups';
    END IF;
END$$

-- Driver discipline policy: 3 surcharge offences -> warning;
-- offence after warning -> suspension; 2+ suspensions in 6 months -> termination.
CREATE TRIGGER `offences_after_insert_discipline_policy`
AFTER INSERT ON `Offence`
FOR EACH ROW
BEGIN
    DECLARE surcharge_count INT DEFAULT 0;
    DECLARE existing_warning_count INT DEFAULT 0;
    DECLARE recent_suspension_count INT DEFAULT 0;
    DECLARE current_driver_status VARCHAR(40);

    SELECT status
    INTO current_driver_status
    FROM Driver
    WHERE driver_id = NEW.driver_id;

    IF current_driver_status <> 'terminated' THEN

        SELECT COUNT(*)
        INTO existing_warning_count
        FROM WarningLetter
        WHERE driver_id = NEW.driver_id;

        SELECT COUNT(*)
        INTO surcharge_count
        FROM Offence
        WHERE driver_id = NEW.driver_id
          AND surcharge_amount > 0;

        IF existing_warning_count = 0 AND surcharge_count >= 3 THEN
            INSERT INTO WarningLetter (driver_id, issue_date, reason)
            VALUES (
                NEW.driver_id,
                NEW.offence_date,
                'Automatic warning: 3 surcharge offences'
            );

        ELSEIF existing_warning_count > 0 THEN
            INSERT INTO Suspension (driver_id, start_date, end_date, reason)
            VALUES (
                NEW.driver_id,
                NEW.offence_date,
                DATE_ADD(NEW.offence_date, INTERVAL 14 DAY),
                'Automatic suspension: offence after warning'
            );

            SELECT COUNT(*)
            INTO recent_suspension_count
            FROM Suspension
            WHERE driver_id = NEW.driver_id
              AND start_date >= DATE_SUB(NEW.offence_date, INTERVAL 6 MONTH)
              AND start_date <= NEW.offence_date;

            IF recent_suspension_count >= 2 THEN
                UPDATE Driver
                SET status = 'terminated'
                WHERE driver_id = NEW.driver_id;
            ELSE
                UPDATE Driver
                SET status = 'suspended'
                WHERE driver_id = NEW.driver_id;
            END IF;
        END IF;
    END IF;
END$$

-- Validate a new trip and calculate its cost (transport, tax, total).
CREATE TRIGGER `trips_before_insert_rules`
BEFORE INSERT ON `Trip`
FOR EACH ROW
BEGIN
    DECLARE vehicle_capacity DECIMAL(10,2);
    DECLARE vehicle_status VARCHAR(40);
    DECLARE assigned_driver INT;
    DECLARE driver_status VARCHAR(40);
    DECLARE customer_farmer_type VARCHAR(40);
    DECLARE group_member_total INT DEFAULT 0;
    DECLARE chair_match_count INT DEFAULT 0;

    IF NEW.trip_date < DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pickup date must be at least 3 days from today';
    END IF;

    IF NEW.delivery_date < NEW.trip_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Delivery date cannot be before pickup date';
    END IF;

    IF (NEW.customer_farmer_id IS NULL AND NEW.customer_group_id IS NULL)
       OR (NEW.customer_farmer_id IS NOT NULL AND NEW.customer_group_id IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trip must use exactly one customer source';
    END IF;

    IF NEW.customer_farmer_id IS NOT NULL THEN
        SELECT farmer_type
        INTO customer_farmer_type
        FROM Farmer
        WHERE farmer_id = NEW.customer_farmer_id;

        IF customer_farmer_type <> 'large_scale' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Small-scale farmers must request transport through a farmer group';
        END IF;
    END IF;

    IF NEW.customer_group_id IS NOT NULL THEN
        IF NEW.requested_by_farmer_id IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Group trips must be requested by the group chair';
        END IF;

        SELECT COUNT(*)
        INTO group_member_total
        FROM GroupMembership
        WHERE group_id = NEW.customer_group_id;

        IF group_member_total < 5 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A farmer group needs at least 5 members before requesting a trip';
        END IF;

        SELECT COUNT(*)
        INTO chair_match_count
        FROM GroupMembership
        WHERE group_id = NEW.customer_group_id
          AND farmer_id = NEW.requested_by_farmer_id
          AND role = 'chair';

        IF chair_match_count = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Only the group chair can request transport for a farmer group';
        END IF;
    END IF;

    SELECT load_capacity, status, assigned_driver_id
    INTO vehicle_capacity, vehicle_status, assigned_driver
    FROM Vehicle
    WHERE vehicle_id = NEW.vehicle_id;

    SELECT status
    INTO driver_status
    FROM Driver
    WHERE driver_id = NEW.driver_id;

    IF NEW.load_weight > vehicle_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trip load exceeds vehicle capacity';
    END IF;

    IF vehicle_status <> 'available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Vehicle must be available before trip assignment';
    END IF;

    IF driver_status <> 'active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Driver must be active before trip assignment';
    END IF;

    IF assigned_driver IS NOT NULL AND assigned_driver <> NEW.driver_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trip driver must match the vehicle assigned driver';
    END IF;

    SET NEW.transport_cost = ROUND(NEW.base_rate * NEW.distance_km * NEW.load_weight, 2);
    SET NEW.tax_amount = ROUND(NEW.transport_cost * 0.20, 2);
    SET NEW.total_cost = ROUND(NEW.transport_cost + NEW.tax_amount, 2);
END$$

-- Validate trip status transitions and recompute cost on update.
CREATE TRIGGER `trips_before_update_rules`
BEFORE UPDATE ON `Trip`
FOR EACH ROW
BEGIN
    DECLARE vehicle_capacity DECIMAL(10,2);
    DECLARE assigned_driver INT;

    IF (NEW.trip_date <> OLD.trip_date OR NEW.delivery_date <> OLD.delivery_date)
       AND NEW.trip_date < DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pickup date must be at least 3 days from today';
    END IF;

    IF NEW.delivery_date < NEW.trip_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Delivery date cannot be before pickup date';
    END IF;

    IF OLD.trip_status = 'completed' AND NEW.trip_status <> OLD.trip_status THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Completed trips cannot change status';
    END IF;

    IF OLD.trip_status = 'cancelled' AND NEW.trip_status <> OLD.trip_status THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cancelled trips cannot change status';
    END IF;

    IF OLD.trip_status = 'scheduled'
       AND NEW.trip_status NOT IN ('scheduled', 'in_progress', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Scheduled trips can only move to in_progress or cancelled';
    END IF;

    IF OLD.trip_status = 'in_progress'
       AND NEW.trip_status NOT IN ('in_progress', 'completed', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'In-progress trips can only move to completed or cancelled';
    END IF;

    SELECT load_capacity, assigned_driver_id
    INTO vehicle_capacity, assigned_driver
    FROM Vehicle
    WHERE vehicle_id = NEW.vehicle_id;

    IF NEW.load_weight > vehicle_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trip load exceeds vehicle capacity';
    END IF;

    IF assigned_driver IS NOT NULL AND assigned_driver <> NEW.driver_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trip driver must match the vehicle assigned driver';
    END IF;

    SET NEW.transport_cost = ROUND(NEW.base_rate * NEW.distance_km * NEW.load_weight, 2);
    SET NEW.tax_amount = ROUND(NEW.transport_cost * 0.20, 2);
    SET NEW.total_cost = ROUND(NEW.transport_cost + NEW.tax_amount, 2);
END$$

-- Keep vehicle status in sync with trip status.
CREATE TRIGGER `trips_after_update_vehicle_status`
AFTER UPDATE ON `Trip`
FOR EACH ROW
BEGIN
    IF OLD.trip_status <> NEW.trip_status THEN
        IF NEW.trip_status = 'in_progress' THEN
            UPDATE Vehicle
            SET status = 'in_transit'
            WHERE vehicle_id = NEW.vehicle_id;
        ELSEIF NEW.trip_status IN ('completed', 'cancelled') THEN
            UPDATE Vehicle
            SET status = 'available'
            WHERE vehicle_id = NEW.vehicle_id;
        END IF;
    END IF;
END$$

-- ------------------------------------------------------------------
-- Audit Log triggers (write-only change history)
-- These triggers only INSERT into AuditLog and never alter the rows
-- being changed, so they do not affect existing business logic.
-- ------------------------------------------------------------------

-- Record when a trip is created.
CREATE TRIGGER `trips_after_insert_audit`
AFTER INSERT ON `Trip`
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (table_name, action_type, record_id, description)
    VALUES (
        'Trip',
        'INSERT',
        NEW.trip_id,
        CONCAT('Trip created: ', NEW.origin, ' -> ', NEW.destination,
               ' (status ', NEW.trip_status, ')')
    );
END$$

-- Record when a trip's status changes.
CREATE TRIGGER `trips_after_update_audit`
AFTER UPDATE ON `Trip`
FOR EACH ROW
BEGIN
    IF NEW.trip_status <> OLD.trip_status THEN
        INSERT INTO AuditLog (table_name, action_type, record_id, description)
        VALUES (
            'Trip',
            'UPDATE',
            NEW.trip_id,
            CONCAT('Trip status changed: ', OLD.trip_status, ' -> ', NEW.trip_status)
        );
    END IF;
END$$

-- Record when a payment is recorded.
CREATE TRIGGER `payments_after_insert_audit`
AFTER INSERT ON `Payment`
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (table_name, action_type, record_id, description)
    VALUES (
        'Payment',
        'INSERT',
        NEW.payment_id,
        CONCAT('Payment recorded for trip ', NEW.trip_id,
               ': ', NEW.amount_paid, ' via ', NEW.payment_method)
    );
END$$

-- Record when a loader is removed from a trip.
CREATE TRIGGER `trip_loaders_after_delete_audit`
AFTER DELETE ON `TripLoader`
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (table_name, action_type, record_id, description)
    VALUES (
        'TripLoader',
        'DELETE',
        OLD.trip_loader_id,
        CONCAT('Loader ', OLD.loader_id, ' removed from trip ', OLD.trip_id)
    );
END$$

DELIMITER ;
