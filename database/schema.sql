-- Movers Transport System - Database Schema
-- ------------------------------------------------------------------
-- This file reflects the live MySQL database used by the application
-- (tables + views only; triggers live in triggers.sql).
--
-- Recommended load order:
--   1) schema.sql    (this file: tables + views)
--   2) seed.sql      (sample data; load BEFORE triggers so historical
--                     trip dates are not rejected by the date trigger)
--   3) triggers.sql  (business-rule triggers)
--
-- Target: MySQL 8+ / utf8mb4
-- ------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS movers_transport
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE movers_transport;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------
-- Fleet and Staff
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS `Driver`;
CREATE TABLE `Driver` (
  `driver_id`   INT NOT NULL AUTO_INCREMENT,
  `first_name`  VARCHAR(50) NOT NULL,
  `last_name`   VARCHAR(50) NOT NULL,
  `phone`       VARCHAR(20) NOT NULL,
  `hire_date`   DATE NOT NULL,
  `salary_rate` DECIMAL(10,2) NOT NULL,
  `status`      ENUM('active','suspended','terminated') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`driver_id`),
  UNIQUE KEY `phone` (`phone`),
  CONSTRAINT `Driver_chk_1` CHECK ((`salary_rate` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `Loader`;
CREATE TABLE `Loader` (
  `loader_id`    INT NOT NULL AUTO_INCREMENT,
  `first_name`   VARCHAR(50) NOT NULL,
  `last_name`    VARCHAR(50) NOT NULL,
  `phone`        VARCHAR(20) NOT NULL,
  `payment_rate` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`loader_id`),
  UNIQUE KEY `phone` (`phone`),
  CONSTRAINT `Loader_chk_1` CHECK ((`payment_rate` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `Vehicle`;
CREATE TABLE `Vehicle` (
  `vehicle_id`         INT NOT NULL AUTO_INCREMENT,
  `plate_number`       VARCHAR(20) NOT NULL,
  `vehicle_type`       ENUM('van','pickup','container_truck') NOT NULL,
  `load_capacity`      DECIMAL(10,2) NOT NULL,
  `fuel_type`          ENUM('petrol','diesel','electric') NOT NULL,
  `status`             ENUM('available','assigned','in_transit','under_maintenance','fueling','out_of_service','retired') NOT NULL DEFAULT 'available',
  `assigned_driver_id` INT DEFAULT NULL,
  PRIMARY KEY (`vehicle_id`),
  UNIQUE KEY `plate_number` (`plate_number`),
  UNIQUE KEY `assigned_driver_id` (`assigned_driver_id`),
  CONSTRAINT `fk_vehicle_driver` FOREIGN KEY (`assigned_driver_id`) REFERENCES `Driver` (`driver_id`) ON DELETE SET NULL,
  CONSTRAINT `Vehicle_chk_1` CHECK ((`load_capacity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Farmer Management
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS `Farmer`;
CREATE TABLE `Farmer` (
  `farmer_id`         INT NOT NULL AUTO_INCREMENT,
  `first_name`        VARCHAR(50) NOT NULL,
  `last_name`         VARCHAR(50) NOT NULL,
  `phone`             VARCHAR(20) NOT NULL,
  `address`           VARCHAR(255) NOT NULL,
  `farmer_type`       ENUM('large_scale','small_scale') NOT NULL,
  `registration_date` DATE NOT NULL DEFAULT (curdate()),
  PRIMARY KEY (`farmer_id`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `FarmerGroup`;
CREATE TABLE `FarmerGroup` (
  `group_id`          INT NOT NULL AUTO_INCREMENT,
  `group_name`        VARCHAR(100) NOT NULL,
  `region`            VARCHAR(100) NOT NULL,
  `registration_date` DATE NOT NULL DEFAULT (curdate()),
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `group_name` (`group_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `GroupMembership`;
CREATE TABLE `GroupMembership` (
  `membership_id` INT NOT NULL AUTO_INCREMENT,
  `group_id`      INT NOT NULL,
  `farmer_id`     INT NOT NULL,
  `join_date`     DATE NOT NULL DEFAULT (curdate()),
  `role`          ENUM('member','secretary','treasurer','chair') NOT NULL DEFAULT 'member',
  PRIMARY KEY (`membership_id`),
  UNIQUE KEY `uq_group_farmer` (`group_id`,`farmer_id`),
  KEY `fk_gm_farmer` (`farmer_id`),
  CONSTRAINT `fk_gm_farmer` FOREIGN KEY (`farmer_id`) REFERENCES `Farmer` (`farmer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gm_group`  FOREIGN KEY (`group_id`)  REFERENCES `FarmerGroup` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Authentication / Roles
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS `AppUser`;
CREATE TABLE `AppUser` (
  `user_id`       INT NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          ENUM('system_admin','ops_manager','accountant','hr_manager','driver','farmer') NOT NULL,
  `farmer_id`     INT DEFAULT NULL,
  `driver_id`     INT DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `farmer_id` (`farmer_id`),
  UNIQUE KEY `driver_id` (`driver_id`),
  CONSTRAINT `fk_user_driver` FOREIGN KEY (`driver_id`) REFERENCES `Driver` (`driver_id`),
  CONSTRAINT `fk_user_farmer` FOREIGN KEY (`farmer_id`) REFERENCES `Farmer` (`farmer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Trip Operations
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS `Trip`;
CREATE TABLE `Trip` (
  `trip_id`                 INT NOT NULL AUTO_INCREMENT,
  `vehicle_id`              INT NOT NULL,
  `driver_id`               INT NOT NULL,
  `customer_farmer_id`      INT DEFAULT NULL,
  `customer_group_id`       INT DEFAULT NULL,
  `requested_by_farmer_id`  INT DEFAULT NULL,
  `origin`                  VARCHAR(150) NOT NULL,
  `destination`             VARCHAR(150) NOT NULL,
  `distance_km`             DECIMAL(8,2) NOT NULL,
  `trip_date`               DATE NOT NULL,
  `delivery_date`           DATE NOT NULL,
  `cargo_type`              VARCHAR(100) NOT NULL,
  `load_weight`             DECIMAL(10,2) NOT NULL,
  `base_rate`               DECIMAL(10,2) NOT NULL,
  `transport_cost`          DECIMAL(12,2) NOT NULL,
  `tax_amount`              DECIMAL(12,2) NOT NULL,
  `total_cost`              DECIMAL(12,2) NOT NULL,
  `trip_status`             ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  PRIMARY KEY (`trip_id`),
  KEY `fk_trip_farmer` (`customer_farmer_id`),
  KEY `fk_trip_group` (`customer_group_id`),
  KEY `idx_trip_driver` (`driver_id`),
  KEY `idx_trip_vehicle` (`vehicle_id`),
  KEY `idx_trip_date` (`trip_date`),
  KEY `fk_trip_requested_by_farmer` (`requested_by_farmer_id`),
  CONSTRAINT `fk_trip_driver`              FOREIGN KEY (`driver_id`)              REFERENCES `Driver` (`driver_id`),
  CONSTRAINT `fk_trip_farmer`              FOREIGN KEY (`customer_farmer_id`)     REFERENCES `Farmer` (`farmer_id`),
  CONSTRAINT `fk_trip_group`               FOREIGN KEY (`customer_group_id`)      REFERENCES `FarmerGroup` (`group_id`),
  CONSTRAINT `fk_trip_requested_by_farmer` FOREIGN KEY (`requested_by_farmer_id`) REFERENCES `Farmer` (`farmer_id`),
  CONSTRAINT `fk_trip_vehicle`             FOREIGN KEY (`vehicle_id`)             REFERENCES `Vehicle` (`vehicle_id`),
  CONSTRAINT `chk_trip_customer` CHECK (((`customer_farmer_id` IS NOT NULL) OR (`customer_group_id` IS NOT NULL))),
  CONSTRAINT `Trip_chk_1` CHECK ((`distance_km` > 0)),
  CONSTRAINT `Trip_chk_2` CHECK ((`load_weight` > 0)),
  CONSTRAINT `Trip_chk_3` CHECK ((`base_rate` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `TripLoader`;
CREATE TABLE `TripLoader` (
  `trip_loader_id` INT NOT NULL AUTO_INCREMENT,
  `trip_id`        INT NOT NULL,
  `loader_id`      INT NOT NULL,
  `payment_amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`trip_loader_id`),
  UNIQUE KEY `uq_trip_loader` (`trip_id`,`loader_id`),
  KEY `fk_tl_loader` (`loader_id`),
  CONSTRAINT `fk_tl_loader` FOREIGN KEY (`loader_id`) REFERENCES `Loader` (`loader_id`),
  CONSTRAINT `fk_tl_trip`   FOREIGN KEY (`trip_id`)   REFERENCES `Trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `TripLoader_chk_1` CHECK ((`payment_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `Payment`;
CREATE TABLE `Payment` (
  `payment_id`     INT NOT NULL AUTO_INCREMENT,
  `trip_id`        INT NOT NULL,
  `amount_paid`    DECIMAL(12,2) NOT NULL,
  `payment_date`   DATE NOT NULL,
  `payment_method` ENUM('cash','mpesa','bank_transfer','cheque','card') NOT NULL,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `trip_id` (`trip_id`),
  CONSTRAINT `fk_payment_trip` FOREIGN KEY (`trip_id`) REFERENCES `Trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `Payment_chk_1` CHECK ((`amount_paid` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Vehicle Maintenance
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS `FuelRecord`;
CREATE TABLE `FuelRecord` (
  `fuel_id`    INT NOT NULL AUTO_INCREMENT,
  `vehicle_id` INT NOT NULL,
  `trip_id`    INT DEFAULT NULL,
  `fuel_date`  DATE NOT NULL,
  `liters`     DECIMAL(8,2) NOT NULL,
  `fuel_cost`  DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`fuel_id`),
  KEY `fk_fuel_vehicle` (`vehicle_id`),
  KEY `fk_fuel_trip` (`trip_id`),
  CONSTRAINT `fk_fuel_trip`    FOREIGN KEY (`trip_id`)    REFERENCES `Trip` (`trip_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fuel_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `Vehicle` (`vehicle_id`),
  CONSTRAINT `FuelRecord_chk_1` CHECK ((`liters` > 0)),
  CONSTRAINT `FuelRecord_chk_2` CHECK ((`fuel_cost` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `ServiceRecord`;
CREATE TABLE `ServiceRecord` (
  `service_id`   INT NOT NULL AUTO_INCREMENT,
  `vehicle_id`   INT NOT NULL,
  `trip_id`      INT DEFAULT NULL,
  `service_date` DATE NOT NULL,
  `service_cost` DECIMAL(10,2) NOT NULL,
  `description`  VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`service_id`),
  KEY `fk_svc_vehicle` (`vehicle_id`),
  KEY `fk_svc_trip` (`trip_id`),
  CONSTRAINT `fk_svc_trip`    FOREIGN KEY (`trip_id`)    REFERENCES `Trip` (`trip_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_svc_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `Vehicle` (`vehicle_id`),
  CONSTRAINT `ServiceRecord_chk_1` CHECK ((`service_cost` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Driver Discipline
-- ------------------------------------------------------------------

DROP TABLE IF EXISTS `Offence`;
CREATE TABLE `Offence` (
  `offence_id`       INT NOT NULL AUTO_INCREMENT,
  `driver_id`        INT NOT NULL,
  `trip_id`          INT DEFAULT NULL,
  `offence_date`     DATE NOT NULL,
  `offence_type`     VARCHAR(100) NOT NULL,
  `surcharge_amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`offence_id`),
  KEY `fk_off_trip` (`trip_id`),
  KEY `idx_off_driver_date` (`driver_id`,`offence_date`),
  CONSTRAINT `fk_off_driver` FOREIGN KEY (`driver_id`) REFERENCES `Driver` (`driver_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_off_trip`   FOREIGN KEY (`trip_id`)   REFERENCES `Trip` (`trip_id`) ON DELETE SET NULL,
  CONSTRAINT `Offence_chk_1` CHECK ((`surcharge_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `WarningLetter`;
CREATE TABLE `WarningLetter` (
  `warning_id` INT NOT NULL AUTO_INCREMENT,
  `driver_id`  INT NOT NULL,
  `issue_date` DATE NOT NULL,
  `reason`     VARCHAR(255) NOT NULL,
  PRIMARY KEY (`warning_id`),
  KEY `fk_warn_driver` (`driver_id`),
  CONSTRAINT `fk_warn_driver` FOREIGN KEY (`driver_id`) REFERENCES `Driver` (`driver_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `Suspension`;
CREATE TABLE `Suspension` (
  `suspension_id` INT NOT NULL AUTO_INCREMENT,
  `driver_id`     INT NOT NULL,
  `start_date`    DATE NOT NULL,
  `end_date`      DATE NOT NULL,
  `reason`        VARCHAR(255) NOT NULL,
  PRIMARY KEY (`suspension_id`),
  KEY `idx_sus_driver_date` (`driver_id`,`start_date`),
  CONSTRAINT `fk_sus_driver` FOREIGN KEY (`driver_id`) REFERENCES `Driver` (`driver_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_sus_dates` CHECK ((`end_date` >= `start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `TripReview`;
CREATE TABLE `TripReview` (
  `review_id`   INT NOT NULL AUTO_INCREMENT,
  `trip_id`     INT NOT NULL,
  `farmer_id`   INT NOT NULL,
  `target_type` ENUM('driver','loader') NOT NULL,
  `driver_id`   INT DEFAULT NULL,
  `loader_id`   INT DEFAULT NULL,
  `rating`      TINYINT NOT NULL,
  `comment`     VARCHAR(500) DEFAULT NULL,
  `review_date` DATE NOT NULL DEFAULT (curdate()),
  PRIMARY KEY (`review_id`),
  UNIQUE KEY `uq_trip_review_target` (`trip_id`,`farmer_id`,`target_type`,`driver_id`,`loader_id`),
  KEY `fk_review_farmer` (`farmer_id`),
  KEY `fk_review_driver` (`driver_id`),
  KEY `fk_review_loader` (`loader_id`),
  CONSTRAINT `fk_review_driver` FOREIGN KEY (`driver_id`) REFERENCES `Driver` (`driver_id`),
  CONSTRAINT `fk_review_farmer` FOREIGN KEY (`farmer_id`) REFERENCES `Farmer` (`farmer_id`),
  CONSTRAINT `fk_review_loader` FOREIGN KEY (`loader_id`) REFERENCES `Loader` (`loader_id`),
  CONSTRAINT `fk_review_trip`   FOREIGN KEY (`trip_id`)   REFERENCES `Trip` (`trip_id`),
  CONSTRAINT `TripReview_chk_1` CHECK ((`rating` BETWEEN 1 AND 5)),
  CONSTRAINT `TripReview_chk_2` CHECK (
      ((`target_type` = 'driver') AND (`driver_id` IS NOT NULL) AND (`loader_id` IS NULL))
   OR ((`target_type` = 'loader') AND (`loader_id` IS NOT NULL) AND (`driver_id` IS NULL))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Audit Log (trigger-populated change history)
-- ------------------------------------------------------------------
-- Logs a few key actions (trip created, trip status changed, payment
-- recorded, loader removed); the triggers in triggers.sql write here.
-- No foreign keys on purpose, so audit rows survive if the source row
-- is later deleted.

DROP TABLE IF EXISTS `AuditLog`;
CREATE TABLE `AuditLog` (
  `audit_id`    INT NOT NULL AUTO_INCREMENT,
  `table_name`  VARCHAR(64) NOT NULL,
  `action_type` VARCHAR(20) NOT NULL,
  `record_id`   INT DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `changed_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `idx_audit_table` (`table_name`),
  KEY `idx_audit_changed_at` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------
-- Reporting Views (role-oriented read models)
-- ------------------------------------------------------------------

CREATE OR REPLACE VIEW `TripFinancialSummary` AS
  SELECT `t`.`trip_id` AS `trip_id`,
         `t`.`transport_cost` AS `transport_cost`,
         `t`.`tax_amount` AS `tax_amount`,
         `t`.`total_cost` AS `total_cost`,
         COALESCE(`p`.`amount_paid`,0) AS `amount_paid`,
         (`t`.`total_cost` - COALESCE(`p`.`amount_paid`,0)) AS `balance_due`
  FROM `Trip` `t`
  LEFT JOIN `Payment` `p` ON (`t`.`trip_id` = `p`.`trip_id`);

CREATE OR REPLACE VIEW `AccountantReceivablesView` AS
  SELECT `t`.`trip_id` AS `trip_id`,
         `t`.`trip_date` AS `trip_date`,
         `t`.`transport_cost` AS `transport_cost`,
         `t`.`tax_amount` AS `tax_amount`,
         `t`.`total_cost` AS `total_cost`,
         COALESCE(`p`.`amount_paid`,0) AS `amount_paid`,
         `p`.`payment_method` AS `payment_method`,
         `p`.`payment_date` AS `payment_date`,
         (`t`.`total_cost` - COALESCE(`p`.`amount_paid`,0)) AS `balance_due`
  FROM `Trip` `t`
  LEFT JOIN `Payment` `p` ON (`t`.`trip_id` = `p`.`trip_id`);

CREATE OR REPLACE VIEW `FarmerCustomerTripView` AS
  SELECT `t`.`trip_id` AS `trip_id`,
         `t`.`customer_farmer_id` AS `farmer_id`,
         `t`.`customer_group_id` AS `group_id`,
         COALESCE(CONCAT(`f`.`first_name`,' ',`f`.`last_name`),`fg`.`group_name`) AS `customer_name`,
         `t`.`origin` AS `origin`,
         `t`.`destination` AS `destination`,
         `t`.`distance_km` AS `distance_km`,
         `t`.`trip_date` AS `trip_date`,
         `t`.`cargo_type` AS `cargo_type`,
         `t`.`load_weight` AS `load_weight`,
         `t`.`trip_status` AS `trip_status`,
         `t`.`total_cost` AS `total_cost`,
         COALESCE(`p`.`amount_paid`,0) AS `amount_paid`,
         (`t`.`total_cost` - COALESCE(`p`.`amount_paid`,0)) AS `balance_due`
  FROM `Trip` `t`
  LEFT JOIN `Farmer` `f`       ON (`t`.`customer_farmer_id` = `f`.`farmer_id`)
  LEFT JOIN `FarmerGroup` `fg` ON (`t`.`customer_group_id` = `fg`.`group_id`)
  LEFT JOIN `Payment` `p`      ON (`t`.`trip_id` = `p`.`trip_id`);

CREATE OR REPLACE VIEW `OperationsTripManifestView` AS
  SELECT `t`.`trip_id` AS `trip_id`,
         COALESCE(CONCAT(`f`.`first_name`,' ',`f`.`last_name`),`fg`.`group_name`) AS `customer_name`,
         CONCAT(`d`.`first_name`,' ',`d`.`last_name`) AS `driver_name`,
         `v`.`plate_number` AS `plate_number`,
         `t`.`origin` AS `origin`,
         `t`.`destination` AS `destination`,
         `t`.`distance_km` AS `distance_km`,
         `t`.`trip_date` AS `trip_date`,
         `t`.`cargo_type` AS `cargo_type`,
         `t`.`load_weight` AS `load_weight`,
         `t`.`trip_status` AS `trip_status`,
         COUNT(`tl`.`loader_id`) AS `loader_count`
  FROM `Trip` `t`
  LEFT JOIN `Farmer` `f`       ON (`t`.`customer_farmer_id` = `f`.`farmer_id`)
  LEFT JOIN `FarmerGroup` `fg` ON (`t`.`customer_group_id` = `fg`.`group_id`)
  JOIN `Driver` `d`            ON (`t`.`driver_id` = `d`.`driver_id`)
  JOIN `Vehicle` `v`           ON (`t`.`vehicle_id` = `v`.`vehicle_id`)
  LEFT JOIN `TripLoader` `tl`  ON (`t`.`trip_id` = `tl`.`trip_id`)
  GROUP BY `t`.`trip_id`, `customer_name`, `driver_name`, `v`.`plate_number`,
           `t`.`origin`, `t`.`destination`, `t`.`distance_km`, `t`.`trip_date`,
           `t`.`cargo_type`, `t`.`load_weight`, `t`.`trip_status`;

CREATE OR REPLACE VIEW `DriverTripAssignmentView` AS
  SELECT `t`.`trip_id` AS `trip_id`,
         `t`.`driver_id` AS `driver_id`,
         CONCAT(`d`.`first_name`,' ',`d`.`last_name`) AS `driver_name`,
         `v`.`plate_number` AS `plate_number`,
         `t`.`origin` AS `origin`,
         `t`.`destination` AS `destination`,
         `t`.`trip_date` AS `trip_date`,
         `t`.`cargo_type` AS `cargo_type`,
         `t`.`load_weight` AS `load_weight`,
         `t`.`trip_status` AS `trip_status`
  FROM `Trip` `t`
  JOIN `Driver` `d`  ON (`t`.`driver_id` = `d`.`driver_id`)
  JOIN `Vehicle` `v` ON (`t`.`vehicle_id` = `v`.`vehicle_id`);

CREATE OR REPLACE VIEW `DriverDisciplineSummary` AS
  SELECT `d`.`driver_id` AS `driver_id`,
         `d`.`first_name` AS `first_name`,
         `d`.`last_name` AS `last_name`,
         `d`.`status` AS `status`,
         COUNT(DISTINCT `o`.`offence_id`) AS `offence_count`,
         COUNT(DISTINCT `w`.`warning_id`) AS `warning_count`,
         COUNT(DISTINCT `s`.`suspension_id`) AS `suspension_count`
  FROM `Driver` `d`
  LEFT JOIN `Offence` `o`       ON (`d`.`driver_id` = `o`.`driver_id`)
  LEFT JOIN `WarningLetter` `w` ON (`d`.`driver_id` = `w`.`driver_id`)
  LEFT JOIN `Suspension` `s`    ON (`d`.`driver_id` = `s`.`driver_id`)
  GROUP BY `d`.`driver_id`, `d`.`first_name`, `d`.`last_name`, `d`.`status`;

CREATE OR REPLACE VIEW `HRDriverDisciplineView` AS
  SELECT `d`.`driver_id` AS `driver_id`,
         CONCAT(`d`.`first_name`,' ',`d`.`last_name`) AS `driver_name`,
         `d`.`phone` AS `phone`,
         `d`.`status` AS `status`,
         COUNT(DISTINCT `o`.`offence_id`) AS `offence_count`,
         COUNT(DISTINCT `w`.`warning_id`) AS `warning_count`,
         COUNT(DISTINCT `s`.`suspension_id`) AS `suspension_count`
  FROM `Driver` `d`
  LEFT JOIN `Offence` `o`       ON (`d`.`driver_id` = `o`.`driver_id`)
  LEFT JOIN `WarningLetter` `w` ON (`d`.`driver_id` = `w`.`driver_id`)
  LEFT JOIN `Suspension` `s`    ON (`d`.`driver_id` = `s`.`driver_id`)
  GROUP BY `d`.`driver_id`, `driver_name`, `d`.`phone`, `d`.`status`;
