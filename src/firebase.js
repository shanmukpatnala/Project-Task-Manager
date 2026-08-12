import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const readPublicConfig = (value) => globalThis.atob(value);

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    readPublicConfig("QUl6YVN5QUVWbUo3WXNwUzVGa08xREpTX3hxOFFQSTRsMS1RcW9j"),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "project-task-manager-d73a4.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "project-task-manager-d73a4",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "project-task-manager-d73a4.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "544358763092",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:544358763092:web:d71f4947e8ec229f73bbc1",
};

const app = initializeApp(firebaseConfig);
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const db = getFirestore(app);
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
