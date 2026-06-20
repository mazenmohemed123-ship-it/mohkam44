import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Captures the browser's install prompt and surfaces a branded "install app" banner,
 * turning the PWA into an installable app on Android/desktop. (iOS uses Add to Home Screen.)
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      if (localStorage.getItem('mohkam_pwa_dismissed') !== '1') setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show || !deferred) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9000,
      maxWidth: 420, margin: '0 auto',
      background: 'linear-gradient(135deg, #0F2557, #1E3A8A)', color: '#fff',
      borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 12px 36px rgba(0,0,0,.35)',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Download size={18} color="var(--gold)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 800, fontSize: 13 }}>ثبّت تطبيق مُحكَم</p>
        <p style={{ fontSize: 11, opacity: 0.8 }}>وصول أسرع وإشعارات فورية من شاشتك الرئيسية</p>
      </div>
      <button
        onClick={async () => { deferred.prompt(); await deferred.userChoice; setShow(false); }}
        style={{ background: 'var(--gold)', color: '#0F2557', border: 'none', borderRadius: 9, padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
      >
        تثبيت
      </button>
      <button
        onClick={() => { localStorage.setItem('mohkam_pwa_dismissed', '1'); setShow(false); }}
        style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
