import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export const BOOTSTRAP_ADMIN_EMAIL = "shanmukpatnala13@gmail.com";

export default function useUserProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          let organizationDisabled = false;

          if (data.organizationId) {
            const orgSnap = await getDoc(
              doc(db, "organizations", data.organizationId)
            );
            organizationDisabled = Boolean(orgSnap.data()?.disabled);
          }

          const shouldPromote =
            user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
            data.role !== "appAdmin";

          if (shouldPromote) {
            await setDoc(
              userRef,
              { role: "appAdmin", organizationId: null },
              { merge: true }
            );
            setProfile({
              id: user.uid,
              ...data,
              role: "appAdmin",
              organizationId: null,
              organizationDisabled: false,
            });
          } else {
            setProfile({ id: user.uid, ...data, organizationDisabled });
          }
        } else {
          const isBootstrapAdmin =
            user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
          const data = {
            email: user.email,
            role: isBootstrapAdmin ? "appAdmin" : "staff",
            organizationId: null,
            mustChangePassword: false,
            createdAt: serverTimestamp(),
          };

          await setDoc(userRef, data);
          setProfile({ id: user.uid, ...data });
        }
      } catch (err) {
        if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
          setProfile({
            id: user.uid,
            email: user.email,
            role: "appAdmin",
            organizationId: null,
            mustChangePassword: false,
          });
        } else {
          alert(err.message);
        }
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

  return { profile, loading, setProfile };
}
