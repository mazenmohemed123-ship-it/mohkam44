# إعداد مشروع Supabase جديد في دقائق (بدون ما يضيع أي شيء)

اتبع الخطوات بالترتيب. الإجمالي ~10 دقائق.

## 1) أنشئ المشروع
- ادخل https://supabase.com/dashboard → **New project** → اختر اسم وكلمة مرور قاعدة بيانات (احفظها).

## 2) ابنِ قاعدة البيانات (ثوانٍ)
- من القائمة: **SQL Editor → New query**.
- افتح ملف `project/supabase/setup.sql` من الريبو، انسخ **كل محتواه**، الصقه، واضغط **Run**.
- ده بيعمل كل الجداول والفهارس والدوال والتريجرز وسياسات الأمان (RLS) و Realtime و buckets التخزين دفعة واحدة.

## 3) فعّل الدخول المجهول (مهم جداً للموكلين)
- **Authentication → Sign In / Providers → Anonymous sign-ins → Enable**.
- (اختياري للأمان) **Authentication → Policies/Settings → Leaked password protection → Enable**.

## 4) املأ مفاتيح الموقع على Vercel
- في Supabase: **Project Settings → API**، انسخ:
  - `Project URL` و `anon public key`.
- في Vercel (Project → Settings → Environment Variables) عدّل/ضع:
  - `VITE_SUPABASE_URL` = الـ Project URL
  - `VITE_SUPABASE_ANON_KEY` = الـ anon key
  - (لو مفعّل) متغيرات `VITE_FIREBASE_*` و `VITE_FIREBASE_VAPID_KEY` و `VITE_PAYMOB_IFRAME_ID`.
- اعمل **Redeploy** للموقع.

## 5) انشر الـ Edge Functions (مرة واحدة)
الدوال موجودة في `project/supabase/functions`. أسهل طريقة عبر Supabase CLI:
```bash
npm i -g supabase
supabase login
supabase link --project-ref <ref-المشروع-الجديد>
supabase functions deploy ai-tools
supabase functions deploy send-notification
supabase functions deploy paymob-webhook
supabase functions deploy create-checkout-session
supabase functions deploy auto-renew-check
supabase functions deploy send-email
```

## 6) اضبط الأسرار (Secrets) للـ Edge Functions
**Project Settings → Edge Functions → Secrets** (أو `supabase secrets set KEY=VALUE`):
- `HF_TOKEN` = توكن Hugging Face مجاني (من huggingface.co/settings/tokens) — لتشغيل الذكاء الاصطناعي.
- `FCM_SERVICE_ACCOUNT` = ملف خدمة Firebase JSON (سطر واحد) — للإشعارات.
- `PAYMOB_API_KEY` / `PAYMOB_HMAC_SECRET` / `PAYMOB_INTEGRATION_ID` / `PAYMOB_IFRAME_ID` — للدفع.
> ملاحظة: `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` و `SUPABASE_ANON_KEY` بيوفرهم Supabase تلقائياً للدوال.

## 7) فعّل ربط الويبهوك (الدفع)
- في لوحة Paymob حُط رابط الـ webhook على دالة:
  `https://<ref>.functions.supabase.co/paymob-webhook`

## 8) اعمل نفسك Admin
- سجّل دخول في الموقع كمحامي بإيميل الأدمن (`mazenmohemed123@gmail.com`).
- ارجع لـ **SQL Editor** ونفّذ:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'mazenmohemed123@gmail.com');
```
- بعدها ادخل صفحة الأدمن من: `https://<دومين-موقعك>/admin-control-center`.

## ملاحظات
- الكود نفسه ما بيتغيّرش — بس متغيرات Supabase (URL/anon key). أي مشروع جديد يشتغل فوراً بعد الخطوات دي.
- لو الـ `HF_TOKEN` مش متظبط، مزايا الذكاء الاصطناعي بترجّع رسالة "الخدمة غير مفعّلة" — مش هتكسر الموقع.
- buckets التخزين (`documents` و `chat-attachments`) بيتعملوا تلقائياً من `setup.sql`.
