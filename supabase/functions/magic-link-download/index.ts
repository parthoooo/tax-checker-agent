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

    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const storagePath = url.searchParams.get("path") ?? "";
    const download = url.searchParams.get("download") === "1";

    if (!token || !storagePath) {
      return new Response(JSON.stringify({ error: "Missing token or path" }), {
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

    const expectedPrefix = `clients/${linkRow.client_id}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return new Response(JSON.stringify({ error: "File not found for this link" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("documents")
      .createSignedUrl(storagePath, 3600, download ? { download: true } : undefined);

    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: signErr?.message ?? "Could not sign URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, signedUrl: signed.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
