import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

import useRole from "../utils/useRole";
import Logout from "./Logout";
import ProjectList from "./ProjectList";
import TaskManager from "./TaskManager";

function CreateProject() {
  const role = useRole();               // admin | user
  const user = auth.currentUser;

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeProject, setActiveProject] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!projectName || !startDate || !endDate) {
      alert("Please fill all required fields");
      return;
    }

    try {
      await addDoc(collection(db, "projects"), {
        projectName,
        description,
        startDate,
        endDate,
        status: "Active",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      alert("Project created successfully ✅");

      setProjectName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
    } catch (error) {
      console.error(error);
      alert("Error creating project ❌");
    }
  };

  return (
    <>
      {/* Navbar */}
      <div className="navbar">
        Project Task Manager
        <Logout />
      </div>

      {/* ADMIN → CREATE PROJECT */}
      {role === "admin" && (
        <div className="container">
          <h2>Create Project</h2>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />

            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            <button type="submit">Create Project</button>
          </form>
        </div>
      )}

      {/* USER MESSAGE */}
      {role === "user" && (
        <div className="container">
          <h2>Welcome</h2>
          <p>You can view projects and tasks.</p>
        </div>
      )}

      {/* PROJECT LIST */}
      <ProjectList openProject={setActiveProject} />

      {/* TASK MANAGER */}
      {activeProject && <TaskManager projectId={activeProject} />}
    </>
  );
}

export default CreateProject;