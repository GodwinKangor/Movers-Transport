-- Movers Transport System - Sample / Seed Data
-- ------------------------------------------------------------------
-- Snapshot of the working demo data (mirrors the live database).
--
-- IMPORTANT load order:
--   1) schema.sql
--   2) seed.sql   <-- this file (load BEFORE triggers.sql)
--   3) triggers.sql
--
-- Why seed before triggers? The trip triggers reject pickup dates
-- earlier than 3 days from "today", and this sample data contains
-- historical trips. Loading data first (with no triggers yet) avoids
-- those validation errors. Cost columns below already hold the
-- database-calculated values.
--
-- Login accounts included below (password for every test.* account
-- is: password123):
--   test.admin       / password123   (system_admin)
--   test.ops         / password123   (ops_manager)
--   test.accountant  / password123   (accountant)
--   test.hr          / password123   (hr_manager)
--   test.driver      / password123   (driver, linked to driver_id 1)
--   test.farmer      / password123   (farmer, linked to farmer_id 1)
-- The 'admin' account uses the password configured via MOVERS_DEMO_PASSWORD.
-- ------------------------------------------------------------------

USE movers_transport;

SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing rows (safe re-seed)
DELETE FROM `AuditLog`;
DELETE FROM `TripReview`;
DELETE FROM `Suspension`;
DELETE FROM `WarningLetter`;
DELETE FROM `Offence`;
DELETE FROM `ServiceRecord`;
DELETE FROM `FuelRecord`;
DELETE FROM `Payment`;
DELETE FROM `TripLoader`;
DELETE FROM `Trip`;
DELETE FROM `AppUser`;
DELETE FROM `GroupMembership`;
DELETE FROM `FarmerGroup`;
DELETE FROM `Farmer`;
DELETE FROM `Vehicle`;
DELETE FROM `Loader`;
DELETE FROM `Driver`;

-- ------------------------------------------------------------------
-- Drivers
-- ------------------------------------------------------------------
INSERT INTO `Driver` (`driver_id`, `first_name`, `last_name`, `phone`, `hire_date`, `salary_rate`, `status`) VALUES
  (1,'Daniel','Kofi','555-0201','2025-08-12',28.00,'active'),
  (2,'Miriam','Adebayo','555-0202','2025-09-20',30.00,'active'),
  (3,'Joseph','Kamau','555-0203','2025-10-01',26.50,'suspended');

-- ------------------------------------------------------------------
-- Loaders
-- ------------------------------------------------------------------
INSERT INTO `Loader` (`loader_id`, `first_name`, `last_name`, `phone`, `payment_rate`) VALUES
  (1,'Lena','Owusu','555-0301',18.00),
  (2,'Noah','Banda','555-0302',18.00),
  (3,'Ibrahim','Sow','555-0303',19.50);

-- ------------------------------------------------------------------
-- Vehicles
-- ------------------------------------------------------------------
INSERT INTO `Vehicle` (`vehicle_id`, `plate_number`, `vehicle_type`, `load_capacity`, `fuel_type`, `status`, `assigned_driver_id`) VALUES
  (4,'MV-1001','pickup',1500.00,'diesel','available',1),
  (5,'MV-2001','container_truck',9000.00,'diesel','available',2),
  (6,'MV-3001','van',900.00,'diesel','under_maintenance',NULL);

-- ------------------------------------------------------------------
-- Farmers
-- ------------------------------------------------------------------
INSERT INTO `Farmer` (`farmer_id`, `first_name`, `last_name`, `phone`, `address`, `farmer_type`, `registration_date`) VALUES
  (1,'Amina','Mensah','555-0101','North Valley Farm Road','large_scale','2026-01-05'),
  (2,'Kwame','Boateng','555-0102','East Ridge Farm 12','small_scale','2026-01-07'),
  (3,'Grace','Njeri','555-0103','Lakeview Plot 8','small_scale','2026-01-07'),
  (4,'Samuel','Okoro','555-0104','Greenfield Plot 4','small_scale','2026-01-08'),
  (5,'Fatima','Diallo','555-0105','Harvest Lane 2','small_scale','2026-01-08'),
  (6,'Peter','Moyo','555-0106','Riverbend Plot 11','small_scale','2026-01-09'),
  (16,'Amina','Mensah','555-0198','Nairobi','large_scale','2026-06-02'),
  (17,'Godwin','Kangor','1 603-276-9576','Soy','large_scale','2026-06-02'),
  (18,'Joy','Wambui','466-444','Kiambu','small_scale','2026-06-06');

