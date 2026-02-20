import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Logout() {
  return (
    <button
      style={{ margin: "10px", background: "#ef4444" }}
      onClick={() => signOut(auth)}
    >
      Logout
    </button>
  );
}

export default Logout;