# CHAT_ERROR.md

## 1. اسم الدالة بالضبط
`ensureGeneralChatCase`

## 2. السطور من 1 لـ 30 من الدالة
```typescript
  const ensureGeneralChatCase = async () => {
    const lawyerId = urlLawyerId || profile?.linked_lawyer_id;
    if (!lawyerId) return null;

    const existing = aggregatedCases.find(
      (c) => c.lawyer_id === lawyerId && c.case_number === 'GENERAL-CHAT'
    );
    if (existing) {
      setSelectedCase(existing);
      return existing;
    }

    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .eq('case_number', 'GENERAL-CHAT')
        .eq('client_id', user.id)
        .limit(1);

      if (!error && data && data.length > 0) {
        const c = data[0];
        setSelectedCase(c);
        setAggregatedCases((prev) => prev.some(ac => ac.id === c.id) ? prev : [c, ...prev]);
        return c;
      }

      const { data: newCase } = await supabase
        .from('cases')
```

## 3. الخطأ الذي يظهر في الكونسول بالضبط وقت ما الخطأ يظهر
عند حدوث استثناء (Exception) أو خطأ في الاتصال بقاعدة البيانات أو أثناء تنفيذ العملية داخل كتلة `try`، يتم التقاط الخطأ في كتلة `catch (e)` وتتم طباعة الخطأ في الكونسول (Console) كالتالي:

```javascript
Error in ensureGeneralChatCase: [تفاصيل الخطأ / Error Object]
```

بالإضافة إلى ذلك، عند فشل الدالة وإرجاعها `null`، تظهر التنبيهات التالية في واجهة المستخدم (UI) بناءً على الإجراء المتبع:
- في حال بدء محادثة مع موظف المكتب:
  `⚠️ خطأ في تهيئة المحادثة مع موظف المكتب`
- في حال بدء محادثة مع المحامي:
  `⚠️ خطأ في تهيئة المحادثة مع المحامي`