-- ------------------------------------------------------------------
-- Farmer Groups + Memberships (group chair = Kwame Boateng / farmer 2)
-- ------------------------------------------------------------------
INSERT INTO `FarmerGroup` (`group_id`, `group_name`, `region`, `registration_date`) VALUES
  (1,'Riverbend Growers','North Region','2026-01-10');

INSERT INTO `GroupMembership` (`membership_id`, `group_id`, `farmer_id`, `join_date`, `role`) VALUES
  (1,1,2,'2026-01-10','chair'),
  (2,1,3,'2026-01-10','secretary'),
  (3,1,4,'2026-01-10','treasurer'),
  (4,1,5,'2026-01-10','member'),
  (5,1,6,'2026-01-10','member'),
  (6,1,18,'2026-06-06','member');

-- ------------------------------------------------------------------
-- Application users (auth). Password for all test.* accounts: password123
-- ------------------------------------------------------------------
INSERT INTO `AppUser` (`user_id`, `username`, `password_hash`, `role`, `farmer_id`, `driver_id`, `created_at`) VALUES
  (1,'admin','scrypt:32768:8:1$kBsQWlMhAj0XXZWU$daff5266ca9abd4476f3c78ae44b35234f1b240dc2548c1dcf40b265769ca078437a51c96a6a2c1c8572d8e75db361880cf219c6057df07506af41d6a6bed744','system_admin',NULL,NULL,'2026-06-01 21:31:46'),
  (4,'hr.manager','scrypt:32768:8:1$byaBkFr6sOdrncwa$d6f7f594ca05bc7d077c39ef2a5ef48ab6f5cdea81c024fe11de269b2ca50996258cb94387c81cc861468ba57e0473f09dfe4d16abfa84cef88dfb23dce1ff79','hr_manager',NULL,NULL,'2026-06-02 14:20:22'),
  (5,'test.admin','scrypt:32768:8:1$hSyoOF3608odjmg9$39c246b76ee43642a3d8e3b3293b2dc303ba4d3b507dbb441a4c4a556b3c086fdef979dfc012f7edc69193c43ec03520e61cd54d84aceb21871313c18e9d16b0','system_admin',NULL,NULL,'2026-06-02 14:23:32'),
  (6,'test.ops','scrypt:32768:8:1$hSyoOF3608odjmg9$39c246b76ee43642a3d8e3b3293b2dc303ba4d3b507dbb441a4c4a556b3c086fdef979dfc012f7edc69193c43ec03520e61cd54d84aceb21871313c18e9d16b0','ops_manager',NULL,NULL,'2026-06-02 14:23:32'),
  (7,'test.accountant','scrypt:32768:8:1$hSyoOF3608odjmg9$39c246b76ee43642a3d8e3b3293b2dc303ba4d3b507dbb441a4c4a556b3c086fdef979dfc012f7edc69193c43ec03520e61cd54d84aceb21871313c18e9d16b0','accountant',NULL,NULL,'2026-06-02 14:23:33'),
  (8,'test.hr','scrypt:32768:8:1$hSyoOF3608odjmg9$39c246b76ee43642a3d8e3b3293b2dc303ba4d3b507dbb441a4c4a556b3c086fdef979dfc012f7edc69193c43ec03520e61cd54d84aceb21871313c18e9d16b0','hr_manager',NULL,NULL,'2026-06-02 14:23:33'),
  (9,'test.driver','scrypt:32768:8:1$hSyoOF3608odjmg9$39c246b76ee43642a3d8e3b3293b2dc303ba4d3b507dbb441a4c4a556b3c086fdef979dfc012f7edc69193c43ec03520e61cd54d84aceb21871313c18e9d16b0','driver',NULL,1,'2026-06-02 14:23:33'),
  (10,'test.farmer','scrypt:32768:8:1$hSyoOF3608odjmg9$39c246b76ee43642a3d8e3b3293b2dc303ba4d3b507dbb441a4c4a556b3c086fdef979dfc012f7edc69193c43ec03520e61cd54d84aceb21871313c18e9d16b0','farmer',1,NULL,'2026-06-02 14:23:33');

