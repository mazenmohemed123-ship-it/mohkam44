import { useState } from 'react';
import { Sparkles, Scale, FileText, Send, X, Copy } from 'lucide-react';
import { Button, Modal, Spinner } from '../atoms';
import { askLegalAssistant, summarizeText } from '../../services/aiTools';
import type { Tier } from '../../context/RoleContext';

interface AIAssistantProps {
  tier: Tier;
  role: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
  onClose: () => void;
}

export function AIAssistant({ tier, role, push, onClose }: AIAssistantProps) {
  const isLawyer = ['owner', 'partner', 'lawyer'].includes(role);
  const canLegal = tier === 'team' && isLawyer;
  const canSummarize = tier === 'pro' || tier === 'team';

  const [mode, setMode] = useState<'legal' | 'summarize'>(canLegal ? 'legal' : 'summarize');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ used?: number; limit?: number }>({});

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setOutput('');
    const res = mode === 'legal' ? await askLegalAssistant(input) : await summarizeText(input);
    setLoading(false);
    if (res.error) {
      push(res.error, 'warning');
      return;
    }
    setOutput(res.text || 'لم يتم إرجاع نتيجة.');
    setMeta({ used: res.used, limit: res.limit });
  };

  const copyOut = async () => {
    try {
      await navigator.clipboard.writeText(output);
      push('تم نسخ النتيجة', 'success');
    } catch { /* ignore */ }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #FFFBEB, #fff)' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} color="var(--gold)" /> المساعد الذكي
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Mode tabs (only the ones the tier/role allows) */}
        <div style={{ display: 'flex', gap: 8 }}>
          {canLegal && (
            <Button size="sm" variant={mode === 'legal' ? 'primary' : 'secondary'} onClick={() => { setMode('legal'); setOutput(''); }}>
              <Scale size={14} /> مساعد قانوني
            </Button>
          )}
          {canSummarize && (
            <Button size="sm" variant={mode === 'summarize' ? 'primary' : 'secondary'} onClick={() => { setMode('summarize'); setOutput(''); }}>
              <FileText size={14} /> تلخيص نص
            </Button>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {mode === 'legal'
            ? 'اطرح سؤالك القانوني — الإجابة إرشادية ولا تُغني عن الاستشارة الرسمية.'
            : 'الصق نص القضية أو المستند للحصول على ملخص موجز.'}
        </p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          maxLength={mode === 'legal' ? 4000 : 8000}
          placeholder={mode === 'legal' ? 'مثال: ما هي إجراءات الطعن بالنقض في حكم جنائي؟' : 'الصق النص المراد تلخيصه هنا...'}
          dir="rtl"
          style={{ width: '100%', padding: 14, border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, resize: 'vertical', fontFamily: "'Cairo',sans-serif", outline: 'none', lineHeight: 1.8 }}
        />

        <Button onClick={run} disabled={loading || !input.trim()} fullWidth>
          {loading ? <><Spinner /> جاري المعالجة...</> : <><Send size={14} /> {mode === 'legal' ? 'اسأل' : 'لخّص'}</>}
        </Button>

        {output && (
          <div className="fade-up" style={{ background: '#F5F8FF', borderRadius: 10, padding: 14, direction: 'rtl', position: 'relative' }}>
            <button onClick={copyOut} title="نسخ" style={{ position: 'absolute', top: 8, left: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex' }}>
              <Copy size={13} color="var(--navy)" />
            </button>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{output}</p>
            {meta.limit != null && (
              <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>الاستخدام اليومي: {meta.used} / {meta.limit}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
