import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyAu33lTfW_h5pR5pMCXy0JqBOPBg9Dn0hc",
  authDomain: "skillwise-a1fb2.firebaseapp.com",
  projectId: "skillwise-a1fb2",
  storageBucket: "skillwise-a1fb2.firebasestorage.app",
  messagingSenderId: "705470129076",
  appId: "1:705470129076:web:25f62a7028788f28dec8e1",
  measurementId: "G-JS5LLLY9J9"
};

const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const db = getFirestore(app);