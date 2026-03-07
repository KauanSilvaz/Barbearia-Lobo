// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAmljKXhjb9GlY1ABEA-GPJqNsftsv_hVk",
  authDomain: "ksstech-79520.firebaseapp.com",
  projectId: "ksstech-79520",
  storageBucket: "ksstech-79520.firebasestorage.app",
  messagingSenderId: "935997511388",
  appId: "1:935997511388:web:9c336727d3e588ee30c619",
  measurementId: "G-TM49C8N0T1"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificação recebida em background: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    vibrate: [200, 100, 200, 100, 200], // Vibração personalizada
    data: {
      url: payload.data ? payload.data.url : '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});