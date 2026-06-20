import { useState } from 'react';
import { Phone, Shield, Fingerprint } from 'lucide-react';
import { Button, Field, Card, Spinner, Badge } from '../atoms';
import { supabase, generateDeviceFingerprint } from '../../services/supabase';
import { isValidGlobalPhone } from '../../services/phoneValidation';
import type { Profile } from '../../context/RoleContext';

interface ClientZeroAuthProps {
  lawyerId: string;
  inviteToken?: string;
  onAuth: (user: any, profile: Profile) => void;
  onBack: () => void;
}

interface ClientSession {
  userId: string;
  phoneNumber: string;
  linkedLawyerId: string;
  clientName: string;
  createdAt: string;
}

const SESSION_KEY = 'mohkam_client_session';

export function ClientZeroAuth({ lawyerId, inviteToken, onAuth, onBack }: ClientZeroAuthProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    const phoneValidation = isValidGlobalPhone(phone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || 'رقم الهاتف غير صالح');
      setLoading(false);
      return;
    }
    if (!lawyerId) {
      setError('الدخول متاح فقط عبر رابط المكتب الذي يرسله إليك المحامي.');
      setLoading(false);
      return;
    }

    try {
      // Office-gated entry: the phone must be registered on a case of this office
      // (as the primary client phone or one of the case follower phones).
      const { data, error: rpcErr } = await supabase.rpc('check_office_access', {
        p_lawyer_id: lawyerId,
        p_phone: phone,
      });
      const row = Array.isArray(data) ? data[0] : data;

      if (rpcErr || !row || !row.match_count) {
        setError('رقم هاتفك غير مسجّل لدى هذا المكتب. برجاء التواصل مع المحامي لإضافة رقمك إلى القضية.');
        setLoading(false);
        return;
      }

      await proceedWithAuth(phone, row.office_id || lawyerId, row.client_name);
    } catch {
      setError('حدث خطأ في الاتصال. حاول مرة أخرى.');
    }
    setLoading(false);
  };

  const proceedWithAuth = async (phoneNumber: string, linkedLawyerId: string, clientNameIn?: string) => {
    const fingerprint = generateDeviceFingerprint();
    localStorage.setItem('mohkam_device_fp', fingerprint);
    document.cookie = `mohkam_client=1; path=/; max-age=31536000; samesite=strict`;

    const clientName = clientNameIn || 'موكل ' + phoneNumber.slice(-4);
    let realUserId: string;

    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !authData.user) throw new Error(authError?.message || 'Auth failed');
      realUserId = authData.user.id;

      // Ensure this visitor has their own GENERAL-CHAT with the office.
      const { data: existingCase } = await supabase
        .from('cases')
        .select('id, client_id')
        .eq('case_number', 'GENERAL-CHAT')
        .eq('lawyer_id', linkedLawyerId)
        .eq('client_id', realUserId)
        .maybeSingle();

      if (!existingCase) {
        await supabase.from('cases').insert({
          case_number: 'GENERAL-CHAT',
          client_name: clientName,
          client_phone: phoneNumber,
          case_type: 'محادثة عامة',
          judgment: 'نشط',
          total_fees: 0,
          admin_fees: 0,
          lawyer_id: linkedLawyerId,
          client_id: realUserId,
        });
      }
    } catch (err: any) {
      console.error('Supabase anonymous auth failed:', err);
      setError('فشلت عملية المصادقة الآمنة. تحقق من اتصال الإنترنت وحاول مرة أخرى.');
      setLoading(false);
      return;
    }

    const session: ClientSession = {
      userId: realUserId,
      phoneNumber,
      linkedLawyerId,
      clientName,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    const { data: lawyer } = await supabase
      .from('profiles')
      .select('id, is_emergency_enabled')
      .eq('id', linkedLawyerId)
      .single();

    const profile: Profile = {
      id: realUserId,
      full_name: clientName,
      phone_number: phoneNumber,
      role: 'client',
      tier: 'free',
      is_emergency_enabled: lawyer?.is_emergency_enabled ?? true,
      linked_lawyer_id: linkedLawyerId,
      device_fingerprint: fingerprint,
    };

    await supabase.from('profiles').upsert([{
      id: realUserId,
      full_name: clientName,
      phone_number: phoneNumber,
      role: 'client',
      tier: 'free',
      is_emergency_enabled: lawyer?.is_emergency_enabled ?? true,
      linked_lawyer_id: linkedLawyerId,
      device_fingerprint: fingerprint,
    }], { onConflict: 'id' });

    setVerified(true);
    setTimeout(() => onAuth({ id: realUserId }, profile), 800);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0F2557, #1E3A8A)', padding: 20,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)',
        backgroundSize: '60px 60px', pointerEvents: 'none',
      }} />

      <Card style={{ maxWidth: 440, width: '100%', padding: 32, position: 'relative', zIndex: 1 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--navy)', fontWeight: 700,
          cursor: 'pointer', marginBottom: 16, fontSize: 13, fontFamily: "'Cairo',sans-serif",
        }}>
          رجوع
        </button>

        {verified ? (
          <div className="fade-up" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E6F7EF', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={28} color="var(--success)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)', marginBottom: 8 }}>تم التحقق بنجاح</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>جاري تحويلك إلى بوابة الموكل...</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(200,149,42,.1)', border: '2px solid var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Fingerprint size={28} color="var(--gold)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>الدخول إلى مكتبك القانوني</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>أدخل رقم هاتفك المسجّل لدى المكتب</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <Phone size={16} color="var(--muted)" style={{ position: 'absolute', right: 12, top: 36 }} />
                <Field label="رقم الهاتف" value={phone} onChange={setPhone} type="tel" placeholder="+20 123 456 7890" mono />
              </div>

              {error && (
                <p style={{ fontSize: 12, color: 'var(--danger)', background: '#FDECEF', padding: '10px 13px', borderRadius: 9, lineHeight: 1.7 }}>
                  {error}
                </p>
              )}

              <Button variant="gold" fullWidth onClick={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
                {loading ? <><Spinner /> جاري التحقق...</> : 'دخول'}
              </Button>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: '#F5F8FF', borderRadius: 10, fontSize: 11, color: 'var(--muted)',
              }}>
                <Shield size={14} />
                <span>لا يُسمح بالدخول إلا للأرقام المسجّلة لدى المكتب — لا حاجة لكلمة مرور</span>
              </div>
            </div>

            {inviteToken && (
              <div style={{ marginTop: 12 }}>
                <Badge color="gold">دعوة من مكتب محاماة</Badge>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
