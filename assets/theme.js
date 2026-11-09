/* Sparky's Space — saved dark theme and stable navigation */
(() => {
  const root = document.documentElement;
  const themeSelect = document.getElementById("theme-choice");
  const accentSelect = document.getElementById("accent-choice");
  const allowedThemes = ["lavender","rose","midnight","emerald","amber","slate","sakura","ocean","aurora","cherry","mocha"];
  const allowedAccents = ["pink","purple","blue","cyan","teal","green","orange","red"];
  const savedTheme = localStorage.getItem("sparky-theme");
  const savedAccent = localStorage.getItem("sparky-accent");
  const textSizeSelect = document.getElementById("text-size-choice");
  const reducedMotionChoice = document.getElementById("reduced-motion-choice");
  const savedTextSize = localStorage.getItem("sparky-text-size");
  const savedReducedMotion = localStorage.getItem("sparky-reduced-motion") === "true";
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
  function applyTextSize(size) {
    const safe = ["normal","large","larger"].includes(size) ? size : "normal";
    root.dataset.textSize = safe === "normal" ? "" : safe;
    if (textSizeSelect) textSizeSelect.value = safe;
    localStorage.setItem("sparky-text-size", safe);
  }
  function applyReducedMotion(enabled) {
    root.classList.toggle("reduce-motion", Boolean(enabled));
    if (reducedMotionChoice) reducedMotionChoice.checked = Boolean(enabled);
    localStorage.setItem("sparky-reduced-motion", String(Boolean(enabled)));
  }
  applyTextSize(savedTextSize || "normal");
  applyReducedMotion(savedReducedMotion);
  textSizeSelect?.addEventListener("change", () => applyTextSize(textSizeSelect.value));
  reducedMotionChoice?.addEventListener("change", () => applyReducedMotion(reducedMotionChoice.checked));
  applyTheme(savedTheme || "lavender");
  applyAccent(savedAccent || "purple");
  themeSelect?.addEventListener("change", () => applyTheme(themeSelect.value));
  accentSelect?.addEventListener("change", () => applyAccent(accentSelect.value));

  // Navigation remains visible and stable; the CSS keeps it to one compact row.
  // Hiding a sticky nav during scroll caused disorienting scroll jumps on some browsers.
})();
