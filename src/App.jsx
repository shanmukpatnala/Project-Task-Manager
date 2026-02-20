import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/login";
import Signup from "./components/signup";
import CreateProject from "./components/CreateProject";

function App() {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  if (user) {
    return <CreateProject />;
  }

  return showSignup ? (
    <Signup goToLogin={() => setShowSignup(false)} />
  ) : (
    <Login goToSignup={() => setShowSignup(true)} />
  );
}

export default App;