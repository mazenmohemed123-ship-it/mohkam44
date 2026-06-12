# HOOKS2.md

## 1. السطور من 289 لـ 420 كاملة بالظبط في `ClientPortal.tsx`
```typescript
289:     emergencySent: '🆘 Acil durum uyarısı avukata başarıyla iletildi',
290:     emergencyError: 'Acil durum uyarısı gönderilemedi',
291:   }
292: };
293: 
294: function getNextWeekdayDate(dayId: string): string {
295:   const dayIndexMap: Record<string, number> = {
296:     sunday: 0,
297:     monday: 1,
298:     tuesday: 2,
299:     wednesday: 3,
300:     thursday: 4,
301:     friday: 5,
302:     saturday: 6,
303:   };
304:   const targetDay = dayIndexMap[dayId];
305:   if (targetDay === undefined) return dayId;
306: 
307:   const resultDate = new Date();
308:   const currentDay = resultDate.getDay();
309:   const steps = (targetDay - currentDay + 7) % 7;
310:   resultDate.setDate(resultDate.getDate() + steps);
311: 
312:   const yyyy = resultDate.getFullYear();
313:   const mm = String(resultDate.getMonth() + 1).padStart(2, '0');
314:   const dd = String(resultDate.getDate()).padStart(2, '0');
315:   return `${yyyy}-${mm}-${dd}`;
316: }
317: 
318: function getInitialBotGreeting(lawyerName: string, lang: string): string {
319:   if (lang === 'en') return `Hello! 😊 I am Mr. ${lawyerName}'s assistant. How can I help you today?`;
320:   if (lang === 'fr') return `Bonjour ! 😊 Je suis l'assistant de Me ${lawyerName}. Comment puis-je vous aider ?`;
321:   if (lang === 'tr') return `Merhaba! 😊 Ben Avukat ${lawyerName}'in asistanıyım. Bugün size nasıl yardımcı olabilirim?`;
322:   return `مرحباً، أنا مساعد الأستاذ ${lawyerName}. كيف أقدر أساعدك؟`;
323: }
324: 
325: const getDayLabel = (dayId: string, lang: string) => {
326:   const labels: Record<string, Record<string, string>> = {
327:     saturday: { ar: 'السبت', en: 'Saturday', fr: 'Samedi', tr: 'Cumartesi' },
328:     sunday: { ar: 'الأحد', en: 'Sunday', fr: 'Dimanche', tr: 'Pazar' },
329:     monday: { ar: 'الاثنين', en: 'Monday', fr: 'Lundi', tr: 'Pazartesi' },
330:     tuesday: { ar: 'الثلاثاء', en: 'Tuesday', fr: 'Mardi', tr: 'Salı' },
331:     wednesday: { ar: 'الأربعاء', en: 'Wednesday', fr: 'Mercredi', tr: 'Çarşamba' },
332:     thursday: { ar: 'الخميس', en: 'Thursday', fr: 'Jeudi', tr: 'Perşembe' },
333:     friday: { ar: 'الجمعة', en: 'Friday', fr: 'Vendredi', tr: 'Cuma' },
334:   };
335:   return labels[dayId]?.[lang] || labels[dayId]?.ar;
336: };
337: 
338: 
339: export function ClientPortal({ user, profile, onLogout, urlLawyerId }: ClientPortalProps) {
340:   const { locale, setLocale, isRTL } = useLocale();
341:   const t = (key: keyof typeof TRANSLATIONS['ar']) => {
342:     return TRANSLATIONS[locale]?.[key] || TRANSLATIONS['ar'][key];
343:   };
344: 
345:   /* Full-screen mobile chat routing state */
346:   const [currentScreen, setCurrentScreen] = useState<'hub' | 'live_chat'>('hub');
347: 
348:   const [lawyerInfo, setLawyerInfo] = useState<any>(null);
349:   const [lawyerProfile, setLawyerProfile] = useState<Profile | null>(null);
350:   const [botMsgs, setBotMsgs] = useState<ChatMsg[]>([]);
351:   const [humanMsgs, setHumanMsgs] = useState<ChatMsg[]>([]);
352:   const { triggerEmergency } = useCase();
353:   const [input, setInput] = useState('');
354:   const [aggregatedCases, setAggregatedCases] = useState<CaseInfo[]>([]);
355:   const [selectedCase, setSelectedCase] = useState<CaseInfo | null>(null);
356:   const [showEmg, setShowEmg] = useState(false);
357:   const [emgText, setEmgText] = useState('');
358:   const [emgSent, setEmgSent] = useState(false);
359:   const [emgEnabled, setEmgEnabled] = useState(true);
360: 
361:   /* Chat dropdown state */
362:   const [showChatDropdown, setShowChatDropdown] = useState(false);
363:   const [activeChatTarget, setActiveChatTarget] = useState<string>('bot');
364:   const [activeChatLabel, setActiveChatLabel] = useState<string>('المساعد الذكي');
365: 
366:   /* Simplified appointment booking state */
367:   const [selectedDay, setSelectedDay] = useState<string>('');
368:   const [selectedSlot, setSelectedSlot] = useState<string>('');
369:   const [apptSubmitted, setApptSubmitted] = useState(false);
370: 
371:   /* Payment state - Paymob */
372:   const [showPayment, setShowPayment] = useState(false);
373:   const [selectedChannel, setSelectedChannel] = useState<string>('');
374:   const [paymentProcessing, setPaymentProcessing] = useState(false);
375:   const [paymentDone] = useState(false);
376: 
377:   /* Lawyer availability and payment credentials */
378:   const [availableDays, setAvailableDays] = useState<string[]>([]);
379:   const [workHours, setWorkHours] = useState<{ from: string; to: string }>({ from: '09:00', to: '17:00' });
380:   const [lawyerPaymentInfo, setLawyerPaymentInfo] = useState<{
381:     vodafone_cash_number?: string;
382:     instapay_address?: string;
383:     instapay_qr_url?: string;
384:     bank_account_details?: {
385:       iban?: string;
386:       bank_name?: string;
387:       account_holder?: string;
388:       account_number?: string;
389:       country?: string;
390:     };
391:   } | null>(null);
392: 
393:   /* Team members for Team plan */
394:   const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
395:   const teamMembersRef = useRef(teamMembers);
396:   useEffect(() => { teamMembersRef.current = teamMembers; }, [teamMembers]);
397: 
398:   /* Reconnect handler for offline-to-online restore */
399:   const [reconnectTrigger, setReconnectTrigger] = useState(0);
400:   useEffect(() => {
401:     const handleOnline = () => setReconnectTrigger(p => p + 1);
402:     window.addEventListener('online', handleOnline);
403:     return () => window.removeEventListener('online', handleOnline);
404:   }, []);
405: 
406:   /* Quota warning state */
407:   const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
408: 
409:   /* Appointment status tracking */
410:   const [appointmentStatus, setAppointmentStatus] = useState<AppointmentRequest | null>(null);
411:   const [showAppointmentStatus, setShowAppointmentStatus] = useState(false);
412: 
413:   /* Draggable bottom sheet state */
414:   const [sheetOpen, setSheetOpen] = useState(false);
415:   const sheetRef = useRef<HTMLDivElement>(null);
416: 
417:   const chatDropdownRef = useRef<HTMLDivElement>(null);
418:   const endRef = useRef<HTMLDivElement>(null);
419:   const fileInputRef = useRef<HTMLInputElement>(null);
420:   const { list: notifList, push } = useNotifications();
```

## 2. هل يوجد أي return أو if أو condition قبل السطر 400؟
* **خارج دالة المكون (من السطر 289 إلى 338):**
  نعم، توجد شروط `if` وعبارات `return` متعددة داخل الدوال المساعدة: `getNextWeekdayDate`, `getInitialBotGreeting`, `getDayLabel`.
* **داخل دالة المكون `ClientPortal` (من السطر 339 إلى السطر 399):**
  * لا توجد أي جملة شرطية `if` أو شروط (conditions) في المسار الرئيسي للمكون.
  * توجد عبارة `return` واحدة فقط داخل الدالة الفرعية المساعدة `t` في السطر 342:
    `return TRANSLATIONS[locale]?.[key] || TRANSLATIONS['ar'][key];`

## 3. السطور من 396 لـ 420 كاملة
```typescript
396:   useEffect(() => { teamMembersRef.current = teamMembers; }, [teamMembers]);
397: 
398:   /* Reconnect handler for offline-to-online restore */
399:   const [reconnectTrigger, setReconnectTrigger] = useState(0);
400:   useEffect(() => {
401:     const handleOnline = () => setReconnectTrigger(p => p + 1);
402:     window.addEventListener('online', handleOnline);
403:     return () => window.removeEventListener('online', handleOnline);
404:   }, []);
405: 
406:   /* Quota warning state */
407:   const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
408: 
409:   /* Appointment status tracking */
410:   const [appointmentStatus, setAppointmentStatus] = useState<AppointmentRequest | null>(null);
411:   const [showAppointmentStatus, setShowAppointmentStatus] = useState(false);
412: 
413:   /* Draggable bottom sheet state */
414:   const [sheetOpen, setSheetOpen] = useState(false);
415:   const sheetRef = useRef<HTMLDivElement>(null);
416: 
417:   const chatDropdownRef = useRef<HTMLDivElement>(null);
418:   const endRef = useRef<HTMLDivElement>(null);
419:   const fileInputRef = useRef<HTMLInputElement>(null);
420:   const { list: notifList, push } = useNotifications();
```
