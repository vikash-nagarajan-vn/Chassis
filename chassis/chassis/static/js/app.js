/* Chassis - the only hand-written JavaScript in the app.
 * Everything here is something a browser cannot do from Python:
 *   1. Remember the light/dark choice across visits
 *   2. Mint a per-tab demo token so each new tab gets a fresh demo
 *   3. Detect the user's timezone for the calendar
 *   4. Play the completion checkmark animation
 *   5. Open/close native dialogs and the mobile nav
 */

// 1. Theme: dark by default, remembered in localStorage.
(function () {
  var saved = null;
  try { saved = localStorage.getItem("chassis-theme"); } catch (e) {}
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
})();

function toggleTheme() {
  var el = document.documentElement;
  var light = el.getAttribute("data-theme") === "light";
  if (light) {
    el.removeAttribute("data-theme");
    try { localStorage.setItem("chassis-theme", "dark"); } catch (e) {}
  } else {
    el.setAttribute("data-theme", "light");
    try { localStorage.setItem("chassis-theme", "light"); } catch (e) {}
  }
}

// 2. Per-tab demo token. sessionStorage is per-tab and cleared when the tab
// closes, so a brand-new tab always starts a brand-new demo.
function openDemo() {
  var token = null;
  try { token = sessionStorage.getItem("chassis-demo"); } catch (e) {}
  if (!token) {
    token = "demo-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { sessionStorage.setItem("chassis-demo", token); } catch (e) {}
  }
  window.location.href = "/demo/" + token + "/board";
}

// 3. Timezone: prefill any empty timezone selector when a day dialog opens.
function applyTimezone(root) {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var sel = (root || document).querySelector("select[name='timezone']");
    if (sel && !sel.value) {
      var has = Array.prototype.some.call(sel.options, function (o) { return o.value === tz; });
      if (!has && tz) { var opt = new Option(tz, tz); sel.add(opt, 0); }
      sel.value = tz;
    }
  } catch (e) {}
}

// 4. Completion checkmark: server injects .checkmark-overlay into #fx; remove
// it once the animation ends so it does not linger.
document.addEventListener("animationend", function (ev) {
  var ring = ev.target.closest && ev.target.closest(".checkmark-overlay");
  if (ring && ev.animationName === "pop") ring.remove();
});

// 5a. Native dialogs: open via [data-open-dialog], close via [data-close-dialog].
document.addEventListener("click", function (ev) {
  var opener = ev.target.closest("[data-open-dialog]");
  if (opener) {
    var dlg = document.getElementById(opener.getAttribute("data-open-dialog"));
    if (dlg && dlg.showModal) dlg.showModal();
  }
  var closer = ev.target.closest("[data-close-dialog]");
  if (closer) {
    var d = closer.closest("dialog");
    if (d) d.close();
  }
});

// After HTMX swaps content into a dialog body, show the dialog and set timezone.
document.body.addEventListener("htmx:afterSwap", function (ev) {
  if (ev.detail.target && ev.detail.target.id === "day-dialog-body") {
    applyTimezone(ev.detail.target);
    var dlg = document.getElementById("day-dialog");
    if (dlg && !dlg.open && dlg.showModal) dlg.showModal();
  }
});

// Close the day dialog after a successful save/remove.
document.body.addEventListener("htmx:afterRequest", function (ev) {
  var t = ev.detail.elt;
  if (t && t.getAttribute && t.getAttribute("data-closes-dialog") !== null && ev.detail.successful) {
    var dlg = document.getElementById("day-dialog");
    if (dlg && dlg.open) dlg.close();
  }
});

// 5b. Mobile nav drawer.
function toggleNav() {
  document.querySelector(".sidebar").classList.toggle("open");
  document.querySelector(".scrim").classList.toggle("open");
}
function closeNav() {
  document.querySelector(".sidebar").classList.remove("open");
  document.querySelector(".scrim").classList.remove("open");
}

// Copy helper for the share URL.
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(function () {
    if (btn) { var old = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = old; }, 1500); }
  }).catch(function () {});
}
