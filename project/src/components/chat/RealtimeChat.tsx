import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, CreditCard as Edit3, Trash2, MessageSquare, Shield, Scale, Phone, Hash, FileText, ChevronLeft, ChevronRight, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { Button, Card, Badge, Modal } from '../atoms';
import { sanitize } from '../../services/sanitize';
import { supabase } from '../../services/supabase';
import { checkFloodLimit } from '../../services/floodProtection';
import { checkChatUploadQuota, getDailyChatUploadCount } from '../../services/chatQuotas';
import { useRole } from '../../context/RoleContext';
import { useCase, type CaseRow } from '../../context/CaseContext';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  case_id: string;
  sender_id: string;
  message_text: string;
  is_deleted: boolean;
  attachment_url?: string;
  attachment_type?: string;
  room_type?: string;
  created_at: string;
  updated_at: string;
}

/* Helper functions for emergency/system message detection */
const isEmergencyMessage = (text: string): boolean =>
  text.startsWith('🆘') || text.includes('【طلب طوارئ') || text.includes('🆘 [طلب طوارئ') || text.includes('【🚨 طلب طوارئ');

const isSystemMessage = (text: string): boolean =>
  text.startsWith('【') || text.includes('تم قبول') || text.includes('تم رفض');

interface RealtimeChatProps {
  cases: CaseRow[];
  userId: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
  userEmail?: string;
  openChatWithClient?: (clientId: string) => Promise<void>;
}

