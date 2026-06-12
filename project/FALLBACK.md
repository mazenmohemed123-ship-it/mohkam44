```typescript
    localStorage.setItem('mohkam_device_fp', fingerprint);
    document.cookie = `mohkam_client=1; path=/; max-age=31536000; samesite=strict`;

    let realUserId: string;

    // Try Supabase Anonymous Auth first
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Auth failed');
      }
      realUserId = authData.user.id;
    } catch (err: any) {
      console.error('Supabase anonymous auth failed:', err);
      setError('فشلت عملية المصادقة الآمنة. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
      setLoading(false);
      return;
    }

    const clientName = cases[0]?.client_name || 'موكل ' + phoneNumber.slice(-4);

    // Store session in localStorage for persistence
    const session: ClientSession = {
      userId: realUserId,
      phoneNumber,
      linkedLawyerId,
      clientName,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
```
