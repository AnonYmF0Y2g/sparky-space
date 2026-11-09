/* Separate selectors: topic manuals and platform manuals. */
(() => {
  const pairs = [
    ["guide-topic-select", "guide-topic-go"],
    ["guide-platform-select", "guide-platform-go"]
  ];
  for (const [selectId, buttonId] of pairs) {
    const select = document.getElementById(selectId);
    const button = document.getElementById(buttonId);
    if (!select || !button) continue;
    const go = () => {
      if (select.value) window.location.href = select.value;
      else select.focus();
    };
    button.addEventListener("click", go);
    select.addEventListener("keydown", event => {
      if (event.key === "Enter") go();
    });
  }
})();
