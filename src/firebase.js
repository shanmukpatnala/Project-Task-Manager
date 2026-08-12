import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAEVmJ7YspS5FkO1DJS_xq8QPI4l1-Qqoc",
  authDomain: "project-task-manager-d73a4.firebaseapp.com",
  projectId: "project-task-manager-d73a4",
  storageBucket: "project-task-manager-d73a4.firebasestorage.app",
  messagingSenderId: "544358763092",
  appId: "1:544358763092:web:d71f4947e8ec229f73bbc1"
};

const app = initializeApp(firebaseConfig);
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const db = getFirestore(app);
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
