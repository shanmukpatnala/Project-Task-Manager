import { useState } from "react";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import PasswordInput from "./PasswordInput";

function PasswordResetRequired({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const showStatus = (type, message) => {
    setStatus({ type, message });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (password.length < 6) {
      showStatus("error", "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showStatus("error", "New password and confirm password must match.");
      return;
    }

    try {
      setLoading(true);
      await updatePassword(auth.currentUser, password);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        mustChangePassword: false,
      });
      showStatus("success", "Password updated successfully.");
      setTimeout(onComplete, 700);
    } catch (err) {
      showStatus("error", err.message || "Password update failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Create Your Password</h2>
      <form onSubmit={handleSubmit} noValidate>
        <PasswordInput
          placeholder="New password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setStatus(null);
          }}
        />
        <PasswordInput
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setStatus(null);
          }}
        />
        {status && (
          <div className={`inline-status ${status.type}`} role="status">
            <span className="status-mark" aria-hidden="true" />
            <span>{status.message}</span>
          </div>
        )}
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}

export default PasswordResetRequired;
