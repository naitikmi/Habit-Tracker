const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

function loadData() {
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

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/data', (req, res) => {
  const data = loadData();
  if (data) {
    res.json({ ok: true, data });
  } else {
    res.json({ ok: false, data: null });
  }
});

app.post('/api/data', (req, res) => {
  try {
    saveData(req.body);
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
  console.log('║  Data saved to: data.json                ║');
  console.log('╚══════════════════════════════════════════╝');
});
