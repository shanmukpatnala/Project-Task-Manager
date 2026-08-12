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
import PasswordInput from "./PasswordInput";

function ProjectSettings({ organizationId, canManage, onProjectCreated }) {
  const [activePanel, setActivePanel] = useState("");
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [projectLogo, setProjectLogo] = useState("");
  const [projectLogoName, setProjectLogoName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectEndDate, setProjectEndDate] = useState("");
  const [name, setName] = useState("");
  const [emailName, setEmailName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const organizationDomain = useMemo(() => {
    const rawName = organization?.name || "";
    const compactName = rawName.toLowerCase().replace(/\s+/g, "");
    return compactName.includes(".") ? compactName : "";
  }, [organization?.name]);

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

  const loadSettings = async () => {
    const [orgSnap, userSnap, projectSnap, taskSnap] = await Promise.all([
      getDoc(doc(db, "organizations", organizationId)),
      getDocs(
        query(collection(db, "users"), where("organizationId", "==", organizationId))
      ),
      getDocs(
        query(collection(db, "projects"), where("organizationId", "==", organizationId))
      ),
      getDocs(
        query(collection(db, "tasks"), where("organizationId", "==", organizationId))
      ),
    ]);

    setOrganization(orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data() } : null);
    setUsers(
      userSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((user) => user.role !== "appAdmin")
    );
    setProjects(projectSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setWorkItems(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    if (organizationId) loadSettings();
  }, [organizationId]);

  const validateDomainEmail = (email) => {
    if (!organizationDomain) return true;
    return email.toLowerCase().endsWith(`@${organizationDomain}`);
  };

  const handleEmailNameChange = (value) => {
    setEmailName(value.toLowerCase().split("@")[0]);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    clearStatus();

    if (!file) {
      setProjectLogo("");
      setProjectLogoName("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      showStatus("error", "Project failed. Please upload an image file.");
      return;
    }

    if (file.size > 700 * 1024) {
      showStatus("error", "Project failed. Logo image must be below 700 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProjectLogo(String(reader.result));
      setProjectLogoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const createUser = async (e) => {
    e.preventDefault();
    clearStatus();

    if (!organizationId || !auth.currentUser?.uid) {
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
        organizationId,
        mustChangePassword: created,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await signOutSecondary(secondaryAuth);
      setName("");
      setEmailName("");
      setPassword("");
      await loadSettings();
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

    if (!projectName.trim() || !projectStartDate || !projectEndDate) {
      showStatus("error", "Project failed. Please fill project name, start date, and end date.");
      return;
    }

    try {
      setLoading(true);
      const projectData = {
        projectLogo,
        projectLogoName,
        projectName: projectName.trim(),
        description: projectDescription.trim(),
        startDate: projectStartDate,
        endDate: projectEndDate,
        status: "Active",
        organizationId,
        assignedUserIds: [],
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      };
      const projectRef = await addDoc(collection(db, "projects"), projectData);

      setProjectLogo("");
      setProjectLogoName("");
      setProjectName("");
      setProjectDescription("");
      setProjectStartDate("");
      setProjectEndDate("");
      await loadSettings();
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

  const saveAssignment = async () => {
    clearStatus();

    if (!selectedUserId) {
      showStatus("error", "Assignment failed. Please select a user first.");
      return;
    }

    if (!selectedProjectId) {
      showStatus("error", "Assignment failed. Please select a project.");
      return;
    }

    const project = projects.find((item) => item.id === selectedProjectId);
    const assignedUserIds = new Set(project?.assignedUserIds || []);
    assignedUserIds.add(selectedUserId);

    try {
      setLoading(true);
      await updateDoc(doc(db, "projects", selectedProjectId), {
        assignedUserIds: Array.from(assignedUserIds),
        updatedAt: serverTimestamp(),
      });
      await loadSettings();
      showStatus("success", "User assigned to project.");
    } catch (err) {
      showStatus("error", err.message || "Assignment failed.");
    } finally {
      setLoading(false);
    }
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
          className={activePanel === "createProject" ? "active" : ""}
          onClick={() => {
            setActivePanel("createProject");
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
          className={activePanel === "assignUser" ? "active" : ""}
          onClick={() => {
            setActivePanel("assignUser");
            clearStatus();
          }}
        >
          Assign User To Project
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

      {!activePanel && (
        <div className="ado-panel settings-panel narrow-panel">
          <h2>Organization Settings</h2>
          <p>Select an action above to open its form.</p>
        </div>
      )}

      {activePanel === "createProject" && (
        <div className="ado-panel settings-panel narrow-panel">
          <h2>Create Project</h2>
          <form onSubmit={createProject} noValidate>
            <label className="logo-upload">
              <span>Project logo image optional</span>
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
              type="date"
              value={projectStartDate}
              onChange={(e) => setProjectStartDate(e.target.value)}
            />
            <input
              type="date"
              value={projectEndDate}
              onChange={(e) => setProjectEndDate(e.target.value)}
            />
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

      {activePanel === "assignUser" && (
        <div className="ado-panel settings-panel narrow-panel">
          <h2>Assign User To Project</h2>
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setSelectedProjectId("");
            }}
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
          <select
            value={selectedProjectId}
            disabled={!selectedUserId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectName}
              </option>
            ))}
          </select>
          {renderStatus()}
          <button type="button" disabled={loading} onClick={saveAssignment}>
            {loading ? "Saving..." : "Assign User"}
          </button>
        </div>
      )}

      {activePanel === "manageProject" && (
        <div className="settings-page two-column">
          <div className="ado-panel settings-panel">
            <h2>Projects</h2>
            {renderStatus()}
            {projects.length === 0 && <p>No projects found.</p>}
            {projects.map((project) => (
              <div className="settings-row" key={project.id}>
                <div>
                  <b>{project.projectName}</b>
                  <span>{project.disabled ? "Disabled" : "Enabled"}</span>
                </div>
                <div className="row-actions">
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

          <div className="ado-panel settings-panel">
            <h2>Work Items</h2>
            {workItems.length === 0 && <p>No work items found.</p>}
            {workItems.map((item, index) => {
              const project = projects.find((p) => p.id === item.projectId);
              return (
                <div className="settings-row" key={item.id}>
                  <div>
                    <b>#{item.number || index + 1} {item.title}</b>
                    <span>{project?.projectName || "Project"}</span>
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
        </div>
      )}
    </div>
  );
}

export default ProjectSettings;
