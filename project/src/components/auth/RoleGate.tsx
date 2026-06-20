import { Scale } from 'lucide-react';

interface RoleGateProps {
  onSelect: (role: 'lawyer' | 'client') => void;
}

export function RoleGate({ onSelect }: RoleGateProps) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0F2557 0%, #1E3A8A 55%, #3B5FC0 100%)',
      padding: 20,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: '0 auto 16px',
            background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(200,149,42,.2)',
          }}>
            <Scale size={36} color="#C8952A" />
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 900, color: '#fff',
            fontFamily: "'Tajawal', sans-serif", marginBottom: 8,
            textShadow: '0 2px 20px rgba(0,0,0,.3)',
          }}>
            مُحكَم
          </h1>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 15 }}>منصة إدارة القضايا القانونية</p>
          <div style={{ width: 60, height: 3, background: 'var(--gold)', margin: '12px auto 0', borderRadius: 2 }} />
        </div>

        <button
          onClick={() => onSelect('lawyer')}
          style={{
            width: '100%', padding: 20, borderRadius: 16,
            border: '1.5px solid rgba(255,255,255,.2)',
            background: 'var(--gold)', color: '#0F2557',
            cursor: 'pointer', fontSize: 17, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 8px 28px rgba(200,149,42,.35)',
          }}
        >
          <Scale size={20} /> دخول المحامي
        </button>

        <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, marginTop: 18, lineHeight: 1.7 }}>
          الموكلون يدخلون عبر رابط المكتب الذي يرسله إليهم المحامي فقط
        </p>
      </div>
    </div>
  );
}
