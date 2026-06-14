# CHAT_DEBUG.md

## 1. في ClientPortal.tsx:
البحث عن كلمة "insert" في messages (سواء كإدراج أو اشتراك في حدث INSERT):

### أ) كود إدراج الرسالة في قاعدة البيانات (الأسطر 921 - 935):
```typescript
    setInput('');

    // لما تبعت رسالة — متضيفش للـ state يدوياً
    // سيب الـ Realtime subscription هو اللي يضيفها
    const { error: insertErr } = await supabase.from('messages').insert([{
      case_id: selectedCase.id,
      sender_id: user.id,
      sender_role: 'client',
      message_text: sanitize(txt) || (attachment ? '📎 مرفق' : ''),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      room_type: 'client_chat',
    }]);
```

### ب) الاشتراك في حدث INSERT للرسائل (الأسطر 700 - 710):
```typescript
  useEffect(() => {
    if (!selectedCase) return;

    const channel = supabase
      .channel(`messages-${selectedCase.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `case_id=eq.${selectedCase.id}` }, (payload) => {
        const msg = payload.new as any;
        // Ignore internal team chat — client should not see it
        if (msg.room_type === 'internal_team_chat') return;
        // Detect system messages (emergency alerts)
        const isSystemMessage = msg.message_text?.startsWith('【') || msg.sender_role === 'system';
```

---

## 2. في RealtimeChat.tsx:
البحث عن كلمة "channel" أو "subscribe" والأسطر المحيطة بها:

### أ) الاشتراك بـ channel (الأسطر 184 - 190):
```typescript
    chRef.current?.unsubscribe();
    chRef.current = supabase
      .channel('msgs:' + selectedCase.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `case_id=eq.${selectedCase.id}`,
```

### ب) استخدام subscribe و unsubscribe (الأسطر 203 - 209):
```typescript
      }, (payload) => {
        setMsgs((prev) => prev.map((m) => m.id === payload.new.id ? (payload.new as Message) : m));
      })
      .subscribe();

    return () => { chRef.current?.unsubscribe(); };
  }, [selectedCase]);
```

---

## 3. تشغيل استعلام Supabase SQL Editor:
```sql
SELECT id, case_id, sender_id, 
       message_text, room_type, created_at
FROM messages
ORDER BY created_at DESC
LIMIT 5;
```

> [!WARNING]
> **ملاحظة فنية بخصوص الاتصال بقاعدة البيانات:**
> تعذر الاتصال المباشر بقاعدة البيانات البعيدة (Remote Database) لتشغيل الاستعلام برمجياً نظراً لعدم توفر كلمة مرور الـ Postgres (Database Password) في ملفات البيئة المحلية (`.env`) أو صلاحيات تسجيل الدخول لـ Supabase CLI في بيئة العمل الحالية. 
> بالإضافة إلى أن الاتصال عن طريق الـ `anon` key العادي يخضع لسياسات أمان Row Level Security (RLS) ويظهر النتائج فارغة `[]` بدون مصادقة مستخدم مخول.
> 
> **يرجى تشغيل الاستعلام مباشرة داخل Supabase Dashboard SQL Editor** لعرض أحدث 5 رسائل بأمان وصلاحيات كاملة.