-- ------------------------------------------------------------------
-- Trips (transport_cost / tax_amount / total_cost are DB-calculated)
-- ------------------------------------------------------------------
INSERT INTO `Trip` (`trip_id`, `vehicle_id`, `driver_id`, `customer_farmer_id`, `customer_group_id`, `requested_by_farmer_id`, `origin`, `destination`, `distance_km`, `trip_date`, `delivery_date`, `cargo_type`, `load_weight`, `base_rate`, `transport_cost`, `tax_amount`, `total_cost`, `trip_status`) VALUES
  (3,4,1,1,NULL,NULL,'North Valley Farm','Central Market',42.50,'2026-02-01','2026-02-01','Tomatoes',800.00,0.75,25500.00,5100.00,30600.00,'cancelled'),
  (4,5,2,NULL,1,2,'Riverbend Cooperative Store','Metro Retail Depot',88.00,'2026-02-03','2026-02-03','Fertilizer bags',4500.00,0.62,245520.00,49104.00,294624.00,'scheduled'),
  (5,4,1,1,NULL,NULL,'North Valley Farm','Central Market',40.00,'2026-05-26','2026-05-26','Tomatoes',1000.00,0.75,30000.00,6000.00,36000.00,'scheduled'),
  (13,4,1,16,NULL,NULL,'Nairobi','Central Market',20.00,'2026-06-03','2026-06-03','Maize',500.00,0.75,7500.00,1500.00,9000.00,'scheduled'),
  (14,4,1,17,NULL,NULL,'North Valley Farm','Central Market',40.00,'2026-05-26','2026-05-26','Tomatoes',1000.00,0.75,30000.00,6000.00,36000.00,'scheduled'),
  (19,4,1,1,NULL,NULL,'Review Test Farm','Review Test Market',10.00,'2026-05-01','2026-05-01','Beans',100.00,0.75,750.00,150.00,900.00,'scheduled');

-- ------------------------------------------------------------------
-- Trip loaders
-- ------------------------------------------------------------------
INSERT INTO `TripLoader` (`trip_loader_id`, `trip_id`, `loader_id`, `payment_amount`) VALUES
  (1,3,1,54.00),
  (2,3,2,54.00),
  (3,4,2,72.00),
  (4,4,3,78.00),
  (5,5,2,18.00),
  (11,13,1,18.00),
  (12,14,1,18.00),
  (13,14,2,18.00),
  (20,19,1,18.00);

-- ------------------------------------------------------------------
-- Fuel + Service records
-- ------------------------------------------------------------------
INSERT INTO `FuelRecord` (`fuel_id`, `vehicle_id`, `trip_id`, `fuel_date`, `liters`, `fuel_cost`) VALUES
  (1,4,3,'2026-02-01',18.50,74.00),
  (2,5,4,'2026-02-03',45.00,180.00);

INSERT INTO `ServiceRecord` (`service_id`, `vehicle_id`, `trip_id`, `service_date`, `service_cost`, `description`) VALUES
  (1,4,3,'2026-02-02',35.00,'Post-trip inspection'),
  (2,5,4,'2026-02-04',60.00,'Brake and tire inspection'),
  (3,4,3,'2026-06-02',0.00,'Driver reported inspection test');

-- ------------------------------------------------------------------
-- Offences (driver discipline source records)
-- ------------------------------------------------------------------
INSERT INTO `Offence` (`offence_id`, `driver_id`, `trip_id`, `offence_date`, `offence_type`, `surcharge_amount`) VALUES
  (1,1,NULL,'2026-06-02','Late departure',10.50),
  (2,2,NULL,'2026-06-02','Late departure',10.50),
  (3,2,NULL,'2026-06-02','Late departure',10.50);

-- ------------------------------------------------------------------
-- Trip reviews (individual-farmer trips only)
-- ------------------------------------------------------------------
INSERT INTO `TripReview` (`review_id`, `trip_id`, `farmer_id`, `target_type`, `driver_id`, `loader_id`, `rating`, `comment`, `review_date`) VALUES
  (1,19,1,'driver',1,NULL,5,'Professional trip','2026-06-02');

SET FOREIGN_KEY_CHECKS = 1;
