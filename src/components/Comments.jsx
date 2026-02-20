import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

function Comments({ workItemId }) {
  const [text, setText] = useState("");
  const [comments, setComments] = useState([]);

  const loadComments = async () => {
    const snap = await getDocs(collection(db, "comments"));
    const filtered = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.workItemId === workItemId);
    setComments(filtered);
  };

  const addComment = async () => {
    if (!text) return;

    await addDoc(collection(db, "comments"), {
      workItemId,
      text,
      createdBy: auth.currentUser.email,
      createdAt: serverTimestamp()
    });

    setText("");
    loadComments();
  };

  useEffect(() => {
    loadComments();
  }, [workItemId]);

  return (
    <div>
      <h4>Comments</h4>

      {comments.map(c => (
        <div key={c.id}>
          <b>{c.createdBy}</b>: {c.text}
        </div>
      ))}

      <textarea
        placeholder="Add comment"
        value={text}
        onChange={e => setText(e.target.value)}
      />

      <button onClick={addComment}>Add Comment</button>
    </div>
  );
}

export default Comments;