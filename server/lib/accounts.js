const crypto = require("crypto");
const { Pool } = require("pg");

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;
const USERNAME_MIN = 1;
const USERNAME_MAX = 24;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 128;
const RESERVED_NAMES = new Set(["guest account"]);

// Setup PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost") ? { rejectUnauthorized: false } : false
});

// Dynamic Schema Initialization
async function initDb() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(24) UNIQUE NOT NULL,
                canonical VARCHAR(24) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                password_salt VARCHAR(255) NOT NULL,
                role VARCHAR(24) DEFAULT 'player',
                name_color VARCHAR(24),
                class VARCHAR(255),
                achievements JSONB DEFAULT '{}'::jsonb,
                stats JSONB DEFAULT '{"tanks": 0, "bosses": 0, "shapes": 0}'::jsonb,
                created_at BIGINT,
                last_login_at BIGINT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                token VARCHAR(255) PRIMARY KEY,
                account_id VARCHAR(36) REFERENCES accounts(id) ON DELETE CASCADE,
                username VARCHAR(24) NOT NULL,
                created_at BIGINT NOT NULL,
                expires_at BIGINT NOT NULL
            );
        `);
    } finally {
        client.release();
    }
}
initDb().catch(err => console.error("[DB ERROR]: Failed to initialize PostgreSQL tables:", err));

function canonicalName(name) {
    return String(name || "").trim().toLowerCase();
}

function validateUsername(name) {
    if (typeof name !== "string") return "Name must be text.";
    const trimmed = name.trim();
    if (trimmed.length < USERNAME_MIN) return "Name is too short.";
    if (trimmed.length > USERNAME_MAX) return "Name is too long.";
    for (const char of trimmed) {
        const code = char.charCodeAt(0);
        if (code < 0x20 || code > 0x7e) return "Name may only use characters from U+0020 to U+007E.";
    }
    if (RESERVED_NAMES.has(canonicalName(trimmed))) return "That name is reserved.";
    return null;
}

function validatePassword(password) {
    if (typeof password !== "string") return "Password must be text.";
    if (password.length < PASSWORD_MIN) return "Password is too short.";
    if (password.length > PASSWORD_MAX) return "Password is too long.";
    return null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
}

async function register(username, password) {
    const nameError = validateUsername(username);
    if (nameError) return { ok: false, error: nameError };
    const passwordError = validatePassword(password);
    if (passwordError) return { ok: false, error: passwordError };

    const trimmed = username.trim();
    const canonical = canonicalName(trimmed);

    try {
        const id = crypto.randomUUID();
        const { salt, hash } = hashPassword(password);
        const now = Date.now();
        const role = canonical === "phi" ? "developer" : "player";
        const achievements = {};
        const stats = { tanks: 0, bosses: 0, shapes: 0 };

        await pool.query(
            `INSERT INTO accounts (id, username, canonical, password_hash, password_salt, role, achievements, stats, created_at, last_login_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id, trimmed, canonical, hash, salt, role, JSON.stringify(achievements), JSON.stringify(stats), now, now]
        );

        const account = { id, username: trimmed, role, nameColor: null, class: null, achievements, stats, createdAt: now, lastLoginAt: now };
        
        // Create session
        const sessionToken = "acct_" + crypto.randomBytes(32).toString("base64url");
        const expiresAt = now + SESSION_TTL;
        await pool.query(
            `INSERT INTO sessions (token, account_id, username, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [sessionToken, id, trimmed, now, expiresAt]
        );

        return { ok: true, account, session: sessionToken };
    } catch (err) {
        if (err.code === '23505') {
            return { ok: false, error: "That name is already claimed." };
        }
        console.error("Error in registration:", err);
        return { ok: false, error: "Registration failed." };
    }
}

async function login(username, password) {
    try {
        const res = await pool.query("SELECT * FROM accounts WHERE canonical = $1", [canonicalName(username)]);
        const account = res.rows[0];
        if (!account) return { ok: false, error: "Invalid name or password." };

        const passwordHash = hashPassword(password, account.password_salt).hash;
        const valid = crypto.timingSafeEqual(Buffer.from(passwordHash, "hex"), Buffer.from(account.password_hash, "hex"));
        if (!valid) return { ok: false, error: "Invalid name or password." };

        const now = Date.now();
        await pool.query("UPDATE accounts SET last_login_at = $1 WHERE id = $2", [now, account.id]);

        const safeAcc = {
            id: account.id,
            username: account.username,
            role: account.username.toLowerCase() === "phi" ? "developer" : (account.role || "player"),
            nameColor: account.name_color || null,
            class: account.class || null,
            achievements: account.achievements || {},
            stats: account.stats || { tanks: 0, bosses: 0, shapes: 0 },
            createdAt: Number(account.created_at),
            lastLoginAt: now
        };

        const sessionToken = "acct_" + crypto.randomBytes(32).toString("base64url");
        const expiresAt = now + SESSION_TTL;
        await pool.query(
            `INSERT INTO sessions (token, account_id, username, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [sessionToken, account.id, account.username, now, expiresAt]
        );

        return { ok: true, account: safeAcc, session: sessionToken };
    } catch (err) {
        console.error("Error in login:", err);
        return { ok: false, error: "Login failed." };
    }
}

