import useUserProfile from "./useUserProfile";
import { auth } from "../firebase";

export default function useRole() {
  const { profile } = useUserProfile(auth.currentUser);
  return profile?.role || "staff";
}
