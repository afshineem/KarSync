-- ========================================================================
-- Workshop Attendance & Payroll Management System
-- Database Schema for MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+
-- Collation: utf8mb4_unicode_ci (Supports Kurdish Sorani, Persian & Arabic)
-- ========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------
-- 1. Table: workers (کارکنان / کرێکاران)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workers` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `role` VARCHAR(255) NOT NULL,
  `daily_rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `overtime_hourly_rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_workers_active` (`is_active`),
  KEY `idx_workers_updated` (`updated_at`),
  KEY `idx_workers_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 2. Table: users (کاربران سیستم و نقش‌ها / RBAC Users)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'operator') NOT NULL DEFAULT 'admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 3. Table: attendance_logs (ثبت کارکرد روزانه / دەوامی ڕۆژانە)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id` VARCHAR(64) NOT NULL,
  `worker_id` VARCHAR(64) NOT NULL,
  `date` DATE NOT NULL,
  `type` ENUM('full', 'half') NOT NULL DEFAULT 'full',
  `overtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `calculated_daily_wage` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `calculated_overtime_wage` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_day_pay` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('draft', 'approved') NOT NULL DEFAULT 'draft',
  `created_by` VARCHAR(64) DEFAULT NULL,
  `approved_by` VARCHAR(64) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_logs_date` (`date`),
  KEY `idx_logs_worker_id` (`worker_id`),
  KEY `idx_logs_status` (`status`),
  KEY `idx_logs_updated` (`updated_at`),
  KEY `idx_logs_deleted` (`deleted_at`),
  CONSTRAINT `fk_logs_worker` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 4. Table: expenses (فاکتورها و هزینه‌ها / Documents)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(64) NOT NULL,
  `project_id` VARCHAR(64) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'IQD',
  `expense_date` DATE NOT NULL,
  `status` ENUM('draft', 'approved') NOT NULL DEFAULT 'draft',
  `created_by` VARCHAR(64) DEFAULT NULL,
  `approved_by` VARCHAR(64) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exp_date` (`expense_date`),
  KEY `idx_exp_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 5. Table: payments (مساعده و تسویه‌حساب‌ها / Financial Records)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(64) NOT NULL,
  `project_id` VARCHAR(64) DEFAULT NULL,
  `worker_id` VARCHAR(64) NOT NULL,
  `date` DATE NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'IQD',
  `type` VARCHAR(32) NOT NULL DEFAULT 'advance',
  `status` ENUM('draft', 'approved') NOT NULL DEFAULT 'draft',
  `created_by` VARCHAR(64) DEFAULT NULL,
  `approved_by` VARCHAR(64) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pay_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 6. Table: settings (تنظیمات کارگاه / ڕێکخستنەکان)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(128) NOT NULL,
  `setting_value` LONGTEXT DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 4. Initial Seed Data (اطلاعات اولیه نمونه / داتای نموونەیی سەرەتایی)
-- ------------------------------------------------------------------------
INSERT INTO `workers` (`id`, `name`, `phone`, `role`, `daily_rate`, `overtime_hourly_rate`, `is_active`, `created_at`, `updated_at`) VALUES
('w_1', 'ئاراس ئەحمەد (Aras Ahmad)', '07501234567', 'Master Craftsman / وەستای گشتی', 45000.00, 7000.00, 1, NOW(), NOW()),
('w_2', 'کاروان حوسێن (Karwan Husein)', '07709876543', 'Welder / لەحیمچی', 35000.00, 5500.00, 1, NOW(), NOW()),
('w_3', 'هێمن مەحمود (Hemin Mahmud)', '07504443322', 'Apprentice / یاریدەدەر', 25000.00, 4000.00, 1, NOW(), NOW()),
('w_4', 'ڕێبین سالار (Rebin Salar)', '07715556677', 'Technician / تەکنیککار', 38000.00, 6000.00, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES
('workshop_name', 'کارگەی ئاسنگەری و دارتاشی (Central Workshop)', NOW()),
('default_currency', 'IQD', NOW()),
('language', 'ku', NOW())
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

SET FOREIGN_KEY_CHECKS = 1;
