/* Sparky's Space — saved dark theme and hide-on-scroll navigation */
(() => {
  const root = document.documentElement;
  const themeSelect = document.getElementById("theme-choice");
  const accentSelect = document.getElementById("accent-choice");
  const allowedThemes = ["lavender","rose","midnight","emerald","amber","slate"];
  const allowedAccents = ["pink","purple","blue","cyan","teal","green","orange","red"];
  const savedTheme = localStorage.getItem("sparky-theme");
  const savedAccent = localStorage.getItem("sparky-accent");
  function applyTheme(theme) {
    const safe = allowedThemes.includes(theme) ? theme : "lavender";
    root.dataset.theme = safe === "lavender" ? "" : safe;
    if (themeSelect) themeSelect.value = safe;
    localStorage.setItem("sparky-theme", safe);
  }
  function applyAccent(accent) {
    const safe = allowedAccents.includes(accent) ? accent : "purple";
    root.dataset.accent = safe;
    if (accentSelect) accentSelect.value = safe;
    localStorage.setItem("sparky-accent", safe);
  }
  applyTheme(savedTheme || "lavender");
  applyAccent(savedAccent || "purple");
  themeSelect?.addEventListener("change", () => applyTheme(themeSelect.value));
  accentSelect?.addEventListener("change", () => applyAccent(accentSelect.value));

  const nav = document.querySelector("body > nav");
  if (!nav) return;
  let lastY = window.scrollY;
  let ticking = false;
  const reveal = () => nav.classList.remove("nav-hidden");
  const update = () => {
    const y = window.scrollY;
    if (y < 80 || y < lastY - 5) reveal();
    else if (y > 140 && y > lastY + 5 && !nav.contains(document.activeElement)) nav.classList.add("nav-hidden");
    lastY = y;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive:true });
  nav.addEventListener("focusin", reveal);
  nav.addEventListener("pointerenter", reveal);
  nav.addEventListener("keydown", reveal);
})();
