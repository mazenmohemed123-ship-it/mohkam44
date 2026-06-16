/* global importScripts, firebase */
// Firebase Cloud Messaging background handler.
// NOTE: Service workers cannot read Vite env vars, so the public Firebase web config
// must be pasted here. These values are NOT secrets (they ship in every web app).
// Replace the REPLACE_ME placeholders with your Firebase Web App config.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'مُحكَم';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
  });
});
