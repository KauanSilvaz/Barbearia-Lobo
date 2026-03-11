// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBloVa9ljCgsi7PVS5r7GyhMVfCAutKnJM",
  authDomain: "barbeariasaas-b0893.firebaseapp.com",
  projectId: "barbeariasaas-b0893",
  storageBucket: "barbeariasaas-b0893.firebasestorage.app",
  messagingSenderId: "467961031517",
  appId: "1:467961031517:web:aa2b367f48782cc1ed16b4",
  measurementId: "G-53WGFML5HF"
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