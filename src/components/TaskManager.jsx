import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";
import { db } from "../firebase";

function TaskManager({ projectId }) {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);

  const fetchTasks = async () => {
    const snap = await getDocs(collection(db, "tasks"));
    const filtered = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.projectId === projectId);
    setTasks(filtered);
  };

  const addTask = async () => {
    await addDoc(collection(db, "tasks"), {
      projectId,
      title: task,
      status: "pending"
    });
    setTask("");
    fetchTasks();
  };

  const toggleStatus = async (t) => {
    await updateDoc(doc(db, "tasks", t.id), {
      status: t.status === "pending" ? "done" : "pending"
    });
    fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const completed = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  return (
    <div className="container">
      <h3>Tasks</h3>

      <input
        placeholder="Task name"
        value={task}
        onChange={e => setTask(e.target.value)}
      />
      <button onClick={addTask}>Add Task</button>

      <p>Progress: {progress}%</p>
      <progress value={progress} max="100" />

      {tasks.map(t => (
        <div key={t.id}>
          <input
            type="checkbox"
            checked={t.status === "done"}
            onChange={() => toggleStatus(t)}
          />
          {t.title}
        </div>
      ))}
    </div>
  );
}

export default TaskManager;