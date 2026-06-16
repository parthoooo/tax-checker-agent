import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_REQUIREMENTS = [
  { name: "W-2", doc_type: "w2" },
  { name: "1099-NEC", doc_type: "1099-nec" },
  { name: "1098 Mortgage Interest", doc_type: "1098" },
  { name: "Schedule C", doc_type: "sched-c" },
];

const PRIOR_TAX_YEAR = "2024";
const CURRENT_TAX_YEAR = "2025";

async function seedClientPortal(
  admin: ReturnType<typeof createClient>,
  clientId: string,
) {
  const { data: existingReqs } = await admin
    .from("document_requirements")
    .select("id")
    .eq("client_id", clientId)
    .eq("tax_year", CURRENT_TAX_YEAR)
    .limit(1);

  if (existingReqs && existingReqs.length > 0) return;

  const { data: priorReqs } = await admin
    .from("document_requirements")
    .insert(
      DEFAULT_REQUIREMENTS.map((r) => ({
        client_id: clientId,
        name: r.name,
        doc_type: r.doc_type,
        tax_year: PRIOR_TAX_YEAR,
        required: true,
      })),
    )
    .select("id, doc_type");

  if (priorReqs?.length) {
    await admin.from("document_uploads").insert(
      priorReqs.map((req: { id: string; doc_type: string }) => ({
        client_id: clientId,
        requirement_id: req.id,
        file_name: `${req.doc_type}_${PRIOR_TAX_YEAR}.pdf`,
        storage_path: `clients/${clientId}/${PRIOR_TAX_YEAR}/${req.doc_type}/${req.doc_type}_${PRIOR_TAX_YEAR}.pdf`,
        file_size: 200000,
        mime_type: "application/pdf",
        ai_status: "verified",
        tax_year: PRIOR_TAX_YEAR,
        is_prior_year: true,
      })),
    );
  }

  await admin.from("document_requirements").insert(
    DEFAULT_REQUIREMENTS.map((r) => ({
      client_id: clientId,
      name: r.name,
      doc_type: r.doc_type,
      tax_year: CURRENT_TAX_YEAR,
      required: true,
    })),
  );
}

async function provisionClient(
  admin: ReturnType<typeof createClient>,
  authUserId: string,
  email: string,
  fullName: string,
): Promise<string> {
  const { data: byAuth } = await admin
    .from("clients")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (byAuth?.id) {
    await seedClientPortal(admin, byAuth.id);
    return byAuth.id;
  }

  const { data: byEmail } = await admin
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (byEmail?.id) {
    await admin
      .from("clients")
      .update({ auth_user_id: authUserId, name: fullName, status: "active" })
      .eq("id", byEmail.id);
    await seedClientPortal(admin, byEmail.id);
    return byEmail.id;
  }

  const { data: created, error } = await admin
    .from("clients")
    .insert({
      name: fullName,
      email,
      auth_user_id: authUserId,
      status: "active",
      documents_required: DEFAULT_REQUIREMENTS.length,
      documents_submitted: 0,
      issues: 0,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Failed to create client");

  await seedClientPortal(admin, created.id);
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await caller.auth.getUser();
    if (callerErr || !callerUser || callerUser.user_metadata?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { requestId, action, role, rejectedReason } = body as {
      requestId: string;
      action: "approve" | "reject";
      role?: "client" | "preparer" | "admin";
      rejectedReason?: string;
    };

    if (!requestId || !action) {
      return new Response(JSON.stringify({ error: "requestId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: signup, error: fetchErr } = await admin
      .from("signup_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !signup) {
      return new Response(JSON.stringify({ error: "Signup request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (signup.status !== "pending") {
      return new Response(JSON.stringify({ error: "Request already processed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      await admin.auth.admin.updateUserById(signup.auth_user_id, {
        user_metadata: {
          full_name: signup.full_name,
          role: "client",
          approval_status: "rejected",
        },
      });
      await admin.from("signup_requests").update({
        status: "rejected",
        rejected_reason: rejectedReason ?? "Not approved",
        approved_by: callerUser.id,
        approved_at: now,
      }).eq("id", requestId);

      await admin.from("activity_log").insert({
        client_id: null,
        actor: callerUser.user_metadata?.full_name ?? "Admin",
        actor_type: "staff",
        action: `Rejected sign-up for ${signup.email}`,
      });

      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const approvedRole = role ?? "client";
    if (!["client", "preparer", "admin"].includes(approvedRole)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let clientId: string | null = null;
    if (approvedRole === "client") {
      clientId = await provisionClient(admin, signup.auth_user_id, signup.email, signup.full_name);
    }

    await admin.auth.admin.updateUserById(signup.auth_user_id, {
      user_metadata: {
        full_name: signup.full_name,
        role: approvedRole,
        approval_status: "approved",
        client_id: clientId,
      },
    });

    await admin.from("signup_requests").update({
      status: "approved",
      approved_role: approvedRole,
      approved_by: callerUser.id,
      approved_at: now,
    }).eq("id", requestId);

    await admin.from("activity_log").insert({
      client_id: clientId,
      actor: callerUser.user_metadata?.full_name ?? "Admin",
      actor_type: "staff",
      action: `Approved sign-up for ${signup.email} as ${approvedRole}`,
    });

    return new Response(JSON.stringify({ ok: true, status: "approved", role: approvedRole, clientId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
