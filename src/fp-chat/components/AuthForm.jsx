export default function AuthForm({ userId, setUserId, onLogin, isLoggingIn }) {
  return (
    <div className="card">
      <h3>Sign in</h3>
      <div className="form-row">
        <label>User ID</label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter user ID"
          disabled={isLoggingIn}
          onKeyPress={(e) => {
            if (e.key === "Enter" && userId && !isLoggingIn) {
              onLogin();
            }
          }}
        />
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button
          className="btn primary"
          onClick={onLogin}
          disabled={isLoggingIn || !userId}
          style={{ width: "100%" }}
        >
          {isLoggingIn ? "Registering and logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}
