import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export type AppLocale = 'ar' | 'en' | 'fr' | 'tr';

const LOCALE_MAP: Record<string, AppLocale> = {
  ar: 'ar',
  areg: 'ar',
  arsa: 'ar',
  arae: 'ar',
  armu: 'ar',
  fr: 'fr',
  frfr: 'fr',
  frma: 'fr',
  frcd: 'fr',
  frtn: 'fr',
  frdz: 'fr',
  frmr: 'fr',
  en: 'en',
  enus: 'en',
  engb: 'en',
  enau: 'en',
  enca: 'en',
  tr: 'tr',
  trtr: 'tr',
};

function detectLocale(): AppLocale {
  const langs = navigator.languages || [navigator.language || 'ar'];
  for (const lang of langs) {
    const lower = lang.toLowerCase().replace(/[-_]/g, '');
    if (LOCALE_MAP[lower]) return LOCALE_MAP[lower];
    const prefix = lower.slice(0, 2);
    if (LOCALE_MAP[prefix]) return LOCALE_MAP[prefix];
    if (prefix === 'ar') return 'ar';
    if (prefix === 'fr') return 'fr';
    if (prefix === 'en') return 'en';
    if (prefix === 'tr') return 'tr';
  }
  return 'ar';
}

export function useLocale() {
  const [locale, setLocale] = useState<AppLocale>(() => {
    const stored = localStorage.getItem('mohkam_locale') as AppLocale | null;
    return stored || detectLocale();
  });

  useEffect(() => {
    localStorage.setItem('mohkam_locale', locale);
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;

    // Sync to Supabase
    const syncLocale = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase
            .from('profiles')
            .update({ language: locale })
            .eq('id', session.user.id);
        }
      } catch (err) {
        console.error('Error syncing locale to DB:', err);
      }
    };
    syncLocale();
  }, [locale]);

  return { locale, setLocale, isRTL: locale === 'ar' };
}
