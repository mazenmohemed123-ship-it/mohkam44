import type { Tier } from '../context/RoleContext';

export const getCaseLimit = (tier: string): number => {
  if (tier === 'free') return 5;
  if (tier === 'pro') return 20;
  if (tier === 'team') return 999;
  return 5;
};

export const TIER_CASE_LIMITS: Record<Tier, number> = {
  free: 5,
  pro: 20,
  team: 999,
};

export function isCaseCreationBlocked(tier: Tier, currentCaseCount: number): boolean {
  const limit = getCaseLimit(tier);
  return currentCaseCount >= limit;
}

export function getCaseLimitLabel(tier: Tier, lang: 'ar' | 'en' = 'ar'): string {
  const limit = getCaseLimit(tier);
  if (limit >= 999) return lang === 'ar' ? 'غير محدود' : 'Unlimited';
  return String(limit);
}

