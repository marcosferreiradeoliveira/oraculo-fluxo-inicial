import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Debug log for environment variables
console.log('Firebase Config:', {
  apiKey: import.meta.env.VITE_API_KEY ? '✅ Set' : '❌ Missing',
  authDomain: import.meta.env.VITE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing',
  projectId: import.meta.env.VITE_PROJECT_ID ? '✅ Set' : '❌ Missing',
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET ? '✅ Set' : '❌ Missing',
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID ? '✅ Set' : '❌ Missing',
  appId: import.meta.env.VITE_APP_ID ? '✅ Set' : '❌ Missing',
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Initialize Firebase
let app;
try {
  // Check if Firebase app is already initialized
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error; // Re-throw to prevent the app from starting with a broken Firebase config
}

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable Firebase Emulator Suite in development
if (import.meta.env.DEV) {
  try {
    // Uncomment these lines if you want to use Firebase Emulator
    // connectAuthEmulator(auth, 'http://localhost:9099');
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Firebase running in development mode');
  } catch (error) {
    console.warn('Failed to connect to Firebase Emulator:', error);
  }
}

// Analytics (only available in browser)
export let analytics: ReturnType<typeof getAnalytics> | undefined = undefined;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics initialized');
      } else {
        console.log('Firebase Analytics not supported in this browser');
      }
    })
    .catch((error) => {
      console.error('Firebase Analytics initialization error:', error);
    });
}

export { auth, db, storage };