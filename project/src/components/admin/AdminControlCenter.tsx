import { useState, useEffect } from 'react';
import { Shield, Search, Users, DollarSign, Check, X, Crown, Zap, Settings, AlertTriangle, LogOut, CreditCard as Edit3, Save, UserX, UserCheck } from 'lucide-react';
import { Button, Card, Badge, Spinner } from '../atoms';
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
          newTier === 'team' ? 'Team 🏆' :
          newTier === 'pro' ? 'Pro ⭐' : 'Free'
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
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
      <header style={{ background: 'linear-gradient(135deg, #0a192f, #1a365d)', color: '#fff', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 20px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="var(--gold)" />
          </div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 16 }}>Super Admin Control Center</p>
            <p style={{ fontSize: 10, opacity: 0.6 }}>Restricted Access</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color="gold">{user?.email}</Badge>
          <Button variant="ghost" onClick={onLogout} style={{ color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
            <LogOut size={14} /> Exit
          </Button>
        </div>
      </header>

      <main style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
        {/* Stats Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Card style={{ padding: 20, background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <DollarSign size={20} color="var(--gold)" />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>Total Platform Revenue</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace" }}>{stats.totalRevenue.toLocaleString()} ج</p>
          </Card>
          <Card style={{ padding: 20, background: '#E6F7EF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Zap size={20} color="var(--muted)" />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>Free Tier</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--muted)' }}>{stats.activeFree}</p>
          </Card>
          <Card style={{ padding: 20, background: '#F5F8FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Crown size={20} color="var(--navy)" />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>Pro Tier</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy)' }}>{stats.activePro}</p>
          </Card>
          <Card style={{ padding: 20, background: '#FDF4E7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Users size={20} color="var(--gold)" />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>Team Tier</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)' }}>{stats.activeTeam}</p>
          </Card>
          <Card style={{ padding: 20, background: '#FDECEF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <AlertTriangle size={20} color="var(--danger)" />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>Total Debt Owed</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--danger)', fontFamily: "'JetBrains Mono', monospace" }}>{stats.totalDebt.toLocaleString()} ج</p>
          </Card>
        </div>

        {/* Global Configuration Panel */}
        <Card style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Settings size={20} color="var(--navy)" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>Global Configuration</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Default Commission %</label>
              <input
                type="number"
                value={globalCommission}
                onChange={(e) => setGlobalCommission(Number(e.target.value))}
                min={0}
                max={100}
                step={0.5}
                style={{ width: 80, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            <Button variant="gold" onClick={() => saveGlobalCommission(globalCommission)}>
              <Save size={14} /> Save
            </Button>
          </div>
        </Card>

        {/* Coupons Management Panel */}
        <Card style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>🎟️</span>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>إدارة الكوبونات</h3>
          </div>
          
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
            <input 
              placeholder="كود الكوبون (مثال: FRIEND50)"
              value={newCoupon.code}
              onChange={e => setNewCoupon(p => ({...p, code: e.target.value}))}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, minWidth: 200 }}
            />
            <input 
              type="number" 
              placeholder="نسبة الخصم %"
              value={newCoupon.discount_percent || ''}
              onChange={e => setNewCoupon(p => ({...p, discount_percent: Number(e.target.value)}))}
              style={{ width: 120, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14 }}
            />
            <input 
              type="number" 
              placeholder="عدد الاستخدامات"
              value={newCoupon.max_uses || ''}
              onChange={e => setNewCoupon(p => ({...p, max_uses: Number(e.target.value)}))}
              style={{ width: 140, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14 }}
            />
            <input 
              type="date" 
              placeholder="تاريخ الانتهاء"
              value={newCoupon.expires_at}
              onChange={e => setNewCoupon(p => ({...p, expires_at: e.target.value}))}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14 }}
            />
            <select 
              value={newCoupon.tier_target}
              onChange={e => setNewCoupon(p => ({
                ...p, tier_target: e.target.value as 'pro' | 'team'
              }))}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, background: '#fff' }}
            >
              <option value="pro">Pro</option>
              <option value="team">Team</option>
            </select>
            <Button variant="gold" onClick={createCoupon}>
              ➕ إنشاء كوبون
            </Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'right' }}>
                  <th style={{ padding: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>الكود</th>
                  <th style={{ padding: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>الخصم</th>
                  <th style={{ padding: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>الاستخدامات</th>
                  <th style={{ padding: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>الانتهاء</th>
                  <th style={{ padding: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>الباقة</th>
                  <th style={{ padding: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>حذف</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12, fontSize: 14 }}><strong>{c.code}</strong></td>
                    <td style={{ padding: 12, fontSize: 14 }}>{c.discount_percent}%</td>
                    <td style={{ padding: 12, fontSize: 14 }}>{c.used_count}/{c.max_uses}</td>
                    <td style={{ padding: 12, fontSize: 14 }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar') : 'بلا حد'}</td>
                    <td style={{ padding: 12, fontSize: 14 }}>
                      <Badge color={c.tier_target === 'team' ? 'gold' : 'navy'}>{c.tier_target}</Badge>
                    </td>
                    <td style={{ padding: 12, fontSize: 14 }}>
                      <Button size="sm" variant="ghost" onClick={() => deleteCoupon(c.id)} style={{ color: 'var(--danger)', padding: 4 }}>
                        🗑️
                      </Button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                      لا توجد كوبونات حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Search & Filter Card */}
        <Card style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Search size={20} color="var(--navy)" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>Live Search & Filter</h3>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              style={{ width: '100%', padding: '12px 14px 12px 42px', border: '2px solid var(--border)', borderRadius: 12, fontSize: 14, transition: 'border .2s' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--navy)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Status Filter Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '8px 16px', borderRadius: 99,
                  border: statusFilter === f.id ? '2px solid var(--navy)' : '1px solid var(--border)',
                  background: statusFilter === f.id ? 'var(--navy)' : '#fff',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  color: statusFilter === f.id ? '#fff' : 'var(--text)',
                  transition: 'all .15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Lawyers Data Grid */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Users size={20} color="var(--navy)" />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>Lawyers Management</h3>
            </div>
            <Badge color="default">{filtered.length} results</Badge>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spinner size={24} />
              <p style={{ marginTop: 12, color: 'var(--muted)' }}>Loading lawyers...</p>
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
                      background: lawyer.is_frozen ? '#F5F5F5' : '#FAFBFE',
                      borderRadius: 12,
                      border: isDebtOverdue ? '2px solid var(--danger)' : '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      opacity: lawyer.is_frozen ? 0.7 : 1,
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {lawyer.avatar_url ? <img src={lawyer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>👨‍⚖️</span>}
                    </div>

                    {/* Info */}
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lawyer.full_name || 'Unknown'}
                        </p>
                        {lawyer.is_frozen && <Badge color="red">Frozen</Badge>}
                        {isDebtOverdue && <Badge color="orange">Debt: {(lawyer.commission_debt || 0).toLocaleString()} ج</Badge>}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {lawyer.email || lawyer.phone_number || 'No contact'}
                      </p>
                    </div>

                    {/* Current Tier Badge */}
                    <div style={{ minWidth: 80, textAlign: 'center' }}>
                      <Badge color={lawyer.tier === 'team' ? 'gold' : lawyer.tier === 'pro' ? 'navy' : 'default'}>
                        {lawyer.tier === 'team' ? 'Team 🏆' : lawyer.tier === 'pro' ? 'Pro ⭐' : 'Free'}
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
                            style={{ width: 50, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}
                          />
                          <Button size="sm" variant="gold" onClick={() => saveCustomCommission(lawyer.id, customCommission)}><Check size={10} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCommission(null)}><X size={10} /></Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCommission(lawyer.id); setCustomCommission(lawyer.commission_rate || globalCommission); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}
                        >
                          {lawyer.commission_rate || globalCommission}%
                          <Edit3 size={10} />
                        </button>
                      )}
                    </div>

                    {/* Debt Display */}
                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                      <p style={{ fontSize: 12, fontWeight: 900, color: isDebtOverdue ? 'var(--danger)' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {(lawyer.commission_debt || 0).toLocaleString()} ج
                      </p>
                    </div>

                    {/* Adjustable Package Upgrade Days & Actions */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={upgradeDays[lawyer.id] ?? 30}
                        onChange={(e) => setUpgradeDays(prev => ({
                          ...prev,
                          [lawyer.id]: Number(e.target.value)
                        }))}
                        style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>يوم</span>
                      <Button 
                        size="sm"
                        variant="gold"
                        onClick={() => upgradeTier(
                          lawyer.id, 'pro', upgradeDays[lawyer.id] ?? 30
                        )}
                        disabled={processingAction === lawyer.id}
                      >
                        ⭐ Pro
                      </Button>
                      <Button 
                        size="sm"
                        variant="primary"
                        onClick={() => upgradeTier(
                          lawyer.id, 'team', upgradeDays[lawyer.id] ?? 30
                        )}
                        disabled={processingAction === lawyer.id}
                      >
                        🏆 Team
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost"
                        style={{ border: '1px solid var(--border)' }}
                        onClick={() => upgradeTier(lawyer.id, 'free', 0)}
                        disabled={processingAction === lawyer.id}
                      >
                        رجوع Free
                      </Button>
                    </div>

                    {/* Freeze/Unfreeze Button */}
                    <Button
                      size="sm"
                      variant={lawyer.is_frozen ? 'primary' : 'secondary'}
                      onClick={() => toggleFreeze(lawyer.id, lawyer.is_frozen)}
                      disabled={processingAction === lawyer.id}
                    >
                      {lawyer.is_frozen ? <UserCheck size={14} /> : <UserX size={14} />}
                      {lawyer.is_frozen ? ' Unfreeze' : ' Freeze'}
                    </Button>
                  </div>
                );
              })}

              {filtered.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                  <Search size={32} style={{ marginBottom: 12 }} />
                  <p>No lawyers found matching your criteria</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
