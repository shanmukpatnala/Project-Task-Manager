import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import PasswordInput from "./PasswordInput";
import loginLogo from "../assets/login logo.png";

const getLoginErrorMessage = (code) => {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email id or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/unauthorized-domain":
      return "This website domain is not allowed in Firebase Authentication.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many login attempts. Please wait and try again.";
    case "auth/operation-not-allowed":
      return "Email/password login is not enabled in Firebase Authentication.";
    case "auth/api-key-not-valid":
    case "auth/invalid-api-key":
      return "Firebase API key is not valid for this deployed website.";
    case "auth/app-not-authorized":
      return "This app is not authorized to use Firebase Authentication.";
    case "auth/user-disabled":
      return "This user account is disabled in Firebase Authentication.";
    default:
      return `Login failed: ${code || "unknown Firebase error"}`;
  }
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    try {
      setLoading(true);
      setError("");
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      setError(getLoginErrorMessage(err.code));
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
