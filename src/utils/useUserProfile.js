import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export const BOOTSTRAP_ADMIN_EMAIL = "shanmukpatnala13@gmail.com";
export const CODETRAX_ORG_NAME = "codetrax.in";
export const CODETRAX_ORG_ADMIN_EMAIL = "admin@codetrax.in";

const getOrCreateCodetraxOrganization = async (user) => {
  const orgQuery = query(
    collection(db, "organizations"),
    where("name", "==", CODETRAX_ORG_NAME)
  );
  const orgSnap = await getDocs(orgQuery);

  if (!orgSnap.empty) {
    const existingOrg = orgSnap.docs[0];
    await setDoc(
      doc(db, "organizations", existingOrg.id),
      {
        adminId: user.uid,
        adminName: "Codetrax Admin",
        adminEmail: CODETRAX_ORG_ADMIN_EMAIL,
        disabled: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return existingOrg.id;
  }

  const orgRef = doc(collection(db, "organizations"));
  await setDoc(orgRef, {
    name: CODETRAX_ORG_NAME,
    adminId: user.uid,
    adminName: "Codetrax Admin",
    adminEmail: CODETRAX_ORG_ADMIN_EMAIL,
    disabled: false,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  return orgRef.id;
};

const getBootstrapProfile = async (user) => {
  const email = user.email?.toLowerCase();

  if (email === BOOTSTRAP_ADMIN_EMAIL) {
    return {
      email: user.email,
      role: "appAdmin",
      organizationId: null,
      mustChangePassword: false,
    };
  }

  if (email === CODETRAX_ORG_ADMIN_EMAIL) {
    const organizationId = await getOrCreateCodetraxOrganization(user);
    return {
      name: "Codetrax Admin",
      email: user.email,
      role: "orgAdmin",
      organizationId,
      mustChangePassword: false,
    };
  }

  return null;
};

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

          const bootstrapProfile = await getBootstrapProfile(user);

          if (bootstrapProfile && data.role !== bootstrapProfile.role) {
            await setDoc(
              userRef,
              bootstrapProfile,
              { merge: true }
            );
            setProfile({
              id: user.uid,
              ...data,
              ...bootstrapProfile,
              organizationDisabled: false,
            });
          } else {
            setProfile({ id: user.uid, ...data, organizationDisabled });
          }
        } else {
          const bootstrapProfile = await getBootstrapProfile(user);
          const data = bootstrapProfile || {
            email: user.email,
            role: "staff",
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
        } else if (user.email?.toLowerCase() === CODETRAX_ORG_ADMIN_EMAIL) {
          setProfile({
            id: user.uid,
            name: "Codetrax Admin",
            email: user.email,
            role: "orgAdmin",
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
