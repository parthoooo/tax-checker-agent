import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildAppMetadataBackfill } from "../_shared/authRoles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * One-shot / idempotent backfill: user_metadata.role → app_metadata.role, then strip role from user_metadata.
 * Invoke with service role Authorization header after deploy.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Service role authorization required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const results: Array<{ id: string; email: string | undefined; action: string }> = [];

  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const users = data.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const nextAppMeta = buildAppMetadataBackfill(user);
      if (!nextAppMeta) continue;

      const legacyRole = user.user_metadata?.role;
      const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: nextAppMeta,
      });

      if (updateErr) {
        results.push({ id: user.id, email: user.email, action: `error: ${updateErr.message}` });
        continue;
      }

      results.push({
        id: user.id,
        email: user.email,
        action: `backfilled role=${String(legacyRole)}`,
      });
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return new Response(JSON.stringify({ ok: true, updated: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
