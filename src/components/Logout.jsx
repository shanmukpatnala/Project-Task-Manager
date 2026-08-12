import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Logout() {
  return (
    <button
      className="logout-button"
      type="button"
      onClick={() => signOut(auth)}
    >
      Logout
    </button>
  );
}

export default Logout;
