/* Shared application logic for Sparky's Space */
(() => {
  "use strict";
  const SUPABASE_URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const siteKey = window.SPARKY_CONFIG?.turnstileSiteKey || "";
  let activeUser = null;
  let originalProfileMedia = { avatar: "", banner: "" };
  let profileLoadSequence = 0;
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
    const request = ++profileLoadSequence;
    if (!user || !byId("profile-form")) return false;
    const { data, error } = await client.from("profiles")
      .select("username, display_name, bio, status, avatar_url, banner_url, profile_accent, is_public, show_bio, show_status").eq("id", user.id).maybeSingle();
    if (request !== profileLoadSequence || activeUser?.id !== user.id) return false;
    if (error) { setText("profile-message", "Couldn't load your profile: " + error.message); return false; }
    if (data) {
      byId("profile-display-name").value = data.display_name || "";
      byId("profile-status").value = data.status || "";
      byId("profile-bio").value = data.bio || "";
      originalProfileMedia = { avatar: data.avatar_url || "", banner: data.banner_url || "" };
      for (const kind of ["avatar", "banner"]) {
        const url = safeImageUrl(originalProfileMedia[kind]);
        const field = byId("profile-" + kind + "-url");
        const preview = byId("profile-" + kind + "-preview");
        if (field) field.value = url;
        if (preview) { preview.hidden = !url; if (url) preview.src = url; else preview.removeAttribute("src"); }
      }
      if (byId("profile-accent")) byId("profile-accent").value = data.profile_accent || "pink";
      if (byId("profile-is-public")) byId("profile-is-public").checked = data.is_public === true;
      if (byId("profile-show-bio")) byId("profile-show-bio").checked = data.show_bio === true;
      if (byId("profile-show-status")) byId("profile-show-status").checked = data.show_status === true;
      const { data: tags, error: tagsError } = await client.from("profile_tags").select("tag").eq("user_id", user.id);
      if (request !== profileLoadSequence || activeUser?.id !== user.id) return false;
      if (tagsError) setText("profile-message", "Profile loaded, but tags could not be refreshed: " + tagsError.message);
      if (byId("profile-tags-input")) byId("profile-tags-input").value = (tags || []).map(item => item.tag).join(", ");
      return true;
    }
    setText("profile-message", "Your profile is still being prepared. Try Reload saved details in a moment.");
    return false;
  }

  async function loadMembers() {
    const directory = byId("member-directory");
    if (!directory) return;
    directory.textContent = "Loading members...";
    const { data, error } = await client.from("public_profiles")
      .select("id, username, display_name, bio, status, avatar_url, banner_url, profile_accent, staff_role, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) { directory.textContent = "Member directory is unavailable: " + error.message; return; }
    if (!data || data.length === 0) { directory.textContent = "No member profiles yet. Be the first!"; return; }
    const memberIds = data.map(member => member.id);
    const [tagResult, badgeResult] = await Promise.all([
      client.from("profile_tags").select("user_id,tag").in("user_id", memberIds),
      client.from("profile_badges").select("user_id,badges(name,icon)").in("user_id", memberIds)
    ]);
    const tagsByUser = new Map();
    for (const item of (tagResult.data || [])) {
      if (!tagsByUser.has(item.user_id)) tagsByUser.set(item.user_id, []);
      tagsByUser.get(item.user_id).push(item.tag);
    }
    const badgesByUser = new Map();
    for (const item of (badgeResult.data || [])) {
      if (!badgesByUser.has(item.user_id)) badgesByUser.set(item.user_id, []);
      if (item.badges) badgesByUser.get(item.user_id).push(item.badges);
    }
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
      if (member.staff_role) {
        const role = document.createElement("span"); role.className = "profile-role-badge";
        const roleNames = {owner:"Owner",admin:"Admin",moderator:"Moderator",support:"Support"};
        role.textContent = "✦ " + (roleNames[member.staff_role] || "Staff");
        content.append(role);
      }
      const profileChips = document.createElement("div"); profileChips.className = "profile-chip-row";
      for (const tagText of (tagsByUser.get(member.id) || [])) {
        const chip = document.createElement("span"); chip.className = "profile-tag-chip"; chip.textContent = tagText; profileChips.append(chip);
      }
      for (const badgeData of (badgesByUser.get(member.id) || [])) {
        const chip = document.createElement("span"); chip.className = "profile-badge-chip"; chip.textContent = (badgeData.icon || "✦") + " " + badgeData.name; profileChips.append(chip);
      }
      if (profileChips.childElementCount) content.append(profileChips);
      if (member.status) { const status = document.createElement("p"); status.textContent = member.status; content.append(status); }
      if (member.bio) { const bio = document.createElement("p"); bio.textContent = member.bio; content.append(bio); }
      const joined = document.createElement("p"); joined.className = "member-meta";
      joined.textContent = member.created_at ? "Joined " + new Date(member.created_at).toLocaleDateString() : "";
      content.append(joined);
      if (member.username) {
        const view = document.createElement("a");
        view.href = "profile.html?username=" + encodeURIComponent(member.username);
        view.textContent = "View profile →";
        view.className = "member-profile-link";
        content.append(view);
      }
      card.append(content); directory.append(card);
    }
    setText("members-message", data.length === 100 ? "Showing the first 100 members." : data.length + " member profile(s).");
  }

  function profileStoragePath(url, userId) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const marker = "/storage/v1/object/public/profile-media/";
      const index = parsed.pathname.indexOf(marker);
      if (index < 0) return null;
      const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
      return path.startsWith(userId + "/") ? path : null;
    } catch { return null; }
  }

  const profileForm = byId("profile-form");
  if (profileForm && !byId("profile-reload")) {
    const reload = document.createElement("button");
    reload.type = "button";
    reload.id = "profile-reload";
    reload.className = "secondary";
    reload.textContent = "Reload saved details";
    profileForm.insertBefore(reload, byId("profile-save"));
    reload.addEventListener("click", async () => {
      if (!activeUser) return;
      reload.disabled = true;
      setText("profile-message", "Reloading your saved profile from the server...");
      try {
        const loaded = await loadOwnProfile(activeUser);
        setText("profile-message", loaded
          ? "Your saved profile details have been reloaded."
          : "Couldn't reload your profile. Please check your connection and try again.");
      } finally {
        reload.disabled = false;
      }
    });
  }
  if (profileForm) profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeUser) return;
    const save = byId("profile-save");
    save.disabled = true;
    setText("profile-message", "Saving your profile...");
    const tags = [...new Set((byId("profile-tags-input")?.value || "")
      .split(",").map(value => value.trim().replace(/^#/, "")).filter(Boolean))];
    if (tags.length > 6 || tags.some(tag => tag.length < 2 || tag.length > 24 || !/^[\p{L}\p{N} _-]+$/u.test(tag) || ["owner","admin","moderator","support","staff"].includes(tag.toLowerCase()))) {
      save.disabled = false;
      setText("profile-message", "Use up to 6 tags. Each must be 2–24 letters, numbers, spaces, underscores, or hyphens.");
      return;
    }
    const avatarRaw = byId("profile-avatar-url")?.value.trim() || "";
    const bannerRaw = byId("profile-banner-url")?.value.trim() || "";
    const avatarUrl = safeImageUrl(avatarRaw);
    const bannerUrl = safeImageUrl(bannerRaw);
    if ((avatarRaw && !avatarUrl) || (bannerRaw && !bannerUrl)) {
      save.disabled = false;
      setText("profile-message", "Uploaded image links must use HTTPS. Please upload the image again.");
      return;
    }
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
    const { data: savedProfile, error: profileError } = await client.from("profiles")
      .update(values).eq("id", activeUser.id)
      .select("id, display_name, bio, status, avatar_url, banner_url, profile_accent, is_public, show_bio, show_status")
      .maybeSingle();
    if (profileError || !savedProfile) {
      save.disabled = false;
      setText("profile-message", profileError
        ? "Couldn't save your profile: " + profileError.message
        : "No profile row was updated. Reload your saved details and try again.");
      return;
    }
    const { error: tagsError } = await client.rpc("replace_my_profile_tags", { p_tags: tags });
    if (tagsError) {
      save.disabled = false;
      setText("profile-message", "Profile details saved, but tags could not be saved: " + tagsError.message);
      return;
    }
    for (const kind of ["avatar", "banner"]) {
      const previous = originalProfileMedia[kind];
      const current = values[kind + "_url"] || "";
      const oldPath = previous !== current ? profileStoragePath(previous, activeUser.id) : null;
      if (oldPath) {
        const { error: removeError } = await client.storage.from("profile-media").remove([oldPath]);
        if (removeError) console.warn("Old profile media could not be removed:", removeError.message);
      }
      originalProfileMedia[kind] = current;
    }
    const reloaded = await loadOwnProfile(activeUser);
    save.disabled = false;
    setText("profile-message", reloaded
      ? "Profile saved and reloaded from the server! ^w^"
      : "Your profile was saved, but the editor couldn't reload it. Use Reload saved details.");
    setText("profile-upload-message", "Your profile images are up to date.");
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



  const imageboardBoards = {
    art: { code: "/art/", title: "Art & Creativity", description: "Drawings, designs, crafts, and creative projects." },
    furry: { code: "/fur/", title: "Furry & Characters", description: "Fursonas, character art, and SFW furry creations." },
    tech: { code: "/tech/", title: "Computers & Tech", description: "PCs, Linux, hardware, software, and setups." },
    games: { code: "/games/", title: "Gaming", description: "Games, game art, and gaming setups." },
    general: { code: "/general/", title: "General", description: "Other SFW pictures and community projects." }
  };

  function imageboardBoardFromUrl() {
    const requested = new URLSearchParams(window.location.search).get("board") || "art";
    return Object.prototype.hasOwnProperty.call(imageboardBoards, requested) ? requested : "art";
  }

  function imageboardNode(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  async function imageboardSignedImage(path, ttl = 900) {
    if (!path) return "";
    const { data, error } = await client.storage.from("community-images").createSignedUrl(path, ttl);
    return error || !data?.signedUrl ? "" : data.signedUrl;
  }

  async function loadImageboardReplyQueue(user) {
    const panel = byId("imageboard-staff-reply-queue");
    const root = byId("imageboard-staff-reply-items");
    if (!panel || !root) return;
    panel.hidden = true;
    root.replaceChildren();
    if (!user) return;
    const { data: role, error: roleError } = await client.from("staff_roles")
      .select("role").eq("user_id", user.id).maybeSingle();
    if (roleError || !["owner", "admin", "moderator"].includes(role?.role)) return;
    panel.hidden = false;
    const { data, error } = await client.from("imageboard_replies")
      .select("id,thread_id,body,image_storage_path,created_at")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(50);
    if (error) {
      root.textContent = "The reply queue could not be loaded.";
      return;
    }
    if (!data?.length) {
      root.textContent = "There are no replies waiting for review.";
      return;
    }
    for (const reply of data) {
      const card = imageboardNode("article", undefined, "ib-staff-reply");
      const heading = imageboardNode("strong", "Pending anonymous reply");
      const meta = imageboardNode("p", "Submitted " + new Date(reply.created_at).toLocaleString(), "member-meta");
      const body = imageboardNode("p", reply.body || "Image reply");
      card.append(heading, meta, body);
      if (reply.image_storage_path) {
        const url = await imageboardSignedImage(reply.image_storage_path, 900);
        if (url) {
          const image = imageboardNode("img", undefined, "ib-reply-image");
          image.src = url; image.alt = "Pending reply attachment";
          card.append(image);
        } else {
          card.append(imageboardNode("p", "The attached image could not be previewed.", "section-note"));
        }
      }
      const actions = imageboardNode("div", undefined, "ib-staff-actions");
      for (const [label, status] of [["Approve", "approved"], ["Reject", "rejected"], ["Remove", "removed"]]) {
        const button = imageboardNode("button", label);
        button.type = "button";
        button.addEventListener("click", async () => {
          button.disabled = true;
          const { error: updateError } = await client.from("imageboard_replies").update({
            status, reviewed_at: new Date().toISOString(), reviewed_by: user.id
          }).eq("id", reply.id);
          if (updateError) {
            body.textContent = "Review failed: " + updateError.message;
            button.disabled = false;
          } else {
            await loadCommunityPosts(activeUser);
          }
        });
        actions.append(button);
      }
      card.append(actions);
      root.append(card);
    }
  }

  async function renderImageboardThread(post, user, boardSlug, root) {
    const board = imageboardBoards[boardSlug] || imageboardBoards.art;
    const back = imageboardNode("a", "← Back to " + board.code);
    back.href = "image-board.html?board=" + encodeURIComponent(boardSlug);
    back.className = "ib-back-link";
    root.append(back);

    const op = imageboardNode("article", undefined, "ib-original-post");
    const opHeading = imageboardNode("h3", post.title);
    const opMeta = imageboardNode("p", "Anonymous · " + new Date(post.created_at).toLocaleString(), "ib-post-meta");
    op.append(opHeading, opMeta);
    if (post.storage_path) {
      const imageUrl = await imageboardSignedImage(post.storage_path, 3600);
      if (imageUrl) {
        const image = imageboardNode("img", undefined, "ib-original-image");
        image.src = imageUrl; image.alt = post.title; image.loading = "lazy";
        op.append(image);
      } else {
        op.append(imageboardNode("p", "The attached image is not available.", "section-note"));
      }
    } else {
      op.append(imageboardNode("p", "Text-only thread · no image attached.", "section-note"));
    }
    if (post.caption) op.append(imageboardNode("p", post.caption, "ib-post-comment"));
    const visibleTags = (post.tags || []).filter(tag => !String(tag).startsWith("board-"));
    if (visibleTags.length) {
      const tags = imageboardNode("div", undefined, "image-post-tags");
      for (const tag of visibleTags) tags.append(imageboardNode("span", tag, "tag"));
      op.append(tags);
    }
    if (post.status !== "approved") {
      const message = post.status === "pending"
        ? "This thread is awaiting moderator approval and is only visible to you."
        : "This thread was not published and is only visible to its submitter and staff.";
      op.append(imageboardNode("p", message, "section-note"));
      if (post.status === "pending" && user?.id === post.user_id) {
        const remove = imageboardNode("button", "Delete pending thread");
        remove.type = "button";
        remove.addEventListener("click", async () => {
          if (!window.confirm("Delete this pending thread and its uploaded image?")) return;
          remove.disabled = true;
          const { error: deleteError } = await client.from("community_posts").delete().eq("id", post.id);
          if (deleteError) {
            messageNode.textContent = "Couldn't delete the thread: " + deleteError.message;
            remove.disabled = false;
            return;
          }
          if (post.storage_path) await client.storage.from("community-images").remove([post.storage_path]);
          window.location.href = "image-board.html?board=" + encodeURIComponent(boardSlug);
        });
        const messageNode = imageboardNode("p", "", "section-note");
        op.append(remove, messageNode);
      }
      root.append(op);
      return;
    }
    root.append(op);

    const replyHeading = imageboardNode("h3", "Replies", "ib-replies-heading");
    root.append(replyHeading);
    const replyRoot = imageboardNode("div", undefined, "ib-replies");
    root.append(replyRoot);
    const { data: replies, error } = await client.from("imageboard_replies")
      .select("id,thread_id,body,status,created_at,image_storage_path")
      .eq("thread_id", post.id).order("created_at", { ascending: true }).limit(100);
    if (error) {
      replyRoot.textContent = "Replies are temporarily unavailable.";
    } else if (!replies?.length) {
      replyRoot.textContent = "No replies yet. Start the conversation!";
    } else {
      for (const reply of replies) {
        const card = imageboardNode("article", undefined, "ib-reply");
        const meta = imageboardNode("p", "Anonymous · " + new Date(reply.created_at).toLocaleString(), "ib-post-meta");
        card.append(meta);
        if (reply.body) card.append(imageboardNode("p", reply.body, "ib-reply-body"));
        if (reply.image_storage_path) {
          const url = await imageboardSignedImage(reply.image_storage_path, 900);
          if (url) {
            const image = imageboardNode("img", undefined, "ib-reply-image");
            image.src = url; image.alt = "Anonymous reply attachment"; image.loading = "lazy";
            card.append(image);
          }
        }
        if (reply.status === "pending") {
          card.classList.add("ib-reply-pending");
          card.append(imageboardNode("small", "Awaiting moderator approval · only you and staff can see this for now."));
        } else if (reply.status !== "approved") {
          card.classList.add("ib-reply-pending");
          card.append(imageboardNode("small", "This reply was not published."));
        }
        replyRoot.append(card);
      }
    }

    if (!user) {
      const signIn = imageboardNode("p", undefined, "section-note");
      signIn.append(document.createTextNode("Sign in to reply. "));
      const link = imageboardNode("a", "Open Account");
      link.href = "account.html";
      signIn.append(link);
      root.append(signIn);
      return;
    }

    const form = imageboardNode("form", undefined, "ib-reply-form");
    const label = imageboardNode("label", "Write a reply");
    const textarea = imageboardNode("textarea");
    textarea.maxLength = 1200; textarea.rows = 3;
    textarea.placeholder = "Keep it friendly. Replies are reviewed before publication.";
    label.append(textarea);
    const imageLabel = imageboardNode("label", "Attach an image (optional)");
    const imageInput = imageboardNode("input");
    imageInput.type = "file"; imageInput.accept = "image/jpeg,image/png,image/webp";
    imageLabel.append(imageInput);
    const submit = imageboardNode("button", "Submit reply for review");
    submit.type = "submit";
    const status = imageboardNode("p", "", "section-note");
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    form.append(label, imageLabel, submit, status);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const body = textarea.value.trim();
      const file = imageInput.files?.[0] || null;
      if (body.length < 2 && !file) {
        status.textContent = "Write at least two characters or attach an image.";
        return;
      }
      if (body.length > 1200) {
        status.textContent = "Replies must be 1,200 characters or fewer.";
        return;
      }
      if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
        status.textContent = "Choose a JPG, PNG, or WebP image under 5 MB.";
        return;
      }
      submit.disabled = true;
      status.textContent = "Submitting your reply...";
      let uploadedPath = "";
      try {
        if (file) {
          const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
          uploadedPath = user.id + "/" + crypto.randomUUID() + "." + extension;
          const { error: uploadError } = await client.storage.from("community-images").upload(uploadedPath, file, {
            contentType: file.type, cacheControl: "3600", upsert: false
          });
          if (uploadError) throw uploadError;
        }
        const { error: insertError } = await client.from("imageboard_replies").insert({
          thread_id: post.id,
          author_id: user.id,
          body,
          image_storage_path: uploadedPath || null
        });
        if (insertError) throw insertError;
        textarea.value = ""; imageInput.value = "";
        root.replaceChildren();
        await renderImageboardThread(post, user, boardSlug, root);
      } catch (submitError) {
        if (uploadedPath) await client.storage.from("community-images").remove([uploadedPath]);
        status.textContent = "Couldn't submit your reply: " + (submitError.message || "Please try again.");
        submit.disabled = false;
      }
    });
    root.append(form);
  }

  async function loadCommunityPosts(user = activeUser) {
    const root = byId("image-board-grid");
    if (!root) return;
    const boardSlug = imageboardBoardFromUrl();
    const board = imageboardBoards[boardSlug];
    const boardCode = byId("imageboard-board-code");
    const boardTitle = byId("imageboard-board-title");
    const boardDescription = byId("imageboard-board-description");
    if (boardCode) boardCode.textContent = board.code;
    if (boardTitle) boardTitle.textContent = board.title;
    if (boardDescription) boardDescription.textContent = board.description;
    const selector = byId("image-upload-board");
    if (selector && selector.value !== boardSlug) selector.value = boardSlug;

    root.replaceChildren(imageboardNode("p", "Loading threads..."));
    const requestedThread = new URLSearchParams(window.location.search).get("thread");
    if (requestedThread) {
      const { data: post, error } = await client.from("community_posts")
        .select("id,user_id,title,caption,tags,storage_path,status,created_at,bump_at")
        .eq("id", requestedThread).maybeSingle();
      if (error || !post) {
        root.replaceChildren(imageboardNode("p", "That thread is unavailable or has not been approved."));
      } else {
        await renderImageboardThread(post, user, boardSlug, root);
      }
      await loadImageboardReplyQueue(user);
      return;
    }

    const { data, error } = await client.from("community_posts")
      .select("id,user_id,title,caption,tags,storage_path,status,created_at,bump_at")
      .order("bump_at", { ascending: false }).limit(100);
    if (error) {
      root.replaceChildren(imageboardNode("p", "The imageboard is unavailable: " + error.message));
      await loadImageboardReplyQueue(user);
      return;
    }
    const visiblePosts = (data || []).filter(post => {
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const boardTag = tags.find(tag => String(tag).startsWith("board-"));
      const assignedBoard = boardTag ? String(boardTag).slice(6) : "art";
      return assignedBoard === boardSlug;
    });
    const approvedIds = visiblePosts.filter(post => post.status === "approved").map(post => post.id);
    const replyCounts = new Map();
    if (approvedIds.length) {
      const { data: replyRows } = await client.from("imageboard_replies")
        .select("thread_id").in("thread_id", approvedIds).eq("status", "approved").limit(5000);
      for (const row of replyRows || []) replyCounts.set(row.thread_id, (replyCounts.get(row.thread_id) || 0) + 1);
    }
    root.replaceChildren();
    if (!visiblePosts.length) {
      root.append(imageboardNode("p", "No threads on this board yet. Start a text-only thread or attach an image."));
    }
    for (const post of visiblePosts) {
      const row = imageboardNode("article", undefined, "ib-thread-row");
      const url = await imageboardSignedImage(post.storage_path, 1800);
      if (url) {
        const thumbLink = imageboardNode("a");
        thumbLink.href = "image-board.html?board=" + encodeURIComponent(boardSlug) + "&thread=" + encodeURIComponent(post.id);
        thumbLink.className = "ib-thread-thumb-link";
        const thumb = imageboardNode("img");
        thumb.src = url; thumb.alt = post.title; thumb.loading = "lazy";
        thumbLink.append(thumb); row.append(thumbLink);
      }
      const details = imageboardNode("div", undefined, "ib-thread-details");
      const subject = imageboardNode("a", post.title, "ib-thread-subject");
      subject.href = "image-board.html?board=" + encodeURIComponent(boardSlug) + "&thread=" + encodeURIComponent(post.id);
      const metaText = post.status === "pending"
        ? "Your thread · Awaiting moderation"
        : post.status === "approved"
          ? "Anonymous · " + new Date(post.bump_at || post.created_at).toLocaleString() + " · " + (replyCounts.get(post.id) || 0) + " replies"
          : "Your thread · Not published";
      const meta = imageboardNode("p", metaText, "ib-post-meta");
      details.append(subject, meta);
      if (post.caption) details.append(imageboardNode("p", post.caption, "ib-thread-excerpt"));
      row.append(details);
      if (post.status === "pending") row.classList.add("ib-thread-pending");
      root.append(row);
    }
    await loadImageboardReplyQueue(user);
  }

  const imageUploadForm = byId("image-upload-form");
  if (imageUploadForm) imageUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = byId("image-upload-message");
    const button = byId("image-upload-submit");
    const file = byId("image-upload-file").files?.[0] || null;
    const userResult = await client.auth.getUser();
    const user = userResult.data?.user;
    if (userResult.error || !user) { status.textContent = "Please sign in before submitting a thread."; return; }
    if (file && (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      status.textContent = "Choose a JPG, PNG or WebP image under 5 MB."; return;
    }
    const token = captchaToken(communityWidget);
    if (!token) { status.textContent = "Complete the verification check before submitting."; return; }
    const title = byId("image-upload-title").value.trim();
    const caption = byId("image-upload-caption").value.trim();
    const boardSlug = byId("image-upload-board")?.value || "art";
    if (!Object.prototype.hasOwnProperty.call(imageboardBoards, boardSlug)) {
      status.textContent = "Choose a valid board."; return;
    }
    const userTags = byId("image-upload-tags").value.split(",")
      .map(tag => tag.trim().toLowerCase()).filter(tag => tag && !tag.startsWith("board-"));
    if (userTags.length > 7 || userTags.some(tag => !/^[a-z0-9-]{2,20}$/.test(tag))) {
      status.textContent = "Use up to seven tags, each 2–20 letters, numbers or hyphens."; return;
    }
    const tags = ["board-" + boardSlug, ...userTags];
    const extension = file ? (file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp") : "";
    const path = file ? user.id + "/" + crypto.randomUUID() + "." + extension : null;
    button.disabled = true; status.textContent = file ? "Uploading your image securely..." : "Submitting your text-only thread...";
    let uploaded = false;
    try {
      if (file) {
        const { error: uploadError } = await client.storage.from("community-images").upload(path, file, {
          contentType: file.type, cacheControl: "3600", upsert: false
        });
        if (uploadError) throw uploadError;
        uploaded = true;
      }
      const { data, error } = await client.functions.invoke("submit-community-action", {
        body: {
          action: "image_post", token, website: "", title, caption, tags,
          storage_path: path, rules_accepted: byId("image-rules-accepted").checked
        }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "The post could not be queued.");
      imageUploadForm.reset();
      status.textContent = "Submitted! Your thread is private until a moderator approves it.";
      await loadCommunityPosts(user);
    } catch (error) {
      if (uploaded) await client.storage.from("community-images").remove([path]);
      let detail = error?.message || "Please try again.";
      if (error?.context && typeof error.context.clone === "function") {
        try {
          const responseBody = await error.context.clone().json();
          if (typeof responseBody?.error === "string" && responseBody.error.trim()) detail = responseBody.error;
        } catch { /* Keep the SDK message when the response has no JSON body. */ }
      }
      status.textContent = "Couldn't submit the thread: " + detail;
    } finally { button.disabled = false; resetCaptcha(communityWidget); }
  });

  async function loadStaffImageQueue(user) {
    const root = byId("staff-image-queue");
    if (!root) return;
    root.replaceChildren();
    if (!user) { root.textContent = "Sign in with an authorized staff account to review image submissions."; return; }
    const { data: role, error: roleError } = await client.from("staff_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleError || !role) { root.textContent = "This page is restricted to authorized staff."; return; }
    const { data, error } = await client.from("community_posts")
      .select("id,user_id,title,caption,tags,storage_path,status,created_at")
      .in("status", ["pending","approved","rejected","removed"]).order("created_at", { ascending: true }).limit(100);
    if (error) { root.textContent = "Couldn't load image submissions: " + error.message; return; }
    if (!data?.length) { root.textContent = "There are no image submissions to review."; return; }
    for (const post of data) {
      const card = document.createElement("article"); card.className = "privacy-section";
      const heading = document.createElement("h3"); heading.textContent = post.title + " · " + post.status;
      const details = document.createElement("p"); details.textContent = post.caption || "No caption";
      const owner = document.createElement("p"); owner.className = "member-meta"; owner.textContent = "Submitted " + new Date(post.created_at).toLocaleString();
      card.append(heading, details, owner);
      if (post.storage_path) {
        const { data: signed } = await client.storage.from("community-images").createSignedUrl(post.storage_path, 900);
        if (signed?.signedUrl) { const image = document.createElement("img"); image.className = "staff-review-image"; image.src = signed.signedUrl; image.alt = post.title; card.append(image); }
      }
      const actions = document.createElement("div"); actions.className = "privacy-actions";
      for (const [label, nextStatus] of [["Approve","approved"],["Reject","rejected"],["Remove","removed"]]) {
        if (post.status === nextStatus) continue;
        const button = document.createElement("button"); button.type = "button"; button.textContent = label;
        button.addEventListener("click", async () => {
          if (!window.confirm(label + " this image submission?")) return;
          button.disabled = true;
          const { error: updateError } = await client.from("community_posts").update({
            status: nextStatus, reviewed_at: new Date().toISOString(), reviewed_by: user.id
          }).eq("id", post.id);
          if (updateError) { details.textContent = "Update failed: " + updateError.message; button.disabled = false; }
          else loadStaffImageQueue(user);
        });
        actions.append(button);
      }
      card.append(actions); root.append(card);
    }
  }

  function refreshUserData(user, session) {
    renderUser(user);
    const uploadNote = byId("image-upload-note");
    if (uploadNote) uploadNote.textContent = user ? "Signed in. Submissions are reviewed before they appear publicly." : "Sign in to your account before submitting an image.";
    loadStaffDeletionQueue(user);
    loadStaffImageQueue(user);
    loadCommunityPosts(user);
    renderSecuritySession(user, session);
    if (user) loadOwnProfile(user);
    loadMyModeration(user);
    loadMyReports(user);
  }
  client.auth.getSession().then(({ data, error }) => {
    if (error) say(error.message);
    refreshUserData(data?.session?.user || null, data?.session || null);
  });
  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user || null;
    // Supabase auth callbacks hold an internal lock; defer database reads until it is released.
    renderUser(user);
    setTimeout(() => refreshUserData(user, session || null), 0);
  });

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