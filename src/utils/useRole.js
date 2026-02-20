import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function useRole() {
  const [role, setRole] = useState("user");

  useEffect(() => {
    const fetchRole = async () => {
      if (!auth.currentUser) return;

      const snap = await getDoc(
        doc(db, "users", auth.currentUser.uid)
      );

      if (snap.exists()) {
        setRole(snap.data().role);
      }
    };

    fetchRole();
  }, []);

  return role;
}