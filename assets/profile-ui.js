/* Profile media uploads: files are stored in the user's own folder. */
(() => {
  "use strict";
  const URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const db = window.supabase.createClient(URL, KEY);
  const el = id => document.getElementById(id);
  const say = value => { if (el("profile-upload-message")) el("profile-upload-message").textContent = value; };
  let user = null;

  async function upload(kind, file) {
    if (!user) throw new Error("Please sign in again before uploading.");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)
      throw new Error("Choose a JPG, PNG, or WebP image under 5 MB.");
    const ext = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" })[file.type];
    const path = user.id + "/" + kind + "-" + crypto.randomUUID() + "." + ext;
    const { error } = await db.storage.from("profile-media").upload(path, file, { contentType:file.type, upsert:false });
    if (error) throw error;
    const { data } = db.storage.from("profile-media").getPublicUrl(path);
    const url = data.publicUrl;
    const field = el("profile-" + kind + "-url");
    const preview = el("profile-" + kind + "-preview");
    if (field) field.value = url;
    if (preview) { preview.src = url; preview.hidden = false; }
    say((kind === "avatar" ? "Profile picture" : "Banner") + " uploaded. Save your profile to apply it.");
  }

  for (const kind of ["avatar", "banner"]) {
    el("profile-" + kind + "-file")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const input = event.target;
      input.disabled = true;
      say("Uploading " + (kind === "avatar" ? "profile picture" : "banner") + "...");
      try { await upload(kind, file); }
      catch (error) {
        say("Upload failed: " + (error.message || "Please try again."));
        input.value = "";
      } finally { input.disabled = false; }
    });
    el("profile-" + kind + "-remove")?.addEventListener("click", () => {
      const field = el("profile-" + kind + "-url");
      const preview = el("profile-" + kind + "-preview");
      const input = el("profile-" + kind + "-file");
      if (field) field.value = "";
      if (preview) { preview.hidden = true; preview.removeAttribute("src"); }
      if (input) input.value = "";
      say((kind === "avatar" ? "Profile picture" : "Banner") + " will be removed when you save your profile.");
    });
  }

  db.auth.getUser().then(({ data }) => { user = data?.user || null; });
})();