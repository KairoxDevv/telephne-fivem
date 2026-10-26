-- =========================================================
--  OBSIDIAN PHONE - tables (prefixe ophone_ pour ne rien casser)
-- =========================================================

CREATE TABLE IF NOT EXISTS `ophone_settings` (
  `citizenid` VARCHAR(50) NOT NULL,
  `settings` LONGTEXT NULL,
  `apps` LONGTEXT NULL,
  `setup_done` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_contacts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `number` VARCHAR(20) NOT NULL,
  `avatar` VARCHAR(255) NULL,
  `favorite` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_conversations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NULL,
  `is_group` TINYINT(1) NOT NULL DEFAULT 0,
  `owner` VARCHAR(20) NULL,
  `last_message` VARCHAR(255) NULL,
  `last_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_conversation_members` (
  `conversation_id` INT NOT NULL,
  `number` VARCHAR(20) NOT NULL,
  `unread` INT NOT NULL DEFAULT 0,
  `hidden` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`conversation_id`, `number`),
  KEY `idx_number` (`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `conversation_id` INT NOT NULL,
  `sender` VARCHAR(20) NOT NULL,
  `content` TEXT NULL,
  `attachment` LONGTEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conv` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_calls` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `caller` VARCHAR(20) NOT NULL,
  `receiver` VARCHAR(20) NOT NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'missed',
  `video` TINYINT(1) NOT NULL DEFAULT 0,
  `duration` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_caller` (`caller`),
  KEY `idx_receiver` (`receiver`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_gallery` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_notes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `content` TEXT NULL,
  `color` VARCHAR(10) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_bank_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `amount` INT NOT NULL,
  `type` VARCHAR(10) NOT NULL,   -- 'in' | 'out'
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_invoices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `amount` INT NOT NULL,
  `society` VARCHAR(50) NULL,
  `sender_name` VARCHAR(80) NULL,
  `sender_cid` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_crypto_wallets` (
  `citizenid` VARCHAR(50) NOT NULL,
  `coin` VARCHAR(10) NOT NULL,
  `amount` DECIMAL(20,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`citizenid`, `coin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_crypto_market` (
  `coin` VARCHAR(10) NOT NULL,
  `price` DECIMAL(20,4) NOT NULL,
  `history` LONGTEXT NULL,
  PRIMARY KEY (`coin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_crypto_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `coin` VARCHAR(10) NOT NULL,
  `type` VARCHAR(10) NOT NULL,
  `amount` DECIMAL(20,6) NOT NULL,
  `price` DECIMAL(20,4) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_casino_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `name` VARCHAR(80) NULL,
  `game` VARCHAR(20) NOT NULL,
  `bet` INT NOT NULL,
  `payout` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cid` (`citizenid`),
  KEY `idx_payout` (`payout`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_pulse_posts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `author` VARCHAR(60) NOT NULL,
  `handle` VARCHAR(40) NOT NULL,
  `content` VARCHAR(280) NOT NULL,
  `image` VARCHAR(512) NULL,
  `likes` LONGTEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ophone_ads` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(50) NOT NULL,
  `author` VARCHAR(60) NOT NULL,
  `number` VARCHAR(20) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `content` VARCHAR(400) NOT NULL,
  `price` INT NULL,
  `image` VARCHAR(512) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
