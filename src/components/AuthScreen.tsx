import { useState } from "react";

interface AuthScreenProps {
  status: "idle" | "connecting" | "syncing" | "error";
  error: string | null;
  onLogin: (baseUrl: string, username: string, password: string) => void;
  onRegister: (baseUrl: string, username: string, password: string) => void;
}

export const AuthScreen = ({ status, error, onLogin, onRegister }: AuthScreenProps) => {
  const [baseUrl, setBaseUrl] = useState("https://matrix.org");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (!baseUrl || !username || !password) return;
    onLogin(baseUrl, username, password);
  };

  const handleRegister = () => {
    if (!baseUrl || !username || !password) return;
    onRegister(baseUrl, username, password);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">Fray Matrix Login</p>
        <h2>Connect to a homeserver</h2>
        <p className="auth-sub">
          Sign in with your Matrix account. Username + password only. No phone required.
        </p>
        <label>
          Homeserver URL
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>
        <label>
          Username or MXID
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-actions">
          <button className="primary" onClick={handleLogin} disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting..." : "Login"}
          </button>
          <button className="ghost" onClick={handleRegister} disabled={status === "connecting"}>
            Register
          </button>
        </div>
        <p className="auth-note">
          Registration uses Matrix dummy auth and may be disabled on some servers.
        </p>
      </div>
    </div>
  );
};
