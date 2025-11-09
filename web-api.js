import http from 'http';
import url from 'url';
import sqlite3pkg from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const sqlite3 = sqlite3pkg.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'queue.db');

function getDb() {
  return new sqlite3.Database(dbPath);
}

function sendJson(res, status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  }

function handleStatus(res) {
  const db = getDb();
  const result = {
    counts: { pending: 0, processing: 0, completed: 0, dead: 0 },
    stop_flag: '0',
    recent: []
  };

  db.all('SELECT state, COUNT(*) as cnt FROM jobs GROUP BY state', [], (err, rows) => {
    if (!err && rows) {
      rows.forEach(r => {
        if (result.counts.hasOwnProperty(r.state)) {
          result.counts[r.state] = r.cnt;
        }
      });
    }

    db.get(`SELECT value FROM config WHERE key='stop_all'`, [], (e2, row2) => {
      if (!e2 && row2) {
        result.stop_flag = row2.value;
      }

      db.all(
        `SELECT id, state, command, updated_at
         FROM jobs
         ORDER BY datetime(updated_at) DESC
         LIMIT 10`,
        [],
        (e3, recent) => {
          if (!e3 && recent) {
            result.recent = recent;
          }
          db.close();
          sendJson(res, 200, result);
        }
      );
    });
  });
}

function handleJobs(res, query) {
  const state = query.state || 'pending';
  const allowed = ['pending', 'processing', 'completed', 'dead'];
  const s = allowed.includes(state) ? state : 'pending';

  const db = getDb();
  db.all(
    `SELECT id, state, command, attempts, max_retries, priority, run_at, updated_at
     FROM jobs
     WHERE state = ?
     ORDER BY datetime(updated_at) DESC
     LIMIT 50`,
    [s],
    (err, rows) => {
      db.close();
      if (err) {
        sendJson(res, 500, { error: err.message });
        return;
      }
      sendJson(res, 200, { state: s, jobs: rows || [] });
    }
  );
}

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
  
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }
  
    if (parsed.pathname === '/api/status') {
      handleStatus(res);
    } else if (parsed.pathname === '/api/jobs') {
      handleJobs(res, parsed.query);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

const PORT = process.env.API_PORT || 4000;
server.listen(PORT, () => {
  console.log('queuectl API running on http://localhost:' + PORT);
});