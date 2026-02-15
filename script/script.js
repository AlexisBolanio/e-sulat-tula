const modal = document.getElementById('authModal');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const openRegisterBtn = document.getElementById('openRegisterBtn');
const closeModalBtn = document.getElementById('closeModal');

function toggleAuth() {
	// toggle between login and register views inside the same modal
	if (loginBox.style.display === 'none') {
		loginBox.style.display = 'block';
		registerBox.style.display = 'none';
	} else {
		loginBox.style.display = 'none';
		registerBox.style.display = 'block';
	}
}

if (openRegisterBtn && modal) {
	openRegisterBtn.addEventListener('click', () => {
		modal.style.display = 'flex';
		if (loginBox) loginBox.style.display = 'none';
		if (registerBox) registerBox.style.display = 'block';
	});
}
const openLoginBtn = document.getElementById('openLoginBtn');
if (openLoginBtn && modal) {
	openLoginBtn.addEventListener('click', () => {
		modal.style.display = 'flex';
		if (loginBox) loginBox.style.display = 'block';
		if (registerBox) registerBox.style.display = 'none';
	});
}
if (closeModalBtn && modal) {
	closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
}
window.addEventListener('click', (e) => {
	if (modal && e.target === modal) modal.style.display = 'none';
});

// API base: same origin kapag naka-deploy (e.g. Vercel), else localhost o custom
const API_BASE = window.API_BASE || (typeof location !== 'undefined' && location.hostname !== 'localhost' && location.origin ? location.origin : 'http://localhost:3000');

// helper to show inline errors in the register form
function showRegisterError(msg) {
    const el = document.getElementById('registerError');
    if (!el) {
        alert(msg);
        return;
    }
    el.textContent = msg;
}

// helper to show inline errors for login form
function showLoginError(msg) {
    const el = document.getElementById('loginError');
    if (!el) {
        showRegisterError(msg || 'May error.');
        return;
    }
    el.textContent = msg;
}

// helper: check server health with timeout
async function isServerAlive(timeout = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(id);
        return res.ok;
    } catch (err) {
        clearTimeout(id);
        return false;
    }
}

// Global loader helpers
function showGlobalLoader(text) {
    const g = document.getElementById('globalLoader');
    const t = document.getElementById('globalLoaderText');
    if (t && text) t.textContent = text;
    if (g) g.style.display = 'flex';
}
function hideGlobalLoader() {
    const g = document.getElementById('globalLoader');
    if (g) g.style.display = 'none';
}

