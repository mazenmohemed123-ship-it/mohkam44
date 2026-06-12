import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { tier, amount, currency, case_id, client_id, channel, redirect_origin } = body;

    // Validate minimum required fields
    if (!amount || !client_id) {
      return new Response(JSON.stringify({ error: "Missing required amount or client_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymobApiKey = Deno.env.get("PAYMOB_API_KEY") || "dummy_api_key";
    const paymobIntegrationId = Deno.env.get("PAYMOB_INTEGRATION_ID") || "12345";
    const paymobIframeId = Deno.env.get("PAYMOB_IFRAME_ID") || "54321";

    const origin = redirect_origin || req.headers.get("origin") || "http://localhost:5173";
    const isDummy = paymobApiKey === "dummy_api_key";

    let paymobOrderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let checkoutUrl = "";

    // 1. Create a pending payment record in our database
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        client_id,
        case_id: case_id || null,
        amount: Number(amount),
        currency: currency || "EGP",
        status: "pending",
        paymob_order_id: paymobOrderId,
        metadata: {
          tier: tier || null,
          channel: channel || "card",
          is_sandbox: isDummy
        }
      })
      .select()
      .single();

    if (paymentError || !paymentRecord) {
      throw new Error(`Failed to create payment record in database: ${paymentError?.message}`);
    }

    if (isDummy) {
      // Sandbox Mode: generate redirect back to app with mock params
      checkoutUrl = `${origin}/?payment_sandbox=1&payment_id=${paymentRecord.id}&paymob_order_id=${paymobOrderId}&amount=${amount}&currency=${currency || "EGP"}`;
    } else {
      // Real Paymob Flow
      // a. Get Auth Token
      const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: paymobApiKey }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(`Paymob Auth Error: ${authData.message || "Unknown error"}`);

      const token = authData.token;

      // b. Register Order
      const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          delivery_needed: "false",
          amount_cents: Math.round(Number(amount) * 100),
          currency: currency || "EGP",
          items: [],
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(`Paymob Order Error: ${orderData.message || "Unknown error"}`);

      paymobOrderId = String(orderData.id);

      // Update the order ID in our payment record
      await supabaseAdmin
        .from("payments")
        .update({ paymob_order_id: paymobOrderId })
        .eq("id", paymentRecord.id);

      // c. Get Payment Key
      const keyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          amount_cents: Math.round(Number(amount) * 100),
          expiration: 3600,
          order_id: paymobOrderId,
          billing_data: {
            apartment: "NA",
            email: "client@mohkam.com",
            floor: "NA",
            first_name: "Client",
            street: "NA",
            building: "NA",
            phone_number: "+201000000000",
            shipping_method: "NA",
            postal_code: "NA",
            city: "Cairo",
            country: "EG",
            last_name: "Mohkam",
            state: "NA"
          },
          currency: currency || "EGP",
          integration_id: paymobIntegrationId,
        }),
      });
      const keyData = await keyRes.json();
      if (!keyRes.ok) throw new Error(`Paymob Key Error: ${keyData.message || "Unknown error"}`);

      checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${paymobIframeId}?payment_token=${keyData.token}`;
    }

    return new Response(JSON.stringify({
      success: true,
      url: checkoutUrl,
      paymob_order_id: paymobOrderId,
      payment_id: paymentRecord.id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
