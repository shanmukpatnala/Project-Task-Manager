import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as signOutSecondary,
} from "firebase/auth";
import { auth, db, secondaryAuth } from "../firebase";
import { imageFileToDataUrl, sanitizeImageDataUrl } from "../utils/imageDataUrl";
import {
  CODETRAX_ADMIN_NAME,
  CODETRAX_ORG_ADMIN_EMAIL,
  CODETRAX_ORG_NAME,
} from "../utils/useUserProfile";
import PasswordInput from "./PasswordInput";

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

function ProjectSettings({
  organizationId,
  profile,
  canManage,
  onOrganizationUpdated,
  onProjectCreated,
  onProjectChanged,
}) {
  const [activePanel, setActivePanel] = useState("profile");
  const [organization, setOrganization] = useState(null);
  const [resolvedOrganizationId, setResolvedOrganizationId] = useState(
    organizationId || ""
  );
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyLogoName, setCompanyLogoName] = useState("");
  const [projectLogo, setProjectLogo] = useState("");
  const [projectLogoName, setProjectLogoName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectWebsite, setProjectWebsite] = useState("");
  const [projectStartDate, setProjectStartDate] = useState(todayDateInputValue);
  const [projectEndDate, setProjectEndDate] = useState("");
  const [editProjectLogo, setEditProjectLogo] = useState("");
  const [editProjectLogoName, setEditProjectLogoName] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectWebsite, setEditProjectWebsite] = useState("");
  const [editProjectEndDate, setEditProjectEndDate] = useState("");
  const [name, setName] = useState("");
  const [emailName, setEmailName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedUsersProjectId, setSelectedUsersProjectId] = useState("");
  const [draggedProjectUserId, setDraggedProjectUserId] = useState("");
  const [editingProjectId, setEditingProjectId] = useState("");
  const [viewingWorkItemsProjectId, setViewingWorkItemsProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const organizationDomain = useMemo(() => {
    const rawName = organization?.name || profile?.organizationName || "";
    const compactName = rawName.toLowerCase().replace(/\s+/g, "");
    return compactName.includes(".") ? compactName : "";
  }, [organization?.name, profile?.organizationName]);

  const displayOrganizationName =
    organization?.name || profile?.organizationName || "Your organization";
  const displayOrganizationAdmin =
    organization?.adminName || profile?.name || organization?.adminEmail || "Organization admin";
  const effectiveOrganizationId = organization?.id || resolvedOrganizationId || organizationId;
  const assignableUsers = users.filter(
    (user) => user.role !== "orgAdmin" && user.role !== "admin" && user.role !== "appAdmin"
  );
  const editingProject = projects.find((project) => project.id === editingProjectId);
  const viewingWorkItemsProject = projects.find(
    (project) => project.id === viewingWorkItemsProjectId
  );
  const viewedProjectWorkItems = workItems.filter(
    (item) => item.projectId === viewingWorkItemsProjectId
  );
  const roleLabel = (role) => {
    if (role === "orgAdmin" || role === "admin") return "Admin";
    if (role === "appAdmin") return "App Admin";
    return "User";
  };
  const assignedUsersForProject = (project) =>
    users.filter((user) => (project.assignedUserIds || []).includes(user.id));
  const selectedUsersProject = projects.find(
    (project) => project.id === selectedUsersProjectId
  );
  const selectedProjectAssignedUserIds = new Set(
    selectedUsersProject?.assignedUserIds || []
  );
  const selectedProjectAssignedUsers = selectedUsersProject
    ? assignedUsersForProject(selectedUsersProject)
    : [];
  const selectedProjectUnassignedUsers = selectedUsersProject
    ? assignableUsers.filter((user) => !selectedProjectAssignedUserIds.has(user.id))
    : [];

  const emailLocalName = useMemo(
    () => emailName.trim().toLowerCase().split("@")[0],
    [emailName]
  );

  const userEmail = useMemo(() => {
    if (!emailLocalName) return "";
    return organizationDomain
      ? `${emailLocalName}@${organizationDomain}`
      : emailLocalName;
  }, [emailLocalName, organizationDomain]);

  const showStatus = (type, message) => {
    setStatus({ type, message });
  };

  const clearStatus = () => setStatus(null);

  const resetCreateProjectForm = () => {
    setProjectLogo("");
    setProjectLogoName("");
    setProjectName("");
    setProjectDescription("");
    setProjectWebsite("");
    setProjectStartDate(todayDateInputValue());
    setProjectEndDate("");
  };

  const createUserAuth = async () => {
    try {
      await signOutSecondary(secondaryAuth);
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        userEmail,
        password
      );
      return { credential, created: true };
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        throw new Error(
          "User failed. This email already exists."
        );
      }

      throw err;
    }
  };

  const loadSettings = async (organizationIdOverride = effectiveOrganizationId) => {
    if (!organizationIdOverride) return;

    const [orgSnap, userSnap, projectSnap, taskSnap] = await Promise.all([
      getDoc(doc(db, "organizations", organizationIdOverride)),
      getDocs(
        query(collection(db, "users"), where("organizationId", "==", organizationIdOverride))
      ),
      getDocs(
        query(collection(db, "projects"), where("organizationId", "==", organizationIdOverride))
      ),
      getDocs(
        query(collection(db, "tasks"), where("organizationId", "==", organizationIdOverride))
      ),
    ]);

    const organizationData = orgSnap.exists()
      ? { id: orgSnap.id, ...orgSnap.data() }
      : null;

    setOrganization(organizationData);
    setResolvedOrganizationId(organizationData?.id || organizationIdOverride);
    setCompanyLogo(sanitizeImageDataUrl(organizationData?.companyLogo));
    setCompanyLogoName(organizationData?.companyLogoName || "");
    const organizationUsers = userSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((user) => user.role !== "appAdmin");

    if (
      profile?.id &&
      (profile.role === "orgAdmin" || profile.role === "admin") &&
      !organizationUsers.some((user) => user.id === profile.id)
    ) {
      organizationUsers.push({
        id: profile.id,
        name: profile.name || organizationData?.adminName || CODETRAX_ADMIN_NAME,
        email: profile.email || organizationData?.adminEmail,
        role: profile.role,
        organizationId: organizationIdOverride,
      });
    }

    setUsers(
      organizationUsers.sort((a, b) => {
        const aIsAdmin = a.role === "orgAdmin" || a.role === "admin";
        const bIsAdmin = b.role === "orgAdmin" || b.role === "admin";
        if (aIsAdmin !== bIsAdmin) return aIsAdmin ? -1 : 1;
        return (a.name || a.email || "").localeCompare(b.name || b.email || "");
      })
    );
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setWorkItems(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    setResolvedOrganizationId(organizationId || "");
  }, [organizationId]);

  useEffect(() => {
    if (effectiveOrganizationId) loadSettings();
  }, [effectiveOrganizationId]);

  useEffect(() => {
    const resolveOrganization = async () => {
      if (effectiveOrganizationId || profile?.email?.toLowerCase() !== CODETRAX_ORG_ADMIN_EMAIL) {
        return;
      }

      try {
        const snap = await getDocs(
          query(
            collection(db, "organizations"),
            where("adminEmail", "==", CODETRAX_ORG_ADMIN_EMAIL)
          )
        );
        const orgDoc = snap.docs[0];
        if (!orgDoc) return;

        const nextOrganization = { id: orgDoc.id, ...orgDoc.data() };
        setOrganization(nextOrganization);
        setResolvedOrganizationId(orgDoc.id);
        onOrganizationUpdated?.(nextOrganization);

        if (auth.currentUser?.uid) {
          await setDoc(
            doc(db, "users", auth.currentUser.uid),
            {
              name: profile?.name || nextOrganization.adminName || CODETRAX_ADMIN_NAME,
              organizationId: orgDoc.id,
              organizationName: nextOrganization.name || CODETRAX_ORG_NAME,
              role: profile?.role || "orgAdmin",
            },
            { merge: true }
          );
        }
      } catch (err) {
        showStatus("error", err.message || "Organization failed to load.");
      }
    };

    resolveOrganization();
  }, [effectiveOrganizationId, profile?.email]);

  const validateDomainEmail = (email) => {
    if (!organizationDomain) return true;
    return email.toLowerCase().endsWith(`@${organizationDomain}`);
  };

  const handleEmailNameChange = (value) => {
    setEmailName(value.toLowerCase().split("@")[0]);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    clearStatus();

    if (!file) {
      setProjectLogo("");
      setProjectLogoName("");
      return;
    }

    try {
      setProjectLogo(await imageFileToDataUrl(file));
      setProjectLogoName(file.name);
    } catch (err) {
      showStatus("error", `Project failed. ${err.message}`);
    }
  };

  const handleCompanyLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    clearStatus();

    if (!file) {
      setCompanyLogo(sanitizeImageDataUrl(organization?.companyLogo));
      setCompanyLogoName(organization?.companyLogoName || "");
      return;
    }

    try {
      setCompanyLogo(await imageFileToDataUrl(file));
      setCompanyLogoName(file.name);
    } catch (err) {
      showStatus("error", `Profile failed. ${err.message}`);
    }
  };

  const handleProjectEditLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    clearStatus();

    if (!file) return;

    try {
      setEditProjectLogo(await imageFileToDataUrl(file));
      setEditProjectLogoName(file.name);
    } catch (err) {
      showStatus("error", `Project update failed. ${err.message}`);
    }
  };

  const resolveEffectiveOrganizationId = async () => {
    if (effectiveOrganizationId) return effectiveOrganizationId;

    if (profile?.email?.toLowerCase() !== CODETRAX_ORG_ADMIN_EMAIL) {
      return "";
    }

    const snap = await getDocs(
      query(
        collection(db, "organizations"),
        where("adminEmail", "==", CODETRAX_ORG_ADMIN_EMAIL)
      )
    );
    const orgDoc = snap.docs[0];
    if (!orgDoc) return "";

    const nextOrganization = { id: orgDoc.id, ...orgDoc.data() };
    setOrganization(nextOrganization);
    setResolvedOrganizationId(orgDoc.id);
    onOrganizationUpdated?.(nextOrganization);

    if (auth.currentUser?.uid) {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          name: profile?.name || nextOrganization.adminName || CODETRAX_ADMIN_NAME,
          organizationId: orgDoc.id,
          organizationName: nextOrganization.name || CODETRAX_ORG_NAME,
          role: profile?.role || "orgAdmin",
        },
        { merge: true }
      );
    }

    return orgDoc.id;
  };

  const saveOrganizationProfile = async (e) => {
    e.preventDefault();
    clearStatus();

    const currentOrganizationId = await resolveEffectiveOrganizationId();

    if (!currentOrganizationId) {
      showStatus("error", "Profile failed. Please logout and login again.");
      return;
    }

    try {
      setLoading(true);
      const updates = {
        companyLogo: sanitizeImageDataUrl(companyLogo),
        companyLogoName,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "organizations", currentOrganizationId), updates);
      const nextOrganization = {
        ...(organization || {}),
        id: currentOrganizationId,
        ...updates,
      };
      setOrganization(nextOrganization);
      onOrganizationUpdated?.(nextOrganization);
      showStatus("success", "Organization profile saved.");
    } catch (err) {
      showStatus("error", err.message || "Profile failed.");
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    clearStatus();

    const currentOrganizationId = await resolveEffectiveOrganizationId();

    if (!currentOrganizationId || !auth.currentUser?.uid) {
      showStatus("error", "User failed. Please logout and login again.");
      return;
    }

    if (!name.trim() || !emailLocalName || !password) {
      showStatus("error", "User failed. Please fill name, email, and password.");
      return;
    }

    if (!validateDomainEmail(userEmail)) {
      showStatus(
        "error",
        `User failed. Only @${organizationDomain} email ids are allowed.`
      );
      return;
    }

    if (password.length < 6) {
      showStatus("error", "User failed. Temporary password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const { credential, created } = await createUserAuth();

      await setDoc(doc(db, "users", credential.user.uid), {
        name: name.trim(),
        email: userEmail,
        role: "staff",
        organizationId: currentOrganizationId,
        mustChangePassword: created,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await signOutSecondary(secondaryAuth);
      setName("");
      setEmailName("");
      setPassword("");
      await loadSettings(currentOrganizationId);
      showStatus("success", "User created.");
    } catch (err) {
      showStatus("error", err.message || "User failed.");
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    clearStatus();

    if (!projectName.trim() || !projectStartDate) {
      showStatus("error", "Project failed. Please fill project name and created date.");
      return;
    }

    const currentOrganizationId = await resolveEffectiveOrganizationId();

    if (!currentOrganizationId || !auth.currentUser?.uid) {
      showStatus("error", "Project failed. Organization is still loading. Please refresh and try again.");
      return;
    }

    try {
      setLoading(true);
      const sanitizedProjectLogo = sanitizeImageDataUrl(projectLogo);
      const projectData = {
        projectLogo: sanitizedProjectLogo || null,
        projectLogoName: sanitizedProjectLogo ? projectLogoName || null : null,
        projectName: projectName.trim(),
        description: projectDescription.trim() || null,
        website: projectWebsite.trim() || null,
        startDate: projectStartDate,
        endDate: projectEndDate || null,
        status: "Active",
        organizationId: currentOrganizationId,
        assignedUserIds: [],
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      };
      const projectRef = await addDoc(collection(db, "projects"), projectData);

      resetCreateProjectForm();
      await loadSettings(currentOrganizationId);
      onProjectCreated?.({ id: projectRef.id, ...projectData });
      showStatus("success", "Project created.");
    } catch (err) {
      showStatus("error", err.message || "Project failed.");
    } finally {
      setLoading(false);
    }
  };

  const deleteUserProfile = async (userId) => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, "users", userId));
      await Promise.all(
        projects.map((project) =>
          updateDoc(doc(db, "projects", project.id), {
            assignedUserIds: (project.assignedUserIds || []).filter(
              (id) => id !== userId
            ),
          })
        )
      );
      await loadSettings();
      showStatus("success", "User deleted.");
    } catch (err) {
      showStatus("error", err.message || "User delete failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleProjectStatus = async (project) => {
    clearStatus();

    try {
      setLoading(true);
      await updateDoc(doc(db, "projects", project.id), {
        disabled: !project.disabled,
        status: project.disabled ? "Active" : "Disabled",
        updatedAt: serverTimestamp(),
      });
      await loadSettings();
      showStatus(
        "success",
        project.disabled ? "Project enabled." : "Project disabled."
      );
    } catch (err) {
      showStatus("error", err.message || "Project update failed.");
    } finally {
      setLoading(false);
    }
  };

  const selectProjectForEdit = (project) => {
    setEditingProjectId(project.id);
    setViewingWorkItemsProjectId("");
    setEditProjectLogo(sanitizeImageDataUrl(project.projectLogo));
    setEditProjectLogoName(project.projectLogoName || "");
    setEditProjectName(project.projectName || "");
    setEditProjectWebsite(project.website || "");
    setEditProjectEndDate(project.endDate || "");
    clearStatus();
  };

  const selectProjectWorkItems = (project) => {
    setViewingWorkItemsProjectId(project.id);
    setEditingProjectId("");
    clearStatus();
  };

  const saveProjectDetails = async (e) => {
    e.preventDefault();
    clearStatus();

    if (!editingProjectId) {
      showStatus("error", "Project update failed. Please select a project.");
      return;
    }

    if (!editProjectName.trim()) {
      showStatus("error", "Project update failed. Please fill project name.");
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, "projects", editingProjectId), {
        projectLogo: sanitizeImageDataUrl(editProjectLogo),
        projectLogoName: editProjectLogoName,
        projectName: editProjectName.trim(),
        website: editProjectWebsite.trim() || null,
        endDate: editProjectEndDate || null,
        updatedAt: serverTimestamp(),
      });
      await loadSettings();
      showStatus("success", "Project settings saved.");
    } catch (err) {
      showStatus("error", err.message || "Project update failed.");
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId) => {
    clearStatus();

    try {
      setLoading(true);
      await deleteDoc(doc(db, "projects", projectId));
      await Promise.all(
        workItems
          .filter((item) => item.projectId === projectId)
          .map((item) => deleteDoc(doc(db, "tasks", item.id)))
      );
      await loadSettings();
      showStatus("success", "Project and its work items deleted.");
    } catch (err) {
      showStatus("error", err.message || "Project delete failed.");
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkItem = async (workItemId) => {
    clearStatus();

    try {
      setLoading(true);
      await deleteDoc(doc(db, "tasks", workItemId));
      await loadSettings();
      showStatus("success", "Work item deleted.");
    } catch (err) {
      showStatus("error", err.message || "Work item delete failed.");
    } finally {
      setLoading(false);
    }
  };

  const updateProjectUserAssignment = async (userId, shouldAssign) => {
    clearStatus();

    if (!selectedUsersProjectId) {
      showStatus("error", "Please select a project first.");
      return;
    }

    if (!userId) {
      return;
    }

    const project = projects.find((item) => item.id === selectedUsersProjectId);
    const assignedUserIds = new Set(project?.assignedUserIds || []);

    if (shouldAssign && assignedUserIds.has(userId)) {
      showStatus("error", "This user is already assigned to this project.");
      return;
    }

    if (shouldAssign) {
      assignedUserIds.add(userId);
    } else {
      assignedUserIds.delete(userId);
    }

    try {
      setLoading(true);
      const nextAssignedUserIds = Array.from(assignedUserIds);
      await updateDoc(doc(db, "projects", selectedUsersProjectId), {
        assignedUserIds: nextAssignedUserIds,
        updatedAt: serverTimestamp(),
      });
      const updatedProject = {
        ...project,
        assignedUserIds: nextAssignedUserIds,
      };
      setProjects((currentProjects) =>
        currentProjects.map((item) =>
          item.id === selectedUsersProjectId ? updatedProject : item
        )
      );
      await loadSettings();
      onProjectChanged?.(updatedProject);
      showStatus(
        "success",
        shouldAssign ? "User assigned to project." : "User unassigned from project."
      );
    } catch (err) {
      showStatus("error", err.message || "Project user update failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectUserDrop = (shouldAssign) => {
    if (!draggedProjectUserId) return;
    updateProjectUserAssignment(draggedProjectUserId, shouldAssign);
    setDraggedProjectUserId("");
  };

  const renderStatus = () =>
    status && (
      <div className={`inline-status ${status.type}`} role="status">
        <span className="status-mark" aria-hidden="true" />
        <span>{status.message}</span>
      </div>
    );

  if (!canManage) {
    return (
      <div className="settings-page">
        <div className="ado-panel settings-panel">
          <h2>Organization Settings</h2>
          <p>Only organization admins can manage projects and users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-stack">
      <div className="settings-actions">
        <button
          type="button"
          className={activePanel === "profile" ? "active" : ""}
          onClick={() => {
            setActivePanel("profile");
            clearStatus();
          }}
        >
          Profile
        </button>
        <button
          type="button"
          className={activePanel === "createProject" ? "active" : ""}
          onClick={() => {
            setActivePanel("createProject");
            resetCreateProjectForm();
            clearStatus();
          }}
        >
          Create Project
        </button>
        <button
          type="button"
          className={activePanel === "manageUser" ? "active" : ""}
          onClick={() => {
            setActivePanel("manageUser");
            clearStatus();
          }}
        >
          Manage User
        </button>
        <button
          type="button"
          className={activePanel === "projectUsers" ? "active" : ""}
          onClick={() => {
            setActivePanel("projectUsers");
            clearStatus();
          }}
        >
          Project Users
        </button>
        <button
          type="button"
          className={activePanel === "manageProject" ? "active" : ""}
          onClick={() => {
            setActivePanel("manageProject");
            clearStatus();
          }}
        >
          Manage Project
        </button>
      </div>

      {activePanel === "profile" && (
        <div className="ado-panel settings-panel narrow-panel">
          <h2>Organization Profile</h2>
          <form onSubmit={saveOrganizationProfile} noValidate>
            <div className="organization-profile">
              {companyLogo ? (
                <img className="company-logo-preview" src={companyLogo} alt="" />
              ) : (
                <span className="company-logo-placeholder">
                  {displayOrganizationName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <b>{displayOrganizationName}</b>
                <span>{displayOrganizationAdmin}</span>
              </div>
            </div>
            <label className="logo-upload">
              <span>Organization logo</span>
              <input type="file" accept="image/*" onChange={handleCompanyLogoUpload} />
            </label>
            {companyLogoName && (
              <p className="upload-note">Selected: {companyLogoName}</p>
            )}
            {renderStatus()}
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      )}

      {activePanel === "createProject" && (
        <div className="ado-panel settings-panel narrow-panel">
          <h2>Create Project</h2>
          <form onSubmit={createProject} noValidate>
            <label className="logo-upload">
              <span>Project logo</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
            {projectLogo && (
              <img className="logo-preview" src={projectLogo} alt="Project logo preview" />
            )}
            <input
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <textarea
              placeholder="Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
            <input
              placeholder="Website link"
              type="url"
              value={projectWebsite}
              onChange={(e) => setProjectWebsite(e.target.value)}
            />
            <label className="date-field">
              <span>Project created date</span>
              <input
                type="date"
                value={projectStartDate}
                onChange={(e) => setProjectStartDate(e.target.value)}
              />
            </label>
            <label className="date-field">
              <span>Finish date</span>
              <input
                type="date"
                value={projectEndDate}
                onChange={(e) => setProjectEndDate(e.target.value)}
              />
            </label>
            {renderStatus()}
            <button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </button>
          </form>
        </div>
      )}

      {activePanel === "manageUser" && (
        <div className="settings-page two-column">
          <div className="ado-panel settings-panel">
            <h2>Create User</h2>
            <form onSubmit={createUser} noValidate>
              <input
                placeholder="User name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="email-field">
                <input
                  placeholder="User email"
                  value={emailName}
                  onChange={(e) => handleEmailNameChange(e.target.value)}
                />
                {organizationDomain && <span>@{organizationDomain}</span>}
              </div>
              <PasswordInput
                placeholder="Temporary password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {renderStatus()}
              <button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>

          <div className="ado-panel settings-panel">
            <h2>Users</h2>
            {users.length === 0 && <p>No users created by you.</p>}
            {users.map((user) => (
              <div className="settings-row" key={user.id}>
                <div>
                  <b>{user.name || user.email}</b>
                  <span>{user.email}</span>
                </div>
                <button
                  className="danger-button"
                  type="button"
                  disabled={loading}
                  onClick={() => deleteUserProfile(user.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePanel === "projectUsers" && (
        <div className="ado-panel settings-panel">
          <h2>Project Users</h2>
          <div className="project-users-controls">
            <select
              value={selectedUsersProjectId}
              onChange={(e) => setSelectedUsersProjectId(e.target.value)}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </div>
          {renderStatus()}

          {selectedUsersProject && (
            <div className="project-users-result">
              <div className="project-users-head">
                {selectedUsersProject.projectLogo?.startsWith("data:") ||
                selectedUsersProject.projectLogo?.startsWith("http") ? (
                  <img className="settings-logo" src={selectedUsersProject.projectLogo} alt="" />
                ) : (
                  <span className="settings-logo-placeholder">
                    {(selectedUsersProject.projectName || "P").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <b>{selectedUsersProject.projectName}</b>
                  <span>
                    {selectedProjectAssignedUsers.length} assigned |{" "}
                    {selectedProjectUnassignedUsers.length} unassigned
                  </span>
                </div>
              </div>

              <div className="project-user-columns">
                <section
                  className="project-user-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleProjectUserDrop(true)}
                >
                  <div className="project-user-column-head">
                    <b>Assigned Users</b>
                    <span>{selectedProjectAssignedUsers.length}</span>
                  </div>
                  {selectedProjectAssignedUsers.length === 0 && (
                    <p className="empty-note">No users assigned to this project.</p>
                  )}
                  {selectedProjectAssignedUsers.map((user) => (
                    <div
                      className="project-user-row"
                      draggable
                      key={user.id}
                      onDragStart={() => setDraggedProjectUserId(user.id)}
                    >
                      <span className="user-initials">
                        {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <b>{user.name || user.email}</b>
                        <span>{user.email}</span>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={loading}
                        onClick={() => updateProjectUserAssignment(user.id, false)}
                      >
                        Unassign
                      </button>
                    </div>
                  ))}
                </section>

                <section
                  className="project-user-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleProjectUserDrop(false)}
                >
                  <div className="project-user-column-head">
                    <b>Unassigned Users</b>
                    <span>{selectedProjectUnassignedUsers.length}</span>
                  </div>
                  {selectedProjectUnassignedUsers.length === 0 && (
                    <p className="empty-note">All users are assigned.</p>
                  )}
                  {selectedProjectUnassignedUsers.map((user) => (
                    <div
                      className="project-user-row"
                      draggable
                      key={user.id}
                      onDragStart={() => setDraggedProjectUserId(user.id)}
                    >
                      <span className="user-initials">
                        {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <b>{user.name || user.email}</b>
                        <span>{user.email}</span>
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateProjectUserAssignment(user.id, true)}
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {activePanel === "manageProject" && (
        <div className="settings-page">
          {!editingProjectId && !viewingWorkItemsProjectId && (
          <div className="ado-panel settings-panel">
            <h2>Projects</h2>
            {renderStatus()}
            {projects.length === 0 && <p>No projects found.</p>}
            {projects.map((project) => (
              <div className="settings-row project-settings-row" key={project.id}>
                <div className="project-settings-summary">
                  {project.projectLogo?.startsWith("data:") ||
                  project.projectLogo?.startsWith("http") ? (
                    <img className="settings-logo" src={project.projectLogo} alt="" />
                  ) : (
                    <span className="settings-logo-placeholder">
                      {(project.projectName || "P").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                  <b>{project.projectName}</b>
                    <div className="project-meta-tags">
                      <span>
                        {project.endDate ? `Finish: ${project.endDate}` : "No finish date"}
                      </span>
                      <span>{project.disabled ? "Disabled" : "Enabled"}</span>
                      <span>{assignedUsersForProject(project).length} users</span>
                    </div>
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={loading}
                    onClick={() => selectProjectWorkItems(project)}
                  >
                    View
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={loading}
                    onClick={() => selectProjectForEdit(project)}
                  >
                    Edit
                  </button>
                  <button
                    className={project.disabled ? "enable-button" : "warning-button"}
                    type="button"
                    disabled={loading}
                    onClick={() => toggleProjectStatus(project)}
                  >
                    {project.disabled ? "Enable" : "Disable"}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={loading}
                    onClick={() => deleteProject(project.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}

          {editingProjectId && (
          <div className="ado-panel settings-panel narrow-panel">
            <div className="panel-title-row">
              <h2>Project Settings</h2>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingProjectId("");
                  clearStatus();
                }}
              >
                Back
              </button>
            </div>
            {editingProject && <p>{editingProject.projectName}</p>}
            {renderStatus()}
              <form onSubmit={saveProjectDetails} noValidate>
                <label className="logo-upload">
                  <span>Project logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProjectEditLogoUpload}
                  />
                </label>
                {editProjectLogo && (
                  <img className="logo-preview" src={editProjectLogo} alt="Project logo preview" />
                )}
                <input
                  placeholder="Project name"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                />
                <input
                  placeholder="Website link"
                  type="url"
                  value={editProjectWebsite}
                  onChange={(e) => setEditProjectWebsite(e.target.value)}
                />
                <label className="date-field">
                  <span>Finish date</span>
                  <input
                    type="date"
                    value={editProjectEndDate}
                    onChange={(e) => setEditProjectEndDate(e.target.value)}
                  />
                </label>
                {editProjectLogoName && (
                  <p className="upload-note">Selected: {editProjectLogoName}</p>
                )}
                <button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </button>
              </form>
          </div>
          )}

          {viewingWorkItemsProjectId && (
          <div className="ado-panel settings-panel">
            <div className="panel-title-row">
              <h2>Work Items</h2>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setViewingWorkItemsProjectId("");
                  clearStatus();
                }}
              >
                Back
              </button>
            </div>
            {viewingWorkItemsProject && <p>{viewingWorkItemsProject.projectName}</p>}
            {renderStatus()}
            {viewedProjectWorkItems.length === 0 && <p>No work items found.</p>}
            {viewedProjectWorkItems.map((item, index) => {
              return (
                <div className="settings-row" key={item.id}>
                  <div>
                    <b>#{item.number || index + 1} {item.title}</b>
                    <span>{viewingWorkItemsProject?.projectName || "Project"}</span>
                  </div>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={loading}
                    onClick={() => deleteWorkItem(item.id)}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectSettings;
