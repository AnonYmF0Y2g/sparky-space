import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://anonymf0y2g.github.io";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ALLOWED_CATEGORIES = new Set([
  "harassment", "inappropriate_content", "spam", "impersonation", "safety_concern", "other"
]);

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin"
    }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(204, {});
  if (req.method !== "POST") return response(405, { success: false, error: "Method not allowed." });
  if (req.headers.get("origin") !== ALLOWED_ORIGIN) return response(403, { success: false, error: "Origin not allowed." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return response(401, { success: false, error: "Please sign in first." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const turnstileSecret = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET");
  if (!supabaseUrl || !anonKey || !turnstileSecret) {
    console.error("Required function configuration is missing.");
    return response(503, { success: false, error: "Report protection is not configured yet." });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return response(401, { success: false, error: "Your session is invalid. Please sign in again." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response(400, { success: false, error: "Invalid request body." }); }
  const action = body.action;
  const token = typeof body.token === "string" ? body.token : "";
  if (!token || token.length > 2048) return response(400, { success: false, error: "Complete the verification check first." });

  const form = new FormData();
  form.append("secret", turnstileSecret);
  form.append("response", token);
  const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
  if (!verifyResponse.ok) return response(502, { success: false, error: "Verification service is temporarily unavailable." });
  const verification = await verifyResponse.json();
  if (!verification.success || verification.hostname !== "anonymf0y2g.github.io" || verification.action !== "community_action") {
    return response(403, { success: false, error: "Verification failed or expired. Please try again." });
  }

  const userId = authData.user.id;
  if (action === "report") {
    const category = typeof body.category === "string" ? body.category : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!ALLOWED_CATEGORIES.has(category)) return response(400, { success: false, error: "Choose a valid report category." });
    if (details.length < 10 || details.length > 2000) return response(400, { success: false, error: "Report details must be 10–2,000 characters." });
    let reportedUserId: string | null = null;
    if (username) {
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return response(400, { success: false, error: "That username format is invalid." });
      const { data: target, error: targetError } = await supabase.from("profiles")
        .select("id, username").eq("username", username).maybeSingle();
      if (targetError) return response(400, { success: false, error: "Couldn't look up that username." });
      if (!target) return response(404, { success: false, error: "That username wasn't found. Check the spelling or leave it blank for a general report." });
      if (target.id === userId) return response(400, { success: false, error: "You can't report your own account." });
      reportedUserId = target.id;
    }
    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: userId, reported_user_id: reportedUserId, category, details
    });
    if (insertError) {
      console.error("Report insert failed:", insertError.code);
      return response(400, { success: false, error: "The report could not be saved. Please try again." });
    }
    return response(200, { success: true });
  }

  if (action === "appeal") {
    const actionId = typeof body.action_id === "string" ? body.action_id : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionId)) {
      return response(400, { success: false, error: "Invalid moderation record." });
    }
    if (message.length < 10 || message.length > 2000) return response(400, { success: false, error: "Appeal messages must be 10–2,000 characters." });
    const { data: moderation, error: moderationError } = await supabase.from("moderation_actions")
      .select("id, target_user_id").eq("id", actionId).eq("target_user_id", userId).maybeSingle();
    if (moderationError || !moderation) return response(404, { success: false, error: "That moderation record isn't available for your account." });
    const { error: appealError } = await supabase.from("appeals").insert({
      action_id: actionId, appellant_id: userId, message
    });
    if (appealError) {
      if (appealError.code === "23505") return response(409, { success: false, error: "An appeal has already been submitted for this action." });
      return response(400, { success: false, error: "The appeal could not be saved. Please try again." });
    }
    return response(200, { success: true });
  }

  return response(400, { success: false, error: "Unknown action." });
});
