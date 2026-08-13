import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

function ProjectList({
  openProject,
  organizationId,
  currentUserId,
  isAdmin,
  refreshKey,
  localProject,
}) {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState(null);

  const fetchProjects = async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "projects"),
          where("organizationId", "==", organizationId)
        )
      );
      const data = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((project) => {
            const assigned =
              project.createdBy === currentUserId ||
              project.assignedUserIds?.includes(currentUserId);

            return isAdmin || assigned;
          });

      setStatus(null);
      if (!localProject) {
        setProjects(data);
        return;
      }

      const refreshedLocalProject = data.find(
        (project) => project.id === localProject.id
      );
      const mergedLocalProject = refreshedLocalProject
        ? { ...localProject, ...refreshedLocalProject }
        : localProject;

      setProjects([
        mergedLocalProject,
        ...data.filter((project) => project.id !== localProject.id),
      ]);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message || "Projects failed to load.",
      });
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [organizationId, currentUserId, isAdmin, refreshKey, localProject]);

  return (
    <div className="ado-panel project-panel">
      <h2>Projects</h2>
      {status && (
        <div className={`inline-status ${status.type}`} role="status">
          <span className="status-mark" aria-hidden="true" />
          <span>{status.message}</span>
        </div>
      )}
      {projects.length === 0 && <p>No projects found.</p>}
      <div className="project-grid">
      {projects.map((p) => (
        <div className="project-card" key={p.id}>
          <button type="button" onClick={() => openProject(p)}>
            {p.projectLogo?.startsWith("http") || p.projectLogo?.startsWith("data:") ? (
              <img
                alt=""
                className="project-logo-img"
                src={p.projectLogo}
              />
            ) : (
              <span className="project-badge">
                {p.projectLogo || p.projectName?.[0] || "P"}
              </span>
            )}
            <b>{p.projectName}</b>
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}

export default ProjectList;
