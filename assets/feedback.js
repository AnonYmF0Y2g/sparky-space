(() => {
  "use strict";
  const SUPABASE_URL = "https://wuwvazwrqmdqiztyxfrs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KfdFoBj7R-Zf5vQv6L4NYA_rKhju2oj";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = id => document.getElementById(id);
  const form = $("feedback-form");
  const button = $("feedback-submit");
  const status = $("feedback-status");

  db.auth.getUser().then(({data}) => {
    const user = data?.user;
    $("feedback-identity").textContent = user
      ? "You are signed in. Your account ID will be attached to this submission; your email address is not included."
      : "You can submit as a guest. No email address or contact details are requested.";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if ($("feedback-website").value.trim()) {
      form.reset();
      status.textContent = "Thanks! Your feedback has been received.";
      return;
    }
    const title = $("feedback-title").value.trim();
    const message = $("feedback-message").value.trim();
    if (title.length < 4 || message.length < 20) {
      status.textContent = "Please add a short title and at least 20 characters of detail.";
      return;
    }
    button.disabled = true;
    status.textContent = "Sending feedback...";
    try {
      const {data:authData, error:authError} = await db.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user || null;
      const {error} = await db.from("feedback_submissions").insert({
        user_id: user?.id || null,
        category: $("feedback-category").value,
        title,
        message
      });
      if (error) throw error;
      form.reset();
      status.textContent = "Feedback sent. Thank you for helping improve Sparky's Space! :3";
    } catch (error) {
      status.textContent = error?.message?.includes("rate limited")
        ? error.message
        : "We couldn't send that right now. Please try again later.";
    } finally {
      button.disabled = false;
    }
  });
})();