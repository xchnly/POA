// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNKM4IrmC6lCS28iHDgJvSeYJqhSRjPb4",
  authDomain: "prestovaoneapproval.firebaseapp.com",
  projectId: "prestovaoneapproval",
  storageBucket: "prestovaoneapproval.firebasestorage.app",
  messagingSenderId: "91874841347",
  appId: "1:91874841347:web:e16e64805f75c6c4e28f36"
};

// Initialize Firebase

// Inisialisasi Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi layanan-layanan Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Ekspor layanan untuk digunakan di seluruh aplikasi
export { auth, db, storage };

export default app;