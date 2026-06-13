import { useState, useEffect } from 'react';
import { Crown, Zap, Users, Lock, Check, Wallet, Shield, Globe } from 'lucide-react';
import { Button, Card, Badge, Spinner } from '../atoms';
import { supabase } from '../../services/supabase';
import { type Tier, useRole } from '../../context/RoleContext';
import { isCaseCreationBlocked, TIER_CASE_LIMITS } from '../../services/caseQuotas';

/* ─── Country-based pricing via IP geolocation ─── */
interface CountryPricing {
  currency: string;
  basic: number;
  pro: number;
  symbol: string;
}

async function getPricingByCountry(): Promise<CountryPricing> {
  const CACHE_KEY = 'mohkam_pricing';
  const CACHE_TIME = 'mohkam_pricing_time';
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // Check localStorage cache first
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME);

  if (cached && cachedTime &&
      Date.now() - parseInt(cachedTime) < ONE_DAY) {
    try { return JSON.parse(cached); } catch { /* fall through */ }
  }

  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    const country = data.country_code;

    const pricing: Record<string, CountryPricing> = {
      // مصر
      EG: { currency: 'EGP', basic: 1200, pro: 2500, symbol: 'ج.م' },

      // الخليج — مرتفع
      SA: { currency: 'SAR', basic: 249, pro: 599, symbol: 'ر.س' },
      AE: { currency: 'AED', basic: 249, pro: 599, symbol: 'د.إ' },
      KW: { currency: 'KWD', basic: 69,  pro: 169, symbol: 'د.ك' },
      QA: { currency: 'QAR', basic: 249, pro: 599, symbol: 'ر.ق' },
      BH: { currency: 'BHD', basic: 69,  pro: 169, symbol: 'د.ب' },
      OM: { currency: 'OMR', basic: 69,  pro: 169, symbol: 'ر.ع' },
      JO: { currency: 'JOD', basic: 65,  pro: 159, symbol: 'د.أ' },

      // شمال أفريقيا
      MA: { currency: 'MAD', basic: 499, pro: 1199, symbol: 'د.م' },
      LY: { currency: 'LYD', basic: 249, pro: 599,  symbol: 'د.ل' },
      TN: { currency: 'TND', basic: 249, pro: 599,  symbol: 'د.ت' },

      // أوروبا — أعلى بكتير
      GB: { currency: 'GBP', basic: 99,  pro: 249, symbol: '£'  },
      FR: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      DE: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      IT: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      ES: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      NL: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      BE: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      SE: { currency: 'EUR', basic: 109, pro: 269, symbol: '€'  },
      CH: { currency: 'CHF', basic: 119, pro: 289, symbol: 'Fr' },

      // أمريكا الشمالية
      US: { currency: 'USD', basic: 59,  pro: 149, symbol: '$'  },
      CA: { currency: 'CAD', basic: 79,  pro: 199, symbol: 'C$' },

      // أستراليا وآسيا
      AU: { currency: 'AUD', basic: 89,  pro: 219, symbol: 'A$' },
      SG: { currency: 'SGD', basic: 79,  pro: 199, symbol: 'S$' },
    };

    // أي بلد تاني — سعر مرتفع افتراضي
    const result = pricing[country] || {
      currency: 'USD', basic: 59, pro: 149, symbol: '$'
    };

    // Cache the result for 24 hours
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    localStorage.setItem(CACHE_TIME, Date.now().toString());

    return result;
  } catch {
    return { currency: 'USD', basic: 59, pro: 149, symbol: '$' };
  }
}

interface SubScreenProps {
  profile: any;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
  caseCount?: number;
}

