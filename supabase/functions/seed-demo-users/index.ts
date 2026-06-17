import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authUserUpdateForRole } from "../_shared/setUserAuthRole.ts";
import type { AppRole } from "../_shared/authRoles.ts";

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

const DEMO_PASSWORD = "BMM-Demo-2026!";

const DEMO_USERS = [
  { email: "nick@brodermansoor.com",       password: DEMO_PASSWORD, full_name: "Nick Broder",   role: "admin" },
  { email: "shawn@brodermansoor.com",      password: DEMO_PASSWORD, full_name: "Shawn Mansoor", role: "preparer" },
  { email: "girik@brodermansoor.com",      password: DEMO_PASSWORD, full_name: "Girik Patel",   role: "preparer" },
  { email: "john.smith@email.com",         password: DEMO_PASSWORD, full_name: "John Smith",    role: "client" },
  { email: "sean.test@brodermansoor.com",  password: DEMO_PASSWORD, full_name: "Sean Test Client",  role: "client" },
  { email: "girik.test@brodermansoor.com", password: DEMO_PASSWORD, full_name: "Girik Test Client", role: "client" },
];

const PRIOR_TAX_YEAR = "2024";
const CURRENT_TAX_YEAR = "2025";

async function seedClientData(admin: ReturnType<typeof createClient>, clientId: string) {
  const { data: existingReqs } = await admin
    .from("document_requirements")
    .select("id")
    .eq("client_id", clientId)
    .eq("tax_year", CURRENT_TAX_YEAR)
    .limit(1);

  if (existingReqs && existingReqs.length > 0) return;

  // Prior-year baseline
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

  if (priorReqs) {
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

  // Current-year checklist
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];

  for (const u of DEMO_USERS) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    let userId: string;
    const role = u.role as AppRole;
    const profileMeta = { full_name: u.full_name };
    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password: u.password,
        email_confirm: true,
        ...authUserUpdateForRole(role, profileMeta),
      });
      if (error) { results.push({ email: u.email, error: error.message }); continue; }
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        ...authUserUpdateForRole(role, profileMeta),
      });
      if (error) { results.push({ email: u.email, error: error.message }); continue; }
      userId = data.user!.id;
    }

    if (u.role === "client") {
      const { data: client } = await admin
        .from("clients")
        .select("id")
        .eq("email", u.email)
        .maybeSingle();

      let clientId: string;
      if (client) {
        clientId = client.id;
        await admin.from("clients").update({ auth_user_id: userId }).eq("id", clientId);
      } else {
        const { data: newClient, error: insErr } = await admin
          .from("clients")
          .insert({
            name: u.full_name,
            email: u.email,
            auth_user_id: userId,
            status: "active",
            documents_required: DEFAULT_REQUIREMENTS.length,
          })
          .select("id")
          .single();
        if (insErr || !newClient) {
          results.push({ email: u.email, error: insErr?.message ?? "client insert failed" });
          continue;
        }
        clientId = newClient.id;
      }

      await seedClientData(admin, clientId);
    }

    results.push({ email: u.email, id: userId, ok: true });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
