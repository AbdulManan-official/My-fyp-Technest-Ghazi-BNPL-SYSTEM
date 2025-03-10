// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkPzQta7nBxr70yw6NjNbJ_AS9rtpRLHU",
  authDomain: "technest-ghazi-fyp.firebaseapp.com",
  projectId: "technest-ghazi-fyp",
  storageBucket: "technest-ghazi-fyp.firebasestorage.app",
  messagingSenderId: "538389829048",
  appId: "1:538389829048:web:b9c29a3911ed2de81ceb4d",
  measurementId: "G-ZF4ZHRCT9D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore, Storage, and Realtime Database
const db = getFirestore(app);
const storage = getStorage(app);
const realtimeDb = getDatabase(app);

// Initialize Firebase Analytics

export { auth, db, storage, realtimeDb, };
