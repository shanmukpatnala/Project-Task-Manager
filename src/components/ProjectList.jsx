import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function ProjectList({ openProject }) {
  const [projects, setProjects] = useState([]);

  const fetchProjects = async () => {
    const snap = await getDocs(collection(db, "projects"));
    setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const deleteProject = async (id) => {
    await deleteDoc(doc(db, "projects", id));
    fetchProjects();
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="container">
      <h2>Projects</h2>
      {projects.map(p => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <b>{p.projectName}</b>
          <br />
          <button onClick={() => openProject(p.id)}>Open</button>
          <button onClick={() => deleteProject(p.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

export default ProjectList;