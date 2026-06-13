import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// HMAC calculation helper using Web Crypto API
async function verifyHmac(secret: string, source: string, receivedHmac: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secret);
  const dataBuf = encoder.encode(source);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign("HMAC", key, dataBuf);
  const sigArray = Array.from(new Uint8Array(sigBuf));
  const calculatedHmac = sigArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return calculatedHmac === receivedHmac;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Paymob sends transaction details inside 'obj' parameter
    const body = await req.json();
    const { obj, type } = body;

    if (!obj || type !== "TRANSACTION") {
      return new Response(JSON.stringify({ error: "Unsupported event type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hmacSecret = Deno.env.get("PAYMOB_HMAC_SECRET") || "dummy_hmac_secret";
    const hmacParam = req.url.split("hmac=")[1]?.split("&")[0] || "";

    // Concatenate standard fields for signature validation
    const hmacSource =
      String(obj.amount_cents || "") +
      String(obj.created_at || "") +
      String(obj.currency || "") +
      String(obj.error_occured) +
      String(obj.has_parent_transaction) +
      String(obj.id || "") +
      String(obj.integration_id || "") +
      String(obj.is_3d_secure) +
      String(obj.is_auth) +
      String(obj.is_capture) +
      String(obj.is_refunded) +
      String(obj.is_standalone_payment) +
      String(obj.owner || "") +
      String(obj.pending) +
      String(obj.source_data?.pan || "") +
      String(obj.source_data?.sub_type || "") +
      String(obj.source_data?.type || "") +
      String(obj.success);

    const isSandboxMode = hmacSecret === "dummy_hmac_secret";
    const isSignatureValid = isSandboxMode || await verifyHmac(hmacSecret, hmacSource, hmacParam);

    if (!isSignatureValid) {
      console.warn("HMAC verification failed. Received HMAC:", hmacParam);
      return new Response(JSON.stringify({ error: "Invalid HMAC signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymobOrderId = String(obj.order?.id || "");
    const transactionId = String(obj.id || "");
    const isSuccess = obj.success === true || String(obj.success) === "true";

    console.log(`Processing Paymob webhook: Order ID=${paymobOrderId}, Status=${isSuccess ? 'Success' : 'Failed'}`);

    // Find the corresponding payment record
    const { data: paymentRecord, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("paymob_order_id", paymobOrderId)
      .maybeSingle();

    if (fetchError || !paymentRecord) {
      console.error("Payment record not found for Order ID:", paymobOrderId, fetchError);
      return new Response(JSON.stringify({ error: "Payment record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment record status
    const status = isSuccess ? "success" : "failed";
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status,
        paymob_transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.id);

    if (updateError) {
      console.error("Failed to update payment record:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update payment status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If payment was successful, process upgrades/fees logic
    if (isSuccess) {
      // 1. Increment coupon usage if a coupon was used
      if (paymentRecord.metadata?.coupon_id) {
        const { data: couponData } = await supabaseAdmin
          .from("coupons")
          .select("used_count")
          .eq("id", paymentRecord.metadata.coupon_id)
          .maybeSingle();
        
        if (couponData) {
          await supabaseAdmin
            .from("coupons")
            .update({ used_count: (couponData.used_count || 0) + 1 })
            .eq("id", paymentRecord.metadata.coupon_id);
          console.log(`Incremented used_count for coupon ${paymentRecord.metadata.coupon_id}`);
        }
      }

      // 2. Process payment based on type / case_id
      if (paymentRecord.metadata?.type === "commission_payment") {
        // Reset commission debt to 0
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ commission_debt: 0 })
          .eq("id", paymentRecord.client_id);
        
        if (profileError) {
          console.error("Failed to reset commission debt:", profileError);
        } else {
          console.log(`Commission debt reset to 0 for profile ${paymentRecord.client_id}`);
        }
      } else if (!paymentRecord.case_id) {
        // This is a subscription upgrade for a lawyer
        const tier = paymentRecord.metadata?.tier || "free";
        const isAutoRenew = paymentRecord.metadata?.auto_renew ?? true;
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            tier,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            is_auto_renew_enabled: isAutoRenew,
          })
          .eq("id", paymentRecord.client_id);

        if (profileError) {
          console.error("Failed to upgrade profile tier:", profileError);
        } else {
          console.log(`Profile ${paymentRecord.client_id} successfully upgraded to ${tier}`);
        }
      } else {
        // This is a case payment
        // We can record a case event for payment confirmation
        const { data: c } = await supabaseAdmin.from("cases").select("client_name, case_number").eq("id", paymentRecord.case_id).single();
        const clientName = c?.client_name || "موكل";
        const caseNumber = c?.case_number || "بدون قضية";

        await supabaseAdmin.from("case_events").insert([{
          case_id: paymentRecord.case_id,
          event_type: "PAYMENT_CONFIRMED",
          event_description: `💰 تم تأكيد استلام الدفعة المالية بقيمة ${paymentRecord.amount} ${paymentRecord.currency} عبر Paymob (معاملة: ${transactionId})`,
        }]);

        console.log(`Payment confirmed for Case ID=${paymentRecord.case_id}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
