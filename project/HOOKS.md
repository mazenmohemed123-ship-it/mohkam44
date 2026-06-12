# HOOKS.md

## 1. نتيجة تشغيل الأمر (Grep Command Output)
```text
1:import { useState, useEffect, useRef } from 'react';
346:  const [currentScreen, setCurrentScreen] = useState<'hub' | 'live_chat'>('hub');
348:  const [lawyerInfo, setLawyerInfo] = useState<any>(null);
349:  const [lawyerProfile, setLawyerProfile] = useState<Profile | null>(null);
350:  const [botMsgs, setBotMsgs] = useState<ChatMsg[]>([]);
351:  const [humanMsgs, setHumanMsgs] = useState<ChatMsg[]>([]);
353:  const [input, setInput] = useState('');
354:  const [aggregatedCases, setAggregatedCases] = useState<CaseInfo[]>([]);
355:  const [selectedCase, setSelectedCase] = useState<CaseInfo | null>(null);
356:  const [showEmg, setShowEmg] = useState(false);
357:  const [emgText, setEmgText] = useState('');
358:  const [emgSent, setEmgSent] = useState(false);
359:  const [emgEnabled, setEmgEnabled] = useState(true);
362:  const [showChatDropdown, setShowChatDropdown] = useState(false);
363:  const [activeChatTarget, setActiveChatTarget] = useState<string>('bot');
364:  const [activeChatLabel, setActiveChatLabel] = useState<string>('المساعد الذكي');
367:  const [selectedDay, setSelectedDay] = useState<string>('');
368:  const [selectedSlot, setSelectedSlot] = useState<string>('');
369:  const [apptSubmitted, setApptSubmitted] = useState(false);
372:  const [showPayment, setShowPayment] = useState(false);
373:  const [selectedChannel, setSelectedChannel] = useState<string>('');
374:  const [paymentProcessing, setPaymentProcessing] = useState(false);
375:  const [paymentDone] = useState(false);
378:  const [availableDays, setAvailableDays] = useState<string[]>([]);
379:  const [workHours, setWorkHours] = useState<{ from: string; to: string }>({ from: '09:00', to: '17:00' });
380:  const [lawyerPaymentInfo, setLawyerPaymentInfo] = useState<{
394:  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
395:  const teamMembersRef = useRef(teamMembers);
396:  useEffect(() => { teamMembersRef.current = teamMembers; }, [teamMembers]);
399:  const [reconnectTrigger, setReconnectTrigger] = useState(0);
400:  useEffect(() => {
407:  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
410:  const [appointmentStatus, setAppointmentStatus] = useState<AppointmentRequest | null>(null);
411:  const [showAppointmentStatus, setShowAppointmentStatus] = useState(false);
414:  const [sheetOpen, setSheetOpen] = useState(false);
415:  const sheetRef = useRef<HTMLDivElement>(null);
417:  const chatDropdownRef = useRef<HTMLDivElement>(null);
418:  const endRef = useRef<HTMLDivElement>(null);
419:  const fileInputRef = useRef<HTMLInputElement>(null);
505:  useEffect(() => {
516:  useEffect(() => {
652:  useEffect(() => {
665:  useEffect(() => {
717:  useEffect(() => {
762:  useEffect(() => {
782:  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [botMsgs, humanMsgs]);
```

## 2. تفاصيل السطر 544 في `ClientPortal.tsx`
* **المكتوب في السطر 544 بالضبط:**
  ```typescript
      // Fetch lawyer availability days and work hours
  ```
* **السطور المحيطة بالسطر 544 (من 542 إلى 546):**
  ```typescript
  542:       });
  543: 
  544:     // Fetch lawyer availability days and work hours
  545:     supabase.from('lawyer_availability')
  546:       .select('available_days, time_slots, notes')
  ```

## 3. تفاصيل `package.json` بخصوص React
* **إصدار (version) الـ `react`:**
  `^18.3.1`
* **إصدار (version) الـ `react-dom`:**
  `^18.3.1`
* **الحزم الأخرى التي تعتمد على `react` كـ `peerDependency`:**
  * الحزم المثبتة في المشروع التي تطلب `react` كـ `peerDependency` هي:
    1. **`react-dom`**: تعتمد على `react` بالإصدار `^18.3.1`
    2. **`lucide-react`**: تعتمد على `react` بالإصدار `^16.5.1 || ^17.0.0 || ^18.0.0`
