import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_USERS = [
  { email: "nick@brodermansoor.com",  password: "password123", full_name: "Nick Broder",   role: "admin" },
  { email: "shawn@brodermansoor.com", password: "password123", full_name: "Shawn Mansoor", role: "preparer" },
  { email: "girik@brodermansoor.com", password: "password123", full_name: "Girik Patel",   role: "preparer" },
  { email: "john.smith@email.com",    password: "password123", full_name: "John Smith",    role: "client" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];

  for (const u of DEMO_USERS) {
    // Try to find existing user
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    let userId: string;
    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });
      if (error) { results.push({ email: u.email, error: error.message }); continue; }
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });
      if (error) { results.push({ email: u.email, error: error.message }); continue; }
      userId = data.user!.id;
    }

    // Link client row for John
    if (u.role === "client") {
      const { data: client } = await admin
        .from("clients")
        .select("id")
        .eq("email", u.email)
        .maybeSingle();
      if (client) {
        await admin.from("clients").update({ auth_user_id: userId }).eq("id", client.id);
      } else {
        await admin.from("clients").insert({
          name: u.full_name,
          email: u.email,
          auth_user_id: userId,
          status: "active",
        });
      }
    }

    results.push({ email: u.email, id: userId, ok: true });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});