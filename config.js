import db from './db.js';

export function getConfig(key) {
  return new Promise((resolve) => {
    db.get('SELECT value FROM config WHERE key = ?', [key], (_, row) => {
      if (!row) {
        resolve(null);
      } else {
        resolve(row.value);
      }
    });
  });
}

export function setConfig(key, value) {
  db.run('INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)', [key, value]);
  console.log(`Config updated: ${key} = ${value}`);
}

export function setStopAll(val) {
  setConfig('stop_all', String(val));
  console.log(`Stop signal sent. Workers will finish current job and exit.`);
}