export function RealtimeChat({ cases, userId, push, userEmail, openChatWithClient }: RealtimeChatProps) {
  const { canViewChat, tier, activeRole } = useRole();
  const { selectedCase, setSelectedCase } = useCase();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  const [linkedClients, setLinkedClients] = useState<any[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [masterLawyerId, setMasterLawyerId] = useState<string>('');

  useEffect(() => {
    const fetchMasterAndClients = async () => {
      try {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('master_lawyer_id')
          .eq('id', userId)
          .single();
        const masterId = myProfile?.master_lawyer_id || userId;
        setMasterLawyerId(masterId);

        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url')
          .eq('role', 'client')
          .eq('linked_lawyer_id', masterId);

        if (!error && data) {
          setLinkedClients(data);
        }
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };
    fetchMasterAndClients();
  }, [userId]);

  const startChatWithClient = async (client: any) => {
    setShowNewChatModal(false);
    setSearchQuery('');

    if (openChatWithClient) {
      await openChatWithClient(client.id);
      return;
    }

    // 1. Search in local cases list for a GENERAL-CHAT case for this client
    const existingGeneralChat = cases.find(
      (c) => (c.client_id === client.id || c.client_phone === client.phone_number) && c.case_number === 'GENERAL-CHAT'
    );

    if (existingGeneralChat) {
      setSelectedCase(existingGeneralChat);
      return;
    }

    try {
      // 2. Search in DB for GENERAL-CHAT case for this lawyer and client
      const { data: generalChat } = await supabase
        .from('cases')
        .select('*')
        .eq('lawyer_id', masterLawyerId)
        .eq('client_id', client.id)
        .eq('case_number', 'GENERAL-CHAT')
        .maybeSingle();

      if (generalChat) {
        setSelectedCase(generalChat);
        return;
      }

      // 3. If no GENERAL-CHAT case exists, create one
      const { data: newCase } = await supabase
        .from('cases')
        .insert([{
          case_number: 'GENERAL-CHAT',
          client_name: client.full_name || 'موكل',
          client_phone: client.phone_number || '',
          case_type: 'محادثة عامة',
          judgment: 'نشط',
          total_fees: 0,
          admin_fees: 0,
          lawyer_id: masterLawyerId,
          client_id: client.id,
        }])
        .select('*')
        .single();

      if (newCase) {
        if (tier === 'team') {
          const { data: staffProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('master_lawyer_id', masterLawyerId);
          if (staffProfiles && staffProfiles.length > 0) {
            const membershipInserts = staffProfiles.map(s => ({
              user_id: s.id,
              case_id: newCase.id
            }));
            await supabase.from('memberships').insert(membershipInserts);
          }
        }
        setSelectedCase(newCase);
      } else {
        push('❌ خطأ في إنشاء المحادثة', 'danger');
      }
    } catch (err) {
      console.error('Error starting chat:', err);
      push('❌ خطأ في إنشاء المحادثة', 'danger');
    }
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const MAX_MSG_LEN = 2000;
  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<any>(null);

  useEffect(() => {
    if (cases.length > 0 && !selectedCase) {
      setSelectedCase(cases[0]);
    }
  }, [cases, selectedCase]);

  useEffect(() => {
    if (!selectedCase) return;
    setLoading(true);

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('case_id', selectedCase.id)
        .neq('room_type', 'internal_team_chat')
        .order('created_at', { ascending: true });

      if (!error && data) setMsgs(data);
      setLoading(false);
    };

    fetchMessages();

    // Real-time subscription so both sent and received messages appear instantly.
    chRef.current?.unsubscribe();
    chRef.current = supabase
      .channel(`client_chat:${selectedCase.id}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `case_id=eq.${selectedCase.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        // Internal team chat must never leak into the client conversation view
        if (msg.room_type === 'internal_team_chat') return;
        setMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `case_id=eq.${selectedCase.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMsgs((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      })
      .subscribe();

    return () => { chRef.current?.unsubscribe(); };
  }, [selectedCase]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const sendMessage = useCallback(async (attachment?: File) => {
    const msgKey = `${userId}-${Date.now()}`;
    console.log('Sending message with key:', msgKey);
    if (!input.trim() && !attachment) return;
    if (!selectedCase) return;
    if (input.length > MAX_MSG_LEN) { push('⚠️ الرسالة طويلة جداً', 'warning'); return; }

    const { allowed, cooldownSeconds } = checkFloodLimit(userEmail);
    if (!allowed) {
      push(`⚠️ إرسال سريع جداً! يرجى الانتظار ${cooldownSeconds} ثانية.`, 'warning');
      return;
    }

    let attachmentUrl: string | undefined;
    let attachmentType: string | undefined;

    if (attachment) {
      if (tier === 'free') {
        push('رفع الصور والملفات غير متاح في الباقة المجانية. يرجى الترقية.', 'warning');
        return;
      }
      const dailyCount = await getDailyChatUploadCount(selectedCase.id, userId);
      if (tier === 'pro' && dailyCount >= 30) {
        push('وصلت لحد الصور اليومي', 'warning');
        return;
      }
      const fileSizeMB = attachment.size / (1024 * 1024);
      const quotaCheck = checkChatUploadQuota(tier, dailyCount, fileSizeMB);
      if (!quotaCheck.allowed) {
        setQuotaWarning(quotaCheck.reason || 'تم تجاوز الحد');
        return;
      }

      const path = `chat/${selectedCase.id}/${Date.now()}_${attachment.name}`;
      const { error: uploadErr } = await supabase.storage.from('chat-attachments').upload(path, attachment);
      if (!uploadErr) {
        const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
        attachmentUrl = data?.publicUrl;
        attachmentType = attachment.type.startsWith('image/') ? 'image' : attachment.type.startsWith('video/') ? 'video' : undefined;
      } else {
        push('خطأ في رفع الملف', 'danger');
        return;
      }
    }

    const safeInput = sanitize(input);
    const { error } = await supabase.from('messages').insert([{
      id: uuidv4(),
      case_id: selectedCase.id,
      sender_id: userId,
      sender_role: activeRole,
      message_text: safeInput || (attachment ? '📎 مرفق' : ''),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      room_type: 'client_chat',
    }]);

    // 23505 = duplicate id from a network retry; the message is already saved.
    if (!error || (error as any).code === '23505') setInput('');
    else push('خطأ في الإرسال', 'danger');
  }, [input, selectedCase, userId, push, tier, userEmail, activeRole]);

  const deleteMessage = async (id: string) => {
    await supabase.from('messages').update({ is_deleted: true, message_text: '🚫 تم حذف هذه الرسالة' }).eq('id', id);
    setMsgs((prev) => prev.map((m) => m.id === id ? { ...m, is_deleted: true, message_text: '🚫 تم حذف هذه الرسالة' } : m));
  };

  const editMessage = async (id: string) => {
    if (!editText.trim()) return;
    const safeText = sanitize(editText);
    await supabase.from('messages').update({ message_text: safeText }).eq('id', id);
    setMsgs((prev) => prev.map((m) => m.id === id ? { ...m, message_text: safeText } : m));
    setEditingId(null);
    setEditText('');
  };

  if (!canViewChat) {
    return (
      <Card style={{ padding: 32, textAlign: 'center' }}>
        <Shield size={40} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 14 }}>الشات غير متاح لدورك الحالي</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#fff', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Case List Sidebar */}
      <div style={{
        width: sidebarCollapsed ? 48 : 220,
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s',
        flexShrink: 0,
        background: '#FAFBFE',
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>القضايا</span>
              <button
                onClick={() => setShowNewChatModal(true)}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none',
                  borderRadius: 6, width: 22, height: 22, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 'bold'
                }}
                title="بدء محادثة جديدة"
              >
                +
              </button>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            {sidebarCollapsed ? <ChevronLeft size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {cases.map((c) => {
            const isSelected = selectedCase?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCase(c)}
                style={{
                  width: '100%', padding: sidebarCollapsed ? '10px 12px' : '10px 14px',
                  border: 'none', background: isSelected ? '#fff' : 'transparent',
                  cursor: 'pointer', textAlign: 'right',
                  borderRight: isSelected ? '3px solid var(--navy)' : '3px solid transparent',
                  transition: 'all .15s',
                  display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? 0 : 10,
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isSelected ? 'var(--navy)' : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Scale size={14} color={isSelected ? '#fff' : 'var(--muted)'} />
                </div>
                {!sidebarCollapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--navy)' : 'var(--text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {c.client_name || c.case_number}
                    </p>
                    <p style={{
                      fontSize: 10, color: 'var(--muted)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {c.case_number}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedCase ? (
          <>
            {/* Case Metadata Header */}
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, #F5F8FF, #fff)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: 'var(--navy)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Scale size={18} color="var(--gold)" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 900, fontSize: 15, color: 'var(--navy)' }}>
                    {selectedCase.client_name || selectedCase.case_number}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedCase.case_number}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="pulse" style={{ width: 7, height: 7, background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>Real-time</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selectedCase.case_type && (
                  <Badge color="navy">
                    <FileText size={10} style={{ marginLeft: 4 }} />
                    {selectedCase.case_type}
                  </Badge>
                )}
                {selectedCase.judgment && (
                  <Badge color={/براءة/.test(selectedCase.judgment) ? 'green' : /انتظار/.test(selectedCase.judgment) ? 'orange' : 'default'}>
                    {selectedCase.judgment}
                  </Badge>
                )}
                {selectedCase.client_phone && (
                  <Badge color="default">
                    <Phone size={10} style={{ marginLeft: 4 }} />
                    {selectedCase.client_phone}
                  </Badge>
                )}
                <Badge color="gold">
                  <Hash size={10} style={{ marginLeft: 4 }} />
                  {selectedCase.total_fees?.toLocaleString() || 0} ج
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFBFE' }}>
              {loading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>جاري التحميل...</p>}
              {!loading && msgs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <MessageSquare size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>لا توجد رسائل بعد</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>ابدأ المحادثة الآن</p>
                </div>
              )}

              {msgs.map((msg) => {
                const isMe = msg.sender_id === userId;
                const isEmergency = isEmergencyMessage(msg.message_text);
                const isSystem = isSystemMessage(msg.message_text);
                const chatClass = msg.is_deleted
                  ? 'chat-deleted'
                  : isEmergency
                    ? 'chat-emergency-sos'
                    : isSystem
                      ? 'chat-system'
                      : isMe
                        ? 'chat-me'
                        : 'chat-other';
                return (
                  <div
                    key={msg.id}
                    className="fade-up"
                    style={{ display: 'flex', justifyContent: isEmergency ? 'flex-end' : (isMe ? 'flex-start' : 'flex-end'), position: 'relative' }}
                    onMouseEnter={() => setHoveredId(msg.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div style={{ position: 'relative', maxWidth: '76%' }}>
                      {isEmergency && !msg.is_deleted && (
                        <div style={{
                          position: 'absolute', top: -8, right: -8,
                          width: 18, height: 18, background: 'linear-gradient(135deg, #C41E3A, #8B0000)',
                          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
                          boxShadow: '0 0 12px rgba(196,30,58,.6)',
                          animation: 'ping 1.2s ease infinite',
                        }}>
                          <span style={{ fontSize: 10 }}>🆘</span>
                        </div>
                      )}
                      <div
                        className={chatClass}
                        style={{
                          padding: isEmergency ? '14px 18px' : '10px 14px',
                          fontSize: isEmergency ? 14 : 13,
                          lineHeight: 1.75,
                          direction: 'rtl',
                          boxShadow: isEmergency ? '0 6px 24px rgba(196,30,58,.4)' : undefined,
                        }}
                      >
                        {editingId === msg.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && editMessage(msg.id)}
                              maxLength={MAX_MSG_LEN}
                              style={{
                                flex: 1, padding: '4px 8px', border: '1.5px solid var(--navy-mid)',
                                borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: "'Cairo',sans-serif",
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={() => editMessage(msg.id)}>✓</Button>
                          </div>
                        ) : (
                          <>
                            {msg.attachment_url && msg.attachment_type === 'image' && (
                              <img src={msg.attachment_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.message_text && msg.message_text !== '📎 مرفق' ? 8 : 0 }} />
                            )}
                            {msg.attachment_url && msg.attachment_type === 'video' && (
                              <video src={msg.attachment_url} controls style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.message_text && msg.message_text !== '📎 مرفق' ? 8 : 0 }} />
                            )}
                            {msg.message_text !== '📎 مرفق' && msg.message_text}
                          </>
                        )}
                        <p style={{ fontSize: 9, marginTop: 4, opacity: 0.45, textAlign: 'left', fontFamily: "'JetBrains Mono', monospace" }}>
                          {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {hoveredId === msg.id && !msg.is_deleted && isMe && editingId !== msg.id && (
                        <div style={{
                          position: 'absolute', top: -8, right: 0,
                          display: 'flex', gap: 4, background: '#fff', borderRadius: 6,
                          padding: '2px 4px', boxShadow: '0 2px 8px rgba(0,0,0,.1)', zIndex: 10,
                        }}>
                          <button
                            onClick={() => { setEditingId(msg.id); setEditText(msg.message_text); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: "'Cairo',sans-serif" }}
                          >
                            <Edit3 size={10} /> تعديل
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: "'Cairo',sans-serif" }}
                          >
                            <Trash2 size={10} /> حذف
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: '#fff' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: '#F5F8FF', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="file"
                  accept="image/*,video/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) sendMessage(file);
                  }}
                  style={{ display: 'none' }}
                />
                <ImageIcon size={16} color="var(--navy)" />
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="اكتب رسالة..."
                dir="rtl"
                maxLength={MAX_MSG_LEN}
                style={{
                  flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)',
                  borderRadius: 10, fontSize: 13, fontFamily: "'Cairo',sans-serif", outline: 'none',
                }}
                onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.border = '1.5px solid var(--navy-mid)'; }}
                onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.border = '1.5px solid var(--border)'; }}
              />
              <Button onClick={() => sendMessage()} style={{ padding: '10px 16px' }}>
                <Send size={16} />
              </Button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 40 }}>
            <MessageSquare size={40} color="var(--border)" />
            <p style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 14 }}>اختر قضية لبدء المحادثة</p>
          </div>
        )}
      </div>

      {/* Quota Warning Modal */}
      {quotaWarning && (
        <Modal onClose={() => setQuotaWarning(null)}>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FDECEF', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={28} color="var(--danger)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)', marginBottom: 10 }}>تم تجاوز الحد</h3>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>{quotaWarning}</p>
            <Button variant="primary" fullWidth onClick={() => setQuotaWarning(null)} style={{ marginTop: 16 }}>فهمت</Button>
          </div>
        </Modal>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <Modal onClose={() => setShowNewChatModal(false)}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)', marginBottom: 12, textAlign: 'right' }}>💬 بدء محادثة جديدة مع موكل</h3>
            <input
              type="text"
              placeholder="البحث بالاسم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              dir="rtl"
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)',
                borderRadius: 8, fontSize: 13, fontFamily: "'Cairo',sans-serif", outline: 'none',
                marginBottom: 14,
              }}
            />
            <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linkedClients
                .filter((c) =>
                  (c.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (c.phone_number || '').includes(searchQuery)
                )
                .map((client) => (
                  <button
                    key={client.id}
                    onClick={() => startChatWithClient(client)}
                    style={{
                      width: '100%', padding: '10px 12px', border: 'none',
                      background: '#F5F8FF', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background .15s', textAlign: 'right'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#E6F0FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F8FF'; }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--navy)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 14, fontWeight: 'bold'
                    }}>
                      {client.full_name?.charAt(0) || 'C'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{client.full_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>{client.phone_number || '—'}</p>
                    </div>
                  </button>
                ))}
              {linkedClients.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: 10 }}>لا يوجد موكلون مسجلون بعد</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
