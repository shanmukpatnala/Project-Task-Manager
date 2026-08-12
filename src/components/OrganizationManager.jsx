import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as signOutSecondary,
} from "firebase/auth";
import { auth, db, secondaryAuth } from "../firebase";
import PasswordInput from "./PasswordInput";
import loginLogo from "../assets/login logo.png";

function OrganizationManager({ activeView, profile, setActiveView }) {
  const [organizationName, setOrganizationName] = useState("");
  const [orgAdminName, setOrgAdminName] = useState("");
  const [orgAdminEmail, setOrgAdminEmail] = useState("");
  const [orgAdminPassword, setOrgAdminPassword] = useState("");
  const [organization, setOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState(null);
  const [manageStatus, setManageStatus] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState("");

  const isAppAdmin = profile?.role === "appAdmin";
  const isOrgAdmin = profile?.role === "orgAdmin" || profile?.role === "admin";

  const createOrSignInSecondaryUser = async (email, password) => {
    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      return { credential, created: true };
    } catch (err) {
      if (err.code !== "auth/email-already-in-use") {
        throw err;
      }

      const credential = await signInWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      return { credential, created: false };
    }
  };

  const organizationEmailDomain = (name) =>
    name.toLowerCase().replace(/\s+/g, "").includes(".")
      ? name.toLowerCase().replace(/\s+/g, "")
      : "";

  const currentOrganizationDomain = organizationEmailDomain(
    organization?.name || ""
  );

  const staffUserEmail = currentOrganizationDomain
    ? `${staffEmail.trim().toLowerCase().split("@")[0]}@${currentOrganizationDomain}`
    : staffEmail.trim().toLowerCase();

  const expectedOrganizationAdminEmail = (name) => {
    const domain = organizationEmailDomain(name);
    return domain === "codetrax.in" ? "admin@codetrax.in" : "";
  };

  const loadOrganizations = async () => {
    const orgSnap = await getDocs(collection(db, "organizations"));
    const userSnap = await getDocs(collection(db, "users"));
    const users = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    setOrganizations(
      orgSnap.docs.map((d) => {
        const org = { id: d.id, ...d.data() };
        const admin = users.find((user) => user.id === org.adminId);
        return {
          ...org,
          adminEmail: admin?.email || org.adminEmail,
          adminName: admin?.name || org.adminName,
          disabled: Boolean(org.disabled),
        };
      })
    );
  };

  const loadOrganization = async () => {
    if (!profile?.organizationId) {
      setOrganization(null);
      setStaff([]);
      return;
    }

    const orgSnap = await getDoc(
      doc(db, "organizations", profile.organizationId)
    );

    if (orgSnap.exists()) {
      setOrganization({ id: orgSnap.id, ...orgSnap.data() });
    }

    const userSnap = await getDocs(
      query(
        collection(db, "users"),
        where("organizationId", "==", profile.organizationId)
      )
    );
    setStaff(
      userSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
    );
  };

  useEffect(() => {
    if (isAppAdmin) loadOrganizations();
    if (isOrgAdmin) loadOrganization();
  }, [profile?.organizationId, profile?.role]);

  useEffect(() => {
    const expectedAdminEmail = expectedOrganizationAdminEmail(organizationName);
    if (expectedAdminEmail) {
      setOrgAdminEmail(expectedAdminEmail);
    }
  }, [organizationName]);

  const createOrganization = async (e) => {
    e.preventDefault();
    setCreateStatus(null);

    if (
      !organizationName.trim() ||
      !orgAdminName.trim() ||
      !orgAdminEmail.trim() ||
      !orgAdminPassword
    ) {
      setCreateStatus({
        type: "error",
        message: "Organization failed. Please fill organization and admin login details.",
      });
      return;
    }

    if (orgAdminPassword.length < 6) {
      setCreateStatus({
        type: "error",
        message: "Organization failed. Temporary password must be at least 6 characters.",
      });
      return;
    }

    const domain = organizationEmailDomain(organizationName.trim());
    const expectedAdminEmail = expectedOrganizationAdminEmail(
      organizationName.trim()
    );
    if (
      expectedAdminEmail &&
      orgAdminEmail.trim().toLowerCase() !== expectedAdminEmail
    ) {
      setCreateStatus({
        type: "error",
        message: `Organization failed. ${organizationName.trim()} must use ${expectedAdminEmail}.`,
      });
      return;
    }

    if (domain && !orgAdminEmail.trim().toLowerCase().endsWith(`@${domain}`)) {
      setCreateStatus({
        type: "error",
        message: `Organization failed. Only @${domain} admin email ids are allowed.`,
      });
      return;
    }

    try {
      setLoading(true);
      const orgRef = doc(collection(db, "organizations"));
      const { credential: adminCredential, created } =
        await createOrSignInSecondaryUser(
        orgAdminEmail.trim(),
        orgAdminPassword
      );

      try {
        await setDoc(orgRef, {
          name: organizationName.trim(),
          adminId: adminCredential.user.uid,
          adminName: orgAdminName.trim(),
          adminEmail: orgAdminEmail.trim(),
          disabled: false,
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "users", adminCredential.user.uid), {
          name: orgAdminName.trim(),
          email: orgAdminEmail.trim(),
          role: "orgAdmin",
          organizationId: orgRef.id,
          mustChangePassword: created,
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        if (created) {
          await deleteUser(adminCredential.user);
        }
        throw err;
      }

      await signOutSecondary(secondaryAuth);
      setOrganizationName("");
      setOrgAdminName("");
      setOrgAdminEmail("");
      setOrgAdminPassword("");
      await loadOrganizations();
      setCreateStatus({
        type: "success",
        message: "Organization created.",
      });
    } catch (err) {
      setCreateStatus({
        type: "error",
        message:
          err.code === "auth/email-already-in-use"
            ? "Organization failed. This admin email is already used with a different password."
            : "Organization failed. Please check the details and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleOrganizationStatus = async (organizationId, disabled) => {
    try {
      setLoading(true);
      setManageStatus(null);
      await updateDoc(doc(db, "organizations", organizationId), {
        disabled: !disabled,
        updatedAt: serverTimestamp(),
      });
      await loadOrganizations();
      setManageStatus({
        type: "success",
        message: disabled ? "Organization enabled." : "Organization disabled.",
      });
    } catch (err) {
      setManageStatus({
        type: "error",
        message: err.message || "Organization update failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteOrganization = async (organizationId) => {
    if (pendingDeleteId !== organizationId) {
      setPendingDeleteId(organizationId);
      setManageStatus({
        type: "error",
        message: "Click delete again to confirm deleting this organization and its data.",
      });
      return;
    }

    try {
      setLoading(true);
      setManageStatus(null);
      const collectionsToDelete = ["users", "projects", "tasks", "workItems", "comments"];
      const batch = writeBatch(db);

      for (const collectionName of collectionsToDelete) {
        const snap = await getDocs(
          query(
            collection(db, collectionName),
            where("organizationId", "==", organizationId)
          )
        );
        snap.docs.forEach((item) => {
          batch.delete(doc(db, collectionName, item.id));
        });
      }

      batch.delete(doc(db, "organizations", organizationId));
      await batch.commit();

      await loadOrganizations();
      setPendingDeleteId("");
      setManageStatus({
        type: "success",
        message:
          "Organization data deleted. Authentication login accounts must be removed from Firebase Console or backend.",
      });
    } catch (err) {
      setManageStatus({
        type: "error",
        message: err.message || "Organization delete failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const createStaffUser = async (e) => {
    e.preventDefault();
    setManageStatus(null);

    if (!staffName.trim() || !staffEmail.trim().split("@")[0] || !temporaryPassword) {
      setManageStatus({
        type: "error",
        message: "User failed. Please fill staff name, email, and temporary password.",
      });
      return;
    }

    if (temporaryPassword.length < 6) {
      setManageStatus({
        type: "error",
        message: "User failed. Temporary password must be at least 6 characters.",
      });
      return;
    }

    try {
      setLoading(true);
      const { credential, created } = await createOrSignInSecondaryUser(
        staffUserEmail,
        temporaryPassword
      );

      await setDoc(doc(db, "users", credential.user.uid), {
        name: staffName.trim(),
        email: staffUserEmail,
        role: "staff",
        organizationId: profile.organizationId,
        mustChangePassword: created,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await signOutSecondary(secondaryAuth);
      setStaffName("");
      setStaffEmail("");
      setTemporaryPassword("");
      await loadOrganization();
      setManageStatus({
        type: "success",
        message: "Employee login created. Share the email and temporary password.",
      });
    } catch (err) {
      setManageStatus({
        type: "error",
        message: err.message || "User failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isAppAdmin) {
    if (activeView === "home") {
      return (
        <div className="container dashboard-card">
          <div className="admin-home-brand">
            <img src={loginLogo} alt="Project Task Manager" />
            <div>
              <h2>Home</h2>
              <p>Manage organizations and workspace access.</p>
            </div>
          </div>
          <div className="stat-box">
            <span>Total Organizations</span>
            <strong>{organizations.length}</strong>
          </div>
        </div>
      );
    }

    if (activeView === "create") {
      return (
        <div className="container">
          <h2>Create Organization</h2>
            <form onSubmit={createOrganization} noValidate>
            <input
              type="text"
              placeholder="Organization name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Organization admin name"
              value={orgAdminName}
              onChange={(e) => setOrgAdminName(e.target.value)}
            />
            <input
              type="email"
              placeholder={
                expectedOrganizationAdminEmail(organizationName) ||
                "Organization admin email"
              }
              value={orgAdminEmail}
              onChange={(e) => setOrgAdminEmail(e.target.value.toLowerCase())}
            />
            <PasswordInput
              placeholder="Temporary admin password"
              value={orgAdminPassword}
              onChange={(e) => setOrgAdminPassword(e.target.value)}
            />
            {createStatus && (
              <div
                className={`inline-status ${createStatus.type}`}
                role="status"
                aria-live="polite"
              >
                <span className="status-mark" aria-hidden="true" />
                <span>{createStatus.message}</span>
              </div>
            )}
            <button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Organization"}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="container manage-container">
        <h2>Manage Organizations</h2>
        {manageStatus && (
          <div className={`inline-status ${manageStatus.type}`} role="status">
            <span className="status-mark" aria-hidden="true" />
            <span>{manageStatus.message}</span>
          </div>
        )}
        {organizations.length === 0 && <p>No organizations found.</p>}
        {organizations.map((org) => (
          <div className="organization-row" key={org.id}>
            <div className="organization-info">
              <b>{org.name}</b>
              <span>{org.adminName || "Organization admin"}</span>
              <span>{org.adminEmail}</span>
              <span className={org.disabled ? "status disabled" : "status enabled"}>
                {org.disabled ? "Disabled" : "Enabled"}
              </span>
            </div>
            <div className="row-actions">
              <button
                className={org.disabled ? "enable-button" : "warning-button"}
                type="button"
                onClick={() => toggleOrganizationStatus(org.id, org.disabled)}
              >
                {org.disabled ? "Enable" : "Disable"}
              </button>
              <button
                className="danger-icon-button"
                type="button"
                title="Delete organization"
                aria-label={`Delete ${org.name}`}
                onClick={() => deleteOrganization(org.id)}
              >
                {pendingDeleteId === org.id ? "!" : "X"}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!isOrgAdmin || !profile?.organizationId || profile?.organizationDisabled) {
    return null;
  }

  return (
    <div className="container">
      <h2>Manage Organization</h2>
      <p>
        <b>{organization?.name || "Your organization"}</b>
      </p>

      <form onSubmit={createStaffUser}>
        <input
          type="text"
          placeholder="Employee name"
          value={staffName}
          onChange={(e) => setStaffName(e.target.value)}
        />
        <div className="email-field">
          <input
            type="text"
            placeholder="Employee email"
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value.toLowerCase().split("@")[0])}
          />
          {currentOrganizationDomain && <span>@{currentOrganizationDomain}</span>}
        </div>
        <PasswordInput
          placeholder="Temporary password"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
        />
        {manageStatus && (
          <div className={`inline-status ${manageStatus.type}`} role="status">
            <span className="status-mark" aria-hidden="true" />
            <span>{manageStatus.message}</span>
          </div>
        )}
        <button type="submit">
          {loading ? "Creating..." : "Create Employee Login"}
        </button>
      </form>

      <h3>Users</h3>
      {staff.map((member) => (
        <div className="list-item" key={member.id}>
          <b>{member.name || member.email}</b>
          <span>{member.role}</span>
        </div>
      ))}
    </div>
  );
}

export default OrganizationManager;
