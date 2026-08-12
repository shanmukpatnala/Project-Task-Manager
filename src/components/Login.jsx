import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import PasswordInput from "./PasswordInput";
import loginLogo from "../assets/login logo.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid email id/password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <img
          className="auth-logo"
          src={loginLogo}
          alt="Project Task Manager"
        />
        <h1>Project Task Manager</h1>
        <p>Plan projects, assign work, and track progress from one clean workspace.</p>
      </section>

      <section className="auth-card">
        <div className="auth-card-head">
          <img
            className="auth-card-logo"
            src={loginLogo}
            alt=""
          />
          <div>
            <h2>Welcome back</h2>
            <p>Login to continue your work.</p>
          </div>
        </div>

        <form onSubmit={handleLogin} noValidate>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />

          <PasswordInput
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />

          {error && (
            <div className="field-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default Login;
