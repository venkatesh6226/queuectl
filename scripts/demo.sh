# Simple demo script for queuectl
# Runs through basic flows:
# - clean db
# - init
# - enqueue jobs
# - run workers
# - show status + DLQ
# - retry from DLQ
# - stop workers

echo "== QueueCTL Demo =="

# always run from project root
cd "$(dirname "$0")/.." || exit 1

echo
echo "== Clean start =="
rm -f queue.db

echo
echo "== Init database =="
node db.js

echo
echo "== Show default config =="
node queuectl.js config:get max_retries
node queuectl.js config:get backoff_base

echo
echo "== Enqueue some jobs =="

# simple success jobs
node queuectl.js enqueue '{"id":"job-hello","command":"echo hello from job-hello"}'
node queuectl.js enqueue '{"id":"job-sleep","command":"sleep 1 && echo done sleeping"}'

# failing job to test retries + DLQ
node queuectl.js enqueue '{"id":"job-fail","command":"bash -c \"exit 2\"","max_retries":2}'

echo
echo "== Start workers (2) =="
node queuectl.js worker --count 2 &
WORKER_PID=$!

# give workers time to process
sleep 8

echo
echo "== Status after processing =="
node queuectl.js status

echo
echo "== List completed jobs =="
node queuectl.js list --state completed

echo
echo "== DLQ list =="
DLQ_OUTPUT=$(node queuectl.js dlq:list)

echo "$DLQ_OUTPUT"

# try retrying first DLQ job if exists
FIRST_DEAD_ID=$(echo "$DLQ_OUTPUT" | head -n 1 | awk '{print $1}')

if echo "$DLQ_OUTPUT" | grep -q "No jobs in DLQ"; then
  echo "No DLQ jobs to retry."
elif [ -n "$FIRST_DEAD_ID" ]; then
  echo
  echo "== Retry first DLQ job: $FIRST_DEAD_ID =="
  node queuectl.js dlq:retry "$FIRST_DEAD_ID"
else
  echo
  echo "Could not detect a DLQ job id."
fi

# give worker a moment to pick retried job (if any)
sleep 5

echo
echo "== Final status =="
node queuectl.js status

echo
echo "== Stop workers =="
node queuectl.js worker:stop

# if the background worker is still running, kill it
if ps -p "$WORKER_PID" > /dev/null 2>&1; then
  kill "$WORKER_PID" >/dev/null 2>&1 || true
fi

echo
echo "== Demo finished =="