import { useState, useEffect } from 'react';
import { MessageSquare, Scale, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { Modal } from '../atoms';
import { supabase } from '../../services/supabase';
import { useRole } from '../../context/RoleContext';
import { useCase, type CaseRow } from '../../context/CaseContext';
import { ChatRoom } from './ChatRoom';

interface RealtimeChatProps {
  cases: CaseRow[];
  userId: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
  userEmail?: string;
  openChatWithClient?: (clientId: string) => Promise<void>;
}

export function RealtimeChat({ cases, userId, push, openChatWithClient }: RealtimeChatProps) {
  const { canViewChat, tier, activeRole } = useRole();
  const { selectedCase, setSelectedCase } = useCase();

  const [linkedClients, setLinkedClients] = useState<any[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [masterLawyerId, setMasterLawyerId] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const fetchMasterAndClients = async () => {
      try {
        const { data: myProfile } = await supabase.from('profiles').select('master_lawyer_id').eq('id', userId).single();
        const masterId = myProfile?.master_lawyer_id || userId;
        setMasterLawyerId(masterId);
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url')
          .eq('role', 'client')
          .eq('linked_lawyer_id', masterId);
        if (data) setLinkedClients(data);
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };
    fetchMasterAndClients();
  }, [userId]);

  useEffect(() => {
    if (cases.length > 0 && !selectedCase) setSelectedCase(cases[0]);
  }, [cases, selectedCase, setSelectedCase]);

  const startChatWithClient = async (client: any) => {
    setShowNewChatModal(false);
    setSearchQuery('');
    if (openChatWithClient) { await openChatWithClient(client.id); return; }

    const existing = cases.find(
      (c) => (c.client_id === client.id || c.client_phone === client.phone_number) && c.case_number === 'GENERAL-CHAT',
    );
    if (existing) { setSelectedCase(existing); return; }

    try {
      const { data: generalChat } = await supabase
        .from('cases')
        .select('*')
        .eq('lawyer_id', masterLawyerId)
        .eq('client_id', client.id)
        .eq('case_number', 'GENERAL-CHAT')
        .maybeSingle();
      if (generalChat) { setSelectedCase(generalChat); return; }

      const { data: newCase } = await supabase
        .from('cases')
        .insert([{
          case_number: 'GENERAL-CHAT', client_name: client.full_name || 'موكل', client_phone: client.phone_number || '',
          case_type: 'محادثة عامة', judgment: 'نشط', total_fees: 0, admin_fees: 0,
          lawyer_id: masterLawyerId, client_id: client.id,
        }])
        .select('*')
        .single();

      if (newCase) {
        if (tier === 'team') {
          const { data: staff } = await supabase.from('profiles').select('id').eq('master_lawyer_id', masterLawyerId);
          if (staff && staff.length) {
            await supabase.from('memberships').insert(staff.map((s) => ({ user_id: s.id, case_id: newCase.id })));
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

  if (!canViewChat) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <Shield size={40} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 14 }}>الشات غير متاح لدورك الحالي</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#fff', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Case list sidebar */}
      <div style={{ width: sidebarCollapsed ? 48 : 220, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'width .2s', flexShrink: 0, background: '#FAFBFE' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>القضايا</span>
              <button onClick={() => setShowNewChatModal(true)} title="بدء محادثة جديدة" style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>+</button>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
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
                style={{ width: '100%', padding: '10px 14px', border: 'none', background: isSelected ? '#fff' : 'transparent', cursor: 'pointer', textAlign: 'right', borderRight: isSelected ? '3px solid var(--navy)' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? 0 : 10, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isSelected ? 'var(--navy)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Scale size={14} color={isSelected ? '#fff' : 'var(--muted)'} />
                </div>
                {!sidebarCollapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--navy)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client_name || c.case_number}</p>
                    <p style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'JetBrains Mono', monospace" }}>{c.case_number}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedCase ? (
          <ChatRoom
            key={selectedCase.id}
            userId={userId}
            userRole={activeRole}
            roomType="client_chat"
            caseId={selectedCase.id}
            headerTitle={selectedCase.client_name || selectedCase.case_number}
            headerSubtitle={selectedCase.case_number}
            push={push}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 40 }}>
            <MessageSquare size={40} color="var(--border)" />
            <p style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 14 }}>اختر قضية لبدء المحادثة</p>
          </div>
        )}
      </div>

      {/* New chat modal */}
      {showNewChatModal && (
        <Modal onClose={() => setShowNewChatModal(false)}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)', marginBottom: 12, textAlign: 'right' }}>بدء محادثة جديدة مع موكل</h3>
            <input
              type="text"
              placeholder="البحث بالاسم أو الهاتف…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              dir="rtl"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: "'Cairo',sans-serif", outline: 'none', marginBottom: 14 }}
            />
            <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linkedClients
                .filter((c) => (c.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone_number || '').includes(searchQuery))
                .map((client) => (
                  <button
                    key={client.id}
                    onClick={() => startChatWithClient(client)}
                    style={{ width: '100%', padding: '10px 12px', border: 'none', background: '#F5F8FF', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'right' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
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
