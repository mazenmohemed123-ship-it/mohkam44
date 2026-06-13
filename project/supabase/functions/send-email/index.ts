import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, type } = await req.json();

    // templates
    const templates: Record<string, { subject: string; html: string }> = {
      welcome: {
        subject: 'مرحباً بك في محكَم',
        html: `
          <div dir="rtl" style="font-family: Arial; padding: 20px;">
            <h2>مرحباً بك في منصة محكَم ⚖️</h2>
            <p>تم إنشاء حسابك بنجاح.</p>
            <p>يمكنك الآن إدارة قضاياك ومواعيدك من مكان واحد.</p>
          </div>
        `,
      },
      appointment_reminder: {
        subject: 'تذكير بموعد قادم',
        html: `
          <div dir="rtl" style="font-family: Arial; padding: 20px;">
            <h2>تذكير بموعد ⏰</h2>
            <p>لديك موعد قادم في منصة محكَم.</p>
          </div>
        `,
      },
      tier_upgrade: {
        subject: 'تم ترقية باقتك في محكَم ⭐',
        html: `
          <div dir="rtl" style="font-family: Arial; 
               padding: 20px; background: #f9f9f9;">
            <h2 style="color: #2563eb;">مبروك! تم تفعيل باقتك ⭐</h2>
            <p>تم ترقية حسابك في منصة <strong>محكَم</strong>.</p>
            <br/>
            <a href="https://mohkam.app"
               style="background: #2563eb; color: white;
                      padding: 10px 20px; border-radius: 5px;
                      text-decoration: none;">
              افتح التطبيق
            </a>
          </div>
        `,
      },
    };

    const emailContent = type && templates[type] 
      ? templates[type] 
      : { subject, html };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'محكَم <noreply@mohkam.app>',
        to,
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    return new Response(
      JSON.stringify({ sent: res.ok }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
