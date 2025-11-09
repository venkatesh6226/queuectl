
import { Command } from 'commander';
import './db.js';

import {
  enqueue,
  listByState,
  listDLQ,
  retryFromDLQ,
  status
} from './jobs.js';

import { start } from './worker.js';
import { getConfig, setConfig } from './config.js';

const program = new Command();

program
  .name('queuectl')
  .description('Simple background job queue CLI')
  .version('0.1.0');

program
  .command('enqueue <json>')
  .description('Add a new job to the queue from a JSON string')
  .action((json) => {
    enqueue(json);
  });

program
  .command('worker')
  .description('Manage workers')
  .option('--count <n>', 'number of workers to start', '1')
  .action((flags) => {
    start(flags.count);
  });

program
  .command('worker:stop')
  .description('Stop running workers gracefully')
  .action(() => {
    setConfig('stop_all', '1');
  });

program
  .command('status')
  .description('Show summary of job states & active workers')
  .action(() => {
    status();
  });

program
  .command('list')
  .description('List jobs by state')
  .option('--state <state>', 'pending|processing|completed|dead', 'pending')
  .action((flags) => {
    listByState(flags.state);
  });

program
  .command('dlq:list')
  .description('List jobs in Dead Letter Queue')
  .action(() => {
    listDLQ();
  });

program
  .command('dlq:retry <jobId>')
  .description('Retry a job from the DLQ')
  .action((jobId) => {
    retryFromDLQ(jobId);
  });

program
  .command('config:get <key>')
  .description('Get a config value')
  .action(async (key) => {
    const value = await getConfig(key);
    if (value === null) {
      console.log(`No config found for "${key}"`);
    } else {
      console.log(`${key} = ${value}`);
    }
  });

program
  .command('config:set <key> <value>')
  .description('Set a config value')
  .action((key, value) => {
    setConfig(key, value);
  });

program.parse(process.argv);