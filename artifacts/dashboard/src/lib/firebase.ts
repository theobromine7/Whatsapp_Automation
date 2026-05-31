import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

if (apiKey) {
  const firebaseConfig = {
    apiKey,
    authDomain: "studio-1871371743-58ae3.firebaseapp.com",
    projectId: "studio-1871371743-58ae3",
    storageBucket: "studio-1871371743-58ae3.firebasestorage.app",
  };
  _app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  _auth = getAuth(_app);
}

export const auth: Auth | null = _auth;
export const googleProvider = new GoogleAuthProvider();

export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!_auth) throw new Error("Firebase not configured — VITE_FIREBASE_API_KEY is missing");
  const cred = await signInWithEmailAndPassword(_auth, email, password);
  return cred.user;
}

export async function loginWithGoogle(): Promise<User> {
  if (!_auth) throw new Error("Firebase not configured — VITE_FIREBASE_API_KEY is missing");
  const cred = await signInWithPopup(_auth, googleProvider);
  return cred.user;
}

export async function logout(): Promise<void> {
  if (!_auth) return;
  await signOut(_auth);
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!_auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, cb);
}
