/* Public announcement feed for Sparky's Space.
   Only published rows are requested. All announcement text is rendered as text, never HTML. */
(() => {
  "use strict";

  const target = document.getElementById("announcements-list");
  const status = document.getElementById("announcements-message");
  if (!target) return;

  const SUPABASE_URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";

  function showMessage(text) {
    if (status) status.textContent = text || "";
  }

  function showEmpty(text) {
    const empty = document.createElement("p");
    empty.className = "announcement-empty";
    empty.textContent = text;
    target.replaceChildren(empty);
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
  }

  async function loadAnnouncements() {
    if (!window.supabase) {
      showEmpty("Announcements are temporarily unavailable. Please try again later.");
      showMessage("The community service could not load.");
      return;
    }

    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await client
        .from("announcements")
        .select("id,title,body,is_pinned,published_at,created_at")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      target.replaceChildren();

      if (!data || data.length === 0) {
        showEmpty("No announcements just yet. Check back soon! ^w^");
        return;
      }

      for (const announcement of data) {
        const card = document.createElement("article");
        card.className = "announcement-card";

        const heading = document.createElement("h3");
        heading.textContent = announcement.title || "Community update";

        const meta = document.createElement("div");
        meta.className = "announcement-meta";

        if (announcement.is_pinned) {
          const pinned = document.createElement("span");
          pinned.className = "announcement-pin";
          pinned.textContent = "Pinned";
          meta.append(pinned);
        }

        const date = document.createElement("span");
        date.textContent = formatDate(announcement.published_at || announcement.created_at);
        meta.append(date);

        const body = document.createElement("p");
        body.textContent = announcement.body || "";

        card.append(heading, meta, body);
        target.append(card);
      }

      showMessage("");
    } catch (error) {
      showEmpty("Announcements are temporarily unavailable. Please try again later.");
      showMessage("Could not load announcements. Please try again later.");
    }
  }

  loadAnnouncements();
})();
