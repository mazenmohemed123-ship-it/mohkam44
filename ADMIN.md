# توثيق الـ Routing وصلاحيات الـ Admin

هذا المستند يوضح آلية عمل توجيه المسارات (Routing) بناءً على الأدوار (Roles) في النظام الحالي، والإجابة على الأسئلة المطروحة.

---

## 1. الأدوار التي يتم توجيهها (Roles Routed)

في ملف `RoleContext.tsx` يتم تعريف الأدوار الخاصة بالملف الشخصي للمستخدم (`Profile`) كالتالي:
- **أدوار شركة المحاماة (`FirmRole`):** `'owner' | 'partner' | 'lawyer' | 'assistant' | 'secretary' | 'accountant'`
- **دور العميل:** `'client'`

أما في ملف `App.tsx` (السطور 282-289)، يتم توجيه المستخدمين بعد تسجيل الدخول كالتالي:
1. **العميل (`role === 'client'`):** يتم توجيهه إلى بوابة العميل (`<ClientPortal />`).
2. **أدوار المحامين والموظفين (أي دور آخر غير `client`):** يتم توجيههم تلقائياً إلى بوابة المحامي (`<LawyerPortal />`).

---

## 2. مسار وحالة دور المسؤول (`role === 'admin'`)

### أين يذهب المستخدم لو كان الـ `role = 'admin'` حالياً؟
إذا كانت قيمة الـ `role` في جدول الـ Profiles في قاعدة البيانات تساوي `'admin'`:
- **سيتم توجيهه إلى بوابة المحامي (`<LawyerPortal />`).**
  
**لماذا؟**
لأن الشرط المكتوب في `App.tsx` هو شرط ثنائي بسيط:
```typescript
{profile.role === 'client' ? (
  <ClientPortal user={user} profile={profile} onLogout={logout} ... />
) : (
  <LawyerPortal user={user} profile={profile} onLogout={logout} />
)}
```
بما أن `'admin'` لا تساوي `'client'`، فإن التطبيق سيعتبره محامياً أو موظفاً ويوجهه إلى بوابة المحامي (`<LawyerPortal />`).

---

## 3. كيف يتم توجيه المسؤول (Admin) الفعلي في النظام؟

النظام لا يستخدم حقل الـ `role = 'admin'` للتحقق من هوية مسؤول لوحة التحكم (Admin Control Center). بدلاً من ذلك، تعتمد العملية على الآتي:

1. **المسار الخاص (Route-based):**
   لوحة التحكم مخصصة للمسار المباشر `/admin-control-center` المعرف بالثابت `ADMIN_ROUTE = '/admin-control-center'` في `App.tsx`.
   
2. **التحقق من البريد الإلكتروني (Email-based Auth):**
   داخل مكون لوحة التحكم `AdminControlCenter.tsx` (السطر 51)، يتم التحقق من البريد الإلكتروني للمستخدم المسجل حصرياً كالتالي:
   ```typescript
   /* Access control: Mazen only */
   const isAuthorized = user?.email === 'mazen@mazen.engineer';
   ```
   - إذا كان البريد الإلكتروني هو `mazen@mazen.engineer` يتم السماح له بالدخول.
   - إذا كان أي بريد إلكتروني آخر (حتى لو كان له دور آخر)، يتم إظهار شاشة **Access Denied (تم رفض الوصول)**.
