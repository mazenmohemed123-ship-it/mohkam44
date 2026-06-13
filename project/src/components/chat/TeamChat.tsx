import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Shield, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { Button, Spinner } from '../atoms';
import { supabase, sendPushToClient } from '../../services/supabase';
import { checkFloodLimit } from '../../services/floodProtection';
import { sanitize } from '../../services/sanitize';

interface TeamMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message_text: string;
  is_deleted: boolean;
  room_type?: string;
  attachment_url?: string;
  attachment_type?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface TeamChatProps {
  masterLawyerId: string;
  userId: string;
  userRole: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
  userEmail?: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'المحامي المسؤول',
  partner: 'شريك',
  lawyer: 'محامي',
  assistant: 'مساعد',
  secretary: 'سكرتير',
  accountant: 'محاسب',
};

export function TeamChat({ masterLawyerId, userId, userRole, push, userEmail }: TeamChatProps) {
  const [msgs, setMsgs] = useState<TeamMessage[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Private chat states
  const [activeTab, setActiveTab] = useState<'group' | 'private'>('group');
  const [peerTarget, setPeerTarget] = useState<TeamMember | null>(null);
  const [peerCaseId, setPeerCaseId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<any>(null);

  const resolvePeerCase = async (targetId: string) => {
    const caseNumber = 'PEER-' + [userId, targetId].sort().join('-');
    try {
      const { data: existing } = await supabase
        .from('cases')
        .select('id')
        .eq('case_number', caseNumber)
        .limit(1);

      if (existing && existing.length > 0) {
        setPeerCaseId(existing[0].id);
        return existing[0].id;
      }

      const { data: newCase } = await supabase
        .from('cases')
        .insert([{
          case_number: caseNumber,
          client_name: 'محادثة خاصة',
          case_type: 'شات ثنائي',
          judgment: 'نشط',
          total_fees: 0,
          admin_fees: 0,
          lawyer_id: masterLawyerId,
        }])
        .select('id')
        .single();

      if (newCase) {
        // Insert memberships for both users
        await supabase.from('memberships').insert([
          { user_id: userId, case_id: newCase.id },
          { user_id: targetId, case_id: newCase.id }
        ]);

        setPeerCaseId(newCase.id);
        return newCase.id;
      } else {
        const { data: retryData } = await supabase
          .from('cases')
          .select('id')
          .eq('case_number', caseNumber)
          .limit(1);
        if (retryData && retryData.length > 0) {
          setPeerCaseId(retryData[0].id);
          return retryData[0].id;
        }
      }
    } catch (err) {
      console.error('Error resolving peer case:', err);
    }
    return null;
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .or(`id.eq.${masterLawyerId},master_lawyer_id.eq.${masterLawyerId}`)
      .in('role', ['owner', 'partner', 'lawyer', 'assistant', 'secretary', 'accountant']);
    if (data) setMembers(data);
  };

  useEffect(() => {
    loadMembers();
  }, [masterLawyerId]);

  useEffect(() => {
    if (activeTab === 'private' && !peerCaseId) return;

    setLoading(true);
    const fetchMsgs = async () => {
      const roomType = activeTab === 'group' ? 'internal_team_chat' : 'peer_chat';
      let query = supabase
        .from('messages')
        .select('*')
        .eq('room_type', roomType);

      if (roomType === 'internal_team_chat') {
        query = query.eq('team_id', masterLawyerId);
      } else {
        query = query.eq('case_id', peerCaseId || '');
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (!error && data) setMsgs(data);
      setLoading(false);
    };
    fetchMsgs();

    chRef.current?.unsubscribe();

    const channelName = activeTab === 'group' ? `team_room_group:${masterLawyerId}` : `team_room_peer:${peerCaseId}`;
    const filterStr = activeTab === 'group' ? `team_id=eq.${masterLawyerId}` : `case_id=eq.${peerCaseId}`;

    chRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: filterStr,
      }, (payload) => {
        const msg = payload.new as TeamMessage;
        const expectedType = activeTab === 'group' ? 'internal_team_chat' : 'peer_chat';
        if (msg.room_type === expectedType) {
          setMsgs((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      })
      .subscribe();

    return () => { chRef.current?.unsubscribe(); };
  }, [activeTab, masterLawyerId, peerCaseId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const sendMessage = useCallback(async (attachment?: File) => {
    if (!input.trim() && !attachment) return;
    if (activeTab === 'private' && !peerCaseId) return;

    const { allowed, cooldownSeconds } = checkFloodLimit(userEmail);
    if (!allowed) {
      push(`⚠️ إرسال سريع جداً! يرجى الانتظار ${cooldownSeconds} ثانية.`, 'warning');
      return;
    }

    setSending(true);
    let attachmentUrl: string | undefined;
    let attachmentType: string | undefined;

    const folderId = activeTab === 'group' ? masterLawyerId : peerCaseId;
    if (attachment && folderId) {
      const path = `team-chat/${folderId}/${Date.now()}_${attachment.name}`;
      const { error: uploadErr } = await supabase.storage.from('chat-attachments').upload(path, attachment);
      if (!uploadErr) {
        const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
        attachmentUrl = data?.publicUrl;
        attachmentType = attachment.type.startsWith('image/') ? 'image' : undefined;
      }
    }

    const safeText = sanitize(input);
    const roomType = activeTab === 'group' ? 'internal_team_chat' : 'peer_chat';
    const case_id = activeTab === 'group' ? null : peerCaseId;
    const team_id = activeTab === 'group' ? masterLawyerId : null;
    const sender_id = userId;

    if (roomType === 'internal_team_chat') {
      console.log('internal msg:', { room_type: roomType, team_id, case_id, sender_id });
    }

    const { error } = await supabase.from('messages').insert([{
      sender_id: sender_id,
      sender_role: userRole,
      message_text: safeText,
      room_type: roomType,
      case_id: case_id,
      team_id: team_id,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    }]);

    if (!error) {
      setInput('');
      try {
        const senderName = members?.find((m) => m.id === userId)?.full_name || 'عضو';
        if (activeTab === 'group') {
          if (members && members.length > 0) {
            for (const m of members) {
              if (m.id !== userId) {
                sendPushToClient(m.id, `رسالة داخلية من ${senderName}`, safeText.slice(0, 80)).catch(() => {});
              }
            }
          }
        } else if (activeTab === 'private' && peerTarget) {
          sendPushToClient(peerTarget.id, `رسالة خاصة من ${senderName}`, safeText.slice(0, 80)).catch(() => {});
        }
      } catch (err) {
        console.error('Error sending push notifications:', err);
      }
    } else {
      push('خطأ في الإرسال', 'danger');
    }
    setSending(false);
  }, [input, activeTab, masterLawyerId, peerCaseId, userId, userRole, push, userEmail, members, peerTarget]);

  const getMemberName = (senderId: string) => {
    const m = members.find((m) => m.id === senderId);
    return m?.full_name || 'عضو';
  };

  const getMemberRole = (senderId: string) => {
    const m = members.find((m) => m.id === senderId);
    return m?.role || 'lawyer';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        background: activeTab === 'group' ? 'linear-gradient(135deg, #FFFBEB, #fff)' : 'linear-gradient(135deg, #EFF6FF, #fff)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: activeTab === 'group' ? 'var(--gold)' : 'var(--navy)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {activeTab === 'group' ? <Shield size={18} color="#fff" /> : <MessageSquare size={18} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 900, fontSize: 15, color: activeTab === 'group' ? 'var(--gold)' : 'var(--navy)' }}>
            {activeTab === 'group' ? 'الشات الداخلي السري' : `محادثة خاصة: ${peerTarget?.full_name}`}
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            {activeTab === 'group' ? 'خاص بأعضاء المكتب فقط — الموكلون لا يرونه' : `محادثة ثنائية آمنة بينك وبين ${peerTarget?.full_name}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="pulse" style={{ width: 7, height: 7, background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>Real-time</span>
        </div>
      </div>

      {/* Member chips / Switch tabs */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', background: '#FAFBFE' }}>
        <button
          onClick={() => {
            setActiveTab('group');
            setPeerTarget(null);
          }}
          style={{
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 99,
            background: activeTab === 'group' ? 'var(--gold)' : '#F5F8FF',
            color: activeTab === 'group' ? '#fff' : 'var(--navy)',
            fontSize: 11,
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          <span>🏛️</span>
          <span>المجموعة</span>
        </button>

        {members.map((m) => {
          const isMe = m.id === userId;
          const isSelected = activeTab === 'private' && peerTarget?.id === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (isMe) {
                  setActiveTab('group');
                  setPeerTarget(null);
                } else {
                  setActiveTab('private');
                  setPeerTarget(m);
                  setPeerCaseId(null);
                  resolvePeerCase(m.id);
                }
              }}
              style={{
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 99,
                background: isSelected ? 'var(--navy)' : (isMe ? '#FFFBEB' : '#F5F8FF'),
                color: isSelected ? '#fff' : (isMe ? 'var(--gold)' : 'var(--navy)'),
                fontSize: 11,
                fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              <span>{ROLE_LABELS[m.role] || m.role}</span>
              <span style={{ opacity: 0.7 }}>{m.full_name?.split(' ')[0]} {isMe && '(أنت)'}</span>
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFBFE' }}>
        {loading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>جاري التحميل...</p>}
        {!loading && msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            {activeTab === 'group' ? (
              <>
                <Users size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>ابدأ المحادثة الداخلية</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>هذه القناة مرئية لأعضاء المكتب فقط</p>
              </>
            ) : (
              <>
                <MessageSquare size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>ابدأ محادثة خاصة مع {peerTarget?.full_name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>هذه المحادثة سرية ومباشرة بينكما</p>
              </>
            )}
          </div>
        )}

        {msgs.map((msg) => {
          const isMe = msg.sender_id === userId;
          const senderRole = getMemberRole(msg.sender_id);
          return (
            <div key={msg.id} className="fade-up" style={{ display: 'flex', justifyContent: isMe ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '76%' }}>
                {!isMe && activeTab === 'group' && (
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', marginBottom: 3, marginRight: 4 }}>
                    {ROLE_LABELS[senderRole] || senderRole} — {getMemberName(msg.sender_id)}
                  </p>
                )}
                <div
                  className={isMe ? 'chat-me' : 'chat-other'}
                  style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.75, direction: 'rtl' }}
                >
                  {msg.attachment_url && msg.attachment_type === 'image' && (
                    <img src={msg.attachment_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.message_text ? 8 : 0 }} />
                  )}
                  {msg.message_text}
                  <p style={{ fontSize: 9, marginTop: 4, opacity: 0.45, textAlign: 'left', fontFamily: "'JetBrains Mono', monospace" }}>
                    {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
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
            accept="image/*"
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
          placeholder={activeTab === 'group' ? 'اكتب رسالة داخلية للجروب...' : `اكتب رسالة خاصة إلى ${peerTarget?.full_name?.split(' ')[0]}...`}
          dir="rtl"
          maxLength={2000}
          style={{
            flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)',
            borderRadius: 10, fontSize: 13, fontFamily: "'Cairo',sans-serif", outline: 'none',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.border = '1.5px solid var(--navy-mid)'; }}
          onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.border = '1.5px solid var(--border)'; }}
        />
        <Button onClick={() => sendMessage()} disabled={sending} style={{ padding: '10px 16px' }}>
          {sending ? <Spinner size={16} /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
