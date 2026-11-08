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

  async function loadOwnProfile(user) {
    if (!user || !byId("profile-form")) return;
    const { data, error } = await client.from("profiles")
      .select("username, display_name, bio, status").eq("id", user.id).maybeSingle();
    if (error) { setText("profile-message", "Couldn't load your profile: " + error.message); return; }
    if (data) {
      byId("profile-display-name").value = data.display_name || "";
      byId("profile-status").value = data.status || "";
      byId("profile-bio").value = data.bio || "";
    } else setText("profile-message", "Your profile is still being prepared. Please refresh in a moment.");
  }

  async function loadMembers() {
    const directory = byId("member-directory");
    if (!directory) return;
    directory.textContent = "Loading members...";
    const { data, error } = await client.from("profiles")
      .select("username, display_name, bio, status, created_at")
      .order("created_at", { ascending: true }).limit(100);
    if (error) { directory.textContent = "Member directory is unavailable: " + error.message; return; }
    if (!data || data.length === 0) { directory.textContent = "No member profiles yet. Be the first!"; return; }
    directory.replaceChildren();
    for (const member of data) {
      const card = document.createElement("article"); card.className = "member-card";
      const name = document.createElement("strong"); name.textContent = member.display_name || member.username || "Member";
      const username = document.createElement("p"); username.textContent = "@" + (member.username || "member");
      const status = document.createElement("p"); status.textContent = member.status || "No status set";
      const bio = document.createElement("p"); bio.textContent = member.bio || "This member hasn't added a bio yet.";
      const joined = document.createElement("p"); joined.className = "member-meta";
      joined.textContent = member.created_at ? "Joined " + new Date(member.created_at).toLocaleDateString() : "";
      card.append(name, username, status, bio, joined); directory.append(card);
    }
    setText("members-message", data.length === 100 ? "Showing the first 100 members." : data.length + " member profile(s).");
  }

  const profileForm = byId("profile-form");
  if (profileForm) profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeUser) return;
    const save = byId("profile-save"); save.disabled = true; setText("profile-message", "Saving profile...");
    const values = {
      display_name: byId("profile-display-name").value.trim(),
      status: byId("profile-status").value.trim(),
      bio: byId("profile-bio").value.trim()
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
    byId("signout-button").addEventListener("click", async () => {
      const { error } = await client.auth.signOut(); say(error ? error.message : "You have been signed out.");
    });
    setMode("signup");
  }

  function refreshUserData(user) {
    renderUser(user);
    if (user) loadOwnProfile(user);
    loadMyModeration(user);
    loadMyReports(user);
  }
  client.auth.getSession().then(({ data, error }) => {
    if (error) say(error.message);
    refreshUserData(data?.session?.user || null);
  });
  client.auth.onAuthStateChange((_event, session) => refreshUserData(session?.user || null));
  loadMembers();
})();