async function logout(sessionToken) {
    if (!sessionToken) return { ok: true };
    try {
        await pool.query("DELETE FROM sessions WHERE token = $1", [sessionToken]);
    } catch (err) {
        console.error("Error in logout:", err);
    }
    return { ok: true };
}

async function getAccountBySession(sessionToken) {
    if (!sessionToken || typeof sessionToken !== "string") return null;
    try {
        await pool.query("DELETE FROM sessions WHERE expires_at <= $1", [Date.now()]);

        const sessionRes = await pool.query("SELECT * FROM sessions WHERE token = $1", [sessionToken]);
        const session = sessionRes.rows[0];
        if (!session) return null;

        const accountRes = await pool.query("SELECT * FROM accounts WHERE id = $1", [session.account_id]);
        const account = accountRes.rows[0];
        if (!account) return null;

        return {
            id: account.id,
            username: account.username,
            role: account.username.toLowerCase() === "phi" ? "developer" : (account.role || "player"),
            nameColor: account.name_color || null,
            class: account.class || null,
            achievements: account.achievements || {},
            stats: account.stats || { tanks: 0, bosses: 0, shapes: 0 },
            createdAt: Number(account.created_at),
            lastLoginAt: Number(account.last_login_at)
        };
    } catch (err) {
        console.error("Error in getAccountBySession:", err);
        return null;
    }
}

async function getPermissionsForSession(sessionToken) {
    const account = await getAccountBySession(sessionToken);
    if (!account) return null;
    const role = account.role || "player";
    const permissions = {
        accountId: account.id,
        accountName: account.username,
        role,
        level: 0,
    };
    if (role === "moderator") permissions.level = 1;
    if (role === "admin" || role === "developer") {
        permissions.level = 3;
        permissions.administrator = true;
        permissions.class = "developer";
    }
    if (role === "shiny" || role === "shinyMember") {
        permissions.level = 2;
        permissions.class = "arrasMenu_shinyMember";
    }
    if (role === "youtuber") {
        permissions.level = 2;
        permissions.class = "arrasMenu_youtuber";
    }
    if (role === "betaTester" || role === "beta_tester") {
        permissions.level = 1;
        permissions.class = "arrasMenu_betaTester";
    }
    if (account.nameColor) permissions.nameColor = account.nameColor;
    if (account.class) permissions.class = account.class;
    return permissions;
}

