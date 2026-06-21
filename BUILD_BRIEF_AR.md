# مُحكَم — بريف بناء كامل لمنصة إدارة القضايا القانونية (من الصفر)

> **للذكاء الاصطناعي المنفّذ (Bolt / Lovable / Cursor / v0 / Claude / GPT):**
> اقرأ هذا الملف بالكامل ثم ابنِ التطبيق **من الصفر** كما هو موصوف. لا تختصر أي شاشة أو ميزة.
> في النهاية أخرِج **ملف SQL واحد** (`supabase_setup.sql`) يبني قاعدة البيانات كاملة على Supabase
> ليرفعه المالك على حسابه. اربط نظام الشات من ريبو **somni-chat** (الرابط في القسم 8).

---

## 0) ملخّص تنفيذي
- **الاسم:** مُحكَم (Mohkam) — منصة عربية (RTL) لإدارة القضايا والتواصل بين **المحامي ↔ الموكل** وبين **أعضاء المكتب**.
- **اللغة الأساسية:** العربية (اتجاه RTL)، مع دعم en/fr/tr في بوابة الموكل.
- **بدون أي إيموجيز إطلاقاً** في الواجهة — استخدم أيقونات `lucide-react` فقط. التصميم رسمي يليق بمحامٍ.
- **هوية بصرية:** كحلي `#0F2557` + ذهبي `#C8952A/#D4AF37`، خطوط Cairo/Tajawal، زوايا ناعمة، ظلال خفيفة.
- **PWA قوي** قابل للتثبيت كتطبيق.

## 1) التقنيات (Stack) والقيود
- **Frontend:** React 18 + TypeScript + Vite (SPA). Tailwind اختياري؛ المشروع الحالي يستخدم inline styles + متغيّرات CSS.
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage + Edge Functions).
- **الاستضافة:** Vercel (SPA) — لازم `vercel.json` فيه rewrites + security headers.
- **عميل Supabase واحد (singleton)** في كل المتصفح (ملف `src/services/supabase.ts`).
- **الدفع:** Paymob (Egypt) عبر Edge Functions + Webhook.
- **الإشعارات:** Firebase Cloud Messaging (FCM HTTP v1 عبر Service Account).
- **الذكاء الاصطناعي:** Hugging Face Inference عبر Edge Function (التوكن على السيرفر فقط + حدود يومية).
- **نظام الشات:** مكتبة **somni-chat** (القسم 8).

## 2) قواعد التصميم (إلزامية)
1. **ممنوع الإيموجيز نهائياً** — أي أيقونة = مكوّن من `lucide-react`.
2. RTL افتراضي، خط Cairo للنصوص و Tajawal للعناوين، JetBrains Mono للأرقام/الأكواد.
3. ألوان عبر متغيّرات CSS: `--navy, --gold, --bg, --border, --muted, --text, --danger, --success`.
4. لوحة الأدمن بثيم **داكن فخم** (كحلي غامق + ذهبي، بانلات زجاجية).
5. كل شاشة لازم تكون responsive وتشتغل ممتاز على الموبايل.

## 3) الأدوار والصلاحيات (RBAC) والباقات
**الأدوار (`profiles.role`):** `owner, partner, lawyer, assistant, secretary, accountant, client, admin`.
- المحامي الرئيسي = `owner`؛ الموظفون لهم `master_lawyer_id` يشير للـ owner.
- صلاحيات الموظفين أعمدة boolean: `can_view_billing, can_manage_appointments, can_edit_documents, can_reply_client_chats`.

**الباقات (`profiles.tier`):** `free | pro | team`:
- **free:** حتى 5 قضايا، تسجيل صوتي أساسي، شات، بوابة موكل. لا رفع ملفات في الشات.
- **pro:** قضايا غير محدودة، رفع صور/ملفات بحد يومي، إشعارات Push، فواتير، + أدوات AI (تلخيص/تفريغ صوتي/OCR).
- **team:** كل مزايا Pro + موظفون غير محدودين + **شات داخلي للفريق** + شات ثنائي بين الموظفين + رفع غير محدود + **المساعد القانوني الذكي (للمحامين فقط)** + لوحة تقارير.

**حدود الرفع اليومية:** free=50MB، pro=2GB، team=∞.