/* Currency conversion rates (USD base) */
const CURRENCY_RATES: Record<string, { rate: number; symbol: string; name: string; nameAr: string }> = {
  USD: { rate: 1, symbol: '$', name: 'US Dollar', nameAr: 'دولار أمريكي' },
  EGP: { rate: 48.5, symbol: 'ج', name: 'Egyptian Pound', nameAr: 'جنيه مصري' },
  SAR: { rate: 3.75, symbol: 'ر.س', name: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  AED: { rate: 3.67, symbol: 'د.إ', name: 'UAE Dirham', nameAr: 'درهم إماراتي' },
  MAD: { rate: 9.8, symbol: 'د.م.', name: 'Moroccan Dirham', nameAr: 'درهم مغربي' },
  MRU: { rate: 39.5, symbol: 'أ.م.', name: 'Mauritanian Ouguiya', nameAr: 'أوقية موريتانية' },
};

/* Base prices in USD */
const BASE_PRICES: Record<string, { monthly: number; name: string; nameAr: string }> = {
  free: { monthly: 0, name: 'Free', nameAr: 'مجاني' },
  pro: { monthly: 20, name: 'Pro', nameAr: 'احترافي' },
  team: { monthly: 50, name: 'Team', nameAr: 'فريق' },
};

/* Translations */
const TRANSLATIONS = {
  ar: {
    subscription: 'الباقات والاشتراكات',
    currentPlan: 'باقتك الحالية',
    month: 'شهر',
    features: {
      free: ['5 قضايا فقط', 'تسجيل صوتي أساسي', 'بوابة الموكل'],
      pro: [
        'شات ريل تايم مع الموكلين',
        'رفع حتى 30 صورة يومياً',
        'مساحة ملفات 100 ميجا',
        'نظام الإشعارات الفورية (Push Notifications)',
        'إدارة غير محدودة للقضايا والجلسات',
        'نظام الفواتير الرقمية وتحصيل الأتعاب',
      ],
      team: [
        'كل مميزات باقة Pro',
        'إضافة عدد غير محدود من الموظفين (مساعد، سكرتير، محاسب)',
        'الشات الداخلي السري لأعضاء المكتب (Internal Team Chat)',
        'مصفوفة صلاحيات دقيقة لكل موظف',
        'رفع غير محدود للصور والملفات (بدون أي قيود)',
        'لوحة تقارير الأداء المالي للمكتب بالكامل',
        'توفير قفل شاشة الأمان المتقدمة',
      ],
    },
    subscribeNow: 'اشترك الآن',
    currentPlanBtn: 'خطتك الحالية',
    popular: 'الأكثر شعبية',
    lawFirms: 'مكاتب المحامين',
    checkoutTitle: 'صفحة دفع',
    securePayment: 'دفع آمن',
    selectPayment: 'اختر طريقة الدفع',
    amountDue: 'المبلغ المطلوب',
    monthly: 'شهرياً',
    payNow: 'ادفع الآن',
    processing: 'جاري المعالجة...',
    paymentSuccess: 'تم الدفع بنجاح!',
    cardDetails: 'بيانات البطاقة',
    cardName: 'اسم حامل البطاقة',
    cardNumber: 'رقم البطاقة',
    expiry: 'تاريخ الانتهاء',
    cvv: 'CVV',
    card: 'بطاقة ائتمانية',
    cardDesc: 'فيزا / ماستركارد / Meeza',
    terms: 'بالضغط على "ادفع" فإنك توافق على شروط الاستخدام وسياسة الخصوصية.',
  },
  en: {
    subscription: 'Subscriptions & Plans',
    currentPlan: 'Your current plan',
    month: 'month',
    features: {
      free: ['5 cases only', 'Basic voice recording', 'Client Portal'],
      pro: [
        'Real-time chat with clients',
        'Upload up to 30 images per day',
        '100 MB file storage',
        'Push Notifications system',
        'Unlimited case & session management',
        'Digital invoicing & fee collection',
      ],
      team: [
        'All Pro features included',
        'Unlimited staff accounts (assistant, secretary, accountant)',
        'Private Internal Team Chat for firm members',
        'Granular permissions matrix per employee',
        'Unlimited file & image uploads (no restrictions)',
        'Full firm financial performance dashboard',
        'Advanced security screen lock',
      ],
    },
    subscribeNow: 'Subscribe Now',
    currentPlanBtn: 'Your Current Plan',
    popular: 'Most Popular',
    lawFirms: 'Law Firms',
    checkoutTitle: 'Checkout',
    securePayment: 'Secure Payment',
    selectPayment: 'Select payment method',
    amountDue: 'Amount Due',
    monthly: 'monthly',
    payNow: 'Pay Now',
    processing: 'Processing...',
    paymentSuccess: 'Payment Successful!',
    cardDetails: 'Card Details',
    cardName: 'Cardholder Name',
    cardNumber: 'Card Number',
    expiry: 'Expiry Date',
    cvv: 'CVV',
    card: 'Credit Card',
    cardDesc: 'Visa / Mastercard / Meeza',
    terms: 'By clicking "Pay Now", you agree to the Terms of Service and Privacy Policy.',
  },
};

interface TierInfo {
  id: Tier;
  priceUSD: number;
  icon: typeof Crown;
  color: string;
  badge?: { ar: string; en: string };
}

const TIERS: TierInfo[] = [
  { id: 'free', priceUSD: 0, icon: Zap, color: 'var(--muted)' },
  { id: 'pro', priceUSD: 20, icon: Crown, color: 'var(--navy)', badge: { ar: 'الأكثر شعبية', en: 'Most Popular' } },
  { id: 'team', priceUSD: 50, icon: Users, color: 'var(--gold)', badge: { ar: 'مكاتب المحامين', en: 'Law Firms' } },
];

function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lang = navigator.language || '';
    if (tz.includes('Cairo') || tz.includes('Egypt') || lang === 'ar-EG') return 'EGP';
    if (tz.includes('Riyadh') || tz.includes('Saudi') || lang === 'ar-SA') return 'SAR';
    if (tz.includes('Dubai') || tz.includes('Abu') || lang === 'ar-AE') return 'AED';
    if (tz.includes('Casablanca') || tz.includes('Morocco') || lang === 'ar-MA') return 'MAD';
    if (tz.includes('Nouakchott') || tz.includes('Mauritania') || lang === 'ar-MR') return 'MRU';
    return 'USD';
  } catch { return 'USD'; }
}

