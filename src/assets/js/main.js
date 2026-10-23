// IFC knowledge — small helpers. Everything here is optional: the site works without JavaScript.
(function () {
  "use strict";

  var TZ = "Asia/Kolkata";

  // Light / dark mode button
  var root = document.documentElement;
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark =
        root.getAttribute("data-theme") === "dark" ||
        (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  });

  // Today's date in the top bar (the page itself may have been built a few hours ago)
  try {
    var today = new Intl.DateTimeFormat("hi-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ,
    }).format(new Date());
    document.querySelectorAll("[data-today]").forEach(function (el) { el.textContent = today; });
  } catch (e) {}

  // "3 घंटे पहले" for news published in the last 24 hours
  try {
    var rtf = new Intl.RelativeTimeFormat("hi", { numeric: "auto" });
    var now = Date.now();
    document.querySelectorAll("time[data-relative]").forEach(function (el) {
      var t = Date.parse(el.getAttribute("datetime"));
      if (isNaN(t)) return;
      var mins = Math.round((now - t) / 60000);
      if (mins < 0 || mins >= 24 * 60) return;
      el.title = el.textContent;
      el.textContent = mins < 60 ? rtf.format(-Math.max(mins, 1), "minute") : rtf.format(-Math.round(mins / 60), "hour");
    });
  } catch (e) {}

  // YouTube player: load the real video only when someone taps play (keeps pages fast)
  document.querySelectorAll("[data-yt]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-yt");
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0";
      iframe.title = btn.getAttribute("aria-label") || "YouTube video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      var wrap = document.createElement("div");
      wrap.className = "yt-player";
      wrap.appendChild(iframe);
      btn.replaceWith(wrap);
      iframe.focus();
    });
  });

  // Share buttons
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = btn.getAttribute("data-copy");
      var label = btn.querySelector(".txt");
      var done = function () {
        if (!label) return;
        var old = label.textContent;
        label.textContent = "कॉपी हो गया!";
        setTimeout(function () { label.textContent = old; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt("लिंक कॉपी करें:", url); });
      } else {
        window.prompt("लिंक कॉपी करें:", url);
      }
    });
  });
  document.querySelectorAll("[data-native-share]").forEach(function (btn) {
    if (!navigator.share) return;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      navigator.share({ title: btn.getAttribute("data-title"), url: btn.getAttribute("data-url") }).catch(function () {});
    });
  });

  // Search page
  var form = document.querySelector("[data-search]");
  if (form) {
    var input = form.querySelector("input[name=q]");
    var out = document.querySelector("[data-search-results]");
    var status = document.querySelector("[data-search-status]");
    var index = null;

    var norm = function (s) {
      return (s || "").toString().normalize("NFC").toLowerCase();
    };
    var esc = function (s) {
      return (s || "").toString().replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var render = function (q) {
      var terms = norm(q).split(/\s+/).filter(Boolean);
      if (!terms.length) { out.innerHTML = ""; status.textContent = "कोई शब्द लिखें और खोजें।"; return; }
      var hits = index.filter(function (p) {
        var hay = norm(p.t + " " + p.s + " " + p.c + " " + p.ce);
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      }).slice(0, 50);
      status.textContent = hits.length
        ? "“" + q + "” के लिए " + hits.length + (hits.length === 50 ? "+" : "") + " खबरें मिलीं"
        : "“" + q + "” से जुड़ी कोई खबर नहीं मिली। दूसरा शब्द आज़माएं।";
      out.innerHTML = hits.map(function (p) {
        var media = p.i
          ? '<img src="' + esc(p.i) + '" alt="" loading="lazy">'
          : '<span class="card__placeholder" style="--c:' + esc(p.cc) + '">' + esc(p.c) + "</span>";
        return '<article class="card card--row"><a class="card__media" href="' + esc(p.u) + '" tabindex="-1" aria-hidden="true">' + media +
          '</a><div class="card__body"><span class="cat-label" style="--c:' + esc(p.cc) + '">' + esc(p.c) + '</span>' +
          '<h2 class="card__title"><a href="' + esc(p.u) + '">' + esc(p.t) + '</a></h2>' +
          '<div class="card__meta">' + esc(p.d) + "</div></div></article>";
      }).join("");
    };

    var q = new URLSearchParams(location.search).get("q") || "";
    input.value = q;
    status.textContent = "खोज लोड हो रही है…";
    fetch(form.getAttribute("data-index"))
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; render(input.value); })
      .catch(function () { status.textContent = "खोज अभी उपलब्ध नहीं है। थोड़ी देर बाद कोशिश करें।"; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!index) return;
      var value = input.value.trim();
      history.replaceState(null, "", value ? "?q=" + encodeURIComponent(value) : location.pathname);
      render(value);
    });
  }
})();
