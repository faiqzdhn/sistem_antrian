import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyA80A5nb1oj_Fgk6so5drNI8yergRFyqFg",
  authDomain: "spring-radar-479503-b0.firebaseapp.com",
  projectId: "spring-radar-479503-b0",
  storageBucket: "spring-radar-479503-b0.firebasestorage.app",
  messagingSenderId: "624278165196",
  appId: "1:624278165196:web:e4d76fef24d16039491469",
  measurementId: "G-L78QQN47FX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Uncomment untuk development dengan emulator
// if (location.hostname === 'localhost') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   connectAuthEmulator(auth, 'http://localhost:9099');
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }
