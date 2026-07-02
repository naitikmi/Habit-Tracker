const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

async function initDB() {
  if (!DATABASE_URL) return;
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracker_data (
      id TEXT PRIMARY KEY,
      json_data JSONB NOT NULL
    )
  `);
  console.log('PostgreSQL connected');
}

async function loadData(userId) {
  const id = userId || 'main';
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
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading data:', e.message);
  }
  return null;
}

async function saveData(data, userId) {
  const id = userId || 'main';
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
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

app.get('/api/data', async (req, res) => {
  const data = await loadData(req.query.userId);
  res.json({ ok: true, data });
});

app.post('/api/data', async (req, res) => {
  try {
    await saveData(req.body.data, req.body.userId);
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
    console.log('║  Open on your phone using the            ║');
    console.log('║  Network URL above.                      ║');
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
    console.log(`Network: http://${ip}:${PORT}`);
    console.log('Data saved to: data.json (fallback)');
  });
});
