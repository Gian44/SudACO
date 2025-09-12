const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process');

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const instancesDir = path.join(__dirname, '..', 'instances');

// List available instance files
app.get('/api/instances', (req, res) => {
  const type = req.query.type || 'general';
  const dir = path.join(instancesDir, type === 'logic' ? 'logic-solvable' : 'general');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(files.filter(f => f.endsWith('.txt')));
  });
});

// Upload puzzle file
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: req.file.path });
});

// Fetch puzzle file contents
app.get('/api/puzzle', (req, res) => {
  const name = req.query.name;
  const type = req.query.type || 'general';
  const file = path.join(instancesDir, type === 'logic' ? 'logic-solvable' : 'general', name);
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) return res.status(404).end();
    res.type('text/plain').send(data);
  });
});

// Stream solver progress using Server-Sent Events
app.get('/api/solve', (req, res) => {
  let file = req.query.path;
  const name = req.query.name;
  const type = req.query.type || 'general';
  if (!file && name) {
    file = path.join(instancesDir, type === 'logic' ? 'logic-solvable' : 'general', name);
  }
  if (!file) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const solver = spawn(path.join(__dirname, '..', 'sudokusolver'), ['--file', file, '--alg', req.query.alg || '0', '--verbose']);

  solver.stdout.on('data', (data) => {
    data.toString().split(/\r?\n/).forEach(line => {
      if (line.startsWith('PROGRESS ')) {
        const board = line.slice(9);
        res.write(`event: progress\ndata: ${board}\n\n`);
      }
    });
  });

  solver.on('close', (code) => {
    res.write(`event: done\ndata: ${code}\n\n`);
    res.end();
  });
});

// Run experiment script
app.post('/api/experiment', (req, res) => {
  const { type, size, fill, alg } = req.body;
  const script = path.join(__dirname, '..', 'scripts', 'run_experiment.py');
  const args = ['--type', type, '--alg', String(alg || 0), '--timeout', '10'];
  if (type === 'general') {
    args.push('--size', String(size));
    args.push('--fill', String(fill));
  }

  const py = spawn('python3', [script, ...args]);
  let out = '';
  py.stdout.on('data', d => { out += d.toString(); });
  py.on('close', () => {
    try {
      const json = JSON.parse(out.trim() || '{}');
      res.json(json);
    } catch (e) {
      res.status(500).json({ error: e.message, raw: out });
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));

