import { useEffect, useState } from "react";

const API_URL = "http://localhost:4000";

function App() {
  const [status, setStatus] = useState(null);
  const [stateFilter, setStateFilter] = useState("pending");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  function loadStatus() {
    fetch(API_URL + "/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }

  function loadJobs(st) {
    setLoading(true);
    fetch(API_URL + "/api/jobs?state=" + encodeURIComponent(st))
      .then((res) => res.json())
      .then((data) => {
        setJobs(data.jobs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadStatus();
    loadJobs(stateFilter);
    const id = setInterval(() => {
      loadStatus();
      loadJobs(stateFilter);
    }, 4000);
    return () => clearInterval(id);
  }, [stateFilter]);

  return (
    <div style={container}>
      <h1 style={title}>queuectl Dashboard</h1>

      <div style={statusBox}>
        {status ? (
          <div style={statusRow}>
            <div style={statItem}>🟡 Pending: {status.counts.pending}</div>
            <div style={statItem}>🔵 Processing: {status.counts.processing}</div>
            <div style={statItem}>🟢 Completed: {status.counts.completed}</div>
            <div style={statItem}>🔴 Dead: {status.counts.dead}</div>
            <div style={statItem}>⏹ Stop flag: {status.stop_flag}</div>
          </div>
        ) : (
          <div>Loading status...</div>
        )}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "15px", fontWeight: "500" }}>
          View jobs by state:{" "}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={selectBox}
          >
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="dead">Dead</option>
          </select>
        </label>
      </div>

      <div style={tableWrapper}>
        {loading && <div style={loadingText}>Loading jobs...</div>}
        <table style={table}>
          <thead>
            <tr>
              {[
                "ID",
                "State",
                "Command",
                "Tries",
                "Priority",
                "Run At",
                "Updated At",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs && jobs.length > 0 ? (
              jobs.map((j, idx) => (
                <tr
                  key={j.id}
                  style={{
                    backgroundColor: idx % 2 ? "#fafafa" : "#fff",
                  }}
                >
                  <td style={td}>{j.id}</td>
                  <td style={td}>{j.state}</td>
                  <td style={td}>{j.command}</td>
                  <td style={td}>
                    {j.attempts}/{j.max_retries}
                  </td>
                  <td style={td}>{j.priority}</td>
                  <td style={td}>{j.run_at || "-"}</td>
                  <td style={td}>{j.updated_at || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={td} colSpan="7">
                  No jobs to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const container = {
  width: '100vw',          
  minHeight: '100vh',
  padding: '30px 50px',
  fontFamily: 'Inter, system-ui, sans-serif',
  backgroundColor: '#eef1f4',
  color: '#222',
  boxSizing: 'border-box', 
};

const title = {
  fontSize: "26px",
  fontWeight: 700,
  marginBottom: "20px",
  color: "#111",
};

const statusBox = {
  background: "#fff",
  padding: "14px 18px",
  borderRadius: "10px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  marginBottom: "18px",
};

const statusRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
  fontSize: "15px",
  fontWeight: "500",
};

const statItem = {
  background: "#f3f3f3",
  padding: "6px 12px",
  borderRadius: "8px",
};

const selectBox = {
  padding: "6px 10px",
  borderRadius: "5px",
  border: "1px solid #bbb",
  marginLeft: "4px",
  fontSize: "14px",
};

const tableWrapper = {
  background: "#fff",
  padding: "12px",
  borderRadius: "8px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "950px",
};

const th = {
  background: "#e2e6eb",
  color: "#111",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: "600",
  borderBottom: "2px solid #ccc",
};

const td = {
  padding: "8px 10px",
  borderBottom: "1px solid #ddd",
  color: "#333",
  fontSize: "13px",
  wordBreak: "break-word",
  verticalAlign: "top",
};

const loadingText = {
  marginBottom: "8px",
  fontSize: "13px",
  color: "#666",
};

export default App;