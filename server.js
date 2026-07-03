const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'habit-tracker-secret-key-change-in-production';

let pool = null;

async function initDB() {
  if (!DATABASE_URL) return;
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracker_data (
      id TEXT PRIMARY KEY,
      json_data JSONB NOT NULL
    )
  `);
  const adminHash = await bcrypt.hash('Naitik', 10);
  await pool.query(
    "INSERT INTO users (username, password, role) VALUES ($1, $2, 'admin') ON CONFLICT (username) DO UPDATE SET password = $2, role = 'admin'",
    ['naitikmishra', adminHash]
  );
  console.log('PostgreSQL connected');
}

async function loadData(id) {
  if (pool) {
    try {
      const result = await pool.query("SELECT json_data FROM tracker_data WHERE id = $1", [id]);
      if (result.rows.length > 0) return result.rows[0].json_data;
      return null;
    } catch (e) {
      console.error('DB load error:', e.message);
      return null;
    }
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const all = JSON.parse(raw);
      return all[id] || null;
    }
  } catch (e) {
    console.error('Error loading data:', e.message);
  }
  return null;
}

async function saveData(id, data) {
  if (pool) {
    try {
      await pool.query(
        "INSERT INTO tracker_data (id, json_data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET json_data = $2",
        [id, data]
      );
      return;
    } catch (e) {
      console.error('DB save error:', e.message);
    }
  }
  try {
    let all = {};
    if (fs.existsSync(DATA_FILE)) {
      all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    all[id] = data;
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.error('File save error:', e.message);
  }
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// ===== AUTH MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'No token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin only' });
  }
  next();
}

// ===== AUTH ENDPOINTS =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3) {
      return res.json({ ok: false, error: 'Username (min 3 chars) and password required' });
    }
    const pwErrors = [];
    if (password.length < 8) pwErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwErrors.push('one uppercase letter');
    if (!/[a-z]/.test(password)) pwErrors.push('one lowercase letter');
    if (!/[0-9]/.test(password)) pwErrors.push('one number');
    if (!/[^A-Za-z0-9]/.test(password)) pwErrors.push('one special character');
    if (pwErrors.length) {
      return res.json({ ok: false, error: 'Password must have: ' + pwErrors.join(', ') });
    }
    const hash = await bcrypt.hash(password, 10);
    if (pool) {
      await pool.query("INSERT INTO users (username, password, role) VALUES ($1, $2, 'user')", [username, hash]);
    } else {
      let all = {};
      if (fs.existsSync(DATA_FILE)) all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (!all._users) all._users = {};
      if (all._users[username]) return res.json({ ok: false, error: 'Username taken' });
      all._users[username] = { password: hash, role: 'user' };
      fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
    }
    const token = jwt.sign({ id: username, username, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, user: { username, role: 'user' } });
  } catch (e) {
    if (e.constraint && e.constraint.includes('users_username_key')) {
      return res.json({ ok: false, error: 'Username already taken' });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let user = null;
    if (pool) {
      const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
      if (result.rows.length > 0) user = result.rows[0];
    } else {
      const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (all._users && all._users[username]) user = all._users[username];
    }
    if (!user) return res.json({ ok: false, error: 'Invalid username or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ ok: false, error: 'Invalid username or password' });
    const token = jwt.sign({ id: username, username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, user: { username, role: user.role } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: { username: req.user.username, role: req.user.role } });
});

// ===== DEFAULT CHALLENGES (admin) =====
app.get('/api/default-challenges', async (req, res) => {
  const data = await loadData('default_challenges');
  res.json({ ok: true, data });
});

app.post('/api/default-challenges', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await saveData('default_challenges', req.body.data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== USER PROGRESS =====
app.get('/api/progress', authMiddleware, async (req, res) => {
  const data = await loadData('progress_' + req.user.id);
  res.json({ ok: true, data });
});

app.post('/api/progress', authMiddleware, async (req, res) => {
  try {
    await saveData('progress_' + req.user.id, req.body.data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== USER CHALLENGES =====
app.get('/api/user-challenges', authMiddleware, async (req, res) => {
  const data = await loadData('user_challenges_' + req.user.id);
  res.json({ ok: true, data });
});

app.post('/api/user-challenges', authMiddleware, async (req, res) => {
  try {
    await saveData('user_challenges_' + req.user.id, req.body.data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function getNetworkIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ip = getNetworkIP();
    console.log('╔══════════════════════════════════════════╗');
    console.log('║        Habit Tracker Server              ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║                                          ║');
    console.log(`║  Local:    http://localhost:${PORT}         ║`);
    console.log(`║  Network:  http://${ip}:${PORT}  ║`);
    console.log('║                                          ║');
    if (DATABASE_URL) {
      console.log('║  Data saved to: PostgreSQL                ║');
    } else {
      console.log('║  Data saved to: data.json                ║');
    }
    console.log('╚══════════════════════════════════════════╝');
  });
}).catch(err => {
  console.error('Failed to init DB, starting without persistence:', err.message);
  app.listen(PORT, '0.0.0.0', () => {
    const ip = getNetworkIP();
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
