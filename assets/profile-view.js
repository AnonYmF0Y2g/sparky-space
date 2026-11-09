(() => {
  "use strict";
  const URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const db = window.supabase.createClient(URL, KEY);
  const $ = id => document.getElementById(id);
  const root = $("profile-root");
  const params = new URLSearchParams(location.search);
  const username = (params.get("username") || "").trim().replace(/^@/, "");
  let profile = null;
  let currentUser = null;

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function safeImage(url, className, alt) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return null;
      const img = node("img");
      img.src = parsed.href;
      img.alt = alt || "";
      img.className = className;
      img.loading = "lazy";
      return img;
    } catch { return null; }
  }
  function showUnavailable() {
    root.replaceChildren(
      node("h2", "Profile unavailable"),
      node("p", "This profile may be private, may not exist, or may have been removed from the public directory."),
      node("a", "Back to the community", "")
    );
    root.querySelector("a").href = "community.html";
  }

  async function load() {
    if (!username || username.length > 20) return showUnavailable();
    const [{data:authData},{data:found,error}] = await Promise.all([
      db.auth.getUser(),
      db.from("public_profiles")
        .select("id,username,display_name,bio,status,avatar_url,banner_url,profile_accent,staff_role,created_at")
        .eq("username", username).maybeSingle()
    ]);
    currentUser = authData?.user || null;
    if (error || !found) return showUnavailable();
    profile = found;
    await renderProfile();
    $("guestbook-panel").hidden = false;
    await loadGuestbook();
    if (currentUser) $("profile-guestbook-form").hidden = false;
    else $("guestbook-signin-prompt").hidden = false;
  }

  async function renderProfile() {
    root.replaceChildren();
    const accents = {pink:"#f18abd",purple:"#c49aff",blue:"#80b8ff",cyan:"#69d5e8",teal:"#69d6c2",green:"#8bd88a",orange:"#f2ad70",red:"#f18c91"};
    root.style.setProperty("--member-accent", accents[profile.profile_accent] || accents.pink);
    const banner = safeImage(profile.banner_url, "public-profile-banner", "");
    if (banner) root.append(banner);
    const avatar = safeImage(profile.avatar_url, "public-profile-avatar", "Profile picture");
    if (avatar) root.append(avatar);
    root.append(node("h2", profile.display_name || profile.username, "public-profile-name"));
    root.append(node("p", "@" + profile.username, "member-meta"));
    const roles = {owner:"Owner",admin:"Admin",moderator:"Moderator",support:"Support"};
    if (profile.staff_role && roles[profile.staff_role]) {
      root.append(node("span", "✦ " + roles[profile.staff_role], "profile-role-badge"));
    }
    if (profile.status) root.append(node("p", profile.status, "public-profile-status"));

    const about = node("section", undefined, "public-profile-section");
    about.append(node("h3", "About"));
    about.append(node("p", profile.bio || "This member hasn't added a bio yet."));
    root.append(about);

    const tagsSection = node("section", undefined, "public-profile-section");
    tagsSection.append(node("h3", "Tags and badges"));
    const [tagResult,badgeResult] = await Promise.all([
      db.from("profile_tags").select("tag").eq("user_id", profile.id),
      db.from("profile_badges").select("badges(name,icon,description)").eq("user_id", profile.id)
    ]);
    const chips = node("div", undefined, "profile-chip-row");
    for (const item of tagResult.data || []) chips.append(node("span", item.tag, "profile-tag-chip"));
    for (const item of badgeResult.data || []) {
      if (item.badges) chips.append(node("span", (item.badges.icon || "✦") + " " + item.badges.name, "profile-badge-chip"));
    }
    if (chips.childElementCount) tagsSection.append(chips);
    else tagsSection.append(node("p", "No tags or badges have been added yet.", "section-note"));
    root.append(tagsSection);
    root.append(node("p", profile.created_at ? "Member since " + new Date(profile.created_at).toLocaleDateString() : "", "member-meta"));
    const back = node("a", "← Back to community");
    back.href = "community.html";
    root.append(back);
  }

  async function loadGuestbook() {
    const target = $("guestbook-entries");
    target.replaceChildren(node("p","Loading guestbook...","section-note"));
    const {data,error} = await db.rpc("get_public_guestbook",{p_profile_id:profile.id});
    target.replaceChildren();
    if (error) { target.append(node("p","Guestbook is temporarily unavailable.","section-note")); return; }
    if (!data?.length) { target.append(node("p","No messages yet. You can be the first!","section-note")); return; }
    for (const entry of data) {
      const card = node("article",undefined,"feature-item");
      card.append(node("strong",entry.author_name || "Community member"));
      card.append(node("p",entry.message));
      card.append(node("small",new Date(entry.created_at).toLocaleString()));
      target.append(card);
    }
  }

  $("profile-guestbook-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser || !profile) return;
    const message = $("profile-guestbook-message").value.trim();
    if (message.length < 2 || message.length > 400) {
      $("profile-guestbook-status").textContent = "Please enter a message between 2 and 400 characters.";
      return;
    }
    const button = $("profile-guestbook-submit");
    button.disabled = true;
    $("profile-guestbook-status").textContent = "Posting message...";
    const {error} = await db.from("guestbook_entries").insert({
      profile_id: profile.id,
      author_id: currentUser.id,
      message
    });
    button.disabled = false;
    if (error) {
      $("profile-guestbook-status").textContent = "Couldn't post that message. Please try again.";
      return;
    }
    $("profile-guestbook-message").value = "";
    $("profile-guestbook-status").textContent = "Guestbook message posted. :3";
    await loadGuestbook();
  });

  load();
})();