import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Comments from "./Comments";

function WorkItemDetails({ item }) {
  if (!item) return null;

  const updateStatus = async (newStatus) => {
    await updateDoc(doc(db, "workItems", item.id), {
      status: newStatus
    });
    alert("Status updated");
  };

  return (
    <div className="container">
      <h2>{item.title}</h2>

      <p><b>Status:</b> {item.status}</p>
      <p><b>Assigned To:</b> {item.assignedTo.name}</p>
      <p><b>Priority:</b> {item.priority}</p>

      <select
        value={item.status}
        onChange={e => updateStatus(e.target.value)}
      >
        <option>To Do</option>
        <option>Doing</option>
        <option>Done</option>
      </select>

      <h4>Description</h4>
      <p>{item.description}</p>

      {/* COMMENTS FEATURE */}
      <Comments workItemId={item.id} />
    </div>
  );
}

export default WorkItemDetails;