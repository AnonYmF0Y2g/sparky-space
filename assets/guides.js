/* Device selector for the free guide library. */
(() => {
  const select = document.getElementById("guide-device-select");
  const button = document.getElementById("guide-device-go");
  if (!select || !button) return;
  const go = () => {
    const destination = select.value;
    if (destination) window.location.href = destination;
    else select.focus();
  };
  button.addEventListener("click", go);
  select.addEventListener("keydown", event => {
    if (event.key === "Enter") go();
  });
})();
