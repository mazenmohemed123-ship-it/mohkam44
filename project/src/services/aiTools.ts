import { supabase } from './supabase';

export type AiTask = 'chat' | 'summarize' | 'asr' | 'ocr';

export interface AiResult {
  text?: string;
  error?: string;
  used?: number;
  limit?: number;
}

/**
 * All AI features are proxied through the `ai-tools` Edge Function, which keeps the
 * Hugging Face token server-side and enforces per-tier daily quotas. The browser never
 * sees the token and cannot exceed the limits.
 */
async function invoke(body: Record<string, unknown>): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke('ai-tools', { body });
  if (error) {
    // Edge function returned a non-2xx status — try to surface its Arabic message.
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) return { error: j.error };
      }
    } catch { /* ignore parse failure */ }
    return { error: 'تعذّر الاتصال بخدمة الذكاء الاصطناعي.' };
  }
  return (data || {}) as AiResult;
}

export const askLegalAssistant = (prompt: string) => invoke({ task: 'chat', prompt });

export const summarizeText = (text: string) => invoke({ task: 'summarize', text });

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(blob: Blob): Promise<AiResult> {
  const audio_base64 = await blobToBase64(blob);
  return invoke({ task: 'asr', audio_base64, content_type: blob.type || 'audio/webm' });
}

export async function ocrImage(file: Blob): Promise<AiResult> {
  const image_base64 = await blobToBase64(file);
  return invoke({ task: 'ocr', image_base64, content_type: file.type || 'image/png' });
}
