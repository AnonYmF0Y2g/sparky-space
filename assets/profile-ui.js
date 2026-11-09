/* Profile media uploads and tag editor */
(() => {
  "use strict";
  const URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const db = window.supabase.createClient(URL, KEY);
  const el = id => document.getElementById(id);
  const say = value => { if (el("profile-upload-message")) el("profile-upload-message").textContent = value; };
  let user = null;
  let originalMedia = { avatar: "", banner: "" };

  async function load() {
    const { data } = await db.auth.getUser();
    user = data?.user || null;
    if (!user || !el("profile-form")) return;
    const { data: profile } = await db.from("profiles")
      .select("avatar_url,banner_url").eq("id", user.id).maybeSingle();
    if (!profile) return;
    originalMedia = { avatar: profile.avatar_url || "", banner: profile.banner_url || "" };
    for (const [kind,url] of Object.entries(originalMedia)) {
      const field = el("profile-" + kind + "-url");
      const preview = el("profile-" + kind + "-preview");
      if (field) field.value = url;
      if (preview && url) { preview.src = url; preview.hidden = false; }
    }
    const { data: tags } = await db.from("profile_tags").select("tag").eq("user_id",user.id);
    if (el("profile-tags-input")) el("profile-tags-input").value = (tags || []).map(x=>x.tag).join(", ");
  }

  async function upload(kind,file) {
    if (!user) throw new Error("Please sign in again before uploading.");
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5*1024*1024)
      throw new Error("Choose a JPG, PNG, or WebP image under 5 MB.");
    const ext = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" })[file.type];
    const path = user.id + "/" + kind + "-" + crypto.randomUUID() + "." + ext;
    const { error } = await db.storage.from("profile-media").upload(path,file,{contentType:file.type,upsert:false});
    if (error) throw error;
    const { data } = db.storage.from("profile-media").getPublicUrl(path);
    const url = data.publicUrl;
    el("profile-" + kind + "-url").value = url;
    const preview = el("profile-" + kind + "-preview");
    preview.src = url; preview.hidden = false;
    say((kind === "avatar" ? "Profile picture" : "Banner") + " uploaded. Save your profile to apply it.");
  }

  for (const kind of ["avatar","banner"]) {
    el("profile-" + kind + "-file")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const input = event.target; input.disabled = true; say("Uploading " + kind + "...");
      try { await upload(kind,file); }
      catch(error) { say("Upload failed: " + (error.message || "Please try again.")); input.value = ""; }
      finally { input.disabled = false; }
    });
  }

  el("profile-form")?.addEventListener("submit", async event => {
    const form = event.currentTarget;
    if (form.dataset.tagsBound === "yes") return;
    event.preventDefault();
    const tags = [...new Set((el("profile-tags-input")?.value || "").split(",").map(x=>x.trim().replace(/^#/,"")).filter(Boolean))];
    if (tags.length > 6 || tags.some(x=>x.length<2 || x.length>24 || !/^[\p{L}\p{N} _-]+$/u.test(x))) {
      say("Use up to 6 tags. Each must be 2–24 letters, numbers, spaces, _ or -.");
      return;
    }
    form.dataset.tagsBound = "yes";
    // Let the existing profile handler save profile fields first; then synchronize tags.
    setTimeout(async () => {
      try {
        const { error: removeError } = await db.from("profile_tags").delete().eq("user_id",user.id);
        if (removeError) throw removeError;
        if (tags.length) {
          const { error } = await db.from("profile_tags").insert(tags.map(tag=>({user_id:user.id,tag})));
          if (error) throw error;
        }
        say("Profile tags saved.");
      } catch(error) { say("Profile details saved, but tags could not be saved: " + (error.message || "Please retry.")); }
      finally { delete form.dataset.tagsBound; }
    }, 700);
  }, true);

  load();
})();