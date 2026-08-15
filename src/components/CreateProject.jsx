import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

import Logout from "./Logout";
import OrganizationManager from "./OrganizationManager";
import ProjectList from "./ProjectList";
import ProjectSettings from "./ProjectSettings";
import TaskManager from "./TaskManager";
import codetraxLogo from "../assets/CodeTrax-Logo.png";
import projectTaskManagerLogo from "../assets/project task manager-logo.png";
function CreateProject({ profile, setProfile }) {
  const isAppAdmin = profile?.role === "appAdmin";
  const isOrgAdmin = profile?.role === "orgAdmin" || profile?.role === "admin";
  const canCreateTasks = isOrgAdmin || profile?.role === "staff";
  const [activeView, setActiveView] = useState("home");
  const [workspaceView, setWorkspaceView] = useState("projects");
  const organizationDisabled = Boolean(profile?.organizationDisabled);

  const [organization, setOrganization] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState("");
  const [activeProjectData, setActiveProjectData] = useState(null);
  const [activeProjectSection, setActiveProjectSection] = useState("");
  const [projectTaskCounts, setProjectTaskCounts] = useState({
    total: 0,
    open: 0,
    todo: 0,
    doing: 0,
    resolved: 0,
  });
  const [recentProject, setRecentProject] = useState(null);
  const [projectRefresh, setProjectRefresh] = useState(0);
  const [resolvedOrganizationId, setResolvedOrganizationId] = useState(
    profile?.organizationId || ""
  );

  const profileName =
    profile?.name ||
    (profile?.email === "shanmukpatnala13@gmail.com"
      ? "Shanmuka Patnala"
      : profile?.email || "User");
  const profileInitials = profileName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const workspaceTitle = useMemo(
    () => organization?.name || profile?.organizationName || "Organization",
    [organization?.name, profile?.organizationName]
  );
  const isCodeTraxOrganization = workspaceTitle.toLowerCase() === "codetrax.in";
  const organizationLogo = organization?.companyLogo || "";
  const organizationInitials =
    workspaceTitle
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PT";
  const brandLogo = organizationLogo || (isCodeTraxOrganization ? codetraxLogo : "");
  const activeOrganizationId =
    organization?.id || resolvedOrganizationId || profile?.organizationId || "";
  const activeProjectLogo = activeProjectData?.projectLogo || "";
  const activeProjectInitial =
    activeProjectName?.slice(0, 1).toUpperCase() || "P";

  const loadOrganization = async () => {
    if (!profile?.organizationId) return;

    const snap = await getDoc(doc(db, "organizations", profile.organizationId));
    if (snap.exists()) {
      setOrganization({ id: snap.id, ...snap.data() });
      setResolvedOrganizationId(snap.id);
    }
  };

  useEffect(() => {
    setResolvedOrganizationId(profile?.organizationId || "");
    loadOrganization();
  }, [profile?.organizationId]);

  useEffect(() => {
    const resolveCodeTraxOrganization = async () => {
      if (
        activeOrganizationId ||
        profile?.email?.toLowerCase() !== "admin@codetrax.in"
      ) {
        return;
      }

      const snap = await getDocs(
        query(
          collection(db, "organizations"),
          where("adminEmail", "==", "admin@codetrax.in")
        )
      );
      const orgDoc = snap.docs[0];
      if (!orgDoc) return;

      const nextOrganization = { id: orgDoc.id, ...orgDoc.data() };
      setOrganization(nextOrganization);
      setResolvedOrganizationId(orgDoc.id);
      setProfile?.({
        ...profile,
        name: profile?.name || nextOrganization.adminName || "Shanmuka Patnala",
        organizationId: orgDoc.id,
        organizationName: nextOrganization.name || "CodeTrax.in",
      });

      if (auth.currentUser?.uid) {
        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          {
            name: profile?.name || nextOrganization.adminName || "Shanmuka Patnala",
            organizationId: orgDoc.id,
            organizationName: nextOrganization.name || "CodeTrax.in",
            role: profile?.role || "orgAdmin",
          },
          { merge: true }
        );
      }
    };

    resolveCodeTraxOrganization();
  }, [activeOrganizationId, profile?.email]);

  useEffect(() => {
    const loadProjectTaskCounts = async () => {
      if (!activeProject || !activeOrganizationId) {
        setProjectTaskCounts({
          total: 0,
          open: 0,
          todo: 0,
          doing: 0,
          resolved: 0,
        });
        return;
      }

      const snap = await getDocs(
        query(collection(db, "tasks"), where("organizationId", "==", activeOrganizationId))
      );
      const counts = snap.docs
        .map((task) => task.data())
        .filter((task) => task.projectId === activeProject)
        .reduce(
          (nextCounts, task) => {
            const state = task.state || "To do";

            nextCounts.total += 1;
            if (state !== "Done") nextCounts.open += 1;
            if (state === "To do") nextCounts.todo += 1;
            if (state === "Doing") nextCounts.doing += 1;
            if (state === "Resolved") nextCounts.resolved += 1;

            return nextCounts;
          },
          { total: 0, open: 0, todo: 0, doing: 0, resolved: 0 }
        );

      setProjectTaskCounts(counts);
    };

    loadProjectTaskCounts();
  }, [activeProject, activeOrganizationId, activeProjectSection]);

  const openProject = (project) => {
    setActiveProject(project.id);
    setActiveProjectName(project.projectName);
    setActiveProjectData(project);
    setActiveProjectSection("");
    setWorkspaceView("project");
  };

  const projectWebsite = activeProjectData?.website?.trim();
  const projectWebsiteUrl =
    projectWebsite && /^https?:\/\//i.test(projectWebsite)
      ? projectWebsite
      : projectWebsite
        ? `https://${projectWebsite}`
        : "";

  if (isAppAdmin) {
    return (
      <>
        <div className="navbar">
          <div className="navbar-content">
            <div className="navbar-title">
              <img
                className="app-title-logo"
                src={projectTaskManagerLogo}
                alt="Project Task Manager"
              />
            </div>
            <div className="nav-tabs">
              <button
                className={activeView === "home" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => setActiveView("home")}
              >
                Home
              </button>
              <button
                className={activeView === "create" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => setActiveView("create")}
              >
                Create
              </button>
              <button
                className={activeView === "manage" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => setActiveView("manage")}
              >
                Manage
              </button>
            </div>
          </div>
          <div className="profile-strip">
            <span>{profileName}</span>
            <span className="profile-avatar">{profileInitials}</span>
            <Logout />
          </div>
        </div>
        <OrganizationManager
          activeView={activeView}
          profile={profile}
          setActiveView={setActiveView}
          setProfile={setProfile}
        />
      </>
    );
  }

  return (
    <div className="ado-shell">
      <header className="ado-header">
        <div className="ado-brand">
          {brandLogo ? (
            <img className="ado-logo-img" src={brandLogo} alt="" />
          ) : (
            <span className="ado-logo">{organizationInitials}</span>
          )}
          <b>{workspaceTitle}</b>
        </div>
        <div className="profile-strip dark">
          <span>{profileName}</span>
          <span className="profile-avatar">{profileInitials}</span>
          <Logout />
        </div>
      </header>

      <aside className="ado-sidebar">
        <button
          className={workspaceView === "projects" ? "app-name-link active" : "app-name-link"}
          type="button"
          onClick={() => {
            setWorkspaceView("projects");
            setActiveProject(null);
            setActiveProjectName("");
            setActiveProjectData(null);
            setActiveProjectSection("");
          }}
        >
          {brandLogo ? (
            <img className="side-logo-img" src={brandLogo} alt="" />
          ) : (
            <span className="side-logo-placeholder">{organizationInitials}</span>
          )}
          <span>{workspaceTitle}</span>
        </button>
        {workspaceView === "project" && activeProject && (
          <div className="sidebar-project-menu">
            <button
              className="sidebar-project-title"
              type="button"
              onClick={() => setActiveProjectSection("")}
            >
              {activeProjectLogo?.startsWith("http") ||
              activeProjectLogo?.startsWith("data:") ? (
                <img className="sidebar-project-logo" src={activeProjectLogo} alt="" />
              ) : (
                <span className="sidebar-project-logo placeholder">
                  {activeProjectLogo || activeProjectInitial}
                </span>
              )}
              <span>{activeProjectName}</span>
            </button>
            <button
              className={
                activeProjectSection === "workItems"
                  ? "project-option active"
                  : "project-option"
              }
              type="button"
              onClick={() => setActiveProjectSection("workItems")}
            >
              Work items
            </button>
            <button
              className={
                activeProjectSection === "website"
                  ? "project-option active"
                  : "project-option"
              }
              type="button"
              onClick={() => setActiveProjectSection("website")}
            >
              Website
            </button>
          </div>
        )}
        <button
          className={
            workspaceView === "settings"
              ? "side-link active settings-link"
              : "side-link settings-link"
          }
          type="button"
          onClick={() => {
            setWorkspaceView("settings");
            setActiveProject(null);
            setActiveProjectName("");
            setActiveProjectData(null);
            setActiveProjectSection("");
          }}
        >
          Organization settings
        </button>
      </aside>

      <main className="ado-main">
        {organizationDisabled && (
          <div className="ado-panel">
            <h2>Organization Disabled</h2>
            <p>Please contact your app admin.</p>
          </div>
        )}

        {!organizationDisabled && workspaceView === "projects" && (
          <>
            <div className="workspace-head">
              <h1>{workspaceTitle}</h1>
            </div>

            {activeOrganizationId && (
              <ProjectList
                openProject={openProject}
                organizationId={activeOrganizationId}
                currentUserId={profile.id}
                isAdmin={isOrgAdmin}
                localProject={recentProject}
                refreshKey={projectRefresh}
              />
            )}
          </>
        )}

        {!organizationDisabled && workspaceView === "settings" && (
          <ProjectSettings
            organizationId={activeOrganizationId}
            profile={profile}
            canManage={isOrgAdmin}
            onOrganizationUpdated={(nextOrganization) => {
              setOrganization(nextOrganization);
            }}
            onProjectCreated={(project) => {
              setRecentProject(project);
              setProjectRefresh((current) => current + 1);
            }}
            onProjectChanged={(project) => {
              setRecentProject((currentProject) =>
                currentProject?.id === project.id
                  ? { ...currentProject, ...project }
                  : currentProject
              );
              setProjectRefresh((current) => current + 1);
            }}
          />
        )}

        {!organizationDisabled && workspaceView === "project" && activeProject && (
          <div className="project-workspace">
            <div className="project-content-header">
              <button
                className="project-title-link"
                type="button"
                onClick={() => setActiveProjectSection("")}
              >
                {activeProjectLogo?.startsWith("http") ||
                activeProjectLogo?.startsWith("data:") ? (
                  <img className="project-title-logo" src={activeProjectLogo} alt="" />
                ) : (
                  <span className="project-title-logo placeholder">
                    {activeProjectLogo || activeProjectInitial}
                  </span>
                )}
                <span>{activeProjectName}</span>
              </button>
            </div>

            {!activeProjectSection && (
              <div className="project-option-empty">
                <button
                  className="project-total-tasks"
                  type="button"
                  onClick={() => setActiveProjectSection("workItems")}
                >
                  <strong>
                    {projectTaskCounts.open} of {projectTaskCounts.total}
                  </strong>
                  <span>Total tasks</span>
                  <small>
                    To do {projectTaskCounts.todo} | Doing {projectTaskCounts.doing} | Resolved{" "}
                    {projectTaskCounts.resolved}
                  </small>
                </button>
              </div>
            )}

            {activeProjectSection === "workItems" && (
              <TaskManager
                projectId={activeProject}
                projectName={activeProjectName}
                organizationId={activeOrganizationId}
                canCreateTasks
                embedded
                onBack={() => setActiveProjectSection("")}
              />
            )}

            {activeProjectSection === "website" && (
              <div className="ado-panel project-website-panel">
                <h2>Website</h2>
                {projectWebsite ? (
                  <a href={projectWebsiteUrl} target="_blank" rel="noreferrer">
                    {projectWebsite}
                  </a>
                ) : (
                  <p>No website link added for this project.</p>
                )}
              </div>
            )}
          </div>
        )}

        {!organizationDisabled && workspaceView === "project" && !activeProject && (
          <div className="work-items-page">
            <div className="empty-work">Select a project to view options</div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CreateProject;
