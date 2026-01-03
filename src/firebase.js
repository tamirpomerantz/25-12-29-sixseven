// Firebase configuration and initialization
// Using ES modules - Firebase v10+
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
// TODO: Replace with your actual Firebase config from Firebase Console
// You can find this in Firebase Console > Project Settings > General > Your apps > Web app
const firebaseConfig = {
  apiKey: "AIzaSyBpsomLQ-dilby8Ii88-9ZSSctxVGQnDtY",
  authDomain: "bonus-fce33.firebaseapp.com",
  projectId: "bonus-fce33",
  storageBucket: "bonus-fce33.firebasestorage.app",
  messagingSenderId: "985497914878",
  appId: "1:985497914878:web:030ad76dc4f1ce7b21c4af",
  measurementId: "G-T7VYGPCXG0"
};

// Initialize Firebase
let app;
let auth;
let db;
let googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  // Set the OAuth client ID (optional, but can help with multiple clients)
  googleProvider.setCustomParameters({
    client_id: '985497914878-k3hb8qjeu7hiuq4v4uj7v9q9q671bbsp.apps.googleusercontent.com'
  });
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Create placeholder objects to prevent errors
  auth = null;
  db = null;
  googleProvider = null;
}

export { auth, db, googleProvider };
export default app;

