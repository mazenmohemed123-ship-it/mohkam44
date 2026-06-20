import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface Announcement {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
}

const DISMISS_KEY = 'mohkam_ann_dismissed';

/**
 * Shows the latest active platform announcement. RLS already scopes which announcements
 * the current user (lawyer / client) is allowed to see, so a plain select is enough.
 */
export function AnnouncementBanner() {
  const [ann, setAnn] = useState<Announcement | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!active) return;
        const a = data?.[0] as Announcement | undefined;
        if (a && localStorage.getItem(DISMISS_KEY) !== a.id) setAnn(a);
      });
    return () => { active = false; };
  }, []);

  if (!ann) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px', background: 'linear-gradient(135deg, #0F2557, #1E3A8A)',
      color: '#fff', borderRadius: 12, margin: '0 0 14px', boxShadow: '0 6px 20px rgba(15,37,87,.25)',
    }}>
      <Megaphone size={18} color="var(--gold)" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {ann.title && <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{ann.title}</p>}
        <p style={{ fontSize: 13, lineHeight: 1.7, opacity: 0.92, whiteSpace: 'pre-wrap' }}>{ann.body}</p>
      </div>
      <button
        onClick={() => { localStorage.setItem(DISMISS_KEY, ann.id); setAnn(null); }}
        style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
