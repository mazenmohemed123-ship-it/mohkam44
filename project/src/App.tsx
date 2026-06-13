import { useState, useEffect } from 'react';
import { RoleGate } from './components/auth/RoleGate';
import { AuthPage } from './components/auth/AuthPage';
import { ClientZeroAuth } from './components/auth/ClientZeroAuth';
import { LawyerPortal } from './components/portals/LawyerPortal';
import { ClientPortal } from './components/portals/ClientPortal';
import { AdminControlCenter } from './components/admin/AdminControlCenter';
import { RoleProvider, useRole } from './context/RoleContext';
import { CaseProvider } from './context/CaseContext';
import { supabase } from './services/supabase';
import { Spinner } from './components/atoms';
import type { Profile } from './context/RoleContext';
import { useLocale } from './hooks/useLocale';
import './styles/theme.css';

type AppScreen = 'role_gate' | 'auth_lawyer' | 'auth_client';
type UserRole = 'lawyer' | 'client';

const SESSION_KEY = 'mohkam_client_session';
const ADMIN_ROUTE = '/admin-control-center';



interface ClientSession {
  userId: string;
  phoneNumber: string;
  linkedLawyerId: string;
  clientName: string;
  createdAt: string;
}

function AppContent() {
  const { setLocale } = useLocale();
  const [user, setUser] = useState<any>(null);
  const { profile, setProfile } = useRole();
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<AppScreen>('role_gate');
  const [, setSelectedRole] = useState<UserRole>('lawyer');

  const pathname = window.location.pathname;
  const lawyerPortalMatch = pathname.match(/^\/portal\/lawyer\/([a-f0-9-]{36})/);
  const urlLawyerId = lawyerPortalMatch 
    ? lawyerPortalMatch[1]
    : new URLSearchParams(window.location.search).get('join_lawyer');
  const inviteToken = new URLSearchParams(window.location.search).get('client_invite_token');

  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const paymentId = queryParams.get('payment_id');
    const paymobOrderId = queryParams.get('paymob_order_id');
    const isSandbox = queryParams.get('payment_sandbox') === '1';
    const amount = queryParams.get('amount');
    const curr = queryParams.get('currency') || 'EGP';

    if (paymentId && paymobOrderId) {
      setVerifyingPayment(true);
      setPaymentStatus('pending');

      const verify = async () => {
        if (isSandbox) {
          // Simulate Paymob webhook call
          try {
            await supabase.functions.invoke('paymob-webhook', {
              body: {
                type: "TRANSACTION",
                obj: {
                  id: `sandbox_txn_${Date.now()}`,
                  success: true,
                  amount_cents: Math.round(Number(amount) * 100),
                  currency: curr,
                  order: { id: paymobOrderId }
                }
              }
            });
          } catch (err) {
            console.error("Error triggering sandbox webhook:", err);
          }
        }

        // Poll the database to verify the payment record has updated to 'success'
        let checks = 0;
        const interval = setInterval(async () => {
          const { data, error } = await supabase
            .from('payments')
            .select('status')
            .eq('id', paymentId)
            .single();

          if (!error && data?.status === 'success') {
            clearInterval(interval);
            setPaymentStatus('success');
            setTimeout(() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              window.location.reload();
            }, 2000);
          } else if (error || data?.status === 'failed' || checks > 15) {
            clearInterval(interval);
            setPaymentStatus('failed');
            setTimeout(() => {
              setVerifyingPayment(false);
              window.history.replaceState({}, document.title, window.location.pathname);
            }, 3000);
          }
          checks++;
        }, 1500);
      };

      verify();
    }
  }, []);

  // Check for existing session
  useEffect(() => {
    // Check for admin control center route
    if (window.location.pathname === ADMIN_ROUTE) {
      // Let auth state determine if they can access
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
        }
        setLoading(false);
      });
      return;
    }

    // If we have invite URL params or firm portal path, go straight to client auth
    if ((urlLawyerId && inviteToken) || lawyerPortalMatch) {
      setScreen('auth_client');
      setLoading(false);
      return;
    }

    // Check for stored client session (auto-hydrate on refresh)
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        const clientSession: ClientSession = JSON.parse(storedSession);
        // Validate session is not too old (30 days max)
        const sessionAge = Date.now() - new Date(clientSession.createdAt).getTime();
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        if (sessionAge < maxAge) {
          // Reactivate the Supabase anonymous session
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user && session.user.id === clientSession.userId) {
              // Session still valid - use it
              const clientProfile: Profile = {
                id: clientSession.userId,
                full_name: clientSession.clientName,
                phone_number: clientSession.phoneNumber,
                role: 'client',
                tier: 'free',
                is_emergency_enabled: true,
                linked_lawyer_id: clientSession.linkedLawyerId,
              };
              setUser({ id: clientSession.userId });
              setProfile(clientProfile);
              setLoading(false);
              return;
            }
            // Session expired or invalid - try to refresh
            supabase.auth.signInAnonymously().then(({ data: authData }) => {
              if (authData.user) {
                const clientProfile: Profile = {
                  id: clientSession.userId,
                  full_name: clientSession.clientName,
                  phone_number: clientSession.phoneNumber,
                  role: 'client',
                  tier: 'free',
                  is_emergency_enabled: true,
                  linked_lawyer_id: clientSession.linkedLawyerId,
                };
                setUser({ id: authData.user.id });
                setProfile(clientProfile);
              } else {
                // Failed to restore - clear session
                localStorage.removeItem(SESSION_KEY);
                setScreen('auth_client');
              }
              setLoading(false);
            });
          });
          return;
        }
        // Session too old - clear it
        localStorage.removeItem(SESSION_KEY);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    // Check for device fingerprint auto-login (fallback)
    const deviceFp = localStorage.getItem('mohkam_device_fp');
    if (deviceFp && document.cookie.includes('mohkam_client=1')) {
      setScreen('auth_client');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProfile(data as Profile);
              if (data.language) {
                setLocale(data.language as any);
              }
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (prof) {
          setProfile(prof as Profile);
          if (prof.language) {
            setLocale(prof.language as any);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [urlLawyerId, inviteToken]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    document.cookie = 'mohkam_client=; path=/; max-age=0';
    localStorage.removeItem(SESSION_KEY);
    setScreen('role_gate');
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'client') {
      setScreen('auth_client');
    } else {
      setScreen('auth_lawyer');
    }
  };

  const handleAuth = (u: any, p: Profile) => {
    setUser(u);
    setProfile(p);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 16 }}>
        <Spinner size={36} color="var(--navy)" />
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>جاري التحميل...</p>
      </div>
    );
  }

  // Admin Control Center route
  if (window.location.pathname === ADMIN_ROUTE) {
    return <AdminControlCenter user={user} onLogout={logout} />;
  }

  // Authenticated: show portal
  if (user && profile) {
    return (
      <>
        {profile.role === 'client' ? (
          <ClientPortal user={user} profile={profile} onLogout={logout} urlLawyerId={urlLawyerId || profile.linked_lawyer_id} />
        ) : (
          <LawyerPortal user={user} profile={profile} onLogout={logout} />
        )}
        {verifyingPayment && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 25, 47, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: "'Cairo', sans-serif"
          }}>
            <div style={{
              background: '#112240',
              padding: 40,
              borderRadius: 20,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              {paymentStatus === 'pending' && (
                <>
                  <Spinner size={36} color="var(--gold)" />
                  <h3 style={{ marginTop: 24, fontWeight: 800, fontSize: 18 }}>جاري التحقق من عملية الدفع...</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 }}>Verifying payment transaction with Paymob...</p>
                </>
              )}
              {paymentStatus === 'success' && (
                <>
                  <div style={{ fontSize: 54, color: '#10B981', marginBottom: 16 }}>✓</div>
                  <h3 style={{ fontWeight: 800, fontSize: 20 }}>تم تأكيد الدفع بنجاح!</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 }}>Payment successfully confirmed. Refreshing portal...</p>
                </>
              )}
              {paymentStatus === 'failed' && (
                <>
                  <div style={{ fontSize: 54, color: '#EF4444', marginBottom: 16 }}>✗</div>
                  <h3 style={{ fontWeight: 800, fontSize: 20 }}>فشلت عملية الدفع</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 }}>Payment transaction failed or was cancelled.</p>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Unauthenticated: show auth screens
  if (screen === 'auth_client') {
    if (urlLawyerId) {
      return <ClientZeroAuth lawyerId={urlLawyerId} inviteToken={inviteToken || undefined} onAuth={handleAuth} onBack={() => setScreen('role_gate')} />;
    }
    // Client without invite link - show basic auth
    return <ClientZeroAuth lawyerId="" onAuth={handleAuth} onBack={() => setScreen('role_gate')} />;
  }

  if (screen === 'auth_lawyer') {
    return <AuthPage onAuth={handleAuth} onBack={() => setScreen('role_gate')} />;
  }

  return <RoleGate onSelect={handleRoleSelect} />;
}

export default function App() {
  return (
    <CaseProvider>
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </CaseProvider>
  );
}
