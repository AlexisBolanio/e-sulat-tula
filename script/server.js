const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const argon2 = require('argon2') // added for password hashing

const app = express();
app.use(cors());
app.use(bodyParser.json());

// add simple request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send({ status: 'ok', time: new Date().toISOString() });
});


// Konekta sa MySQL (gamit env sa production/Vercel, local default sa dev)
const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'esulattula_db'
};
const db = mysql.createConnection(dbConfig);

db.connect(err => {
    if (err) {
        console.error("DB connect error:", err);
        // exit so we don't run with a broken DB connection
        
        process.exit(1);
    }
    console.log("Konektado na sa MySQL Database!");
    // prefer existing `tema` table if present (your DB uses `tema`)
    // otherwise ensure a `themes` table exists
    db.query("SHOW TABLES LIKE 'tema'", (sErr, sRows) => {
        if (sErr) {
            console.error('Error checking for tema table:', sErr);
            return;
        }
            if (sRows && sRows.length > 0) {
                // use existing table name and detect column names
                THEME_TABLE = 'tema';
                console.log('Using existing tema table for themes. Detecting columns...');
                db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [db.config.database, THEME_TABLE], (colErr, colRows) => {
                    if (colErr) {
                        console.error('Error reading tema columns:', colErr);
                        return;
                    }
                    const cols = (colRows || []).map(r => (r.COLUMN_NAME || '').toLowerCase());
                    // prefer common description column names
                    if (cols.includes('description')) DESCRIPTION_COLUMN = 'description';
                    else if (cols.includes('desc')) DESCRIPTION_COLUMN = 'desc';
                    else if (cols.includes('deskripsi')) DESCRIPTION_COLUMN = 'deskripsi';
                    else DESCRIPTION_COLUMN = cols[1] || 'description';

                    HAS_PAGES_COLUMN = cols.includes('pages') || cols.includes('page');
                    console.log('Detected description column:', DESCRIPTION_COLUMN, 'pages column present?', HAS_PAGES_COLUMN);
                });
                return;
            }

        // create fallback table with pages column
        const createThemes = `
            CREATE TABLE IF NOT EXISTS themes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                pages INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        db.query(createThemes, (cErr) => {
            if (cErr) console.error('Could not ensure themes table exists:', cErr);
            else console.log('Ensured themes table exists.');
        });
    });

    // Ensure Poetic Threads tables exist (stanzas, user_daily_limits)
    db.query("SHOW TABLES LIKE 'stanzas'", (e, r) => {
        if (!e && r && r.length === 0) {
            db.query(`
                CREATE TABLE stanzas (
                    stanza_id INT PRIMARY KEY AUTO_INCREMENT,
                    theme_id INT NOT NULL,
                    author_id INT NOT NULL,
                    content TEXT NOT NULL,
                    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
                    page_number INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
                    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_theme_status (theme_id, status),
                    INDEX idx_author (author_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `, (err) => {
                if (err) console.error('Could not create stanzas table:', err.message);
                else console.log('Created stanzas table.');
            });
        }
    });
    db.query("SHOW TABLES LIKE 'user_daily_limits'", (e, r) => {
        if (!e && r && r.length === 0) {
            db.query(`
                CREATE TABLE user_daily_limits (
                    limit_id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL UNIQUE,
                    stanzas_written_today INT NOT NULL DEFAULT 0,
                    last_submission_time TIMESTAMP NULL,
                    last_theme_id INT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `, (err) => {
                if (err) console.error('Could not create user_daily_limits table:', err.message);
                else console.log('Created user_daily_limits table.');
            });
        }
    });
});

// default theme table name (may change at runtime to 'tema')
let THEME_TABLE = 'themes';
let DESCRIPTION_COLUMN = 'description';
let HAS_PAGES_COLUMN = true;

// add a promise wrapper for cleaner async/await usage
const dbp = db.promise();

// process-level error handlers for better diagnostics
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});

// API para sa Registration (improved)
app.post('/register', async (req, res) => {
    // extract and sanitize
    let { firstName, lastName, nickName, email, password } = req.body || {};
    firstName = typeof firstName === 'string' ? firstName.trim() : '';
    lastName  = typeof lastName === 'string' ? lastName.trim() : '';
    nickName  = typeof nickName === 'string' ? nickName.trim() : '';
    email     = typeof email === 'string' ? email.trim().toLowerCase() : '';
    password  = typeof password === 'string' ? password : '';

    // log incoming payload (do not log password)
    console.log('Register payload:', { firstName, lastName, nickName, email });

    // basic validation (also protect against excessively long values)
    if (!firstName || !lastName || !nickName || !email || !password) {
        return res.status(400).send({ message: "Kulang ang required fields." });
    }
    if (firstName.length > 100 || lastName.length > 100 || nickName.length > 100 || email.length > 254 || password.length > 2000) {
        return res.status(400).send({ message: "May invalid or too-long field." });
    }

    try {
        // check duplicate email
        const [rows] = await dbp.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            return res.status(409).send({ message: "Ang email na ito ay naka-rehistro na." });
        }

        // hash password and ensure we got a string
        const hashed = await argon2.hash(password);
        if (!hashed || typeof hashed !== 'string') {
            console.error('Invalid password hash:', hashed);
            return res.status(500).send({ message: "May error sa pag-hash ng password." });
        }

        const sql = "INSERT INTO users (first_name, last_name, nick_name, email, password) VALUES (?, ?, ?, ?, ?)";
        const params = [firstName, lastName, nickName, email, hashed];
        console.log('Executing SQL:', { sql, params }); // diagnostic — safe because password is hashed
        // insert and return the created user's basic details (no password)
        const [insertResult] = await dbp.execute(sql, params);
        const insertId = insertResult && insertResult.insertId;
        let createdUser = null;
        if (insertId) {
            const [rows2] = await dbp.execute('SELECT id, first_name, last_name, nick_name, email FROM users WHERE id = ?', [insertId]);
            if (rows2 && rows2.length > 0) createdUser = rows2[0];
        }

        return res.status(201).send({ message: "Matagumpay ang pag-rehistro, Makata!", user: createdUser });
    } catch (err) {
        // improved diagnostic logging
        console.error('Register error:', {
            message: err && err.message,
            code: err && err.code,
            sql: err && (err.sql || err.sqlMessage),
            sqlMessage: err && err.sqlMessage,
            stack: err && err.stack
        });
        return res.status(500).send({ message: "May error sa database o server." });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    let { email, password } = req.body || {};
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';

    if (!email || !password) return res.status(400).send({ message: 'Kulang ang email o password.' });

    try {
        const [rows] = await dbp.execute('SELECT id, first_name, last_name, nick_name, email, password, role FROM users WHERE email = ?', [email]);
        if (!rows || rows.length === 0) return res.status(401).send({ message: 'Maling credentials.' });

        const userRow = rows[0];
        const hash = userRow.password;
        const verified = await argon2.verify(hash, password);
        if (!verified) return res.status(401).send({ message: 'Maling credentials.' });

        // return user without password (include role for admin features)
        const { id, first_name, last_name, nick_name, role } = userRow;
        return res.status(200).send({ message: 'Matagumpay na pag-login.', user: { id, first_name, last_name, nick_name, email, role: role || 'user' } });
    } catch (err) {
        console.error('Login error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// themes endpoints
app.get('/themes', async (req, res) => {
    try {
        const cols = [`id`, `title`, `\`${DESCRIPTION_COLUMN}\` as description`];
        if (HAS_PAGES_COLUMN) cols.push('pages');
        cols.push('created_at');
        const sql = `SELECT ${cols.join(', ')} FROM \`${THEME_TABLE}\` ORDER BY id DESC`;
        const [rows] = await dbp.execute(sql);
        return res.status(200).send({ themes: rows });
    } catch (err) {
        console.error('Get themes error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

app.post('/themes', async (req, res) => {
    let { title, description } = req.body || {};
    let pages = req.body && (req.body.pages || req.body.page) ? parseInt(req.body.pages || req.body.page) || 0 : 0;
    title = typeof title === 'string' ? title.trim() : '';
    description = typeof description === 'string' ? description.trim() : '';
    if (!title) return res.status(400).send({ message: 'Kulang ang title.' });
    try {
        let result;
        if (HAS_PAGES_COLUMN) {
            const sql = `INSERT INTO \`${THEME_TABLE}\` (title, \`${DESCRIPTION_COLUMN}\`, pages) VALUES (?, ?, ?)`;
            [result] = await dbp.execute(sql, [title, description, pages]);
        } else {
            const sql = `INSERT INTO \`${THEME_TABLE}\` (title, \`${DESCRIPTION_COLUMN}\`) VALUES (?, ?)`;
            [result] = await dbp.execute(sql, [title, description]);
        }
        const insertId = result && result.insertId;
        if (insertId) {
            const cols = [`id`, `title`, `\`${DESCRIPTION_COLUMN}\` as description`];
            if (HAS_PAGES_COLUMN) cols.push('pages');
            cols.push('created_at');
            const sql2 = `SELECT ${cols.join(', ')} FROM \`${THEME_TABLE}\` WHERE id = ?`;
            const [rows] = await dbp.execute(sql2, [insertId]);
            return res.status(201).send({ theme: rows[0] });
        }
        return res.status(201).send({ theme: null });
    } catch (err) {
        console.error('Create theme error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// --- STANZAS (Talata) API - Poetic Threads ---
const STANZAS_PER_PAGE = 20;
const MAX_STANZAS_PER_DAY = 3;

// Helper: get/ensure user daily limits, apply daily reset if new day
async function getUserDailyLimits(userId) {
    const [rows] = await dbp.execute(
        'SELECT stanzas_written_today, last_submission_time, last_theme_id FROM user_daily_limits WHERE user_id = ?',
        [userId]
    );
    const today = new Date().toDateString();
    if (!rows || rows.length === 0) {
        await dbp.execute(
            'INSERT INTO user_daily_limits (user_id, stanzas_written_today, last_submission_time, last_theme_id) VALUES (?, 0, NULL, NULL) ON DUPLICATE KEY UPDATE user_id=user_id',
            [userId]
        );
        return { stanzas_written_today: 0, last_theme_id: null };
    }
    const r = rows[0];
    const lastDate = r.last_submission_time ? new Date(r.last_submission_time).toDateString() : null;
    if (lastDate !== today) {
        await dbp.execute(
            'UPDATE user_daily_limits SET stanzas_written_today = 0, last_theme_id = NULL WHERE user_id = ?',
            [userId]
        );
        return { stanzas_written_today: 0, last_theme_id: null };
    }
    return {
        stanzas_written_today: r.stanzas_written_today || 0,
        last_theme_id: r.last_theme_id || null
    };
}

// POST /stanzas - Submit a stanza (validation: 3/day, no back-to-back)
app.post('/stanzas', async (req, res) => {
    let { theme_id, author_id, content } = req.body || {};
    theme_id = parseInt(theme_id, 10);
    author_id = parseInt(author_id, 10);
    content = typeof content === 'string' ? content.trim() : '';
    if (!theme_id || !author_id || !content) {
        return res.status(400).send({ message: 'Kulang ang theme_id, author_id, o content.' });
    }
    try {
        const limits = await getUserDailyLimits(author_id);
        if (limits.stanzas_written_today >= MAX_STANZAS_PER_DAY) {
            return res.status(429).send({ message: 'Naabot mo na ang 3 talata bawat araw. Bumalik bukas, Makata!' });
        }
        if (Number(limits.last_theme_id) === theme_id) {
            return res.status(429).send({ message: 'Hindi ka maaaring magsulat ng magkasunod na talata sa parehong tema. Maghintay ng ibang makata.' });
        }
        const [approvedRows] = await dbp.execute(
            'SELECT COUNT(*) as c FROM stanzas WHERE theme_id = ? AND status = ?',
            [theme_id, 'approved']
        );
        const approvedCount = approvedRows && approvedRows[0] ? Number(Object.values(approvedRows[0])[0] || 0) : 0;
        const pageNumber = Math.floor(approvedCount / STANZAS_PER_PAGE) + 1;
        const [ins] = await dbp.execute(
            'INSERT INTO stanzas (theme_id, author_id, content, status, page_number) VALUES (?, ?, ?, ?, ?)',
            [theme_id, author_id, content, 'pending', pageNumber]
        );
        await dbp.execute(
            'UPDATE user_daily_limits SET stanzas_written_today = stanzas_written_today + 1, last_submission_time = NOW(), last_theme_id = ? WHERE user_id = ?',
            [theme_id, author_id]
        );
        const [rows] = await dbp.execute(
            'SELECT stanza_id, theme_id, author_id, content, status, page_number, created_at FROM stanzas WHERE stanza_id = ?',
            [ins.insertId]
        );
        return res.status(201).send({ message: 'Naipasa ang talata. Hintayin ang approval ng admin.', stanza: rows[0] });
    } catch (err) {
        console.error('Stanza submit error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// GET /stanzas/last?theme_id=X&n=5 - Last N approved stanzas (for continuation context)
app.get('/stanzas/last', async (req, res) => {
    const theme_id = parseInt(req.query.theme_id, 10);
    const n = Math.min(20, Math.max(1, parseInt(req.query.n, 10) || 5));
    if (!theme_id) return res.status(400).send({ message: 'Kailangan ang theme_id.' });
    try {
        const [rows] = await dbp.execute(
            `SELECT s.stanza_id, s.content, s.page_number, u.nick_name as author_name
             FROM stanzas s
             JOIN users u ON u.id = s.author_id
             WHERE s.theme_id = ? AND s.status = 'approved'
             ORDER BY s.stanza_id DESC
             LIMIT ?`,
            [theme_id, n]
        );
        return res.status(200).send({ stanzas: (rows || []).reverse() });
    } catch (err) {
        console.error('Get stanzas/last error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// GET /stanzas?theme_id=X&page=1&author_id=Y (optional) - Approved stanzas; if author_id given, also return that user's own pending/rejected as my_stanzas
app.get('/stanzas', async (req, res) => {
    const theme_id = parseInt(req.query.theme_id, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const author_id_raw = req.query.author_id;
    const author_id = author_id_raw !== undefined && author_id_raw !== '' ? parseInt(author_id_raw, 10) : NaN;
    const wantMyStanzas = Number.isInteger(author_id) && author_id > 0;
    const offset = (page - 1) * STANZAS_PER_PAGE;
    if (!theme_id) return res.status(400).send({ message: 'Kailangan ang theme_id.' });
    try {
        const [rows] = await dbp.execute(
            `SELECT s.stanza_id, s.theme_id, s.author_id, s.content, s.page_number, s.created_at, u.nick_name as author_name
             FROM stanzas s
             JOIN users u ON u.id = s.author_id
             WHERE s.theme_id = ? AND s.status = 'approved'
             ORDER BY s.stanza_id ASC
             LIMIT ? OFFSET ?`,
            [theme_id, STANZAS_PER_PAGE, offset]
        );
        const [totRows] = await dbp.execute(
            'SELECT COUNT(*) as c FROM stanzas WHERE theme_id = ? AND status = ?',
            [theme_id, 'approved']
        );
        const total = totRows && totRows[0] ? Number(Object.values(totRows[0])[0] || 0) : 0;
        const payload = {
            stanzas: rows,
            page,
            total_pages: Math.ceil(total / STANZAS_PER_PAGE),
            total
        };
        if (wantMyStanzas) {
            const [myRows] = await dbp.execute(
                `SELECT s.stanza_id, s.theme_id, s.author_id, s.content, s.status, s.page_number, s.created_at, u.nick_name as author_name
                 FROM stanzas s
                 JOIN users u ON u.id = s.author_id
                 WHERE s.theme_id = ? AND s.author_id = ? AND s.status != 'approved'
                 ORDER BY s.created_at DESC`,
                [theme_id, author_id]
            );
            payload.my_stanzas = myRows || [];
        }
        return res.status(200).send(payload);
    } catch (err) {
        console.error('Get stanzas error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});
app.get('/countUsers', async (req, res) => {
    try {
        const [rows] = await dbp.execute('SELECT COUNT(*) as c FROM users');
        const count = rows && rows[0] ? Number(rows[0].c || 0) : 0;
        return res.status(200).send({ count });
    } catch (err) {
        console.error('Count users error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

app.get('/countStanzas', async (req, res) => {
    try {
        const [rows] = await dbp.execute("SELECT COUNT(*) as c FROM stanzas WHERE status = 'approved'");
        const count = rows && rows[0] ? Number(rows[0].c || 0) : 0;
        return res.status(200).send({ count });
    } catch (err) {
        console.error('Count stanzas error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

app.get('/countThemes', async (req, res) => {
    try {
        const [rows] = await dbp.execute("SELECT COUNT(*) as c FROM themes");
        const count = rows && rows[0] ? Number(rows[0].c || 0) : 0;
        return res.status(200).send({ count });
    } catch (err) {
        console.error('Count stanzas error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// GET /notifications/approved-count?author_id=X - Bilang ng na-approve na talata ng user (para sa notification bell)
app.get('/notifications/approved-count', async (req, res) => {
    const author_id = parseInt(req.query.author_id, 10);
    if (!author_id || author_id < 1) return res.status(400).send({ message: 'Kailangan ang author_id.' });
    try {
        const [rows] = await dbp.execute(
            'SELECT COUNT(*) as c FROM stanzas WHERE author_id = ? AND status = ?',
            [author_id, 'approved']
        );
        const count = rows && rows[0] ? Number(rows[0].c || 0) : 0;
        return res.status(200).send({ count });
    } catch (err) {
        console.error('Notifications approved-count error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// GET /stanzas/pending - Admin only: pending stanzas for moderation
app.get('/stanzas/pending', async (req, res) => {
    const adminId = parseInt(req.query.admin_id, 10);
    if (!adminId) return res.status(400).send({ message: 'Kailangan ang admin_id.' });
    try {
        const [admin] = await dbp.execute('SELECT role FROM users WHERE id = ?', [adminId]);
        if (!admin || admin.length === 0 || (admin[0].role || '').toLowerCase() !== 'admin') {
            return res.status(403).send({ message: 'Admin lang ang may access.' });
        }
        const [rows] = await dbp.execute(
            `SELECT s.stanza_id, s.theme_id, s.author_id, s.content, s.status, s.page_number, s.created_at, u.nick_name as author_name, t.title as theme_title
             FROM stanzas s
             JOIN users u ON u.id = s.author_id
             JOIN ${THEME_TABLE} t ON t.id = s.theme_id
             WHERE s.status = 'pending'
             ORDER BY s.created_at ASC`
        );
        return res.status(200).send({ pending: rows });
    } catch (err) {
        console.error('Get pending error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// PATCH /stanzas/:id/status - Admin only: approve or reject
app.patch('/stanzas/:id/status', async (req, res) => {
    const stanzaId = parseInt(req.params.id, 10);
    const { admin_id, status } = req.body || {};
    const adminId = parseInt(admin_id, 10);
    const s = (status || '').toLowerCase();
    if (!stanzaId || !adminId || !['approved', 'rejected'].includes(s)) {
        return res.status(400).send({ message: 'Kailangan ang admin_id at status (approved/rejected).' });
    }
    try {
        const [admin] = await dbp.execute('SELECT role FROM users WHERE id = ?', [adminId]);
        if (!admin || admin.length === 0 || (admin[0].role || '').toLowerCase() !== 'admin') {
            return res.status(403).send({ message: 'Admin lang ang may access.' });
        }
        await dbp.execute('UPDATE stanzas SET status = ? WHERE stanza_id = ?', [s, stanzaId]);
        return res.status(200).send({ message: s === 'approved' ? 'Na-approve ang talata.' : 'Nireject ang talata.' });
    } catch (err) {
        console.error('Update stanza status error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// Admin stats - use /adminstats to avoid path conflicts
app.get('/adminstats', async (req, res) => {
    const adminId = parseInt(req.query.admin_id, 10);
    if (!adminId) return res.status(400).send({ message: 'Kailangan ang admin_id.' });
    try {
        const [admin] = await dbp.execute('SELECT role FROM users WHERE id = ?', [adminId]);
        if (!admin || admin.length === 0 || (admin[0].role || '').toLowerCase() !== 'admin') {
            return res.status(403).send({ message: 'Admin lang ang may access.' });
        }
        const [userRows] = await dbp.execute('SELECT COUNT(*) as c FROM users');
        let themeRows = [[{ c: 0 }]];
        try {
            [themeRows] = await dbp.execute(`SELECT COUNT(*) as c FROM \`${THEME_TABLE}\``);
        } catch (e) {
            try {
                const alt = THEME_TABLE === 'tema' ? 'themes' : 'tema';
                [themeRows] = await dbp.execute(`SELECT COUNT(*) as c FROM \`${alt}\``);
            } catch (_) {}
        }
        const [pendRows] = await dbp.execute("SELECT COUNT(*) as c FROM stanzas WHERE status = 'pending'");
        const [apprRows] = await dbp.execute("SELECT COUNT(*) as c FROM stanzas WHERE status = 'approved'");
        const [rejRows] = await dbp.execute("SELECT COUNT(*) as c FROM stanzas WHERE status = 'rejected'");
        const getCount = (rows) => (rows && rows[0] ? Number(Object.values(rows[0])[0] || 0) : 0);
        return res.status(200).send({
            users: getCount(userRows),
            themes: getCount(themeRows),
            pending: getCount(pendRows),
            approved: getCount(apprRows),
            rejected: getCount(rejRows)
        });
    } catch (err) {
        console.error('Admin stats error:', err && err.stack ? err.stack : err);
        return res.status(500).send({ message: 'May error sa server.' });
    }
});

// Serve static files (css, assets, etc.) at project root
const projectRoot = path.join(__dirname, '..');
const staticMiddleware = express.static(projectRoot);
app.use(staticMiddleware);

// Root (/) = Admin Dashboard direkt
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'pages', 'admin.html'));
});

// Export app para sa Vercel serverless; listen lang kapag local
module.exports = app;
if (!process.env.VERCEL) {
    app.listen(process.env.PORT || 3000, () => console.log("Server running on port", process.env.PORT || 3000));
}