function detectLang(): 'ar' | 'en' {
  const navLang = navigator.language || '';
  if (navLang.startsWith('ar')) return 'ar';
  if (navLang.startsWith('en')) return 'en';
  return 'ar';
}

export function SubScreen({ profile, push, caseCount = 0 }: SubScreenProps) {
  const { setProfile } = useRole();
  const [upgrading] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const tier = (profile?.tier || 'free') as Tier;

  /* Checkout modal state */
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TierInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true); // Default to enabled

  /* Coupon State */
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [coupon, setCoupon] = useState<any>(null);

  /* Cardholder form state */
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');

  /* Country-based pricing state */
  const [countryPricing, setCountryPricing] = useState<CountryPricing | null>(null);

  useEffect(() => {
    setCurrency(detectCurrency());
    setLang(detectLang());
    getPricingByCountry().then(setCountryPricing);
  }, []);

  const t = TRANSLATIONS[lang];
  const curr = CURRENCY_RATES[currency];

  const convertPrice = (usd: number, tierId?: string) => {
    // Use country-based pricing if available
    if (countryPricing && tierId) {
      if (tierId === 'pro') return `${countryPricing.pro} ${countryPricing.symbol}`;
      if (tierId === 'team') {
        // Team = ~2.5x pro price
        const teamPrice = Math.round(countryPricing.pro * 2.5);
        return `${teamPrice} ${countryPricing.symbol}`;
      }
    }
    const converted = usd * curr.rate;
    if (currency === 'USD') return `$${converted.toFixed(0)}`;
    return `${converted.toFixed(0)} ${curr.symbol}`;
  };

  const isCurTier = (tierId: string) => (profile?.tier || 'free') === tierId;
  const isFreeTierLocked = isCaseCreationBlocked(tier, caseCount);

  const openCheckout = (tierInfo: TierInfo) => {
    if (tierInfo.id === 'free') return;
    setSelectedTier(tierInfo);
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCVV('');
    setPaymentSuccess(false);
    setCouponCode('');
    setCouponDiscount(0);
    setCouponError('');
    setCoupon(null);
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    if (processing) return;
    setShowCheckout(false);
    setSelectedTier(null);
  };

  const applyCoupon = async () => {
    if (!couponCode) return;
    
    const { data: couponData } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();
    
    if (!couponData) {
      setCouponError('كود غير صحيح');
      setCouponDiscount(0);
      setCoupon(null);
      return;
    }
    
    if (couponData.expires_at && new Date(couponData.expires_at) < new Date()) {
      setCouponError('الكود منتهي الصلاحية');
      setCouponDiscount(0);
      setCoupon(null);
      return;
    }
    
    if (couponData.used_count >= couponData.max_uses) {
      setCouponError('تم استخدام الكود بالحد الأقصى');
      setCouponDiscount(0);
      setCoupon(null);
      return;
    }

    if (couponData.tier_target !== selectedTier?.id) {
      setCouponError('هذا الكوبون غير صالح لهذه الباقة');
      setCouponDiscount(0);
      setCoupon(null);
      return;
    }
    
    setCouponDiscount(couponData.discount_percent);
    setCoupon(couponData);
    setCouponError('');
    push(`تم تطبيق خصم ${couponData.discount_percent}% ✅`, 'success');

    if (couponData.discount_percent === 100) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await supabase
        .from('profiles')
        .update({
          tier: couponData.tier_target,
          expires_at: expiresAt.toISOString(),
          is_frozen: false,
        })
        .eq('id', profile.id);

      await supabase
        .from('coupons')
        .update({ used_count: couponData.used_count + 1 })
        .eq('id', couponData.id);

      push(`تم تفعيل باقة ${
        couponData.tier_target === 'pro' ? 'Pro ⭐' : 'Team 🏆'
      } مجاناً ✅`, 'success');

      setProfile({
        ...profile,
        tier: couponData.tier_target as any,
        expires_at: expiresAt.toISOString(),
      });
      
      return;
    }
  };

  const basePrice = selectedTier?.priceUSD || 0;
  const finalPrice = Math.round(
    basePrice * (1 - couponDiscount / 100)
  );

  const processPayment = async () => {
    if (!selectedTier || !cardName || !cardNumber || cardNumber.length < 15) return;

    setProcessing(true);

    try {
      /* Invoke Edge Function for checkout session */
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          tier: selectedTier.id,
          amount: finalPrice,
          currency: currency.toLowerCase(),
          client_id: profile.id,
          channel: 'card',
          redirect_origin: window.location.origin,
          type: 'subscription_payment',
          metadata: {
            coupon_id: coupon?.id || null,
            coupon_code: couponCode || null,
            discount_percent: couponDiscount,
            auto_renew: autoRenew,
          }
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error(lang === 'ar' ? 'لم يتم استرجاع رابط الدفع' : 'No checkout URL returned');

      push(lang === 'ar' ? 'جاري توجيهك لبوابة دفع Paymob...' : 'Redirecting to Paymob payment gateway...', 'success');
      
      setTimeout(() => {
        window.location.href = data.url;
      }, 1000);
    } catch (err: any) {
      push(lang === 'ar' ? 'خطأ في الدفع: ' + err.message : 'Payment error: ' + err.message, 'danger');
      setProcessing(false);
    }
  };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header with language/currency selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 18 }}>{t.subscription}</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {t.currentPlan}: <strong>{BASE_PRICES[profile?.tier || 'free'].nameAr}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Language toggle */}
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#F5F8FF', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}>
            <Globe size={12} color="var(--navy)" />
            <span style={{ fontSize: 11, fontWeight: 700 }}>{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>

          {/* Currency selector */}
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, background: '#fff' }}>
            {Object.keys(CURRENCY_RATES).map((c) => (
              <option key={c} value={c}>{CURRENCY_RATES[c].symbol} {c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Free tier locked warning */}
      {isFreeTierLocked && (
        <div style={{ background: '#FDECEF', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={16} color="var(--danger)" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)' }}>{lang === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached'}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{lang === 'ar' ? `باقتك محدودة بـ ${TIER_CASE_LIMITS[tier] === Infinity ? '∞' : TIER_CASE_LIMITS[tier]} قضية` : `Your plan is limited to ${TIER_CASE_LIMITS[tier] === Infinity ? '∞' : TIER_CASE_LIMITS[tier]} cases`}</p>
          </div>
        </div>
      )}

      {/* VERTICAL STACKED TIER CARDS - Mobile Optimized */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {TIERS.map((tierInfo) => {
          const isCur = isCurTier(tierInfo.id);
          const Icon = tierInfo.icon;

          return (
            <Card
              key={tierInfo.id}
              style={{
                padding: 20, position: 'relative', overflow: 'hidden',
                border: isCur ? `2px solid ${tierInfo.color}` : '1px solid var(--border)',
                boxShadow: isCur ? `0 4px 20px ${tierInfo.color}22` : 'var(--shadow)',
                transition: 'all .3s',
              }}
            >
              {/* Badge strip */}
              {tierInfo.badge && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tierInfo.color }} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: tierInfo.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={24} color={tierInfo.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)' }}>
                    {lang === 'ar' ? BASE_PRICES[tierInfo.id].nameAr : BASE_PRICES[tierInfo.id].name}
                  </p>
                  {tierInfo.badge && <Badge color={tierInfo.id === 'team' ? 'gold' : 'navy'}>{lang === 'ar' ? tierInfo.badge.ar : tierInfo.badge.en}</Badge>}
                </div>
                {tierInfo.priceUSD > 0 && (
                  <div style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: tierInfo.color, fontFamily: "'JetBrains Mono', monospace" }}>
                      {convertPrice(tierInfo.priceUSD, tierInfo.id)}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--muted)' }}>/ {t.month}</p>
                  </div>
                )}
              </div>

              {/* Features list */}
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, paddingLeft: lang === 'en' ? 18 : 0 }}>
                {t.features[tierInfo.id].map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: tierInfo.color + '20', color: tierInfo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={10} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Subscribe button */}
              <Button
                variant={isCur ? 'secondary' : tierInfo.id === 'team' ? 'gold' : 'primary'}
                disabled={isCur || upgrading === tierInfo.id}
                onClick={() => openCheckout(tierInfo)}
                fullWidth
                style={{ background: isCur ? undefined : tierInfo.color }}
              >
                {upgrading === tierInfo.id ? <><Spinner /> {t.processing}</> : isCur ? t.currentPlanBtn : t.subscribeNow}
              </Button>

            </Card>
          );
        })}
      </div>

      {/* ==================== CHECKOUT MODAL - Mobile Responsive ==================== */}
      {showCheckout && selectedTier && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,60,.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Card className="slide-up" style={{ width: '100%', maxWidth: 440, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, var(--navy), var(--navy-light))', padding: '18px 20px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 900 }}>{t.checkoutTitle}</p>
                  <p style={{ fontSize: 11, opacity: 0.7 }}>{t.securePayment}</p>
                </div>
                {!processing && (
                  <button onClick={closeCheckout} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ×
                  </button>
                )}
              </div>
            </div>

            {paymentSuccess ? (
              <div className="fade-up" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E6F7EF', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={32} color="var(--success)" />
                </div>
                <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)', marginBottom: 6 }}>{t.paymentSuccess}</p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>{t.subscription}</p>
              </div>
            ) : (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Amount Display */}
                <div style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', borderRadius: 14, padding: 16, textAlign: 'center', border: '2px solid var(--gold)' }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{t.amountDue}</p>
                  <p style={{ fontSize: 36, fontWeight: 900, color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {convertPrice(finalPrice, selectedTier.id)}
                  </p>
                  {couponDiscount > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'line-through' }}>
                      {convertPrice(selectedTier.priceUSD, selectedTier.id)}
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: 'var(--muted)' }}>{t.monthly}</p>
                </div>

                {/* Coupon Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>كود الخصم (اختياري)</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="كود الخصم (اختياري)"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      disabled={processing}
                      style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: "'Cairo',sans-serif" }}
                    />
                    <Button variant="primary" onClick={applyCoupon} disabled={processing} style={{ whiteSpace: 'nowrap' }}>
                      تطبيق
                    </Button>
                  </div>
                  {couponError && <p style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 700 }}>{couponError}</p>}
                  {couponDiscount > 0 && (
                    <p style={{ color: 'var(--success)', fontSize: 12, fontWeight: 800 }}>
                      ✓ تم تطبيق خصم {couponDiscount}%
                    </p>
                  )}
                </div>

                {/* Cardholder Details Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>{t.cardDetails}</p>

                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder={t.cardName}
                    style={{ padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: "'Cairo',sans-serif", width: '100%' }}
                  />

                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    placeholder={t.cardNumber}
                    style={{ padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", width: '100%', direction: 'ltr' }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder={t.expiry}
                      style={{ padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <input
                      type="text"
                      value={cardCVV}
                      onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder={t.cvv}
                      style={{ padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  </div>
                </div>

                {/* Auto-Renewal Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F5F8FF', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={14} color={autoRenew ? 'var(--success)' : 'var(--muted)'} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{lang === 'ar' ? 'التجديد التلقائي للباقة' : 'Auto-renew subscription'}</span>
                  </div>
                  <button
                    onClick={() => setAutoRenew(!autoRenew)}
                    style={{
                      width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                      background: autoRenew ? 'var(--success)' : 'var(--border)', transition: 'background .2s', position: 'relative',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3, transition: 'right .2s',
                      right: autoRenew ? 3 : 23,
                      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                    }} />
                  </button>
                </div>

                {/* Security Notice */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F5F8FF', borderRadius: 8 }}>
                  <Shield size={14} color="var(--navy)" />
                  <p style={{ fontSize: 10, color: 'var(--muted)' }}>{lang === 'ar' ? 'دفع آمن ومشفر 256-bit' : '256-bit encrypted secure payment'}</p>
                </div>

                {/* Pay Button */}
                <Button
                  variant="gold"
                  fullWidth
                  disabled={!cardName || cardNumber.length < 15 || processing}
                  onClick={processPayment}
                  style={{ padding: '14px 20px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {processing ? <><Spinner /> {t.processing}</> : <><Wallet size={16} /> {t.payNow}</>}
                </Button>

                <p style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>{t.terms}</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
