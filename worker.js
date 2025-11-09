import sqlite3pkg from 'sqlite3';
const sqlite3 = sqlite3pkg.verbose();
import { exec } from 'child_process';

function getConfigValue(db, key, cb) {
  db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
    if (err) {
      console.error('DB error:', err.message);
      return;
    }
    else cb(row.value);
  });
}

function claimOne(db, callback) {
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE', (beginErr) => {
      if (beginErr) {
        db.run('ROLLBACK', () => callback(null));
        return;
      }

      db.get(
        `SELECT id FROM jobs
         WHERE state='pending' AND (run_at IS NULL OR datetime(run_at) <= datetime('now'))
         ORDER BY priority ASC, datetime(created_at) ASC
         LIMIT 1`,
        [],
        (selErr, row) => {
          if (selErr) {
            console.error('DB error:', selErr.message);
            db.run('ROLLBACK', () => callback(null));
            return;
          }
          if (!row) {
            db.run('COMMIT', () => callback(null));
            return;
          }

          const jobId = row.id;
          db.run(
            `UPDATE jobs
             SET state='processing', updated_at = datetime('now')
             WHERE id = ? AND state='pending'`,
            [jobId],
            function (updErr) {
              if (updErr) {
                console.error('DB error:', updErr.message);
                db.run('ROLLBACK', () => callback(null));
                return;
              }
              if (this.changes === 1) {
                db.run('COMMIT', () => callback(jobId));
              } else {
                db.run('ROLLBACK', () => callback(null));
              }
            }
          );
        }
      );
    });
  });
}

function runJob(db, jobId, done) {
  db.get('SELECT * FROM jobs WHERE id = ?', [jobId], (err, job) => {
    if (err || !job) {
      if (err) console.error('DB error:', err.message);
      done();
      return;
    }

    getConfigValue(db, 'default_timeout_sec', (timeoutVal) => {
      getConfigValue(db, 'backoff_base', (baseVal) => {
        const timeoutMs = Number(timeoutVal) * 1000;
        const base = Number(baseVal);

        const startTime = Date.now();
        const options = {};
        let finalTimeoutMs = timeoutMs;
        if (job.timeout_sec != null) {
            const t = Number(job.timeout_sec);
            if (!isNaN(t) && t > 0) finalTimeoutMs = t * 1000;
        }
        if (finalTimeoutMs > 0) options.timeout = finalTimeoutMs;

        exec(job.command, options, (error, stdout, stderr) => {
          const durMs = Date.now() - startTime;

          if (!error) {
            db.run(
              `UPDATE jobs
               SET state='completed',
                   updated_at = datetime('now'),
                   last_output = ?
               WHERE id = ?`,
              [truncateOutput(stdout), jobId],
              (err2) => {
                if (err2) console.error('DB update error:', err2.message);
                console.log(`[worker] job ${jobId} completed in ${durMs}ms`);
                done();
              }
            );
          } else {
            const attempts = (job.attempts || 0) + 1;
            const delaySeconds = Math.pow(base, attempts);
            if (attempts <= job.max_retries) {
              db.run(
                `UPDATE jobs
                 SET state='pending',
                     attempts = ?,
                     run_at = datetime('now', '+' || ? || ' seconds'),
                     updated_at = datetime('now'),
                     last_error = ?
                 WHERE id = ?`,
                [attempts, String(delaySeconds), (stderr || error.message || '').toString().slice(0, 4000), jobId],
                (err3) => {
                  if (err3) console.error('DB update error:', err3.message);
                  console.log(`[worker] job ${jobId} failed (attempt ${attempts}/${job.max_retries}), retry in ${delaySeconds}s`);
                  done();
                }
              );
            } else {
              db.run(
                `UPDATE jobs
                 SET state='dead',
                     attempts = ?,
                     updated_at = datetime('now'),
                     last_error = ?
                 WHERE id = ?`,
                [attempts, (stderr || error.message || '').toString().slice(0, 4000), jobId],
                (err4) => {
                  if (err4) console.error('DB update error:', err4.message);
                  console.log(`[worker] job ${jobId} moved to DLQ after ${attempts} attempts`);
                  done();
                }
              );
            }
          }
        });
      });
    });
  });
}

function truncateOutput(s) {
  if (!s) return null;
  if (s.length > 4000) return s.slice(0, 4000);
  return s;
}

export function loopOne(db) {
    db.get(`SELECT value FROM config WHERE key='stop_all'`, [], (e, row) => {
      if (!e && row && row.value === '1') {
        console.log('[worker] stop flag set, exiting after current cycle');
        setTimeout(() => db.close(() => process.exit(0)), 300);
        return;
      }
  
      claimOne(db, (jobId) => {
        if (!jobId) {
          getConfigValue(db, 'poll_interval_ms', (val) => {
            const ms = parseInt(val, 10) || 500;
            setTimeout(() => loopOne(db), ms);
          });
          return;
        }
        runJob(db, jobId, () => {
          setImmediate(() => loopOne(db));
        });
      });
    });
  }

export function start(count) {
    const n = parseInt(count, 10) || 1;
    console.log(`[worker] starting ${n} loops`);
  
    const initDb = new sqlite3.Database('./queue.db');
    initDb.run(
      `INSERT INTO config(key,value) VALUES('stop_all','0')
       ON CONFLICT(key) DO UPDATE SET value='0'`,
      [],
      () => initDb.close()
    );
  
    const conns = [];
    for (let i = 0; i < n; i++) {
      const conn = new sqlite3.Database('./queue.db');
      conns.push(conn);
      loopOne(conn);
    }
  
    process.on('SIGINT', () => {
      console.log('\n[worker] stopping after current jobs...');
      setTimeout(() => {
        conns.forEach(c => c.close());
        process.exit(0);
      }, 1000);
    });
  }