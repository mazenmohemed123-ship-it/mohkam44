# TEAM_ERROR.md

## 1. السطور من 100 لـ 130 من دالة handleAddStaff (التي تقوم بإضافة عضو فريق) في [TeamManagement.tsx](file:///c:/Users/SMTK/Desktop/bolt/project/src/components/team/TeamManagement.tsx)

```typescript
        email: addEmail,
        password: addPassword,
      });

      if (authError) {
        // Fallback: if signup fails, try admin create or skip
        push('خطأ في إنشاء حساب: ' + authError.message, 'danger');
        setSaving(false);
        return;
      }

      if (authData.user) {
        const newUserId = authData.user.id;
        const profile: Record<string, any> = {
          id: newUserId,
          full_name: sanitize(addName),
          role: addRole,
          phone_number: addPhone || null,
          tier: 'team',
          master_lawyer_id: masterLawyerId,
          can_view_billing: false,
          can_manage_appointments: addRole === 'secretary',
          can_edit_documents: addRole === 'assistant' || addRole === 'lawyer',
          can_reply_client_chats: addRole !== 'accountant',
          is_emergency_enabled: false,
        };

        const { error: profileError } = await supabase.from('profiles').insert([profile]);
        if (profileError) {
          push('خطأ في إنشاء الملف الشخصي', 'danger');
        } else {
```

---

## 2. الـ payload الذي يتم إرساله إلى Supabase بالضبط
عند محاولة إدراج سجل في جدول `profiles` باستخدام `supabase.from('profiles').insert([profile])` بعد تسجيل المستخدم بنجاح في نظام المصادقة (Auth)، يتم إرسال الـ payload بالتنسيق التالي:

```json
{
  "id": "181d87db-8f10-4c34-bacf-e596cf2e6dfc",
  "full_name": "Staff Assistant",
  "role": "assistant",
  "phone_number": "+205555xxxx",
  "tier": "team",
  "master_lawyer_id": "2d33e89c-fc20-4767-9df9-dbac85ba3bd9",
  "can_view_billing": false,
  "can_manage_appointments": false,
  "can_edit_documents": true,
  "can_reply_client_chats": true,
  "is_emergency_enabled": false
}
```

---

## 3. الـ error الذي يعود من Supabase
الخطأ الذي يعود من Supabase عند تنفيذ عملية الـ `insert`:

```json
{
  "code": "23505",
  "details": null,
  "hint": null,
  "message": "duplicate key value violates unique constraint \"profiles_pkey\""
}
```

### سبب حدوث الخطأ:
عندما يقوم النظام بإنشاء حساب المصادقة لعضو الفريق عبر دالة `supabase.auth.signUp` في الخطوة الأولى، يتم إطلاق trigger مباشر في قاعدة بيانات Supabase (وهو `handle_new_user`) والذي يقوم تلقائيًا وبشكل فوري بإدراج صف جديد بالـ `id` الخاص بالمستخدم المنشأ حديثًا داخل جدول `profiles`.

وعندما يحاول الكود في المتصفح تنفيذ عملية إدراج (`insert`) لنفس المعرّف `id` مجددًا، تفشل العملية مباشرة بسبب وجود السجل مسبقًا، مما ينتج عنه خطأ تعارض المفتاح الأساسي `23505` وظهور رسالة للمستخدم في الواجهة: **"خطأ في إنشاء الملف الشخصي"**.