## 4) المصادقة والـ Onboarding (مهم جداً — هنا كانت أغلب الأخطاء)
### المحامي
- يسجّل/يدخل بإيميل وكلمة مرور (Supabase Auth). Trigger `handle_new_user` ينشئ صف `profiles` تلقائياً (role افتراضي lawyer).
### الموكل — **عبر "رابط المكتب" فقط**
- **الشاشة الرئيسية (RoleGate) تعرض زر واحد: "دخول المحامي" فقط.** الموكل لا يسجّل من الشاشة الرئيسية.
- المحامي عنده **رابط واحد ثابت** اسمه **"رابط المكتب"**: `/{origin}/portal/lawyer/{lawyerId}` يرسله للموكل. (احذف أي روابط دعوة/فواتير أخرى — رابط واحد فقط.)
- الموكل يفتح الرابط → يدخل **رقم تليفونه** → الدخول مسموح **فقط** لو الرقم مسجّل في قضية تابعة لهذا المكتب (كرقم أساسي `client_phone` أو ضمن `follower_phones`). غير كده يُرفض برسالة "رقمك غير مسجّل، تواصل مع المكتب".
- يتم التحقق عبر دالة `check_office_access(p_lawyer_id, p_phone)` (SECURITY DEFINER، متاحة لـ anon لأن الزائر لسه مش مسجّل) ثم **Supabase Anonymous sign-in** وإنشاء/ربط `GENERAL-CHAT` الخاص به.
- **المحامي يقدر يضيف حتى 10 أرقام (`follower_phones`) لكل قضية** (لو ناس كتير بيتابعوا نفس القضية) من زر "متابعو القضية" في جدول القضايا.
> **تنبيه:** فعّل **Anonymous sign-ins** في إعدادات Supabase Auth، وإلا لن يدخل أي موكل.

### الأدمن
- يُعرَّف بإيميل ضمن allowlist (مثال `mazenmohemed123@gmail.com`) + `profiles.role='admin'`.
- يدخل عبر مسار خاص `/admin-control-center` بعد تسجيل الدخول.

## 5) الشاشات والمزايا بالتفصيل

### أ) بوابة المحامي (LawyerPortal) — تبويبات:
1. **القضايا (Cases):** جدول قابل للتعديل المباشر (double-click على الخلية)، أعمدة قابلة للإضافة/الحذف، أعمدة افتراضية: رقم القضية، اسم الموكل، الهاتف، نوع القضية، الحكم، الأتعاب، المصاريف. أزرار لكل صف: **متابعو القضية** (مودال فيه رابط المكتب + إدارة حتى 10 أرقام)، **أرشفة**، **حذف** (Pro/Team). كل الأزرار أيقونات lucide.
2. **التسجيل الصوتي (Voice):** نافذة لإضافة/تحديث قضية بالكلام (Web Speech API) أو بالكتابة، مع تحليل النص لاستخراج الحقول. + زر **"تفريغ صوتي بالذكاء (Whisper)"** يرفع ملف صوتي ويحوّله نص (Pro/Team).
3. **الشات مع الموكلين:** قائمة قضايا + غرفة شات (انظر القسم 8 — somni-chat).
4. **شات الفريق (Team):** تبويب "المجموعة" (شات داخلي سري لكل المكتب) + شات ثنائي مع كل عضو (Team فقط).
5. **المستندات (Vault):** رفع/تنزيل/حذف ملفات لكل قضية، حد يومي حسب الباقة، + زر **OCR** على الصور (Pro/Team).
6. **المواعيد/التايملاين:** استقبال طلبات المواعيد من الموكلين لحظياً (صوت تنبيه). **عند قبول/رفض الموعد لازم يتسجّل أثر دائم:** تحديث الحالة + **رسالة نظام في شات القضية** + **حدث في `case_events`** (عشان ما يختفيش). يجب أن يستطيع الموظفون (السكرتير) الرد أيضاً.
7. **التوافر (Availability):** أيام/ساعات عمل المحامي (`lawyer_availability`).
8. **الفوترة/بيانات الدفع:** أرقام فودافون كاش/إنستاباي/حساب بنكي + صورة QR.
9. **الإعدادات:** الاسم/الصورة/البايو/اللغة/العملة + **رابط المكتب** + تفعيل الإشعارات (FCM) + استقبال الطوارئ.
10. **إدارة الفريق (Team):** إضافة موظفين بأدوار وصلاحيات (Team).
11. **المساعد الذكي (زر عائم):** تلخيص (Pro/Team) + مساعد قانوني (Team + محامي فقط) — القسم 10.
12. **بانر الإعلانات:** يعرض أحدث إعلان من الأدمن.

### ب) بوابة الموكل (ClientPortal):
- **بطاقة المحامي** (اسم/صورة/اتصال).
- **المساعد الآلي (Bot):** شات محلي 100% بدون قاعدة بيانات (يجيب على أسئلة عامة: رقم القضية، المواعيد، الطوارئ). **اتركه كما هو — بدون إيموجيز.**
- **الشات البشري** مع المحامي/الفريق (somni-chat).
- **زر الطوارئ:** يرسل تنبيه عاجل عالي الوضوح في الشات + إشعار للمحامي.
- **حجز موعد:** اختيار يوم/وقت → طلب موعد (مع رسالة لطيفة لو الموعد محجوز بدل خطأ خام). يستقبل رد القبول/الرفض لحظياً.
- **الدفع:** فودافون كاش (USSD)، إنستاباي (deep link)، تحويل بنكي (نسخ IBAN)، وبطاقة عبر Paymob.
- **بانر الإعلانات**.

