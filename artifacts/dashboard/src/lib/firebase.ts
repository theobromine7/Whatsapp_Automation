import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;

const firebaseConfig = {
  apiKey: apiKey ?? "",
  authDomain: "studio-1871371743-58ae3.firebaseapp.com",
  projectId: "studio-1871371743-58ae3",
  storageBucket: "studio-1871371743-58ae3.firebasestorage.app",
};

// Only init if we have a real API key — prevents crash on missing env var
const app = apiKey
  ? (getApps().length ? getApps()[0]! : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null as unknown as ReturnType<typeof getAuth>;
export const googleProvider = new GoogleAuthProvider();

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
