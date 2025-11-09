import db from './db.js';
import { getConfig } from './config.js';

export async function enqueue(jsonStr) {
  let obj;
  try {
    obj = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    return;
  }

  if (!obj.command || typeof obj.command !== 'string') {
    console.error('Job must have a "command" string.');
    return;
  }

  if (!obj.id) {
    console.error('Job must have a valid id');
    return;
  }

  const now = new Date().toISOString();
  const maxRetries = await getConfig('max_retries');

  const job = {
    id: obj.id,
    command: obj.command,
    state: 'pending',
    attempts: 0,
    max_retries: obj.max_retries || Number(maxRetries),
    priority: obj.priority ? Number(obj.priority) : 100,
    run_at: obj.run_at || null,
    timeout_sec: obj.timeout_sec ? Number(obj.timeout_sec) : null,
    created_at: now,
    updated_at: now,
    last_error: null,
    last_output: null
  };

  const sql = `
  INSERT INTO jobs (id, command, state, attempts, max_retries, priority, run_at, created_at, updated_at, last_error, last_output, timeout_sec)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
  job.id, job.command, job.state, job.attempts, job.max_retries,
  job.priority, job.run_at, job.created_at, job.updated_at,
  job.last_error, job.last_output, job.timeout_sec
  ];

  db.run(sql, params, (err) => {
    if (err) return console.error('DB insert error:', err.message);
    console.log('Enqueued job:', job.id);
  });
}

export function listByState(state) {
  const validStates = ['pending','processing','completed','dead'];
  if (!validStates.includes(state)) {
    console.error('Invalid state:', state);
    return;
  }

  db.all(
    `SELECT id, command, state, attempts, max_retries, priority, created_at, updated_at, last_output, last_error
     FROM jobs
     WHERE state = ?`,
    [state],
    (err, rows) => {
      if (err) {
        console.error('DB error:', err.message);
        return;
      }
      if (!rows || rows.length === 0) {
        console.log(`No jobs in state: ${state}`);
        return;
      }
      rows.forEach(r => {
        console.log(`${r.id} | ${r.state} | tries ${r.attempts}/${r.max_retries} | priority ${r.priority} | cmd: ${r.command} | created at: ${r.created_at} | updated at: ${r.updated_at} | last_error: ${r.last_error} | last_output: ${r.last_output}`);
      });
    }
  );
}

export function listDLQ() {
    db.all(
      `SELECT id, command, attempts, max_retries, last_error
       FROM jobs
       WHERE state = 'dead'`,
      [],
      (err, rows) => {
        if (err) {
          console.error('DB error:', err.message);
          return;
        }
        if (!rows || rows.length === 0) {
          console.log('No jobs in DLQ');
          return;
        }
        rows.forEach(r => {
          const errMsg = (r.last_error || '').split('\n')[0];
          console.log(`${r.id} | attempts ${r.attempts}/${r.max_retries} | cmd: ${r.command} | last_error: ${errMsg}`);
        });
      }
    );
  }

export function retryFromDLQ(jobId) {
  const sql = `
    UPDATE jobs
    SET state='pending',
        attempts=0,
        run_at = datetime('now'),
        updated_at = datetime('now'),
        last_error = NULL,
        last_output = NULL
    WHERE id = ? AND state='dead'
  `;
  db.run(sql, [jobId], function (err) {
    if (err) {
      console.error('DB error:', err.message);
      return;
    }
    if (this.changes === 0) {
      console.log('No dead job found with id:', jobId);
    } else {
      console.log('Moved job back to pending:', jobId);
    }
  });
}

export function status() {
  const sql = `
    SELECT state, COUNT(*) as cnt
    FROM jobs
    GROUP BY state
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('DB error:', err.message);
      return;
    }
    const counts = { pending: 0, processing: 0, completed: 0, dead: 0 };
    rows.forEach(r => {
      if (counts.hasOwnProperty(r.state)) counts[r.state] = r.cnt;
    });

    console.log('Jobs: pending=%d, processing=%d, completed=%d, dead=%d',
      counts.pending, counts.processing, counts.completed, counts.dead);
    console.log('Active workers (approx):', counts.processing);

  });
}