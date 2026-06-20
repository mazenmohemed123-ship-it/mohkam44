import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Task = "chat" | "summarize" | "asr" | "ocr";

// Hugging Face serverless Inference API models (all free with an HF token).
const HF_MODELS: Record<Task, string> = {
  chat: "mistralai/Mistral-7B-Instruct-v0.3",
  summarize: "csebuetnlp/mT5_multilingual_XLSum",
  asr: "openai/whisper-large-v3",
  ocr: "microsoft/trocr-large-printed",
};

// Daily limits per task per tier. `free` has no AI access at all.
const LIMITS: Record<string, Partial<Record<Task, number>>> = {
  pro: { summarize: 25, asr: 25, ocr: 25 },
  team: { chat: 60, summarize: 100, asr: 100, ocr: 100 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function callHF(model: string, init: RequestInit) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get("HF_TOKEN")}`,
      ...(init.headers || {}),
    },
  });
  if (res.status === 503) {
    throw new Error("النموذج قيد التحميل حالياً، برجاء إعادة المحاولة بعد لحظات.");
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`فشل الاتصال بخدمة الذكاء الاصطناعي (${res.status}): ${txt.slice(0, 200)}`);
  }
  return res;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (!Deno.env.get("HF_TOKEN")) {
      return json({ error: "خدمة الذكاء الاصطناعي غير مفعّلة (HF_TOKEN غير مضبوط)." }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Identify the caller from their JWT.
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "غير مصرّح" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin
      .from("profiles")
      .select("tier, role")
      .eq("id", user.id)
      .maybeSingle();

    const tier = profile?.tier || "free";
    const role = profile?.role || "client";

    const body = await req.json();
    const task = body.task as Task;
    if (!task || !(task in HF_MODELS)) return json({ error: "مهمة غير معروفة" }, 400);

    // ── Access control ──
    if (tier === "free") {
      return json({ error: "هذه الميزة متاحة لباقات Pro و Team فقط. يرجى الترقية." }, 403);
    }
    // Legal assistant: lawyers only, and Team tier only.
    if (task === "chat") {
      const isLawyer = ["owner", "partner", "lawyer"].includes(role);
      if (tier !== "team" || !isLawyer) {
        return json({ error: "المساعد القانوني الذكي متاح للمحامين على باقة Team فقط." }, 403);
      }
    }

    const limit = LIMITS[tier]?.[task];
    if (!limit) {
      return json({ error: "هذه الميزة غير متاحة في باقتك الحالية." }, 403);
    }

    // ── Daily quota check & increment ──
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from("ai_usage_daily")
      .select("count")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .eq("task", task)
      .maybeSingle();

    const used = usage?.count || 0;
    if (used >= limit) {
      return json({ error: `وصلت للحد اليومي لهذه الميزة (${limit}). حاول غداً.`, limit, used }, 429);
    }

    // ── Run the task ──
    let result: unknown;

    if (task === "chat") {
      const prompt = String(body.prompt || "").slice(0, 4000);
      if (!prompt.trim()) return json({ error: "النص مطلوب" }, 400);
      const system = "أنت مساعد قانوني خبير في القانون العربي والمصري. أجب بدقة وإيجاز باللغة العربية الفصحى، مع تنبيه أن إجابتك إرشادية ولا تُغني عن الاستشارة القانونية الرسمية.";
      const hfRes = await callHF(HF_MODELS.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: `<s>[INST] ${system}\n\nالسؤال: ${prompt} [/INST]`,
          parameters: { max_new_tokens: 700, temperature: 0.3, return_full_text: false },
        }),
      });
      const data = await hfRes.json();
      result = { text: Array.isArray(data) ? (data[0]?.generated_text ?? "") : (data.generated_text ?? "") };
    } else if (task === "summarize") {
      const text = String(body.text || "").slice(0, 8000);
      if (!text.trim()) return json({ error: "النص مطلوب" }, 400);
      const hfRes = await callHF(HF_MODELS.summarize, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: text, parameters: { max_length: 220 } }),
      });
      const data = await hfRes.json();
      result = { text: Array.isArray(data) ? (data[0]?.summary_text ?? "") : (data.summary_text ?? "") };
    } else if (task === "asr") {
      if (!body.audio_base64) return json({ error: "الملف الصوتي مطلوب" }, 400);
      const bytes = b64ToBytes(body.audio_base64);
      const hfRes = await callHF(HF_MODELS.asr, {
        method: "POST",
        headers: { "Content-Type": body.content_type || "audio/webm" },
        body: bytes,
      });
      const data = await hfRes.json();
      result = { text: data.text ?? "" };
    } else if (task === "ocr") {
      if (!body.image_base64) return json({ error: "الصورة مطلوبة" }, 400);
      const bytes = b64ToBytes(body.image_base64);
      const hfRes = await callHF(HF_MODELS.ocr, {
        method: "POST",
        headers: { "Content-Type": body.content_type || "image/png" },
        body: bytes,
      });
      const data = await hfRes.json();
      result = { text: Array.isArray(data) ? (data[0]?.generated_text ?? "") : (data.generated_text ?? "") };
    }

    // Increment usage only after a successful call.
    await admin.from("ai_usage_daily").upsert(
      { user_id: user.id, usage_date: today, task, count: used + 1 },
      { onConflict: "user_id,usage_date,task" },
    );

    return json({ success: true, ...(result as object), used: used + 1, limit });
  } catch (e) {
    return json({ error: (e as Error).message || "خطأ غير متوقع" }, 500);
  }
});
