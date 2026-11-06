import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(401, { error: "Sign in is required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return reply(500, { error: "Server configuration is incomplete." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const actor = authData?.user;
    if (authError || !actor) return reply(401, { error: "Your session is invalid or expired. Sign in again." });

    const { data: actorRoles, error: actorRoleError } = await admin
      .from("staff_roles").select("role").eq("user_id", actor.id);
    if (actorRoleError) return reply(500, { error: "Could not verify staff permissions." });
    const roles = (actorRoles || []).map((r: { role: string }) => r.role);
    if (!roles.some((r: string) => ["owner", "admin", "moderator", "support"].includes(r))) {
      return reply(403, { error: "Staff permission required." });
    }

    let input: { target_user_id?: string; action_type?: string; reason?: string; expires_at?: string | null };
    try { input = await req.json(); } catch { return reply(400, { error: "Invalid JSON request." }); }

    const targetId = String(input.target_user_id || "").trim();
    const action = String(input.action_type || "").trim();
    const reason = String(input.reason || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return reply(400, { error: "A valid target account ID is required." });
    }
    if (targetId === actor.id) return reply(400, { error: "You cannot moderate your own account." });
    if (!["temporary_ban", "permanent_ban", "lift_ban"].includes(action)) {
      return reply(400, { error: "Unsupported moderation action." });
    }
    if (reason.length < 3 || reason.length > 1000) {
      return reply(400, { error: "Reason must be between 3 and 1000 characters." });
    }

    let expiresAt: string | null = null;
    let banDuration: string;
    if (action === "temporary_ban") {
      const parsed = input.expires_at ? new Date(input.expires_at) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        return reply(400, { error: "Choose a valid future expiry for a temporary ban." });
      }
      expiresAt = parsed.toISOString();
      banDuration = `${Math.ceil((parsed.getTime() - Date.now()) / 1000)}s`;
    } else if (action === "permanent_ban") {
      banDuration = "876000h";
    } else {
      banDuration = "none";
    }

    const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetId);
    if (targetError || !targetData?.user) return reply(404, { error: "Target account was not found." });

    const { data: targetRoles, error: targetRoleError } = await admin
      .from("staff_roles").select("role").eq("user_id", targetId);
    if (targetRoleError) return reply(500, { error: "Could not verify target staff status." });
    const targetIsStaff = (targetRoles || []).length > 0;
    if ((targetRoles || []).some((r: { role: string }) => r.role === "owner")) {
      return reply(403, { error: "Owner accounts cannot be moderated through this endpoint." });
    }
    if (targetIsStaff && !roles.includes("owner")) {
      return reply(403, { error: "Only an owner can moderate another staff account." });
    }

    const { data: actionRow, error: insertError } = await admin.from("moderation_actions")
      .insert({ actor_id: actor.id, target_user_id: targetId, action_type: action, reason, expires_at: expiresAt })
      .select("id").single();
    if (insertError || !actionRow) return reply(500, { error: "Could not create the moderation audit record." });

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, {
      ban_duration: banDuration,
    });
    if (authUpdateError) {
      await admin.from("moderation_actions").delete().eq("id", actionRow.id);
      return reply(502, { error: "Supabase Auth could not apply the account change. No moderation action was retained." });
    }

    return reply(200, {
      success: true,
      action_id: actionRow.id,
      action_type: action,
      message: action === "lift_ban" ? "Account ban lifted." : "Account ban applied.",
    });
  } catch (_error) {
    return reply(500, { error: "Unexpected server error. No additional details were exposed." });
  }
});