// Register form submit (improved response handling + health check)
const registerForm = document.getElementById('registerForm');
if (registerForm) registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const data = {
        firstName: document.getElementById('regFirst').value,
        lastName: document.getElementById('regLast').value,
        nickName: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Nagpapadala...';
    showGlobalLoader('Nagpapadala...');
    showRegisterError(''); // clear previous

    // check backend health first
    const alive = await isServerAlive(3000);
    if (!alive) {
        // actionable message including command to start backend
        if (!navigator.onLine) {
            showRegisterError('Walang internet connection. Suriin ang iyong koneksyon at subukang muli.');
        } else {
            showRegisterError('Hindi maabot ang server. Siguraduhing tumatakbo ang backend at subukang muli. Sa terminal: cd a:\\E-SULAT-TULA\\script && node server.js');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        let payload = null;
        try {
            payload = await res.json();
        } catch {
            const txt = await res.text();
            payload = { message: txt || '' };
        }

        if (res.ok) {
            const successMsg = payload.message || 'Matagumpay ang pag-rehistro!';
            showRegisterError('');
            // show success modal (no alert)
            const createdUser = payload && payload.user ? payload.user : {
                first_name: data.firstName,
                last_name: data.lastName,
                nick_name: data.nickName,
                email: data.email
            };
            showSuccessModal(successMsg, createdUser);
            // persist login state so reload keeps user logged in
            saveLoggedInUser(createdUser);
            form.reset();
        } else {
            if (res.status === 409) {
                showRegisterError(payload.message || 'Ang email na ito ay naka-rehistro na.');
            } else if (res.status === 400) {
                showRegisterError(payload.message || 'Kulang ang required fields.');
            } else {
                showRegisterError(payload.message || 'May nangyaring error. Subukang muli.');
            }
        }
    } catch (err) {
        console.error(err);
        if (!navigator.onLine) {
            showRegisterError('Walang internet connection. Suriin ang iyong koneksyon at subukang muli.');
        } else {
            showRegisterError('Hindi maabot ang server. Siguraduhing tumatakbo ang backend sa http://localhost:3000 at subukang muli.');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        hideGlobalLoader();
    }
};

// Login form submit
const loginForm = document.getElementById('loginForm');
if (loginForm) loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const data = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };
    // client-side validation
    showLoginError('');
    if (!data.email || !data.password) {
        showLoginError('Paki-supply ang email at password.');
        return;
    }
    if (data.password.length < 6) {
        showLoginError('Ang password ay dapat hindi bababa sa 6 na karakter.');
        return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Nagpapasok...';
    showGlobalLoader('Nagpapasok...');

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        let payload = null;
        try { payload = await res.json(); } catch { payload = { message: 'Walang response mula sa server.' }; }
        if (res.ok) {
            const user = payload.user || {};
            saveLoggedInUser(user);
            showLoginError('');
            form.reset();
            const role = (user.role || user.Role || '').toString().toLowerCase();
            if (role === 'admin') {
                hideGlobalLoader();
                window.location.replace('/');
                return;
            }
            showSuccessModal(payload.message || 'Matagumpay na pag-login.', user);
        } else {
            if (res.status === 401) {
                showLoginError(payload.message || 'Maling email o password.');
            } else if (res.status === 400) {
                showLoginError(payload.message || 'Kulang ang email o password.');
            } else {
                showLoginError(payload.message || 'May nangyaring error. Subukang muli.');
            }
        }
    } catch (err) {
        console.error(err);
        showLoginError('Hindi maabot ang server. Siguraduhing tumatakbo ang backend.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        hideGlobalLoader();
    }
};

// clear login errors when user types
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
if (loginEmailInput) loginEmailInput.addEventListener('input', () => showLoginError(''));
if (loginPasswordInput) loginPasswordInput.addEventListener('input', () => showLoginError(''));

// Success modal helpers
function showSuccessModal(message, user) {
    const modalEl = document.getElementById('successModal');
    const msgEl = document.getElementById('successMessage');
    const nickEl = document.getElementById('nickname');

    if (msgEl) msgEl.textContent = message || 'Matagumpay ang pag-rehistro.';
    if (nickEl && user && (user.nick_name || user.nickName)) nickEl.textContent = user.nick_name || user.nickName;
    if (modalEl) modalEl.style.display = 'block';
    // also hide auth modal
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';
}

// wire up success modal close actions
const closeSuccessBtn = document.getElementById('closeSuccess');
const successOkBtn = document.getElementById('successOk');
if (closeSuccessBtn) closeSuccessBtn.addEventListener('click', () => document.getElementById('successModal').style.display = 'none');
if (successOkBtn) successOkBtn.addEventListener('click', () => document.getElementById('successModal').style.display = 'none');
window.addEventListener('click', (e) => {
    const sm = document.getElementById('successModal');
    if (e.target === sm) sm.style.display = 'none';
});

// --- Auth state helpers: persist user and toggle UI ---
const STORAGE_KEY = 'esulattula_user';
const NOTIF_SEEN_KEY = 'esulattula_seen_approvals';

function getNotifSeenCount(userId) {
    try {
        const raw = localStorage.getItem(NOTIF_SEEN_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return typeof obj[userId] === 'number' ? obj[userId] : 0;
    } catch (e) { return 0; }
}
function setNotifSeenCount(userId, count) {
    try {
        const raw = localStorage.getItem(NOTIF_SEEN_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        obj[userId] = count;
        localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify(obj));
    } catch (e) { console.warn('notif seen save error', e); }
}

function saveLoggedInUser(user) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user || {})); } catch (e) { console.warn('storage error', e); }
    updateAuthUI();
}

function clearLoggedInUser() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { console.warn('storage error', e); }
    updateAuthUI();
}

function getLoggedInUser() {
    try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}

function updateAuthUI() {
    const user = getLoggedInUser();
    const nickEl = document.getElementById('nickname');
    const adminNickEl = document.getElementById('adminNickname');
    const openBtn = document.getElementById('openRegisterBtn');
    const openLoginBtn = document.getElementById('openLoginBtn');
    const logoutBtnEl = document.getElementById('logoutBtn');
    const adminNav = document.getElementById('adminNavItem');
    const loginPrompt = document.getElementById('loginPrompt');
    const submitSection = document.getElementById('submitSection');
    const notifWrap = document.getElementById('navNotifWrap');
    if (user && (user.nick_name || user.nickName || user.first_name)) {
        const display = user.nick_name || user.nickName || user.first_name || 'Makata';
        if (nickEl) nickEl.textContent = display;
        if (adminNickEl) adminNickEl.textContent = display;
        if (openBtn) openBtn.style.display = 'none';
        if (openLoginBtn) openLoginBtn.style.display = 'none';
        if (logoutBtnEl) logoutBtnEl.style.display = 'inline-block';
        if (adminNav && (user.role || '').toLowerCase() === 'admin') adminNav.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';
        if (submitSection) submitSection.style.display = 'block';
        if (notifWrap) notifWrap.style.display = 'inline-flex';
        updateNotifBadge();
    } else {
        if (nickEl) nickEl.textContent = 'Makata';
        if (adminNickEl) adminNickEl.textContent = 'Admin';
        if (openBtn) openBtn.style.display = 'inline-block';
        if (openLoginBtn) openLoginBtn.style.display = 'inline-block';
        if (logoutBtnEl) logoutBtnEl.style.display = 'none';
        if (adminNav) adminNav.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
        if (submitSection) submitSection.style.display = 'none';
        if (notifWrap) notifWrap.style.display = 'none';
        hideNotifDropdown();
    }
}

