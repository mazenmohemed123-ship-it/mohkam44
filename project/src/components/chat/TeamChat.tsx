import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { ChatRoom } from './ChatRoom';
import type { ChatMessage } from '../../services/chat/types';

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

export function TeamChat({ masterLawyerId, userId, userRole, push }: TeamChatProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<'group' | 'private'>('group');
  const [peerTarget, setPeerTarget] = useState<TeamMember | null>(null);
  const [peerCaseId, setPeerCaseId] = useState<string | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .or(`id.eq.${masterLawyerId},master_lawyer_id.eq.${masterLawyerId}`)
        .in('role', ['owner', 'partner', 'lawyer', 'assistant', 'secretary', 'accountant']);
      if (data) setMembers(data);
    };
    loadMembers();
  }, [masterLawyerId]);

  const resolvePeerCase = async (targetId: string) => {
    const caseNumber = 'PEER-' + [userId, targetId].sort().join('-');
    try {
      const { data: existing } = await supabase.from('cases').select('id').eq('case_number', caseNumber).limit(1);
      if (existing && existing.length) { setPeerCaseId(existing[0].id); return; }

      const { data: newCase } = await supabase
        .from('cases')
        .insert([{ case_number: caseNumber, client_name: 'محادثة خاصة', case_type: 'شات ثنائي', judgment: 'نشط', total_fees: 0, admin_fees: 0, lawyer_id: masterLawyerId }])
        .select('id')
        .single();

      if (newCase) {
        await supabase.from('memberships').insert([
          { user_id: userId, case_id: newCase.id },
          { user_id: targetId, case_id: newCase.id },
        ]);
        setPeerCaseId(newCase.id);
      } else {
        const { data: retry } = await supabase.from('cases').select('id').eq('case_number', caseNumber).limit(1);
        if (retry && retry.length) setPeerCaseId(retry[0].id);
      }
    } catch (err) {
      console.error('Error resolving peer case:', err);
    }
  };

  const memberName = (id: string) => members.find((m) => m.id === id)?.full_name || 'عضو';
  const memberRole = (id: string) => members.find((m) => m.id === id)?.role || 'lawyer';

  const resolveSender = (m: ChatMessage) => ({
    isMe: m.sender_id === userId,
    isSystem: m.message_text.startsWith('【') || m.sender_role === 'system',
    label: activeTab === 'group' ? `${ROLE_LABELS[memberRole(m.sender_id)] || memberRole(m.sender_id)} — ${memberName(m.sender_id)}` : undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px', background: '#FAFBFE', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <button
          onClick={() => { setActiveTab('group'); setPeerTarget(null); }}
          style={{ border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, background: activeTab === 'group' ? 'var(--gold)' : '#F5F8FF', color: activeTab === 'group' ? '#fff' : 'var(--navy)', fontSize: 11, fontWeight: 700 }}
        >
          المجموعة
        </button>
        {members.map((m) => {
          const isMe = m.id === userId;
          const isSelected = activeTab === 'private' && peerTarget?.id === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (isMe) { setActiveTab('group'); setPeerTarget(null); return; }
                setActiveTab('private');
                setPeerTarget(m);
                setPeerCaseId(null);
                resolvePeerCase(m.id);
              }}
              style={{ border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, background: isSelected ? 'var(--navy)' : isMe ? '#FFFBEB' : '#F5F8FF', color: isSelected ? '#fff' : isMe ? 'var(--gold)' : 'var(--navy)', fontSize: 11, fontWeight: 700 }}
            >
              {ROLE_LABELS[m.role] || m.role} · {m.full_name?.split(' ')[0]} {isMe && '(أنت)'}
            </button>
          );
        })}
      </div>

      {/* Active room */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'group' ? (
          <ChatRoom
            key={`group-${masterLawyerId}`}
            userId={userId}
            userRole={userRole}
            userName={memberName(userId)}
            roomType="internal_team_chat"
            teamId={masterLawyerId}
            headerTitle="الشات الداخلي السري"
            headerSubtitle="خاص بأعضاء المكتب فقط — الموكلون لا يرونه"
            showReceipts={false}
            resolveSender={resolveSender}
            push={push}
          />
        ) : peerTarget && peerCaseId ? (
          <ChatRoom
            key={`peer-${peerCaseId}`}
            userId={userId}
            userRole={userRole}
            userName={memberName(userId)}
            roomType="peer_chat"
            caseId={peerCaseId}
            peerTargetId={peerTarget.id}
            headerTitle={`محادثة خاصة: ${peerTarget.full_name}`}
            headerSubtitle="محادثة ثنائية آمنة"
            resolveSender={resolveSender}
            push={push}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            جاري فتح المحادثة…
          </div>
        )}
      </div>
    </div>
  );
}
