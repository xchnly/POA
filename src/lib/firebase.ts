// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Pastikan ini diexport

export default app;