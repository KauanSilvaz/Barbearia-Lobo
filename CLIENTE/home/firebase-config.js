// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// Substitua pelos dados do seu projeto no Firebase Console:
// Project Settings > General > Your apps (Web App)
const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore e exporta para usar no home.js
export const db = getFirestore(app);

// Inicializa o Messaging (Notificações Push)
export const messaging = getMessaging(app);