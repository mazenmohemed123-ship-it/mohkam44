import { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle, XCircle, Calendar, Gavel } from 'lucide-react';
import { Card, Badge, Button, Field } from '../atoms';
import { useCase, type CaseEvent, type AppointmentRequest } from '../../context/CaseContext';
import type { FirmRole } from '../../context/RoleContext';
import { supabase } from '../../services/supabase';

interface CaseTimelineProps {
  caseId: string;
  lawyerId: string;
  userId: string;
  activeRole: FirmRole;
  userName?: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
}

const eventTypeIcons: Record<string, typeof Clock> = {
  CASE_CREATED: Gavel,
  JUDGMENT_UPDATED: AlertCircle,
  APPOINTMENT_REQUESTED: Calendar,
  APPOINTMENT_ACCEPTED: CheckCircle,
  APPOINTMENT_REJECTED: XCircle,
};

const eventTypeColors: Record<string, string> = {
  CASE_CREATED: 'var(--navy)',
  JUDGMENT_UPDATED: 'var(--warning)',
  APPOINTMENT_REQUESTED: '#D97706',
  APPOINTMENT_ACCEPTED: 'var(--success)',
  APPOINTMENT_REJECTED: 'var(--danger)',
};

export function CaseTimeline({ caseId, userId, activeRole, userName, push }: CaseTimelineProps) {
  const { respondAppointment, addEvent } = useCase();
  const [rejectFeedback, setRejectFeedback] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRequest[]>([]);

  const fetchTimelineData = async () => {
    const { data: eventsData } = await supabase
      .from('case_events')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const { data: appointmentsData } = await supabase
      .from('appointment_requests')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (eventsData) setEvents(eventsData);
    if (appointmentsData) setAppointments(appointmentsData || []);
  };

  useEffect(() => {
    fetchTimelineData();
  }, [caseId]);

  const handleAccept = async (appt: AppointmentRequest) => {
    await respondAppointment(appt.id, 'accepted', {
      responderId: userId,
      responderRole: activeRole,
      responderName: userName,
    });
    await addEvent(caseId, 'APPOINTMENT_ACCEPTED', `تم قبول موعد ${appt.appointment_date} الساعة ${appt.appointment_time}`);
    push(' تم قبول الموعد وإرسال رسالة تأكيد للموكل', 'success');
    fetchTimelineData();
  };

  const handleReject = async (apptId: string) => {
    const feedback = rejectFeedback[apptId] || '';
    await respondAppointment(apptId, 'rejected', {
      responderId: userId,
      responderRole: activeRole,
      responderName: userName,
      alternativeTime: feedback,
    });
    await addEvent(caseId, 'APPOINTMENT_REJECTED', `تم رفض الموعد${feedback ? ': ' + feedback : ''}`);
    push('تم رفض الموعد وإرسال رسالة للموكل', 'warning');
    setShowRejectInput(null);
    fetchTimelineData();
  };

  const allItems = [
    ...events.map((e) => ({ type: 'event' as const, data: e, date: e.created_at })),
    ...appointments.map((a) => ({ type: 'appointment' as const, data: a, date: a.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={18} /> التايملاين
      </h3>

      {allItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>
          لا توجد أحداث بعد
        </div>
      )}

      {/* Vertical Timeline */}
      <div style={{ position: 'relative', paddingRight: 32 }}>
        <div style={{
          position: 'absolute', right: 8, top: 0, bottom: 0,
          width: 2, background: 'var(--border)', borderRadius: 1,
        }} />

        {allItems.map((item) => {
          if (item.type === 'event') {
            const ev = item.data as CaseEvent;
            const Icon = eventTypeIcons[ev.event_type] || Clock;
            const color = eventTypeColors[ev.event_type] || 'var(--muted)';
            return (
              <div key={ev.id} className="fade-up" style={{ position: 'relative', marginBottom: 20 }}>
                <div style={{
                  position: 'absolute', right: -28, top: 4,
                  width: 20, height: 20, borderRadius: '50%',
                  background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 0 3px #fff, 0 0 8px ${color}44`,
                }}>
                  <Icon size={10} color="#fff" />
                </div>
                <Card style={{ padding: '12px 16px', marginRight: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    {ev.event_description || ev.event_type}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {new Date(ev.created_at).toLocaleString('ar-EG')}
                  </p>
                </Card>
              </div>
            );
          }

          // Appointment card
          const appt = item.data as AppointmentRequest;
          const statusColors: Record<string, { border: string; bg: string; badge: 'green' | 'red' | 'orange' | 'gold'; text: string }> = {
            accepted: { border: 'var(--success)', bg: '#F4FBF7', badge: 'green', text: 'مقبول' },
            rejected: { border: 'var(--danger)', bg: '#FFF5F5', badge: 'red', text: 'مرفوض' },
            pending: { border: '#D97706', bg: '#FFFBEB', badge: 'orange', text: 'بانتظار الرد' },
            rescheduled: { border: 'var(--gold)', bg: '#FEF7E6', badge: 'gold', text: 'مقترح بديل' },
          };
          const statusConfig = statusColors[appt.status] || statusColors.pending;

          return (
            <div key={appt.id} className="fade-up" style={{ position: 'relative', marginBottom: 20 }}>
              <div style={{
                position: 'absolute', right: -28, top: 4,
                width: 20, height: 20, borderRadius: '50%',
                background: statusConfig.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 0 3px #fff, 0 0 8px ${statusConfig.border}44`,
                animation: appt.status === 'pending' ? 'glow 2s ease infinite' : undefined,
              }}>
                <Calendar size={10} color="#fff" />
              </div>
              <Card style={{
                padding: '14px 16px', marginRight: 8,
                borderLeft: `3px solid ${statusConfig.border}`,
                background: statusConfig.bg,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--warning)', marginBottom: 4 }}>
                       طلب حجز موعد
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text)' }}>
                      {appt.appointment_date} — {appt.appointment_time}
                    </p>
                    {appt.reason && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{appt.reason}</p>
                    )}
                    {appt.alternative_time && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        الوقت البديل: <strong style={{ color: 'var(--navy)' }}>{appt.alternative_time}</strong>
                      </p>
                    )}
                  </div>
                  <Badge color={statusConfig.badge}>{statusConfig.text}</Badge>
                </div>

                {appt.status === 'pending' && (
                  showRejectInput === appt.id ? (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Field
                        label="اقتراح ميعاد بديل"
                        value={rejectFeedback[appt.id] || ''}
                        onChange={(v) => setRejectFeedback((p) => ({ ...p, [appt.id]: v }))}
                        placeholder="مثال: الثلاثاء القادم 3 مساءً"
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button size="sm" variant="danger" onClick={() => handleReject(appt.id)}>إرسال الرفض</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(null)}>إلغاء</Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <Button size="sm" variant="success" onClick={() => handleAccept(appt)}>
                        <CheckCircle size={14} /> قبول الموعد
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setShowRejectInput(appt.id)}>
                        <XCircle size={14} /> رفض وتعديل
                      </Button>
                    </div>
                  )
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
