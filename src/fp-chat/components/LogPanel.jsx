export default function LogPanel({ logs }) {
  return (
    <div className="card">
      <h3>Activity</h3>
      <div className="log-panel">
        {logs.length === 0 ? (
          <div className="muted">No activity yet</div>
        ) : (
          logs.map((logEntry, i) => {
            const log = typeof logEntry === "string" ? logEntry : logEntry.log;
            return (
              <div key={i} className="log-item">
                {log}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
