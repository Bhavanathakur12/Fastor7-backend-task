-- CRM Lead/Enquiry Management System Database Schema
-- Compatible with MySQL 8.0+ / MariaDB 10.4+

CREATE DATABASE IF NOT EXISTS `crm_lead_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `crm_lead_db`;

-- 1. Employees / Counselors Table
CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'counselor',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_employees_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Leads / Enquiries Table
CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `course_interest` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `claimed` TINYINT(1) NOT NULL DEFAULT 0,
  `claimed_by` INT UNSIGNED DEFAULT NULL,
  `claimed_by_email` VARCHAR(255) DEFAULT NULL,
  `claimed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_enquiries_claimed_created` (`claimed`, `created_at`),
  INDEX `idx_enquiries_claimed_by` (`claimed_by`, `claimed_at`),
  CONSTRAINT `fk_enquiries_claimed_by` FOREIGN KEY (`claimed_by`)
    REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