### ج) لوحة الأدمن (AdminControlCenter) — ثيم داكن فخم:
- **إحصائيات:** الإيرادات، عدد كل باقة، إجمالي الديون.
- **إرسال إعلان (Broadcast):** عنوان + نص + جمهور (كل المستخدمين / المحامون فقط) عبر دالة `post_announcement` (تتحقق من إيميل الأدمن).
- **العمولة العامة + لكل محامٍ.**
- **الكوبونات:** إنشاء/حذف (كود، نسبة، عدد استخدامات، انتهاء، باقة مستهدفة).
- **إدارة المحامين:** بحث/تصفية، **تجميد/فك تجميد**، **ترقية الباقة لمدة أيام**، عرض الدين.

## 6) الأمان (إلزامي)
- **RLS مفعّل على كل الجداول** بسياسات دقيقة (انظر ملف الـ SQL النهائي).
- الموكلون يستخدمون **anonymous auth** (دور `authenticated`) — السياسات يجب أن تسمح لهم بالوصول لبياناتهم فقط (قضاياهم/رسائلهم).
- **دوال التريجر الداخلية** (`handle_new_user, create_default_client_case, link_*`) يجب **سحب EXECUTE** منها من `PUBLIC/anon/authenticated` (تعمل كـ triggers فقط، لا تُستدعى من الـ API).
- دوال SECURITY DEFINER العامة (receipts, check_office_access, post_announcement) بـ `SET search_path` ثابت.
- **Security Headers في `vercel.json`** كـ HTTP headers حقيقية:
  `Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy, Strict-Transport-Security`.
- فعّل **Leaked Password Protection** في Supabase Auth.

## 7) نموذج البيانات (المرجع الكامل)
الـ schema الكامل لمُحكَم موجود جاهز في الريبو: **`project/supabase/setup.sql`** (جداول، فهارس، قيود، دوال، triggers، RLS، realtime، buckets). الجداول الأساسية:
`profiles, cases (+follower_phones[]), case_events, case_emergencies, appointment_requests, documents, lawyer_availability, memberships, payments, coupons, ai_usage_daily, announcements`.
> **لاحظ:** جدولا `messages` و`message_attachments` الحاليان **سيُستبدلان** بنظام شات somni-chat (القسم 8). أبقِ باقي الجداول كما هي.

## 8) ربط نظام الشات — somni-chat (إلزامي)
**الريبو:** https://github.com/mazenmohemed123-ship-it/somni-chat
نظام شات احترافي framework-agnostic فيه: محرّك أساسي (`chat-core`)، **Supabase adapter** + migration SQL، hooks لـ React (`useMessages, useConversations, useSendMessage, useTyping, usePresence`)، مكوّنات UI، إشعارات، مكالمات.

**خطوات الربط:**
1. ثبّت حزم somni-chat واستخدم **SupabaseAdapter** (يتكامل مع Supabase Auth ويقرأ `userId` من الجلسة الحالية).
2. طبّق migration الـ schema بتاعه: `packages/chat-adapters/supabase/migrations/001_somni_chat_schema.sql` (جداول `conversations, participants, messages, attachments, reactions, presence`) — **أضِفه إلى ملف الـ SQL النهائي**.
3. **خريطة غرف مُحكَم على محادثات somni:**
   - شات الموكل↔المحامي = محادثة `direct` (participants: الموكل + المحامي/أعضاء المكتب). اربطها بالقضية عبر عمود إضافي `case_id` على `conversations` (أضِفه).
   - الشات الداخلي للفريق = محادثة `group` (كل أعضاء المكتب) — اربطها بالمكتب عبر `office_id` (= master_lawyer_id).
   - الشات الثنائي بين الموظفين = محادثة `direct` بين العضوين.
4. فعّل المزايا: **الإرسال المتفائل + Client-ID dedupe** (يمنع التكرار — مهم!)، **read receipts (sent/delivered/read)**، **typing indicators** (auto-clear بعد 3s)، **presence (online/offline)** في رأس المحادثة، **attachments** (صور/فيديو/PDF)، **soft-delete**.
5. استخدم **hooks/UI** بتاعت somni أو اربطها بمكوّن `ChatRoom` موحّد يُستخدم في بوابة المحامي والموكل وشات الفريق.
6. RLS على جداول somni: المشارك يرى محادثاته فقط؛ الإدراج لمن `sender_id = auth.uid()` وهو participant؛ الـ receipts عبر RPC آمن.
7. أضِف جداول somle الشات إلى **`supabase_realtime` publication** + فعّل Realtime.

