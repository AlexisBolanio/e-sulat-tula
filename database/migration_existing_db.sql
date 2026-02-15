-- ============================================================
-- Migration for EXISTING databases (users, tema/themes already exist)
-- ============================================================
-- Run this if you already have users and tema/themes tables.
-- Run: mysql -u root -p esulattula_db < database/migration_existing_db.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Add role to users (skip if column exists - may get error, ignore)
ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER password;

-- Ensure themes table exists with new columns (or alter tema)
-- For "themes" table:
ALTER TABLE themes ADD COLUMN creator_id INT NULL AFTER id;
ALTER TABLE themes ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE themes ADD COLUMN description TEXT DEFAULT NULL;
-- Set creator_id for existing rows (first user as default) - run if needed:
-- UPDATE themes t SET creator_id = (SELECT id FROM users LIMIT 1) WHERE creator_id IS NULL;
-- ALTER TABLE themes MODIFY creator_id INT NOT NULL;

-- For "tema" table (if you use tema instead of themes), run equivalent:
-- ALTER TABLE tema ADD COLUMN creator_id INT NULL AFTER id;
-- ALTER TABLE tema ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Create stanzas table (uses users.id and themes.id as FKs)
-- If you use "tema" instead of "themes", change FOREIGN KEY (theme_id) REFERENCES tema(id)
CREATE TABLE IF NOT EXISTS stanzas (
    stanza_id INT PRIMARY KEY AUTO_INCREMENT,
    theme_id INT NOT NULL,
    author_id INT NOT NULL,
    content TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    page_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,  -- or tema(id) if using tema
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_theme_status (theme_id, status),
    INDEX idx_author (author_id),
    INDEX idx_theme_page (theme_id, page_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- If using "tema" instead of "themes", change theme_id FK to tema(id)

-- Create user_daily_limits table
CREATE TABLE IF NOT EXISTS user_daily_limits (
    limit_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    stanzas_written_today INT NOT NULL DEFAULT 0,
    last_submission_time TIMESTAMP NULL DEFAULT NULL,
    last_theme_id INT NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
