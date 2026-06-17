import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authUserUpdateForRole } from "../_shared/setUserAuthRole.ts";
import type { AppRole } from "../_shared/authRoles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_STAFF_BY_EMAIL: Record<string, AppRole> = {
  "nick@brodermansoor.com": "admin",
  "shawn@brodermansoor.com": "preparer",
  "girik@brodermansoor.com": "preparer",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = user.email?.toLowerCase() ?? "";
  const expectedRole = DEMO_STAFF_BY_EMAIL[email];
  if (!expectedRole) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const currentRole = user.app_metadata?.role;
  if (currentRole === expectedRole) {
    return new Response(JSON.stringify({ ok: true, already: true, role: expectedRole }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    user.id,
    authUserUpdateForRole(expectedRole, meta),
  );

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, role: expectedRole }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