async function updateNotifBadge() {
    const user = getLoggedInUser();
    const authorId = user && (user.id !== undefined && user.id !== null) ? Number(user.id) : NaN;
    const bell = document.getElementById('navNotifBell');
    const badge = document.getElementById('navNotifBadge');
    if (!bell || !badge || !(authorId > 0)) return;
    try {
        const res = await fetch(`${API_BASE}/notifications/approved-count?author_id=${authorId}`);
        const data = await res.json().catch(() => ({}));
        const count = res.ok ? (Number(data.count) || 0) : 0;
        const seen = getNotifSeenCount(String(authorId));
        const unread = Math.max(0, count - seen);
        bell.dataset.count = unread;
        bell.dataset.approvedCount = count;
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hide');
        if (count === 0) badge.classList.add('zero'); else badge.classList.remove('zero');
    } catch (e) { console.warn('Notif badge fetch failed', e); }
}

function showNotifDropdown(message) {
    const dropdown = document.getElementById('navNotifDropdown');
    const msgEl = document.getElementById('navNotifDropdownMsg');
    if (dropdown && msgEl) {
        msgEl.textContent = message || 'Walang bago.';
        dropdown.classList.add('show');
        dropdown.setAttribute('aria-hidden', 'false');
    }
}
function hideNotifDropdown() {
    const dropdown = document.getElementById('navNotifDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
        dropdown.setAttribute('aria-hidden', 'true');
    }
}
function setupNotifBellClick() {
    const bell = document.getElementById('navNotifBell');
    const closeBtn = document.getElementById('navNotifDropdownClose');
    if (bell) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            const user = getLoggedInUser();
            const authorId = user && user.id != null ? Number(user.id) : NaN;
            if (!(authorId > 0)) return;
            const count = parseInt(bell.dataset.approvedCount, 10) || 0;
            setNotifSeenCount(String(authorId), count);
            const badge = document.getElementById('navNotifBadge');
            if (badge) { badge.classList.add('hide'); bell.dataset.count = '0'; }
            const msg = count === 1 ? 'May 1 na-approve na talata ka!' : (count > 0 ? `May ${count} na-approve na talata ka!` : 'Wala ka pang na-approve na talata.');
            showNotifDropdown(msg);
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', hideNotifDropdown);
    document.addEventListener('click', function(e) {
        const wrap = document.getElementById('navNotifWrap');
        const dropdown = document.getElementById('navNotifDropdown');
        if (dropdown && dropdown.classList.contains('show') && wrap && !wrap.contains(e.target)) {
            hideNotifDropdown();
        }
    });
}
setupNotifBellClick();

// wire logout (navbar + admin dashboard)
// redirectUrl: string lang (e.g. '/pages/landpage.html'); huwag ipasa ang click event
function doLogout(redirectUrl) {
    showGlobalLoader('Umaalis...');
    setTimeout(() => {
        clearLoggedInUser();
        hideGlobalLoader();
        if (typeof redirectUrl === 'string' && redirectUrl) {
            window.location.href = redirectUrl;
            return;
        }
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'block';
            const lb = document.getElementById('login-box');
            const rb = document.getElementById('register-box');
            if (lb) lb.style.display = 'block';
            if (rb) rb.style.display = 'none';
        }
    }, 600);
}
const logoutBtnMain = document.getElementById('logoutBtn');
if (logoutBtnMain) logoutBtnMain.addEventListener('click', () => doLogout());
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', () => {
    doLogout('/pages/landpage.html');
});

// wire start writing button (landpage)
const startWritingBtn = document.getElementById('startWritingBtn');
if (startWritingBtn) startWritingBtn.addEventListener('click', () => {
    window.location.href = '/pages/magsulat.html';
});

// Hamburger menu (mobile)
(function() {
    const hamburger = document.getElementById('navHamburger');
    const navLinks = document.getElementById('navLinks');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            const open = navLinks.classList.toggle('is-open');
            hamburger.setAttribute('aria-expanded', open);
        });
        navLinks.querySelectorAll('a').forEach(function(a) {
            a.addEventListener('click', function() {
                navLinks.classList.remove('is-open');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });
    }
})();

// Dark mode toggle
(function() {
    const STORAGE_KEY = 'esulattula_theme';
    const DARK = 'dark';
    const LIGHT = 'light';
    function getStored() { try { return localStorage.getItem(STORAGE_KEY) || LIGHT; } catch (e) { return LIGHT; } }
    function setStored(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {} }
    function applyTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? DARK : LIGHT);
        document.body.classList.toggle('dark-mode', isDark);
        const icon = document.getElementById('navDarkIcon');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }
    var isDark = getStored() === DARK;
    applyTheme(isDark);
    const btn = document.getElementById('navDarkToggle');
    if (btn) {
        btn.addEventListener('click', function() {
            isDark = !isDark;
            setStored(isDark ? DARK : LIGHT);
            applyTheme(isDark);
        });
    }
})();

// initialize UI on load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    // Kapag admin ang naka-login at nasa landing page, direct sa admin dashboard
    const user = getLoggedInUser();
    if (user && (user.role || '').toLowerCase() === 'admin' && window.location.pathname.endsWith('landpage.html')) {
        window.location.replace('/');
    }
});