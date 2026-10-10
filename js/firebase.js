// Inisialisasi Firebase (SDK 13.0.0 lewat CDN) + ekspor fungsi Auth, Firestore, Storage
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js";
export * from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
export * from "https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1656fPz0HWe9nTdiBJcrQz6N02njt_jU",
  authDomain: "whatsapp-4f3df.firebaseapp.com",
  projectId: "whatsapp-4f3df",
  storageBucket: "whatsapp-4f3df.firebasestorage.app",
  messagingSenderId: "622021427143",
  appId: "1:622021427143:web:62a14c35faf2b92d2563e2"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
// Cache offline bawaan Firestore (pesan teks tertunda terkirim otomatis saat online)
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
