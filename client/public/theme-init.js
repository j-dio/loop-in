// Set theme before paint to avoid a flash of the wrong mode.
// External (not inline) so a strict Content-Security-Policy `script-src 'self'` allows it
// without needing 'unsafe-inline' or a per-build hash.
(function () {
  try {
    var stored = localStorage.getItem("loopin-theme");
    var system = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = stored ? stored === "dark" : system;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
