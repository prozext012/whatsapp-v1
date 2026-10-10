// Inisialisasi Firebase (SDK 13.0.0 lewat CDN) + ekspor semua fungsi Auth & Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
export * from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbY3KSq39ac2QYURX31Nf_PmLPY3Mgi8w",
  authDomain: "vexzano-182d1.firebaseapp.com",
  projectId: "vexzano-182d1",
  storageBucket: "vexzano-182d1.firebasestorage.app",
  messagingSenderId: "743135238453",
  appId: "1:743135238453:web:fba61f67c91e9aa3ccd47c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Cache offline bawaan Firestore (pesan tertunda otomatis terkirim saat online)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