> الهدف: شات لحظي **بدون تكرار رسائل، يعمل بين كل الأطراف**، مع علامات القراءة و"يكتب الآن" والحضور والمرفقات.

## 9) الدفع — Paymob (Edge Functions)
- `create-checkout-session`: ينشئ سجل `payments` (pending) ويرجّع **`url`** للـ checkout (sandbox = رابط داخل التطبيق؛ live = iframe Paymob). المبلغ يُرسل بالوحدة الأساسية والدالة تضربه ×100 (لا تضرب من الفرونت). العملة = عملة المستخدم المعروضة.
- `paymob-webhook`: يتحقق من HMAC، يحدّث `payments.status`، وعند النجاح: يرقّي الباقة (لو اشتراك) أو يسجّل دفعة قضية، ويزيد عدّاد الكوبون لو استُخدم.
- الفرونت يستخدم `data.url` (مش payment_key)، ويعرض iframe أو redirect.

## 10) الذكاء الاصطناعي — Hugging Face (Edge Function `ai-tools`)
- التوكن `HF_TOKEN` **على السيرفر فقط** (Supabase secret). **حدود يومية لكل مستخدم** عبر جدول `ai_usage_daily` لحماية التوكن.
- المهام: `chat` (مساعد قانوني — **Team + محامي فقط**)، `summarize` / `asr` (Whisper) / `ocr` — **Pro و Team**. free لا AI.
- نماذج مقترحة (مجانية على HF Inference): ASR=`openai/whisper-large-v3`، تلخيص عربي=`csebuetnlp/mT5_multilingual_XLSum`، مساعد=`mistralai/Mistral-7B-Instruct-v0.3`، OCR=`microsoft/trocr-large-printed`.
- في الواجهة: زر مساعد عائم + زر تفريغ في نافذة الصوت + زر OCR على الصور، مع تعريف المزايا داخل صفحة الباقات.

## 11) الإشعارات — FCM (Edge Function `send-notification`)
- استخدم **FCM HTTP v1** عبر **Service Account** (`FCM_SERVICE_ACCOUNT` كـ secret) — الـ legacy API توقّف.
- الفرونت: `firebaseMessaging` service يطلب التوكن ويخزّنه في `profiles.fcm_token` + `public/firebase-messaging-sw.js`. يعمل graceful لو غير مضبوط.

## 12) الـ Edge Functions المطلوبة
`ai-tools, send-notification, paymob-webhook, create-checkout-session, auto-renew-check, send-email`.

## 13) متغيّرات البيئة والأسرار
- **Vercel (Frontend):** `VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PAYMOB_IFRAME_ID, VITE_FIREBASE_* , VITE_FIREBASE_VAPID_KEY`.
- **Supabase Secrets (Functions):** `HF_TOKEN, FCM_SERVICE_ACCOUNT, PAYMOB_API_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID`.

## 14) PWA
- `manifest.json` كامل (id/scope/lang=ar/dir=rtl/display=standalone/أيقونات 192+512 maskable).
- Service worker للتخزين + `firebase-messaging-sw.js` للإشعارات.
- مكوّن `InstallPrompt` يلتقط `beforeinstallprompt` ويعرض زر "تثبيت التطبيق".

---

## ✅ المخرَج النهائي المطلوب (هام)
1. **مشروع كامل يعمل** (Vite/React) كما هو موصوف، يبني بنجاح (`npm run build`) بدون أخطاء.
2. **ملف SQL واحد** باسم `supabase_setup.sql` يحتوي على:
   - كامل schema مُحكَم (من `project/supabase/setup.sql`) **مع حذف** جدولَي `messages`/`message_attachments` القديمين،
   - **+ schema نظام somni-chat** (conversations/participants/messages/attachments/reactions/presence) مع أعمدة الربط `case_id`/`office_id`،
   - كل الـ RLS، الفهارس، الدوال، الـ triggers، الـ grants، الـ realtime publication، وbuckets التخزين (`documents`, `chat-attachments`).
   - يعمل بتشغيله مرة واحدة في **Supabase → SQL Editor** على مشروع جديد فارغ.
3. **README قصير** بخطوات التشغيل: شغّل SQL، فعّل Anonymous sign-ins، انشر Edge Functions، اضبط الأسرار، حُط `VITE_SUPABASE_URL/ANON_KEY` على Vercel، اعمل نفسك admin.

> **معايير القبول:** الشات يعمل لحظياً بين كل الأطراف **بدون تكرار**؛ الموكل يدخل عبر رابط المكتب فقط ولو رقمه مسجّل؛ المواعيد لا تختفي عند القبول/الرفض؛ لا إيموجيز في الواجهة؛ الدفع يبدأ فعلياً؛ AI يعمل عند ضبط `HF_TOKEN`؛ التطبيق قابل للتثبيت كـ PWA.
