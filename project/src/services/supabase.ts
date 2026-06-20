import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function registerPush(userId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const reg = await navigator.serviceWorker.register('/sw.js');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;
    const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!VAPID) return null;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID,
    });
    const token = JSON.stringify(sub);
    await supabase.from('profiles').update({ fcm_token: token }).eq('id', userId);
    return token;
  } catch {
    return null;
  }
}

export async function sendPushToClient(userId: string, title: string, body: string) {
  // Deliver via FCM (works even when the recipient's app/tab is closed).
  try {
    await supabase.functions.invoke('send-notification', { body: { userId, title, body } });
  } catch {
    // edge function not configured / network error — fall back to a local notification
  }
  // Local foreground notification for the sender's own device, when permitted.
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch {
    // silent
  }
}

export function generateDeviceFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillText('fingerprint', 2, 2);
  }
  const canvasData = canvas.toDataURL();
  const nav = navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvasData.slice(-50),
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'dev_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
}
