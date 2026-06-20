import { useEffect, useRef, useState } from 'react';
import { Send, Check, CheckCheck, Image as ImageIcon, FileText, Edit3, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '../atoms';
import { useChatMessages } from '../../hooks/useChatMessages';
import { useChatPresence } from '../../hooks/useChatPresence';
import { messageState, type ChatMessage, type ChatRoomType } from '../../services/chat/types';

interface ChatRoomProps {
  userId: string;
  userRole?: string;
  userName?: string;
  roomType: ChatRoomType;
  caseId?: string | null;
  teamId?: string | null;
  peerTargetId?: string | null;
  headerTitle: string;
  headerSubtitle?: string;
  canSend?: boolean;
  allowAttachments?: boolean;
  showReceipts?: boolean;
  resolveSender?: (m: ChatMessage) => { label?: string; isMe: boolean; isSystem: boolean };
  push?: (msg: string, type: 'success' | 'warning' | 'danger') => void;
}

const isSystemText = (t: string) => t.startsWith('【') || t.startsWith('🆘');

export function ChatRoom({
  userId,
  userRole,
  userName,
  roomType,
  caseId,
  teamId,
  peerTargetId,
  headerTitle,
  headerSubtitle,
  canSend = true,
  allowAttachments = true,
  showReceipts = true,
  resolveSender,
  push,
}: ChatRoomProps) {
  const roomKey = roomType === 'internal_team_chat' ? teamId : caseId;
  const { messages, loading, send, editMessage, deleteMessage } = useChatMessages({
    userId, userRole, roomType, caseId, teamId, peerTargetId,
  });
  const { isAnyoneElseOnline, isOtherTyping, setTyping } = useChatPresence({ roomKey, userId, userName });

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOtherTyping]);

  const onSend = async (files?: File[]) => {
    if (!input.trim() && (!files || !files.length)) return;
    setSending(true);
    try {
      await send(input, files);
      setInput('');
    } catch {
      push?.('خطأ في الإرسال', 'danger');
    } finally {
      setSending(false);
    }
  };

  const defaultResolve = (m: ChatMessage) => ({
    isMe: m.sender_id === userId,
    isSystem: isSystemText(m.message_text) || m.sender_role === 'system',
    label: undefined as string | undefined,
  });
  const resolve = resolveSender || defaultResolve;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #F5F8FF, #fff)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 900, fontSize: 15, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerTitle}</p>
          <p style={{ fontSize: 11, color: isOtherTyping ? 'var(--success)' : 'var(--muted)', fontWeight: isOtherTyping ? 700 : 400 }}>
            {isOtherTyping ? 'يكتب الآن…' : (headerSubtitle || '')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isAnyoneElseOnline ? 'var(--success)' : 'var(--muted)', display: 'inline-block' }} className={isAnyoneElseOnline ? 'pulse' : undefined} />
          <span style={{ fontSize: 10, color: isAnyoneElseOnline ? 'var(--success)' : 'var(--muted)', fontWeight: 700 }}>
            {isAnyoneElseOnline ? 'متصل الآن' : 'غير متصل'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFBFE' }}>
        {loading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>جاري التحميل…</p>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <MessageSquare size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>لا توجد رسائل بعد</p>
          </div>
        )}

        {messages.map((m) => {
          const { isMe, isSystem, label } = resolve(m);
          const state = messageState(m);
          return (
            <div
              key={m.id}
              className="fade-up"
              style={{ display: 'flex', justifyContent: isSystem ? 'center' : isMe ? 'flex-start' : 'flex-end', position: 'relative' }}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div style={{ maxWidth: '78%', position: 'relative' }}>
                {label && !isMe && !isSystem && (
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', marginBottom: 3, marginRight: 4 }}>{label}</p>
                )}
                <div
                  className={isSystem ? 'chat-system' : isMe ? 'chat-me' : 'chat-other'}
                  style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.75, direction: 'rtl', borderRadius: 12 }}
                >
                  {editingId === m.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { editMessage(m.id, editText); setEditingId(null); } }}
                        autoFocus
                        style={{ flex: 1, padding: '4px 8px', border: '1.5px solid var(--navy-mid)', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: "'Cairo',sans-serif" }}
                      />
                      <Button size="sm" onClick={() => { editMessage(m.id, editText); setEditingId(null); }}>حفظ</Button>
                    </div>
                  ) : (
                    <>
                      {(m.attachments || []).map((a) => (
                        <div key={a.id} style={{ marginBottom: m.message_text && m.message_text !== 'مرفق' ? 8 : 0 }}>
                          {a.file_type === 'image' && <img src={a.file_url} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />}
                          {a.file_type === 'video' && <video src={a.file_url} controls style={{ maxWidth: '100%', borderRadius: 8 }} />}
                          {(a.file_type === 'pdf' || a.file_type === 'file') && (
                            <a href={a.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>
                              <FileText size={14} /> فتح الملف
                            </a>
                          )}
                        </div>
                      ))}
                      {m.message_text !== 'مرفق' && m.message_text}
                    </>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{ fontSize: 9, opacity: 0.5, fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && !isSystem && showReceipts && !m._optimistic && (
                      state === 'read'
                        ? <CheckCheck size={13} color="#34B7F1" />
                        : state === 'delivered'
                          ? <CheckCheck size={13} style={{ opacity: 0.55 }} />
                          : <Check size={13} style={{ opacity: 0.55 }} />
                    )}
                  </div>
                </div>

                {hoveredId === m.id && isMe && !isSystem && editingId !== m.id && (
                  <div style={{ position: 'absolute', top: -6, right: 0, display: 'flex', gap: 4, background: '#fff', borderRadius: 6, padding: '2px 4px', boxShadow: '0 2px 8px rgba(0,0,0,.12)', zIndex: 10 }}>
                    <button onClick={() => { setEditingId(m.id); setEditText(m.message_text); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy)', display: 'flex' }}><Edit3 size={12} /></button>
                    <button onClick={() => deleteMessage(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isOtherTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div className="chat-other" style={{ padding: '8px 14px', borderRadius: 12, fontSize: 12, color: 'var(--muted)' }}>يكتب…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {canSend && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: '#fff' }}>
          {allowAttachments && (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: '#F5F8FF', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="file"
                accept="image/*,video/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onSend([f]); e.currentTarget.value = ''; }}
              />
              <ImageIcon size={16} color="var(--navy)" />
            </label>
          )}
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setTyping(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            placeholder="اكتب رسالة…"
            dir="rtl"
            maxLength={2000}
            style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: "'Cairo',sans-serif", outline: 'none' }}
          />
          <Button onClick={() => onSend()} disabled={sending} style={{ padding: '10px 16px' }}>
            <Send size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
