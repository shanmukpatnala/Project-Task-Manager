import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { BOOTSTRAP_ADMIN_EMAIL } from "../utils/useUserProfile";

function Signup({ goToLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const isBootstrapAdmin =
        email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

      await setDoc(doc(db, "users", credential.user.uid), {
        email,
        role: isBootstrapAdmin ? "appAdmin" : "staff",
        organizationId: null,
        mustChangePassword: false,
        createdAt: serverTimestamp(),
      });

      alert("Account created successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Sign Up</h2>

      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">
          {loading ? "Creating..." : "Sign Up"}
        </button>
      </form>

      <div className="link" onClick={goToLogin}>
        Already have an account? Login
      </div>
    </div>
  );
}

export default Signup;
