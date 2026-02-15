-- ============================================================
-- Poetic Threads (E-SULAT-TULA) - Database Schema
-- ============================================================
-- Run this file to create/update the database structure.
-- Usage: mysql -u root -p esulattula_db < database/poetic_threads_schema.sql
-- Or via phpMyAdmin: Import this file into esulattula_db
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. Users Table
-- Stores account info and roles (user vs admin)
-- ------------------------------------------------------------
-- NOTE: Use "id" as PK to match existing register/login; "user_id" is logical alias
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nick_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) DEFAULT NULL,
    last_name VARCHAR(100) DEFAULT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add role column if upgrading from older schema (run separately if needed)
-- ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER password;

-- ------------------------------------------------------------
-- 2. Themes Table
-- Users create themes (core topic/title of a poem)
-- ------------------------------------------------------------
-- NOTE: Use "id" as PK; "theme_id" is logical alias
CREATE TABLE IF NOT EXISTS themes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    creator_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_creator (creator_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. Stanzas (Talata) Table
-- Heart of content - stores the actual poem writing
-- 20 stanzas per page; status for admin moderation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stanzas (
    stanza_id INT PRIMARY KEY AUTO_INCREMENT,
    theme_id INT NOT NULL,
    author_id INT NOT NULL,
    content TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    page_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_theme_status (theme_id, status),
    INDEX idx_author (author_id),
    INDEX idx_theme_page (theme_id, page_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4. User Daily Limits Table
-- Tracks: 3 stanzas/day limit, no back-to-back in same theme
-- Resets at midnight (via cron/scheduled task)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_daily_limits (
    limit_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    stanzas_written_today INT NOT NULL DEFAULT 0,
    last_submission_time TIMESTAMP NULL DEFAULT NULL,
    last_theme_id INT NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (last_theme_id) REFERENCES themes(id) ON DELETE SET NULL,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Business Rules (enforced in application layer)
-- ------------------------------------------------------------
-- 1. Pagination: 20 stanzas per page; page_number = CEIL(approved_count/20)
-- 2. Submission Throttling:
--    - IF stanzas_written_today >= 3 → Reject
--    - IF last_theme_id == current theme_id → Reject (no back-to-back)
-- 3. Moderation: Only approved stanzas visible to public
-- 4. Daily Reset: Cron at midnight → UPDATE user_daily_limits SET stanzas_written_today = 0;
