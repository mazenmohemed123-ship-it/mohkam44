import { supabase } from './supabase';
import type { Tier } from '../context/RoleContext';

export interface ChatQuota {
  maxImagesPerDay: number;
  maxFileSizeMB: number;
  isUnlimited: boolean;
}

export const TIER_CHAT_QUOTAS: Record<Tier, ChatQuota> = {
  free: { maxImagesPerDay: 0, maxFileSizeMB: 0, isUnlimited: false },
  pro: { maxImagesPerDay: 30, maxFileSizeMB: 100, isUnlimited: false },
  team: { maxImagesPerDay: 999, maxFileSizeMB: 999, isUnlimited: true },
};

export const canAccessChat = (tier: string) => {
  return tier === 'pro' || tier === 'team';
};

export const getDailyImageLimit = (tier: string) => {
  if (tier === 'free') return 0;
  if (tier === 'pro') return 30;
  if (tier === 'team') return 999;
  return 0;
};

export const getStorageLimit = (tier: string) => {
  if (tier === 'free') return 0;
  if (tier === 'pro') return 100 * 1024 * 1024; // 100MB
  if (tier === 'team') return 999 * 1024 * 1024; // unlimited
  return 0;
};

export async function getDailyChatUploadCount(caseId: string, _lawyerId?: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('case_id', caseId)
    .not('attachment_url', 'is', null)
    .gte('created_at', today.toISOString());

  return data?.length || 0;
}

export function checkChatUploadQuota(
  tier: Tier,
  currentUploadCount: number,
  fileSizeMB: number,
): { allowed: boolean; reason?: string } {
  if (tier === 'free') {
    return {
      allowed: false,
      reason: 'رفع الصور والملفات غير متاح في الباقة المجانية. يرجى الترقية.',
    };
  }

  const dailyLimit = getDailyImageLimit(tier);
  if (currentUploadCount >= dailyLimit) {
    return {
      allowed: false,
      reason: `وصلت لحد الصور اليومي (${dailyLimit} صورة/ملف). قم بالترقية لمزيد.`,
    };
  }

  const storageLimitMB = getStorageLimit(tier) / (1024 * 1024);
  if (fileSizeMB > storageLimitMB) {
    return {
      allowed: false,
      reason: `حجم الملف يتجاوز الحد (${storageLimitMB} ميجابايت).`,
    };
  }

  return { allowed: true };
}