async function recordKill(accountId, killType) {
    if (!accountId) return [];
    try {
        const res = await pool.query("SELECT * FROM accounts WHERE id = $1", [accountId]);
        const account = res.rows[0];
        if (!account) return [];

        const stats = account.stats || { tanks: 0, bosses: 0, shapes: 0 };
        const achievements = account.achievements || {};

        let category = '';
        if (killType === 'tank') category = 'tanks';
        else if (killType === 'boss') category = 'bosses';
        else if (killType === 'shape') category = 'shapes';
        else return [];

        stats[category] = (stats[category] || 0) + 1;
        const currentCount = stats[category];
        const newlyUnlocked = [];

        const achievementTiers = {
            tanks: [
                { limit: 1, id: 'kills_1', name: 'First Blood (Kill 1 tank)' },
                { limit: 5, id: 'kills_5', name: 'Skirmisher (Kill 5 tanks)' },
                { limit: 10, id: 'kills_10', name: 'Hunter (Kill 10 tanks)' },
                { limit: 50, id: 'kills_50', name: 'Apex Predator (Kill 50 tanks)' },
                { limit: 100, id: 'kills_100', name: 'Legendary (Kill 100 tanks)' },
                { limit: 500, id: 'kills_500', name: 'Godlike (Kill 500 tanks)' },
            ],
            bosses: [
                { limit: 1, id: 'bosses_1', name: 'Giant Slayer (Kill 1 boss)' },
                { limit: 5, id: 'bosses_5', name: 'Boss Hunter (Kill 5 bosses)' },
                { limit: 10, id: 'bosses_10', name: 'Raid Leader (Kill 10 bosses)' },
                { limit: 50, id: 'bosses_50', name: 'Demigod (Kill 50 bosses)' },
                { limit: 100, id: 'bosses_100', name: 'Titan Slayer (Kill 100 bosses)' },
                { limit: 500, id: 'bosses_500', name: 'Calamity (Kill 500 bosses)' },
            ],
            shapes: [
                { limit: 1, id: 'shapes_1', name: 'First Harvest (Kill 1 shape)' },
                { limit: 5, id: 'shapes_5', name: 'Farmer (Kill 5 shapes)' },
                { limit: 10, id: 'shapes_10', name: 'Harvester (Kill 10 shapes)' },
                { limit: 50, id: 'shapes_50', name: 'Gardener (Kill 50 shapes)' },
                { limit: 100, id: 'shapes_100', name: 'Clearcutter (Kill 100 shapes)' },
                { limit: 500, id: 'shapes_500', name: 'Industrialist (Kill 500 shapes)' },
                { limit: 1000, id: 'shapes_1000', name: 'Scourge of the Nest (Kill 1000 shapes)' },
                { limit: 5000, id: 'shapes_5000', name: 'Polygon Annihilator (Kill 5000 shapes)' },
                { limit: 10000, id: 'shapes_10000', name: 'Geometric Nightmare (Kill 10000 shapes)' },
            ]
        };

        const tiers = achievementTiers[category] || [];
        for (const tier of tiers) {
            if (currentCount >= tier.limit && !achievements[tier.id]) {
                achievements[tier.id] = Date.now();
                newlyUnlocked.push(tier.name);
            }
        }

        await pool.query(
            "UPDATE accounts SET stats = $1, achievements = $2 WHERE id = $3",
            [JSON.stringify(stats), JSON.stringify(achievements), accountId]
        );
        return newlyUnlocked;
    } catch (err) {
        console.error("Error in recordKill:", err);
        return [];
    }
}

async function grantAdWatcher(accountId) {
    if (!accountId) return { ok: false, error: "Account ID is required" };
    try {
        const res = await pool.query("SELECT * FROM accounts WHERE id = $1", [accountId]);
        const account = res.rows[0];
        if (!account) return { ok: false, error: "Account not found" };

        const achievements = account.achievements || {};
        if (achievements['ad_watcher']) {
            return { ok: true, alreadyEarned: true };
        }

        achievements['ad_watcher'] = Date.now();
        await pool.query("UPDATE accounts SET achievements = $1 WHERE id = $2", [JSON.stringify(achievements), accountId]);
        return { ok: true, newlyUnlocked: ["Ad Watcher (Watch an ad purely for an achievement 💀)"] };
    } catch (err) {
        console.error("Error in grantAdWatcher:", err);
        return { ok: false, error: "Database error" };
    }
}

async function updateAccountRole(username, role) {
    try {
        const canonical = canonicalName(username);
        const res = await pool.query(
            "UPDATE accounts SET role = $1 WHERE canonical = $2 RETURNING *",
            [role, canonical]
        );
        const account = res.rows[0];
        if (!account) return { ok: false, error: "Account not found." };
        return { ok: true, account };
    } catch (err) {
        console.error("Error updating role:", err);
        return { ok: false, error: "Database error." };
    }
}

module.exports = {
    register,
    login,
    logout,
    getAccountBySession,
    getPermissionsForSession,
    validateUsername,
    canonicalName,
    recordKill,
    grantAdWatcher,
    updateAccountRole,
};
