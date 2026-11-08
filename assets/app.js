/* Shared application logic for Sparky's Space */
(() => {
  "use strict";
  const SUPABASE_URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const siteKey = window.SPARKY_CONFIG?.turnstileSiteKey || "";
  let activeUser = null;
  let authWidget = null;
  let communityWidget = null;

  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  function captchaReady(widget) {
    return Boolean(window.turnstile && widget !== null && widget !== undefined && window.turnstile.getResponse(widget));
  }
  function captchaToken(widget) {
    return captchaReady(widget) ? window.turnstile.getResponse(widget) : "";
  }
  function resetCaptcha(widget) {
    if (window.turnstile && widget !== null && widget !== undefined) window.turnstile.reset(widget);
  }
  function setupCaptcha() {
    const authBox = byId("auth-captcha");
    const communityBox = byId("community-captcha");
    if (!siteKey || siteKey === "REPLACE_WITH_CLOUDFLARE_SITE_KEY") {
      if (authBox) setText("auth-captcha-note", "Bot protection is not configured yet. Account actions are paused until the site key and Supabase CAPTCHA settings are added.");
      if (communityBox) setText("community-captcha-note", "Bot protection is not configured yet. Report and appeal submissions are paused until Turnstile is configured.");
      return;
    }
    if (!window.turnstile) {
      if (authBox) setText("auth-captcha-note", "Turnstile could not load. Check your connection and try again.");
      if (communityBox) setText("community-captcha-note", "Turnstile could not load. Check your connection and try again.");
      return;
    }
    if (authBox) {
      authWidget = window.turnstile.render(authBox, {
        sitekey: siteKey, action: "auth", theme: "dark",
        callback: () => setText("auth-captcha-note", "Verification complete."),
        "expired-callback": () => setText("auth-captcha-note", "Verification expired. Please complete it again."),
        "error-callback": () => setText("auth-captcha-note", "Verification could not load. Please retry.")
      });
    }
    if (communityBox) {
      communityWidget = window.turnstile.render(communityBox, {
        sitekey: siteKey, action: "community_action", theme: "dark",
        callback: () => setText("community-captcha-note", "Verification complete."),
        "expired-callback": () => setText("community-captcha-note", "Verification expired. Please complete it again."),
        "error-callback": () => setText("community-captcha-note", "Verification could not load. Please retry.")
      });
    }
  }
  setupCaptcha();

  function safeImageUrl(value) {
    if (!value) return "";
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; }
    catch { return ""; }
  }

  async function loadOwnProfile(user) {
    if (!user || !byId("profile-form")) return;
    const { data, error } = await client.from("profiles")
      .select("username, display_name, bio, status, avatar_url, banner_url, profile_accent, is_public, show_bio, show_status").eq("id", user.id).maybeSingle();
    if (error) { setText("profile-message", "Couldn't load your profile: " + error.message); return; }
    if (data) {
      byId("profile-display-name").value = data.display_name || "";
      byId("profile-status").value = data.status || "";
      byId("profile-bio").value = data.bio || "";
      if (byId("profile-avatar-url")) byId("profile-avatar-url").value = data.avatar_url || "";
      if (byId("profile-banner-url")) byId("profile-banner-url").value = data.banner_url || "";
      if (byId("profile-accent")) byId("profile-accent").value = data.profile_accent || "pink";
      if (byId("profile-is-public")) byId("profile-is-public").checked = data.is_public === true;
      if (byId("profile-show-bio")) byId("profile-show-bio").checked = data.show_bio === true;
      if (byId("profile-show-status")) byId("profile-show-status").checked = data.show_status === true;
    } else setText("profile-message", "Your profile is still being prepared. Please refresh in a moment.");
  }

  async function loadMembers() {
    const directory = byId("member-directory");
    if (!directory) return;
    directory.textContent = "Loading members...";
    const { data, error } = await client.from("public_profiles")
      .select("id, username, display_name, bio, status, avatar_url, banner_url, profile_accent, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) { directory.textContent = "Member directory is unavailable: " + error.message; return; }
    if (!data || data.length === 0) { directory.textContent = "No member profiles yet. Be the first!"; return; }
    directory.replaceChildren();
    for (const member of data) {
      const card = document.createElement("article"); card.className = "member-card";
      const accents = ["pink","purple","blue","cyan","teal","green","orange","red"];
      const accentMap = {pink:"#f18abd",purple:"#c49aff",blue:"#80b8ff",cyan:"#69d5e8",teal:"#69d6c2",green:"#8bd88a",orange:"#f2ad70",red:"#f18c91"};
      card.style.setProperty("--member-accent", accentMap[accents.includes(member.profile_accent) ? member.profile_accent : "pink"]);
      const bannerUrl = safeImageUrl(member.banner_url);
      if (bannerUrl) { const banner = document.createElement("img"); banner.className = "member-banner"; banner.src = bannerUrl; banner.alt = ""; banner.loading = "lazy"; card.append(banner); }
      const content = document.createElement("div"); content.className = "member-card-content";
      const avatarUrl = safeImageUrl(member.avatar_url);
      if (avatarUrl) { const avatar = document.createElement("img"); avatar.className = "member-avatar"; avatar.src = avatarUrl; avatar.alt = ""; avatar.loading = "lazy"; content.append(avatar); }
      const name = document.createElement("strong"); name.textContent = member.display_name || member.username || "Member";
      const username = document.createElement("p"); username.className = "member-meta"; username.textContent = "@" + (member.username || "member");
      content.append(name, username);
      if (member.status) { const status = document.createElement("p"); status.textContent = member.status; content.append(status); }
      if (member.bio) { const bio = document.createElement("p"); bio.textContent = member.bio; content.append(bio); }
      const joined = document.createElement("p"); joined.className = "member-meta";
      joined.textContent = member.created_at ? "Joined " + new Date(member.created_at).toLocaleDateString() : "";
      content.append(joined); card.append(content); directory.append(card);
    }
    setText("members-message", data.length === 100 ? "Showing the first 100 members." : data.length + " member profile(s).");
  }

  const profileForm = byId("profile-form");
  if (profileForm) profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeUser) return;
    const save = byId("profile-save"); save.disabled = true; setText("profile-message", "Saving profile...");
    let avatarUrl = "", bannerUrl = "";
    avatarUrl = safeImageUrl(byId("profile-avatar-url").value.trim());
    bannerUrl = safeImageUrl(byId("profile-banner-url").value.trim());
    if (byId("profile-avatar-url").value.trim() && !avatarUrl) { save.disabled = false; setText("profile-message", "Avatar links must use HTTPS."); return; }
    if (byId("profile-banner-url").value.trim() && !bannerUrl) { save.disabled = false; setText("profile-message", "Banner links must use HTTPS."); return; }
    const values = {
      display_name: byId("profile-display-name").value.trim(),
      status: byId("profile-status").value.trim(),
      bio: byId("profile-bio").value.trim(),
      avatar_url: avatarUrl || null,
      banner_url: bannerUrl || null,
      profile_accent: byId("profile-accent").value,
      is_public: byId("profile-is-public").checked,
      show_bio: byId("profile-show-bio").checked,
      show_status: byId("profile-show-status").checked
    };
    const { error } = await client.from("profiles").update(values).eq("id", activeUser.id);
    save.disabled = false;
    setText("profile-message", error ? "Couldn't save: " + error.message : "Profile saved! ^w^");
  });

  async function loadMyReports(user) {
    const list = byId("my-reports-list"); if (!list) return;
    list.replaceChildren();
    if (!user) { list.textContent = "Sign in to view your reports."; return; }
    list.textContent = "Loading your reports...";
    const { data, error } = await client.rpc("get_my_reports");
    if (error) { list.textContent = "Report tracking isn't available yet. (" + error.message + ")"; return; }
    list.replaceChildren();
    if (!data || data.length === 0) { list.textContent = "You haven't submitted any reports."; return; }
    for (const report of data) {
      const item = document.createElement("article"); item.className = "moderation-item";
      const heading = document.createElement("strong"); heading.textContent = String(report.category || "Report").replaceAll("_", " ").toUpperCase();
      const status = document.createElement("span"); status.className = "report-status"; status.textContent = String(report.status || "open").replaceAll("_", " ");
      const details = document.createElement("p"); details.textContent = report.details || "";
      const timeline = document.createElement("ol"); timeline.className = "report-timeline";
      const submitted = document.createElement("li"); submitted.textContent = "Report submitted · " + new Date(report.created_at).toLocaleString(); timeline.append(submitted);
      if (report.reviewed_at) { const reviewed = document.createElement("li"); reviewed.textContent = "Seen by staff · " + new Date(report.reviewed_at).toLocaleString(); timeline.append(reviewed); }
      else if (report.status !== "open") { const reviewed = document.createElement("li"); reviewed.textContent = "Staff have updated this report. The exact review time isn't available for this older report."; timeline.append(reviewed); }
      item.append(heading, status, details, timeline);
      if (report.outcome_message) {
        const outcomeHeading = document.createElement("strong"); outcomeHeading.textContent = "Staff update";
        const outcome = document.createElement("p"); outcome.className = "report-outcome"; outcome.textContent = report.outcome_message;
        item.append(outcomeHeading, outcome);
      }
      list.append(item);
    }
  }

  async function loadMyModeration(user) {
    const list = byId("my-moderation-list"); if (!list) return;
    list.replaceChildren();
    if (!user) { list.textContent = "Sign in to view your account notices."; return; }
    list.textContent = "Loading your moderation history...";
    const { data, error } = await client.from("moderation_actions")
      .select("id, action_type, reason, created_at, expires_at")
      .eq("target_user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (error) { list.textContent = "Couldn't load moderation history: " + error.message; return; }
    list.replaceChildren();
    if (!data || data.length === 0) { list.textContent = "No moderation actions are recorded for your account."; return; }
    for (const action of data) {
      const item = document.createElement("article"); item.className = "moderation-item";
      const heading = document.createElement("strong"); heading.textContent = String(action.action_type).replaceAll("_", " ").toUpperCase();
      const reason = document.createElement("p"); reason.textContent = action.reason || "";
      const date = document.createElement("p"); date.className = "member-meta";
      date.textContent = "Recorded " + new Date(action.created_at).toLocaleString() + (action.expires_at ? " · Expires " + new Date(action.expires_at).toLocaleString() : "");
      item.append(heading, reason, date);
      if (action.action_type !== "note" && action.action_type !== "lift_ban") {
        const appeal = document.createElement("form"); appeal.className = "appeal-form";
        const honeypotLabel = document.createElement("label"); honeypotLabel.className = "honeypot-field"; honeypotLabel.setAttribute("aria-hidden", "true");
        honeypotLabel.textContent = "Website";
        const honeypotInput = document.createElement("input"); honeypotInput.name = "website"; honeypotInput.type = "text"; honeypotInput.autocomplete = "off"; honeypotInput.tabIndex = -1; honeypotInput.setAttribute("aria-hidden", "true");
        honeypotLabel.append(honeypotInput);
        const label = document.createElement("label"); label.textContent = "Appeal this action";
        const messageBox = document.createElement("textarea"); messageBox.minLength = 10; messageBox.maxLength = 2000; messageBox.required = true;
        messageBox.placeholder = "Explain why you think this action should be reviewed.";
        const button = document.createElement("button"); button.type = "submit"; button.textContent = "Submit appeal";
        const status = document.createElement("p"); status.className = "section-note"; status.setAttribute("role", "status");
        appeal.append(honeypotLabel, label, messageBox, button, status);
        appeal.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!activeUser) { status.textContent = "Please sign in first."; return; }
          const token = captchaToken(communityWidget);
          if (!token) { status.textContent = "Complete the Turnstile check above before submitting."; return; }
          button.disabled = true; status.textContent = "Submitting appeal...";
          try {
            const { data: result, error: appealError } = await client.functions.invoke("submit-community-action", {
              body: { action: "appeal", action_id: action.id, message: messageBox.value.trim(), website: honeypotInput.value, token }
            });
            if (appealError) throw appealError;
            if (!result?.success) throw new Error(result?.error || "The appeal could not be submitted.");
            status.textContent = "Appeal submitted for staff review.";
            messageBox.disabled = true; button.disabled = true;
          } catch (error) { status.textContent = "Couldn't submit appeal: " + (error.message || "Please try again."); button.disabled = false; }
          finally { resetCaptcha(communityWidget); }
        });
        item.append(appeal);
      }
      list.append(item);
    }
  }

  const reportForm = byId("report-form");
  if (reportForm) reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = byId("report-message");
    if (!activeUser) { message.textContent = "Please sign in before submitting a report."; return; }
    const token = captchaToken(communityWidget);
    if (!token) { message.textContent = "Complete the Turnstile check before submitting."; return; }
    const submit = byId("report-submit"); submit.disabled = true; message.textContent = "Submitting report...";
    try {
      const { data, error } = await client.functions.invoke("submit-community-action", {
        body: {
          action: "report", token, website: byId("report-website").value,
          username: byId("report-username").value.trim(),
          category: byId("report-category").value,
          details: byId("report-details").value.trim()
        }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "The report could not be submitted.");
      reportForm.reset(); message.textContent = "Report submitted. Thank you for helping keep the community safer.";
      await loadMyReports(activeUser);
    } catch (error) { message.textContent = "Couldn't submit report: " + (error.message || "Please try again."); }
    finally { submit.disabled = false; resetCaptcha(communityWidget); }
  });

  const authForm = byId("auth-form");
  const usernameInput = byId("auth-username");
  const usernameLabel = byId("username-label");
  const emailInput = byId("auth-email");
  const passwordInput = byId("auth-password");
  const submitButton = byId("auth-submit");
  const message = byId("auth-message");
  const signedOut = byId("signed-out");
  const signedIn = byId("signed-in");
  let mode = "signup";
  function say(value) { if (message) message.textContent = value; }
  function setMode(nextMode) {
    mode = nextMode;
    if (!authForm) return;
    const creating = mode === "signup";
    usernameLabel.hidden = !creating; usernameInput.required = creating; usernameInput.disabled = !creating;
    submitButton.textContent = creating ? "Create account" : "Sign in";
    byId("show-signup").classList.toggle("secondary", !creating);
    byId("show-login").classList.toggle("secondary", creating);
    passwordInput.autocomplete = creating ? "new-password" : "current-password";
    say("");
  }
  function renderUser(user) {
    activeUser = user || null;
    if (signedOut && signedIn) {
      signedOut.hidden = Boolean(user); signedIn.hidden = !user;
      if (user) {
        setText("account-username", user.user_metadata?.username || "Member");
        setText("account-email", "Your email address is private and is not shown in the member directory.");
      } else if (authForm) { authForm.reset(); setMode("signup"); }
    }
  }
  if (authForm) {
    byId("show-signup").addEventListener("click", () => setMode("signup"));
    byId("show-login").addEventListener("click", () => setMode("login"));
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const token = captchaToken(authWidget);
      if (!token) { say("Complete the Turnstile check before continuing."); return; }
      const email = emailInput.value.trim(); const password = passwordInput.value;
      submitButton.disabled = true; say(mode === "signup" ? "Creating your account..." : "Signing you in...");
      try {
        let result;
        if (mode === "signup") {
          const username = usernameInput.value.trim();
          if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) throw new Error("Username must be 3–20 characters and use only letters, numbers, _ or -.");
          result = await client.auth.signUp({
            email, password,
            options: { data: { username }, emailRedirectTo: "https://anonymf0y2g.github.io/sparky-space/", captchaToken: token }
          });
          if (result.error) throw result.error;
          if (result.data.session) say("Account created! You're signed in.");
          else { setMode("login"); say("Account created. Check your email for the confirmation link, then come back here to sign in."); }
        } else {
          result = await client.auth.signInWithPassword({ email, password, options: { captchaToken: token } });
          if (result.error) throw result.error;
          say("Signed in successfully!");
        }
      } catch (error) { say(error.message || "Something went wrong. Please try again."); }
      finally { submitButton.disabled = false; resetCaptcha(authWidget); }
    });
    setMode("signup");
  }

  function renderSecuritySession(user, session) {
    const panel = byId("security-session-info");
    if (!panel) return;
    panel.replaceChildren();
    if (!user) { panel.textContent = "Sign in to view your session information."; return; }
    const rows = [
      ["Account created", user.created_at ? new Date(user.created_at).toLocaleString() : "Not available"],
      ["Last sign-in", user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Not available"],
      ["Current session expires", session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "Not available"]
    ];
    for (const [label, value] of rows) {
      const line = document.createElement("p");
      const strong = document.createElement("strong"); strong.textContent = label + ": ";
      line.append(strong, document.createTextNode(value)); panel.append(line);
    }
    const note = document.createElement("p"); note.className = "section-note";
    note.textContent = "For security, this page does not display access tokens or list other devices.";
    panel.append(note);
  }

  async function exportMyData() {
    if (!activeUser) return;
    const button = byId("export-data-button");
    button.disabled = true;
    setText("privacy-data-message", "Preparing your personal data export...");
    try {
      const [profileResult, reportsResult, moderationResult, appealsResult, deletionResult] = await Promise.all([
        client.from("profiles").select("username, display_name, bio, status, avatar_url, banner_url, profile_accent, is_public, show_bio, show_status, created_at, updated_at").eq("id", activeUser.id).maybeSingle(),
        client.rpc("get_my_reports"),
        client.from("moderation_actions").select("action_type, reason, created_at, expires_at").eq("target_user_id", activeUser.id).order("created_at", { ascending: false }),
        client.from("appeals").select("action_id, message, status, staff_response, created_at").eq("appellant_id", activeUser.id).order("created_at", { ascending: false }),
        client.from("account_deletion_requests").select("status, requested_at, resolved_at").eq("user_id", activeUser.id).order("requested_at", { ascending: false })
      ]);
      const failure = [profileResult, reportsResult, moderationResult, appealsResult, deletionResult].find(result => result.error);
      if (failure) throw failure.error;
      const payload = {
        exported_at: new Date().toISOString(),
        account: {
          id: activeUser.id,
          email: activeUser.email || null,
          created_at: activeUser.created_at || null,
          last_sign_in_at: activeUser.last_sign_in_at || null,
          username_metadata: activeUser.user_metadata?.username || null
        },
        profile: profileResult.data || null,
        reports_submitted: reportsResult.data || [],
        moderation_records_about_this_account: moderationResult.data || [],
        appeals_submitted: appealsResult.data || [],
        account_deletion_requests: deletionResult.data || [],
        notes: [
          "This export contains data available to this signed-in account through the website.",
          "It does not contain passwords, access tokens, refresh tokens, staff-only internal notes, or other members' information."
        ]
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sparkys-space-personal-data.json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setText("privacy-data-message", "Your personal data export has been prepared in this browser.");
    } catch (error) {
      setText("privacy-data-message", "Couldn't prepare the export: " + (error.message || "Please try again."));
    } finally { button.disabled = false; }
  }

  byId("export-data-button")?.addEventListener("click", exportMyData);
  byId("request-deletion-button")?.addEventListener("click", async () => {
    if (!activeUser) return;
    const button = byId("request-deletion-button");
    const status = byId("deletion-request-message");
    if (!window.confirm("Submit an account deletion request? This will NOT delete your account immediately. Staff will review the request before any deletion takes place.")) return;
    button.disabled = true;
    status.textContent = "Checking for an existing request...";
    try {
      const { data: existing, error: lookupError } = await client.from("account_deletion_requests")
        .select("id, status, requested_at").eq("user_id", activeUser.id)
        .in("status", ["pending", "reviewing"]).limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        status.textContent = "You already have a deletion request " + existing.status + " since " + new Date(existing.requested_at).toLocaleString() + ".";
      } else {
        const { error } = await client.from("account_deletion_requests").insert({ user_id: activeUser.id });
        if (error) throw error;
        status.textContent = "Your request has been recorded for staff review. Your account and data have NOT been deleted.";
      }
    } catch (error) {
      status.textContent = "Couldn't submit the request: " + (error.message || "Please contact site staff.");
    } finally { button.disabled = false; }
  });

  async function loadStaffDeletionQueue(user) {
    const root = byId("staff-deletion-requests");
    if (!root) return;
    root.replaceChildren();
    if (!user) { root.textContent = "Sign in with an authorized staff account to review requests."; return; }
    const { data: role, error: roleError } = await client.from("staff_roles")
      .select("role").eq("user_id", user.id).maybeSingle();
    if (roleError || !role) { root.textContent = "This page is restricted to authorized staff."; return; }
    const { data, error } = await client.from("account_deletion_requests")
      .select("id, user_id, status, requested_at, resolved_at")
      .order("requested_at", { ascending: false }).limit(100);
    if (error) { root.textContent = "Couldn't load the request queue: " + error.message; return; }
    if (!data?.length) { root.textContent = "There are no account deletion requests."; return; }
    for (const request of data) {
      const card = document.createElement("article");
      card.className = "privacy-section";
      const heading = document.createElement("h3");
      heading.textContent = "Request · " + request.status;
      const details = document.createElement("p");
      details.textContent = "Account ID: " + request.user_id + " · Submitted: " + new Date(request.requested_at).toLocaleString();
      card.append(heading, details);
      const actions = document.createElement("div");
      actions.className = "privacy-actions";
      if (request.status === "pending") {
        const review = document.createElement("button");
        review.type = "button";
        review.textContent = "Mark as reviewing";
        review.addEventListener("click", async () => {
          review.disabled = true;
          const { error: updateError } = await client.from("account_deletion_requests")
            .update({ status: "reviewing", resolved_at: null }).eq("id", request.id);
          if (updateError) { review.disabled = false; details.textContent = "Update failed: " + updateError.message; }
          else loadStaffDeletionQueue(user);
        });
        actions.append(review);
      }
      if (request.status === "pending" || request.status === "reviewing") {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "secondary";
        cancel.textContent = "Cancel request";
        cancel.addEventListener("click", async () => {
          if (!window.confirm("Mark this deletion request as cancelled? This does not delete the account.")) return;
          cancel.disabled = true;
          const { error: updateError } = await client.from("account_deletion_requests")
            .update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", request.id);
          if (updateError) { cancel.disabled = false; details.textContent = "Update failed: " + updateError.message; }
          else loadStaffDeletionQueue(user);
        });
        actions.append(cancel);
      }
      card.append(actions);
      root.append(card);
    }
  }

  function refreshUserData(user, session) {
    renderUser(user);
    loadStaffDeletionQueue(user);
    renderSecuritySession(user, session);
    if (user) loadOwnProfile(user);
    loadMyModeration(user);
    loadMyReports(user);
  }
  client.auth.getSession().then(({ data, error }) => {
    if (error) say(error.message);
    refreshUserData(data?.session?.user || null, data?.session || null);
  });
  client.auth.onAuthStateChange((_event, session) => refreshUserData(session?.user || null, session || null));

  byId("password-reset-button")?.addEventListener("click", async () => {
    if (!activeUser?.email) return;
    const button = byId("password-reset-button");
    button.disabled = true; setText("security-message", "Requesting a password reset email...");
    const { error } = await client.auth.resetPasswordForEmail(activeUser.email, {
      redirectTo: new URL("account.html", window.location.href).href
    });
    setText("security-message", error ? "Couldn't send the reset email: " + error.message : "If the address is eligible, a password reset email has been sent.");
    button.disabled = false;
  });
  byId("signout-others-button")?.addEventListener("click", async () => {
    if (!activeUser || !window.confirm("Sign out all other sessions? This keeps this browser signed in.")) return;
    const button = byId("signout-others-button");
    button.disabled = true; setText("security-message", "Signing out other sessions...");
    const { error } = await client.auth.signOut({ scope: "others" });
    setText("security-message", error ? "Couldn't revoke other sessions: " + error.message : "Other refresh-token sessions have been signed out. Existing access tokens may remain valid until they expire.");
    button.disabled = false;
  });
  byId("signout-button")?.addEventListener("click", async () => {
    const { error } = await client.auth.signOut({ scope: "local" });
    say(error ? error.message : "You have been signed out of this browser.");
  });

  byId("clear-preferences-button")?.addEventListener("click", () => {
    for (const key of ["sparky-theme", "sparky-accent", "sparky-text-size", "sparky-reduced-motion"]) {
      localStorage.removeItem(key);
    }
    setText("preferences-message", "Saved appearance preferences cleared. Reloading with the default settings...");
    window.location.reload();
  });

  async function loadStatusCenter() {
    const root = byId("status-checks");
    if (!root) return;
    const setStatus = (id, state, detail) => {
      const item = byId(id); if (!item) return;
      const status = item.querySelector(".status-state");
      const description = item.querySelector(".status-detail");
      status.textContent = state;
      status.className = "status-state " + (state === "Operational" ? "" : "issue");
      description.textContent = detail;
    };
    const assetPromise = fetch("assets/theme.css", { method:"HEAD", cache:"no-store" }).then(response => response.ok).catch(() => false);
    const databasePromise = client.from("public_profiles").select("id").limit(1).then(({error}) => !error);
    const authPromise = fetch(SUPABASE_URL + "/auth/v1/health", { headers:{apikey:SUPABASE_PUBLISHABLE_KEY}, cache:"no-store" }).then(response => response.ok).catch(() => false);
    const [assetOk,databaseOk,authOk] = await Promise.all([assetPromise,databasePromise,authPromise]);
    setStatus("status-website",assetOk ? "Operational" : "Issue detected",assetOk ? "The site's stylesheet is reachable." : "The stylesheet could not be reached from this browser.");
    setStatus("status-database",databaseOk ? "Operational" : "Issue detected",databaseOk ? "The public directory API responded successfully." : "The directory API did not respond successfully.");
    setStatus("status-auth",authOk ? "Operational" : "Issue detected",authOk ? "The authentication health endpoint responded." : "The authentication health endpoint could not be confirmed.");
    setText("status-last-checked","Last checked: " + new Date().toLocaleString());
  }
  byId("status-refresh")?.addEventListener("click", loadStatusCenter);
  loadStatusCenter();
  loadMembers();
})();