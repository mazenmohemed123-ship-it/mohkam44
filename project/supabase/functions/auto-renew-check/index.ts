import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data: expiredLawyers } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, fcm_token, expires_at')
      .lt('expires_at', new Date().toISOString())
      .eq('is_auto_renew_enabled', false)
      .in('role', ['lawyer', 'owner', 'partner'])
      .not('expires_at', 'is', null);

    let processed = 0;

    for (const lawyer of expiredLawyers || []) {
      await supabaseAdmin
        .from('profiles')
        .update({ tier: 'free' })
        .eq('id', lawyer.id);
      processed++;
    }

    return new Response(
      JSON.stringify({ processed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
