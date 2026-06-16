import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const token = String(form.get("token") ?? "");
    const clientId = String(form.get("clientId") ?? "");
    const docType = String(form.get("docType") ?? "");
    const taxYear = String(form.get("taxYear") ?? "2025");
    const upsert = String(form.get("upsert") ?? "true") === "true";
    const file = form.get("file");

    if (!token || !clientId || !docType || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: linkRow, error: linkErr } = await admin
      .from("magic_link_tokens")
      .select("client_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (linkErr || !linkRow) {
      return new Response(JSON.stringify({ error: "Invalid upload link" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (linkRow.expires_at && new Date(linkRow.expires_at) <= new Date()) {
      return new Response(JSON.stringify({ error: "Upload link expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (linkRow.client_id !== clientId) {
      return new Response(JSON.stringify({ error: "Token does not match client" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeName = file.name.replace(/\s+/g, "_");
    const storagePath = `clients/${clientId}/${taxYear}/${docType}/${safeName}`;

    const { error: uploadErr } = await admin.storage
      .from("documents")
      .upload(storagePath, file, { upsert });

    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, storagePath, upsert }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
