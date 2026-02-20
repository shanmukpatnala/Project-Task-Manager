import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

function WorkItemBoard({ openItem }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("me");

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "workItems"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (filter === "me") {
        setItems(data.filter(i => i.assignedTo.uid === auth.currentUser.uid));
      } else {
        setItems(data);
      }
    };

    load();
  }, [filter]);

  return (
    <div className="container">
      <h3>Work Items</h3>

      <select onChange={e => setFilter(e.target.value)}>
        <option value="me">Assigned to Me</option>
        <option value="team">My Team</option>
      </select>

      {items.map(i => (
        <div key={i.id} onClick={() => openItem(i)}>
          <b>{i.title}</b> — {i.status}
        </div>
      ))}
    </div>
  );
}

export default WorkItemBoard;