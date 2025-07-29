import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Initialize Firebase services
export const firebaseInit = () => {
  try {
    // Check if Firebase app is already initialized
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log('Firebase initialized successfully');
    
    // Initialize services
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);
    let analytics: ReturnType<typeof getAnalytics> | null = null;

    // Initialize analytics if in browser
    if (typeof window !== 'undefined') {
      const initAnalytics = async () => {
        const analyticsSupported = await isSupported();
        if (analyticsSupported) {
          try {
            analytics = getAnalytics(app);
            console.log('Firebase Analytics initialized');
          } catch (error) {
            console.error('Firebase Analytics initialization error:', error);
          }
        } else {
          console.log('Firebase Analytics not supported in this environment');
        }
      };
      // Initialize after a short delay to prevent blocking the main thread
      setTimeout(initAnalytics, 1000);
    }

    // Enable Firebase Emulator Suite in development
    if (import.meta.env.DEV) {
      try {
        // Uncomment these lines if you want to use Firebase Emulator
        // connectAuthEmulator(auth, 'http://localhost:9099');
        // connectFirestoreEmulator(db, 'localhost', 8080);
        // connectStorageEmulator(storage, 'localhost', 9199);
        console.log('Firebase running in development mode');
      } catch (error) {
        console.error('Firebase emulator connection error:', error);
      }
    }

    return { app, auth, db, storage, analytics };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// Initialize Firebase and export services
const { app, auth, db, storage, analytics } = firebaseInit();

export { app, auth, db, storage, analytics };

// Make analytics available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).FIREBASE_ANALYTICS = analytics;
}