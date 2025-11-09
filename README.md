# ⚙️ QueueCTL — CLI based background job queue system

🎥 **Video Walkthrough:**  
[Watch on Google Drive](https://drive.google.com/file/d/1oGLsGq6ddms8AmRZxdMRtV6OnCAzLr9k/view?usp=sharing)

A minimal, self-contained **job queue system** built using **Node.js** and **SQLite3**.  
It provides a CLI-based interface to enqueue, process, retry, and monitor background jobs — all without any external dependencies or servers.

---

## 🧩 1. Setup Instructions

### **Requirements**

- Node.js v18 or later
- SQLite3 (automatically installed with the `sqlite3` npm package)

### **Installation**

```bash
git clone `https://github.com/venkatesh6226/queuectl.git`
cd queuectl
npm install
```

### **Initialize the Database**

```bash
node db.js
```

This creates `queue.db` and inserts default configuration values such as:

- `max_retries`
- `default_timeout_sec`
- `poll_interval_ms`
- `backoff_base`
- `stop_all`

---

### **Start the Worker**

```bash
node queuectl.js worker --count 2
```

Starts 2 worker loops that continuously poll and process jobs in the background.

---

### **Start the Web Dashboard**

```bash
cd dashboard
npm install
npm run dev
```

The dashboard will launch on **http://localhost:5173** (or whichever port Vite assigns).  
It connects to the backend API to display job status, retry failed jobs, and view logs visually.

---

### **Start the REST API Server**

```bash
node web-api.js
```

This exposes endpoints to interact with the queue system programmatically or from the web dashboard.

---

## 🚀 2. Usage Examples

### **Enqueue a new job**

```bash
node cli.js enqueue '{"id":"job1","command":"echo hello","priority":1}'
```

**Output:**

```
Enqueued job: job1
```

### **List jobs by state**

```bash
node cli.js list pending
```

**Output:**

```
job1 | pending | tries 0/3 | priority 1 | cmd: echo hello | created_at: ... | updated_at: ...
```

### **Check queue status**

```bash
node cli.js status
```

**Output:**

```
Jobs: pending=1, processing=0, completed=0, dead=0
Active workers (approx): 0
```

### **View Dead Letter Queue (DLQ)**

```bash
node cli.js dlq
```

**Output:**

```
job9 | attempts 3/3 | cmd: fail.sh | last_error: Command failed: fail.sh
```

### **Retry a failed job**

```bash
node cli.js retry job9
```

**Output:**

```
Moved job back to pending: job9
```

---

## 🌐 3. Web Dashboard Overview

The **React.js dashboard** (found under `/dashboard`) provides a graphical interface for managing jobs.

### **Features:**

- Displays counts for `pending`, `processing`, `completed`, and `dead` jobs.
- View detailed job info (ID, command, retries, timestamps, output).
- Retry or delete jobs directly from the UI.
- Auto-refreshes every few seconds.
- Filter jobs by state or search by ID.

---

### **Tech Stack:**

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express (via `web-api.js`)
- **Database:** SQLite3
- **Communication:** REST APIs

---

### **API Endpoints (web-api.js)**

| Endpoint           | Method | Description                   |
| ------------------ | ------ | ----------------------------- |
| `/api/jobs`        | GET    | Fetch all jobs                |
| `/api/jobs/:state` | GET    | Get jobs by state             |
| `/api/job/:id`     | GET    | Get details of a specific job |
| `/api/enqueue`     | POST   | Enqueue a new job             |
| `/api/retry/:id`   | POST   | Retry a failed (dead) job     |
| `/api/status`      | GET    | Get current queue summary     |
| `/api/config/:key` | GET    | Get configuration value       |
| `/api/config/:key` | POST   | Update configuration value    |

---

## 🏗️ 4. Architecture Overview

### **Core Components**

| File          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `db.js`       | Initializes SQLite database and default values for `config` and `jobs` tables |
| `config.js`   | Reads and updates configuration values                                        |
| `jobs.js`     | Handles enqueue, list, DLQ, retry, and status logic                           |
| `worker.js`   | Core background worker that polls, executes jobs, handles retries             |
| `queuectl.js` | Command-line entrypoint that connects all components                          |

---

### **Job Lifecycle**

1. **Enqueue** — A job is inserted into the `jobs` table with state = `pending`.
2. **Claim** — A worker atomically selects one pending job using a transaction (`BEGIN IMMEDIATE`).
3. **Processing** — Job state changes to `processing` while the shell command runs via `child_process.exec()`.
4. **Completion / Failure** —
   - On success → job marked as `completed`.
   - On failure → `attempts` incremented, job rescheduled with exponential backoff.
5. **DLQ (Dead Letter Queue)** — If retries exceed `max_retries`, job moves to `dead` state.
6. **Retry from DLQ** — Jobs in `dead` can be retried manually, setting them back to `pending`.

---

### **Persistence**

- All job and configuration data are stored in a local SQLite database (`queue.db`).
- Each worker maintains its own database connection for isolation.
- Transactions ensure atomic updates and prevent multiple workers from claiming the same job.

---

## ⚖️ 5. Assumptions & Trade-offs

### **Assumptions**

- Single-node setup (no external message broker).
- Commands are shell-based (e.g., `echo`, `python script.py`).
- Default configuration values always exist (inserted by `db.js`).
- SQLite is used for simplicity and local persistence.

### **Trade-offs**

| Area           | Choice               | Reason                                          |
| -------------- | -------------------- | ----------------------------------------------- |
| DB Backend     | SQLite               | Lightweight, zero setup, perfect for local demo |
| Job Table      | Single-table design  | Easy to debug and extend                        |
| Concurrency    | Multiple connections | Enables parallel processing safely              |
| Retry Handling | Exponential backoff  | Simple, effective failure recovery              |
| Error Logging  | Store in DB          | Persistent and easy to inspect                  |
| Timeout        | `child_process.exec` | Prevents long-running commands                  |

---

## 🧪 6. Testing Instructions

### **1️⃣ Create DB and Defaults**

```bash
node db.js
```

### **2️⃣ Enqueue test jobs**

```bash
node cli.js enqueue '{"id":"job1","command":"echo hello"}'
node cli.js enqueue '{"id":"job2","command":"sleep 2 && echo done"}'
```

### **3️⃣ Start worker**

```bash
node cli.js start 2
```

### **4️⃣ Check Dashboard**

Visit **http://localhost:5173** to view jobs in real-time.

---

## 🧰 7. Demo Script (End-to-End Test)

You can use the included **`demo.sh`** to automatically test the queue system.

### **Run Demo**

```bash
chmod +x scripts/demo.sh
./scripts/demo.sh
```

### **What it does**

1. Cleans up any existing `queue.db`
2. Initializes default config
3. Enqueues a mix of success + failing jobs
4. Starts two workers
5. Waits for jobs to process
6. Displays job status and DLQ
7. Retries the first DLQ job (if present)
8. Stops workers gracefully

Example output:

```
== QueueCTL Demo ==

== Clean start ==
== Init database ==
== Enqueue some jobs ==
Enqueued job: job-hello
Enqueued job: job-sleep
Enqueued job: job-fail
== Start workers (2) ==
[worker] job job-hello completed in 15ms
[worker] job job-sleep completed in 2032ms
[worker] job job-fail moved to DLQ after 3 attempts
== Final status ==
Jobs: pending=0, processing=0, completed=2, dead=1
```

---

✅ **End-to-End tested and functional.**  
🎥 Watch the [video walkthrough](https://drive.google.com/file/d/1oGLsGq6ddms8AmRZxdMRtV6OnCAzLr9k/view?usp=sharing) for a complete demo.