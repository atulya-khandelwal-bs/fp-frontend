import { useEffect, useState } from "react";
import config from "../../common/config.js";

// Cookie utility functions
const setCookie = (name, value, days = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export default function AuthForm({ userId, setUserId, onLogin, isLoggingIn }) {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(config.api.fetchCoaches);

        if (!response.ok) {
          throw new Error(`Failed to fetch coaches: ${response.status}`);
        }

        const data = await response.json();
        setCoaches(data.coaches || []);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching coaches:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCoaches();
  }, []);

  const handleCoachSelect = (coachId) => {
    setUserId(String(coachId));
    setCookie("loggedInUserId", String(coachId));
  };

  // Check for saved userId in cookies on mount
  useEffect(() => {
    const savedUserId = getCookie("loggedInUserId");
    if (savedUserId) {
      setUserId(savedUserId);
    }
  }, [setUserId]);

  return (
    <div className="card">
      <h3>Select Coach to Sign In</h3>
      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--muted)",
          }}
        >
          Loading coaches...
        </div>
      )}
      {error && (
        <div
          style={{
            padding: "1rem",
            background: "#fee2e2",
            color: "#dc2626",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          Error: {error}
        </div>
      )}
      {!loading && !error && coaches.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--muted)",
          }}
        >
          No coaches available
        </div>
      )}
      {!loading && !error && coaches.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          {coaches.map((coach) => (
            <div
              key={coach.coachId}
              onClick={() => handleCoachSelect(coach.coachId)}
              style={{
                border: `2px solid ${
                  userId === String(coach.coachId)
                    ? "var(--primary)"
                    : "var(--border)"
                }`,
                borderRadius: "12px",
                padding: "1rem",
                cursor: "pointer",
                transition: "all 0.2s",
                background:
                  userId === String(coach.coachId)
                    ? "var(--light-pink)"
                    : "var(--bg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
              }}
              onMouseEnter={(e) => {
                if (userId !== String(coach.coachId)) {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.background = "var(--light-gray)";
                }
              }}
              onMouseLeave={(e) => {
                if (userId !== String(coach.coachId)) {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--bg)";
                }
              }}
            >
              <img
                src={coach.coachPhoto || config.defaults.avatar}
                alt={coach.coachName}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid var(--border)",
                }}
                onError={(e) => {
                  e.target.src = config.defaults.avatar;
                }}
              />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontWeight: "600",
                    fontSize: "0.95rem",
                    color: "var(--text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {coach.coachName}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                  }}
                >
                  ID: {coach.coachId}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {userId && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            className="btn primary"
            onClick={onLogin}
            disabled={isLoggingIn}
            style={{ width: "100%" }}
          >
            {isLoggingIn
              ? "Registering and logging in..."
              : `Login as ${userId}`}
          </button>
        </div>
      )}
    </div>
  );
}
