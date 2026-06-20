import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { supabase } from './supabase';

/**
 * Firebase Cloud Messaging (FCM) integration.
 *
 * Everything here is a graceful no-op until the VITE_FIREBASE_* env vars are provided,
 * so the app keeps working before Firebase is configured. To activate push:
 *   1. Create a Firebase project, add a Web App, enable Cloud Messaging.
 *   2. Set the VITE_FIREBASE_* env vars (see .env.example) on Vercel.
 *   3. Fill the same config object in public/firebase-messaging-sw.js.
 *   4. Set the FCM_SERVICE_ACCOUNT secret on the Supabase project (service account JSON).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function isFcmConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    VAPID_KEY,
  );
}

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

async function ensureMessaging(): Promise<Messaging | null> {
  if (!isFcmConfigured()) return null;
  if (!(await isSupported().catch(() => false))) return null;
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as Record<string, string>);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

/** Request permission, obtain an FCM token and persist it to the user's profile. */
export async function requestFcmToken(userId: string): Promise<string | null> {
  try {
    const m = await ensureMessaging();
    if (!m || !('serviceWorker' in navigator)) return null;

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    // Dedicated scope so the FCM worker does not collide with the PWA cache worker (/sw.js).
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });

    const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) {
      await supabase.from('profiles').update({ fcm_token: token }).eq('id', userId);
    }
    return token || null;
  } catch {
    return null;
  }
}

/** Show a toast/notification when a push arrives while the app is in the foreground. */
export async function listenForegroundMessages(onMsg: (title: string, body: string) => void): Promise<void> {
  const m = await ensureMessaging();
  if (!m) return;
  onMessage(m, (payload) => {
    onMsg(payload.notification?.title || 'إشعار', payload.notification?.body || '');
  });
}
