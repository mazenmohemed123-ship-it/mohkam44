import { useState, useEffect } from 'react';
import { Shield, Search, Users, DollarSign, Check, X, Crown, Zap, Settings, AlertTriangle, LogOut, CreditCard as Edit3, Save, UserX, UserCheck, Ticket, Plus, Trash2, Scale } from 'lucide-react';
import { Button, Badge, Spinner } from '../atoms';
import { supabase } from '../../services/supabase';
import { useNotifications } from '../../hooks/useNotifications';

interface AdminControlCenterProps {
  user: any;
  onLogout: () => void;
}

interface LawyerProfile {
  id: string;
  full_name: string;
  email?: string;
  phone_number?: string;
  role: string;
  tier: string;
  commission_debt: number;
  commission_rate: number;
  is_frozen: boolean;
  avatar_url?: string;
  created_at: string;
  started_at?: string;
  expires_at?: string;
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All', labelAr: 'الكل' },
  { id: 'active', label: 'Active', labelAr: 'نشط' },
  { id: 'frozen', label: 'Frozen', labelAr: 'مجمد' },
  { id: 'debt_over_500', label: 'Debt > 500 EGP', labelAr: 'دين > ٥٠٠ ج' },
];

export function AdminControlCenter({ user, onLogout }: AdminControlCenterProps) {
  const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);
  const [filtered, setFiltered] = useState<LawyerProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [globalCommission, setGlobalCommission] = useState(5);
  const [stats, setStats] = useState({ totalRevenue: 0, activeFree: 0, activePro: 0, activeTeam: 0, totalDebt: 0 });
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [customCommission, setCustomCommission] = useState<number>(0);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // New States
  const [upgradeDays, setUpgradeDays] = useState<Record<string, number>>({});
  const [coupons, setCoupons] = useState<any[]>([]);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_percent: 0,
    max_uses: 1,
    expires_at: '',
    tier_target: 'pro' as 'pro' | 'team',
  });

  const { list: notifList, push } = useNotifications();

  /* Access control: Mazen only */
  const ADMIN_EMAILS = [
    'mazen@mazen.engineer',
    'mazenmohemed123@gmail.com',
  ];
  const isAuthorized = user 
    ? ADMIN_EMAILS.includes(user.email ?? '') 
    : false;

  console.log('Admin check:', user?.email, isAuthorized);

  useEffect(() => {
    if (!isAuthorized) return;
    loadLawyers();
    loadCoupons();
  }, [isAuthorized]);

  useEffect(() => {
    const saved = localStorage.getItem('global_commission');
    if (saved) setGlobalCommission(Number(saved));
  }, []);

  useEffect(() => {
    filterLawyers();
  }, [searchQuery, statusFilter, lawyers]);

  const loadLawyers = async () => {
    setLoading(true);
    const { data: lawyersData, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['lawyer', 'owner', 'partner'])
      .order('created_at', { ascending: false });

    if (!error && lawyersData) {
      const mapped = lawyersData.map((p) => {
        return {
          ...p,
          email: p.email || (p as any).staff_email || '',
          commission_rate: p.commission_rate || globalCommission,
          is_frozen: p.is_frozen || false,
          commission_debt: p.commission_debt || 0,
        } as LawyerProfile;
      });
      setLawyers(mapped);
      calculateStats(mapped);
    }
    setLoading(false);
  };

  const calculateStats = (lawyerList: LawyerProfile[]) => {
    const totalDebt = lawyerList.reduce((sum, l) => sum + (l.commission_debt || 0), 0);
    const activeFree = lawyerList.filter(l => l.tier === 'free' && !l.is_frozen).length;
    const activePro = lawyerList.filter(l => l.tier === 'pro' && !l.is_frozen).length;
    const activeTeam = lawyerList.filter(l => l.tier === 'team' && !l.is_frozen).length;
    const totalRevenue = lawyerList.reduce((sum, l) => {
      return sum + (l.commission_debt || 0);
    }, 0);
    setStats({ totalRevenue, activeFree, activePro, activeTeam, totalDebt });
  };

  const filterLawyers = () => {
    let result = [...lawyers];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.full_name?.toLowerCase().includes(query) ||
        l.email?.toLowerCase().includes(query) ||
        l.phone_number?.includes(query)
      );
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(l => !l.is_frozen);
    } else if (statusFilter === 'frozen') {
      result = result.filter(l => l.is_frozen);
    } else if (statusFilter === 'debt_over_500') {
      result = result.filter(l => (l.commission_debt || 0) > 500);
    }

    setFiltered(result);
  };

  const saveGlobalCommission = async (rate: number) => {
    localStorage.setItem('global_commission', rate.toString());
    setGlobalCommission(rate);
    
    await supabase
      .from('profiles')
      .update({ commission_rate: rate })
      .in('role', ['lawyer', 'owner', 'partner']);
    
    await loadLawyers();
    push(`تم تطبيق العمولة ${rate}% على الكل ✅`, 'success');
  };

  const saveCustomCommission = async (lawyerId: string, rate: number) => {
    await supabase
      .from('profiles')
      .update({ commission_rate: rate })
      .eq('id', lawyerId);
    await loadLawyers();
    setEditingCommission(null);
    push('تم حفظ العمولة ✅', 'success');
  };

  const toggleFreeze = async (lawyerId: string, currentState: boolean) => {
    setProcessingAction(lawyerId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_frozen: !currentState })
      .eq('id', lawyerId);

    if (!error) {
      setLawyers(prev => prev.map(l => l.id === lawyerId ? { ...l, is_frozen: !currentState } : l));
      push(!currentState ? '✓ Account frozen' : '✓ Account unfrozen', 'success');
    } else {
      push('Error updating account', 'danger');
    }
    setProcessingAction(null);
  };

  const upgradeTier = async (
    lawyerId: string,
    newTier: 'free' | 'pro' | 'team',
    days: number = 30
  ) => {
    setProcessingAction(lawyerId);

    const lawyer = lawyers.find(l => l.id === lawyerId);
    const currentExpiry = lawyer?.expires_at
      ? new Date(lawyer.expires_at)
      : null;

    const startDate = currentExpiry && currentExpiry > new Date()
      ? currentExpiry
      : new Date();

    const expiresAt = new Date(startDate);
    expiresAt.setDate(expiresAt.getDate() + days);

    await supabase
      .from('profiles')
      .update({
        tier: newTier,
        expires_at: expiresAt.toISOString(),
        is_frozen: false,
      })
      .eq('id', lawyerId);

    await supabase.functions.invoke('send-notification', {
      body: {
        lawyerId,
        clientName: 'إدارة محكَم',
        message: `تم ترقية باقتك إلى ${
          newTier === 'team' ? 'Team' :
          newTier === 'pro' ? 'Pro' : 'Free'
        } لمدة ${days} يوم`,
      },
    });

    if (lawyer?.email) {
      await supabase.functions.invoke('send-email', {
        body: {
          to: lawyer.email,
          type: 'tier_upgrade',
          tierName: newTier,
          days,
        },
      });
    }

    await loadLawyers();
    setProcessingAction(null);
    push(`تم ترقية الباقة لـ ${days} يوم ✅`, 'success');
  };

  const loadCoupons = async () => {
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    setCoupons(data || []);
  };

  const createCoupon = async () => {
    if (!newCoupon.code) return;
    
    await supabase.from('coupons').insert({
      code: newCoupon.code.toUpperCase(),
      discount_percent: newCoupon.discount_percent,
      max_uses: newCoupon.max_uses,
      expires_at: newCoupon.expires_at || null,
      tier_target: newCoupon.tier_target,
      used_count: 0,
      is_active: true,
    });
    
    await loadCoupons();
    push(`تم إنشاء كوبون ${newCoupon.code} ✅`, 'success');
    setNewCoupon({ 
      code: '', discount_percent: 0, 
      max_uses: 1, expires_at: '', tier_target: 'pro' 
    });
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from('coupons').delete().eq('id', id);
    await loadCoupons();
  };

  if (!isAuthorized) return null;

  /* ─── Luxury dark theme tokens ─── */
  const GOLD = '#D4AF37';
  const TEXT = '#E8ECF4';
  const MUTED = '#8A93A6';
  const panel: React.CSSProperties = {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(212,175,55,0.16)',
    borderRadius: 18,
    boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(12px)',
  };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: MUTED };
  const inputStyle: React.CSSProperties = { padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 14, color: TEXT, outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', color: TEXT, background: 'radial-gradient(1200px 600px at 50% -10%, rgba(212,175,55,0.10), transparent), linear-gradient(180deg, #0b1426 0%, #070d18 100%)' }}>
      {/* Notification UI */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
        {notifList.length > 0 && (
          <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
            {notifList.map(n => (
              <div key={n.id} style={{ fontSize: 12, color: n.type === 'success' ? 'var(--success)' : n.type === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>
                {n.msg}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <header style={{ background: 'rgba(7,13,24,0.72)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(212,175,55,0.22)', padding: '0 28px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} color={GOLD} />
          </div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 17, letterSpacing: 0.3, color: '#fff' }}>
              مُحكَم <span style={{ color: GOLD }}>| مركز التحكم</span>
            </p>
            <p style={{ ...label, fontSize: 9.5 }}>Super Admin · Restricted Access</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>{user?.email}</span>
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: TEXT, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            <LogOut size={14} /> خروج
          </button>
        </div>
      </header>

      <main style={{ padding: 28, maxWidth: 1440, margin: '0 auto' }}>
        {/* Stats Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 18, marginBottom: 28 }}>
          {[
            { icon: DollarSign, tint: GOLD, title: 'إجمالي الإيرادات', value: `${stats.totalRevenue.toLocaleString()} ج`, mono: true },
            { icon: Zap, tint: MUTED, title: 'باقة Free', value: String(stats.activeFree) },
            { icon: Crown, tint: '#7FA8FF', title: 'باقة Pro', value: String(stats.activePro) },
            { icon: Users, tint: GOLD, title: 'باقة Team', value: String(stats.activeTeam) },
            { icon: AlertTriangle, tint: '#FF5C6C', title: 'إجمالي الديون', value: `${stats.totalDebt.toLocaleString()} ج`, mono: true },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ ...panel, padding: 22, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.tint}, transparent)` }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.tint}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color={s.tint} />
                  </div>
                  <span style={label}>{s.title}</span>
                </div>
                <p style={{ fontSize: 30, fontWeight: 900, color: s.tint, fontFamily: s.mono ? "'JetBrains Mono', monospace" : undefined }}>{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* Global Configuration Panel */}
        <div style={{ ...panel, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Settings size={18} color={GOLD} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>الإعدادات العامة</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={label}>نسبة العمولة الافتراضية ٪</span>
              <input
                type="number"
                value={globalCommission}
                onChange={(e) => setGlobalCommission(Number(e.target.value))}
                min={0}
                max={100}
                step={0.5}
                style={{ ...inputStyle, width: 110, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            <Button variant="gold" onClick={() => saveGlobalCommission(globalCommission)}>
              <Save size={14} /> حفظ وتطبيق على الكل
            </Button>
          </div>
        </div>

        {/* Coupons Management Panel */}
        <div style={{ ...panel, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Ticket size={18} color={GOLD} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>إدارة الكوبونات</h3>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22 }}>
            <input
              placeholder="كود الكوبون (مثال: FRIEND50)"
              value={newCoupon.code}
              onChange={e => setNewCoupon(p => ({...p, code: e.target.value}))}
              style={{ ...inputStyle, minWidth: 200 }}
            />
            <input
              type="number"
              placeholder="نسبة الخصم %"
              value={newCoupon.discount_percent || ''}
              onChange={e => setNewCoupon(p => ({...p, discount_percent: Number(e.target.value)}))}
              style={{ ...inputStyle, width: 130 }}
            />
            <input
              type="number"
              placeholder="عدد الاستخدامات"
              value={newCoupon.max_uses || ''}
              onChange={e => setNewCoupon(p => ({...p, max_uses: Number(e.target.value)}))}
              style={{ ...inputStyle, width: 150 }}
            />
            <input
              type="date"
              value={newCoupon.expires_at}
              onChange={e => setNewCoupon(p => ({...p, expires_at: e.target.value}))}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
            <select
              value={newCoupon.tier_target}
              onChange={e => setNewCoupon(p => ({
                ...p, tier_target: e.target.value as 'pro' | 'team'
              }))}
              style={{ ...inputStyle }}
            >
              <option value="pro" style={{ color: '#000' }}>Pro</option>
              <option value="team" style={{ color: '#000' }}>Team</option>
            </select>
            <Button variant="gold" onClick={createCoupon}>
              <Plus size={14} /> إنشاء كوبون
            </Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.22)', textAlign: 'right' }}>
                  {['الكود', 'الخصم', 'الاستخدامات', 'الانتهاء', 'الباقة', 'حذف'].map(h => (
                    <th key={h} style={{ padding: 12, ...label }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: 12, fontSize: 14, fontWeight: 800, color: GOLD, fontFamily: "'JetBrains Mono', monospace" }}>{c.code}</td>
                    <td style={{ padding: 12, fontSize: 14, color: TEXT }}>{c.discount_percent}%</td>
                    <td style={{ padding: 12, fontSize: 14, color: TEXT }}>{c.used_count}/{c.max_uses}</td>
                    <td style={{ padding: 12, fontSize: 13, color: MUTED }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar') : 'بلا حد'}</td>
                    <td style={{ padding: 12, fontSize: 14 }}>
                      <Badge color={c.tier_target === 'team' ? 'gold' : 'navy'}>{c.tier_target}</Badge>
                    </td>
                    <td style={{ padding: 12 }}>
                      <button onClick={() => deleteCoupon(c.id)} style={{ background: 'rgba(255,92,108,0.12)', border: '1px solid rgba(255,92,108,0.3)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}>
                        <Trash2 size={14} color="#FF5C6C" />
                      </button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: MUTED }}>
                      لا توجد كوبونات حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Search & Filter */}
        <div style={{ ...panel, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Search size={18} color={GOLD} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>بحث وتصفية مباشرة</h3>
          </div>

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={18} color={MUTED} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو البريد أو الهاتف..."
              dir="rtl"
              style={{ ...inputStyle, width: '100%', padding: '12px 44px 12px 14px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    padding: '8px 18px', borderRadius: 99,
                    border: active ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.14)',
                    background: active ? 'linear-gradient(135deg, rgba(212,175,55,0.9), rgba(212,175,55,0.65))' : 'transparent',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    color: active ? '#0b1426' : MUTED,
                    transition: 'all .15s',
                  }}
                >
                  {f.labelAr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lawyers Data Grid */}
        <div style={{ ...panel, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={18} color={GOLD} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>إدارة المحامين</h3>
            </div>
            <span style={{ ...label, color: GOLD }}>{filtered.length} نتيجة</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spinner size={24} color={GOLD} />
              <p style={{ marginTop: 12, color: MUTED }}>جاري التحميل...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map((lawyer) => {
                const isDebtOverdue = (lawyer.commission_debt || 0) > 500;
                return (
                  <div
                    key={lawyer.id}
                    style={{
                      padding: '16px 20px',
                      background: lawyer.is_frozen ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)',
                      borderRadius: 14,
                      border: isDebtOverdue ? '1px solid rgba(255,92,108,0.55)' : '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      opacity: lawyer.is_frozen ? 0.65 : 1,
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {lawyer.avatar_url ? <img src={lawyer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Scale size={18} color={GOLD} />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lawyer.full_name || 'بدون اسم'}
                        </p>
                        {lawyer.is_frozen && <Badge color="red">مجمد</Badge>}
                        {isDebtOverdue && <Badge color="orange">دين: {(lawyer.commission_debt || 0).toLocaleString()} ج</Badge>}
                      </div>
                      <p style={{ fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                        {lawyer.email || lawyer.phone_number || 'لا يوجد تواصل'}
                      </p>
                    </div>

                    {/* Current Tier Badge */}
                    <div style={{ minWidth: 70, textAlign: 'center' }}>
                      <Badge color={lawyer.tier === 'team' ? 'gold' : lawyer.tier === 'pro' ? 'navy' : 'default'}>
                        {lawyer.tier === 'team' ? 'Team' : lawyer.tier === 'pro' ? 'Pro' : 'Free'}
                      </Badge>
                    </div>

                    {/* Commission Rate */}
                    <div style={{ minWidth: 80 }}>
                      {editingCommission === lawyer.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            value={customCommission}
                            onChange={(e) => setCustomCommission(Number(e.target.value))}
                            min={0}
                            max={100}
                            style={{ ...inputStyle, width: 56, padding: '4px 6px', fontSize: 12 }}
                          />
                          <Button size="sm" variant="gold" onClick={() => saveCustomCommission(lawyer.id, customCommission)}><Check size={10} /></Button>
                          <button onClick={() => setEditingCommission(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={14} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCommission(lawyer.id); setCustomCommission(lawyer.commission_rate || globalCommission); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, color: GOLD }}
                        >
                          {lawyer.commission_rate || globalCommission}%
                          <Edit3 size={11} color={MUTED} />
                        </button>
                      )}
                    </div>

                    {/* Debt Display */}
                    <div style={{ textAlign: 'center', minWidth: 84 }}>
                      <p style={{ fontSize: 13, fontWeight: 900, color: isDebtOverdue ? '#FF5C6C' : TEXT, fontFamily: "'JetBrains Mono', monospace" }}>
                        {(lawyer.commission_debt || 0).toLocaleString()} ج
                      </p>
                    </div>

                    {/* Adjustable Package Upgrade Days & Actions */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={upgradeDays[lawyer.id] ?? 30}
                        onChange={(e) => setUpgradeDays(prev => ({ ...prev, [lawyer.id]: Number(e.target.value) }))}
                        style={{ ...inputStyle, width: 58, padding: '6px 8px', fontSize: 12, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 12, color: MUTED }}>يوم</span>
                      <Button size="sm" variant="gold" onClick={() => upgradeTier(lawyer.id, 'pro', upgradeDays[lawyer.id] ?? 30)} disabled={processingAction === lawyer.id}>
                        <Crown size={13} /> Pro
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => upgradeTier(lawyer.id, 'team', upgradeDays[lawyer.id] ?? 30)} disabled={processingAction === lawyer.id}>
                        <Users size={13} /> Team
                      </Button>
                      <button
                        onClick={() => upgradeTier(lawyer.id, 'free', 0)}
                        disabled={processingAction === lawyer.id}
                        style={{ padding: '7px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', color: MUTED, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                      >
                        إرجاع Free
                      </button>
                    </div>

                    {/* Freeze/Unfreeze Button */}
                    <button
                      onClick={() => toggleFreeze(lawyer.id, lawyer.is_frozen)}
                      disabled={processingAction === lawyer.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        border: lawyer.is_frozen ? `1px solid ${GOLD}` : '1px solid rgba(255,92,108,0.4)',
                        background: lawyer.is_frozen ? 'rgba(212,175,55,0.15)' : 'rgba(255,92,108,0.12)',
                        color: lawyer.is_frozen ? GOLD : '#FF5C6C',
                      }}
                    >
                      {lawyer.is_frozen ? <UserCheck size={14} /> : <UserX size={14} />}
                      {lawyer.is_frozen ? 'إلغاء التجميد' : 'تجميد'}
                    </button>
                  </div>
                );
              })}

              {filtered.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 48, color: MUTED }}>
                  <Search size={32} style={{ marginBottom: 12 }} />
                  <p>لا يوجد محامون مطابقون لبحثك</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
