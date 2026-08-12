import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import CreateProject from "./components/CreateProject";
import useUserProfile from "./utils/useUserProfile";
import PasswordResetRequired from "./components/PasswordResetRequired";

function App() {
  const [user, setUser] = useState(null);
  const { profile, loading, setProfile } = useUserProfile(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  if (user) {
    if (loading) {
      return <div className="container">Loading your account...</div>;
    }

    if (profile?.mustChangePassword) {
      return (
        <PasswordResetRequired
          onComplete={() =>
            setProfile({ ...profile, mustChangePassword: false })
          }
        />
      );
    }

    return <CreateProject profile={profile} setProfile={setProfile} />;
  }

  return <Login />;
}

export default App;
