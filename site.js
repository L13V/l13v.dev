/* ============================================================================
   l13v.dev — behaviour
   Builds the page from projects.js, then runs one scroll engine that every
   scene hangs off: sticky stages report a 0…1 progress, eased so a mouse
   wheel's steps still glide. Nothing here is required to read the page — the
   text is all in the DOM before any of it animates.
   ========================================================================= */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ── little helpers ── */
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function span(p, a, b) { return clamp01((p - a) / (b - a)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function absTop(n) { return n.getBoundingClientRect().top + window.scrollY; }
  function svg(t, attrs) { var n = document.createElementNS("http://www.w3.org/2000/svg", t); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  var ACCENTS = ["#ffc21a", "#5cd0b3", "#a3e635", "#a78bfa", "#ff5d6c", "#60a5fa", "#22d3ee"];
  function accentOf(p, i) { return p.accent || ACCENTS[i % ACCENTS.length]; }
  var fine = window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches;

  /* ============================================================================
     Scroll engine — one rAF loop, every scene an item with measure()/update().
     ========================================================================= */
  var Engine = (function () {
    var items = [], vh = innerHeight, force = true, t0 = 0, lastY = window.scrollY, vel = 0;
    function add(it) { items.push(it); if (it.measure) it.measure(vh); force = true; return it; }
    function measure() {
      vh = innerHeight;
      document.documentElement.style.setProperty("--vh-px", vh + "px");
      items.forEach(function (it) { if (it.measure) it.measure(vh); });
      force = true;
    }
    function loop(now) {
      var dt = t0 ? Math.min(0.05, (now - t0) / 1000) : 0.016; t0 = now;
      var y = window.scrollY;
      /* scroll speed in px/s, smoothed — scenes use it to play faster while you scroll */
      vel += ((y - lastY) / Math.max(dt, 0.008) - vel) * Math.min(1, dt * 10);
      if (Math.abs(vel) < 1) vel = 0;
      lastY = y;
      for (var i = 0; i < items.length; i++) items[i].update(y, vh, dt, force);
      force = false;
      requestAnimationFrame(loop);
    }
    var tm = 0;
    function later() { clearTimeout(tm); tm = setTimeout(measure, 120); }
    addEventListener("resize", later);
    addEventListener("load", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if ("ResizeObserver" in window) new ResizeObserver(later).observe(document.body);
    requestAnimationFrame(loop);
    return { add: add, measure: measure, vh: function () { return vh; }, vel: function () { return vel; } };
  })();

  /* A tall section with a sticky stage inside: progress runs 0→1 while the
     stage is pinned. `lag` eases it (higher is snappier). */
  function pinned(section, onP, lag) {
    var top = 0, len = 1, cur = -1, prev = -2, k = lag || 9;
    return Engine.add({
      measure: function (vh) { top = absTop(section); len = Math.max(1, section.offsetHeight - vh); },
      update: function (y, vh, dt, force) {
        var target = clamp01((y - top) / len);
        if (cur < 0 || force && Math.abs(target - cur) > 0.25) cur = target;
        else cur += (target - cur) * (1 - Math.exp(-dt * k));
        if (Math.abs(cur - target) < 1e-4) cur = target;
        if (cur !== prev || force) { prev = cur; onP(cur, target); }
      }
    });
  }
  /* An element passing through the viewport: 0 as its top enters at the
     bottom, 1 as its bottom leaves at the top. */
  function passing(node, onP) {
    var top = 0, h = 1, prev = -1;
    return Engine.add({
      measure: function () { top = absTop(node); h = node.offsetHeight; },
      update: function (y, vh, dt, force) {
        var p = clamp01((y + vh - top) / (h + vh));
        if (p !== prev || force) { prev = p; onP(p); }
      }
    });
  }

  /* How much faster a scene should play right now: 0 at rest, rising with
     scroll speed (about +3 at a screen per second), capped. */
  function boost() { return Math.min(8, Math.abs(Engine.vel()) / Engine.vh() * 3); }

  /* ============================================================================
     Glide + snap. A slow scroll is always the browser's own. A flick — a fast
     burst of wheel or trackpad movement — glides to the next important point
     in that direction instead of flying past it, and the rest of that
     flick's momentum is absorbed. On touch screens the browser's own scroll
     snapping does the same job, against the same points.
     ========================================================================= */
  var NAV = 64;
  var Glide = (function () {
    var raf = 0, kind = null;
    function stop() { cancelAnimationFrame(raf); raf = 0; kind = null; document.documentElement.classList.remove("gliding"); }
    function to(y, k, onDone) {
      stop();
      var max = document.documentElement.scrollHeight - innerHeight;
      var from = window.scrollY, dest = Math.max(0, Math.min(max, y)), dist = Math.abs(dest - from);
      if (dist < 2) { if (onDone) onDone(); return; }
      if (document.hidden) { window.scrollTo(0, dest); if (onDone) onDone(); return; }
      kind = k || "link";
      document.documentElement.classList.add("gliding");
      var dur = Math.min(1300, 520 + dist * 0.11), t0 = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - t0) / dur), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        window.scrollTo({ top: from + (dest - from) * e, behavior: "instant" });
        if (t < 1) raf = requestAnimationFrame(step);
        else { stop(); if (onDone) onDone(); }
      })(t0);
    }
    return { to: to, stop: stop, kind: function () { return kind; } };
  })();

  var Snap = (function () {
    var getters = [], pts = [], marks = null;
    var touch = window.matchMedia && matchMedia("(pointer:coarse)").matches;
    if (touch) document.documentElement.classList.add("touch");
    function add(fn) { getters.push(fn); }
    function measure() {
      var max = document.documentElement.scrollHeight - innerHeight, seen = {};
      pts = [];
      getters.forEach(function (g) {
        var v = g(); (Array.isArray(v) ? v : [v]).forEach(function (y) {
          if (y == null || !isFinite(y)) return;
          y = Math.round(Math.max(0, Math.min(max, y)));
          if (!seen[y]) { seen[y] = 1; pts.push(y); }
        });
      });
      pts.sort(function (a, b) { return a - b; });
      /* the same points as CSS snap targets, for touch */
      if (touch) {
        if (!marks) { marks = el("div"); marks.setAttribute("aria-hidden", "true"); document.body.appendChild(marks); }
        marks.textContent = "";
        pts.forEach(function (y) { var m = el("i", "snapmark"); m.style.top = (y + NAV) + "px"; marks.appendChild(m); });
      }
    }
    function next(from, dir) {
      for (var i = 0; i < pts.length; i++) {
        var k = dir > 0 ? i : pts.length - 1 - i;
        if (dir > 0 ? pts[k] > from + 24 : pts[k] < from - 24) return pts[k];
      }
      return null;
    }
    /* wheel: watch the last ~130 ms; a fast burst is a flick */
    var hist = [], lockUntil = 0, glideEnd = 0, lastDir = 0;
    addEventListener("wheel", function (e) {
      if (e.ctrlKey || document.body.style.overflow === "hidden") return;
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (!dy) return;
      var now = performance.now(), dir = dy > 0 ? 1 : -1;
      if (Glide.kind() === "link") Glide.stop();
      hist.push([now, dy]);
      while (hist.length && now - hist[0][0] > 130) hist.shift();
      var sum = 0; hist.forEach(function (h) { if ((h[1] > 0 ? 1 : -1) === dir) sum += Math.abs(h[1]); });
      var snapping = Glide.kind() === "snap";
      if (snapping || now < lockUntil) {
        e.preventDefault();
        /* still spinning after the last glide landed: that's another flick */
        if (!snapping && dir === lastDir && sum >= 380 && now - glideEnd > 160) flick(dir, now);
        else lockUntil = Math.min(now + 170, glideEnd + 900);
        return;
      }
      if (sum >= 380) { e.preventDefault(); flick(dir, now); }
    }, { passive: false });
    function flick(dir, now) {
      var to = next(window.scrollY, dir);
      if (to == null) return;
      lastDir = dir; hist = [];
      Glide.to(to, "snap", function () { glideEnd = performance.now(); lockUntil = glideEnd + 170; });
      lockUntil = now + 2000;
    }
    ["touchstart", "keydown"].forEach(function (t) { addEventListener(t, function () { if (Glide.kind() === "link") Glide.stop(); }, { passive: true }); });
    return { add: add, measure: measure, points: function () { return pts; } };
  })();
  /* an element's snap point: its top a little under the header */
  function snapTop(n, off) { return function () { return n ? absTop(n) - (off == null ? NAV + 24 : off) : null; }; }

  /* ============================================================================
     Signal field — a dot grid that radio pulses ripple across. The pointer
     drags a soft light over it, and a click sends a pulse of your own.
     ========================================================================= */
  function Field(canvas, opt) {
    opt = opt || {};
    var ctx = canvas.getContext("2d"), w = 0, h = 0, dpr = 1, gap = 28, ox = 0, oy = 0, cols = 0, rows = 0;
    var pulses = [], mx = -1e4, my = -1e4, tmx = -1e4, tmy = -1e4, lastSpawn = 0, visible = true, raf = 0, alpha = 1;
    var bands = ["#7d97ff", "#78a8f5", "#6fbce0", "#63cbc6", "#5cd0b3", "#8fdcc8"];
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gap = w < 700 ? 22 : 28;
      cols = Math.ceil(w / gap) + 1; rows = Math.ceil(h / gap) + 1;
      ox = (w - (cols - 1) * gap) / 2; oy = (h - (rows - 1) * gap) / 2;
    }
    function spawn(x, y, strong) { pulses.push({ x: x, y: y, t0: performance.now(), a: strong ? 1 : 0.6 }); if (pulses.length > 8) pulses.shift(); }
    function frame(now) {
      raf = 0;
      if (!visible) return;
      if (now - lastSpawn > (opt.every || 1700)) {
        lastSpawn = now;
        spawn(w * (0.1 + Math.random() * 0.8), h * (0.15 + Math.random() * 0.7), false);
      }
      mx += (tmx - mx) * 0.12; my += (tmy - my) * 0.12;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var live = [];
      for (var q = 0; q < pulses.length; q++) {
        var P = pulses[q], age = now - P.t0;
        if (age < 4200) live.push({ x: P.x, y: P.y, r: age * 0.34, f: P.a * Math.pow(1 - age / 4200, 1.6) });
      }
      pulses = pulses.filter(function (P) { return now - P.t0 < 4200; });
      for (var i = 0; i < cols; i++) {
        var x = ox + i * gap;
        ctx.fillStyle = bands[Math.min(bands.length - 1, Math.floor((x / w) * bands.length))];
        for (var j = 0; j < rows; j++) {
          var y = oy + j * gap, b = 0.13;
          var dx = x - mx, dy = y - my, dm = dx * dx + dy * dy;
          if (dm < 120000) b += 0.6 * Math.exp(-dm / 22000);
          for (var k = 0; k < live.length; k++) {
            var L = live[k], ddx = x - L.x, ddy = y - L.y, d = Math.sqrt(ddx * ddx + ddy * ddy) - L.r;
            if (d > -70 && d < 70) b += 1.1 * L.f * Math.exp(-(d * d) / 620);
          }
          if (b > 1) b = 1;
          var s = 1.5 + b * 2.4;
          ctx.globalAlpha = b * alpha;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    size();
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(canvas);
    var host = opt.host || canvas.parentNode;
    host.addEventListener("pointermove", function (e) { var r = canvas.getBoundingClientRect(); tmx = e.clientX - r.left; tmy = e.clientY - r.top; if (mx < -1000) { mx = tmx; my = tmy; } });
    host.addEventListener("pointerleave", function () { tmx = tmy = -1e4; });
    host.addEventListener("pointerdown", function (e) { var r = canvas.getBoundingClientRect(); spawn(e.clientX - r.left, e.clientY - r.top, true); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(canvas);
    }
    spawn(w * 0.5, h * 0.5, true);
    raf = requestAnimationFrame(frame);
    return { fade: function (a) { alpha = a; } };
  }

  /* ============================================================================
     Header, hero, statement
     ========================================================================= */
  var parts = SITE.name.split(" ");
  var given = parts.slice(0, -1).join(" "), surname = parts[parts.length - 1];
  document.getElementById("yr").textContent = String(new Date().getFullYear());
  document.getElementById("hero-role").textContent = SITE.role;

  var nameEl = document.getElementById("hero-name"), chars = [];
  [given, surname].forEach(function (word, li) {
    var ln = el("span", "ln l" + (li + 1));
    word.split("").forEach(function (c, ci) {
      var cw = el("span", "cw");
      cw.style.display = "inline-block";
      var ch = el("span", "ch", c);
      ch.style.animationDelay = (0.15 + li * 0.12 + ci * 0.045) + "s" + (li ? ", " + (1.4 + ci * 0.05) + "s" : "");
      cw.appendChild(ch); ln.appendChild(cw);
      chars.push({ n: cw, f: 0.35 + Math.random() * 0.9, r: (Math.random() - 0.5) * 16, x: (ci - word.length / 2) / word.length });
    });
    nameEl.appendChild(ln);
  });
  nameEl.setAttribute("aria-label", SITE.name);
  setTimeout(function () { nameEl.classList.add("done"); Array.prototype.forEach.call(nameEl.children, function (l) { l.style.overflow = "visible"; }); }, 2000);

  var heroField = Field(document.getElementById("field"), { host: document.querySelector(".hero-pin") });
  var lean = { x: 0, y: 0, tx: 0, ty: 0 }, heroP = 0;
  if (fine) document.querySelector(".hero-pin").addEventListener("pointermove", function (e) {
    lean.tx = (e.clientX / innerWidth - 0.5) * 2; lean.ty = (e.clientY / innerHeight - 0.5) * 2;
  });
  Engine.add({ update: function () {
    if (Math.abs(lean.tx - lean.x) + Math.abs(lean.ty - lean.y) < 1e-3) return;
    lean.x += (lean.tx - lean.x) * 0.08; lean.y += (lean.ty - lean.y) * 0.08;
    nameEl.style.transform = "translate3d(" + (lean.x * 14) + "px," + (lean.y * 10) + "px,0) scale(" + (1 + heroP * 0.08) + ")";
  } });
  var heroMeta = document.querySelectorAll(".hero-meta");
  Snap.add(function () { return 0; });
  pinned(document.querySelector(".hero"), function (p) {
    var e = p * p;
    heroP = p;
    nameEl.style.transform = "translate3d(" + (lean.x * 14) + "px," + (lean.y * 10) + "px,0) scale(" + (1 + p * 0.08) + ")";
    chars.forEach(function (c) {
      c.n.style.transform = "translate3d(" + (c.x * e * 140) + "px," + (-e * (90 + c.f * 260)) + "px,0) rotate(" + (c.r * e) + "deg)";
      c.n.style.opacity = String(clamp01(1 - e * (1.1 + c.f)));
    });
    heroMeta.forEach(function (m) { m.style.opacity = String(clamp01(1 - p * 3)); });
    heroField.fade(1 - p * 0.7);
  }, 14);

  /* the statement lights up one word at a time */
  var stmt = document.getElementById("stmt"), words = [];
  (function () {
    var text = SITE.intro, hl = SITE.highlight || "", at = hl ? text.indexOf(hl) : -1;
    var pieces = at >= 0 ? [[text.slice(0, at), false], [hl, true], [text.slice(at + hl.length), false]] : [[text, false]];
    pieces.forEach(function (pc) {
      pc[0].split(/(\s+)/).forEach(function (tok) {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { stmt.appendChild(document.createTextNode(" ")); return; }
        var w = el("span", "w" + (pc[1] ? " hl" : ""), tok);
        words.push(w); stmt.appendChild(w);
      });
    });
  })();
  document.getElementById("stmt-sub").textContent = SITE.intro2;
  var cta = document.getElementById("cta");
  SITE.links.forEach(function (l, i) {
    var a = el("a", "btn" + (i === 0 ? " pri" : ""), l.label);
    a.href = l.href; a.rel = "noopener"; cta.appendChild(a);
  });
  var seeWork = el("a", "btn"); seeWork.href = "#work";
  seeWork.appendChild(document.createTextNode("See the work ")); seeWork.appendChild(el("span", "arr", "↓"));
  cta.appendChild(seeWork);
  /* The statement plays itself once you reach it — a few words a second,
     faster while you scroll — and starts over if you go back up past it. */
  var stmtFoot = document.getElementById("stmt-foot"), stmtSec = document.querySelector(".statement");
  (function () {
    var top = 0, lit = 0, shown = -1;
    Engine.add({
      measure: function () { top = absTop(stmtSec); },
      update: function (y, vh, dt) {
        if (y < top - vh * 0.45) lit = 0;
        else if (lit < words.length) lit = Math.min(words.length, lit + dt * 3.2 * (1 + boost()));
        var n = Math.floor(lit);
        if (n === shown) return;
        shown = n;
        words.forEach(function (w, i) { w.classList.toggle("on", i < n); });
        stmtFoot.classList.toggle("on", n >= words.length);
      }
    });
    Snap.add(function () { return top; });
  })();

  /* ============================================================================
     Media registry — every project keeps its own list for the viewer.
     ========================================================================= */
  var MEDIA = {}, CLIPS = {}, TITLES = {}, ACC = {};
  function reg(slug, entry) { (MEDIA[slug] = MEDIA[slug] || []).push(entry); return entry; }
  function src(slug, f) { return "media/" + slug + "/" + f; }
  function optsOf(m) {
    var o = {};
    if (typeof m.exposure === "number") o.exposure = m.exposure;
    if (typeof m.env === "number") o.env = m.env;
    if (m.ao === false) o.ao = false;
    if (m.spin === false) o.spin = false;
    return o;
  }
  /* three.js arrives as a module, which is deferred — so a mount may be
     requested before it exists. Queue until it announces itself. */
  function when3D(fn) {
    if (window.__mount3D) fn();
    else document.addEventListener("three-ready", fn, { once: true });
  }
  function mount3D(host, url, opts, onReady) {
    when3D(function () {
      var h = null;
      try { h = window.__mount3D(host, url, opts || {}); } catch (e) { host.classList.add("failed"); }
      if (onReady) onReady(h);
    });
  }
  /* Build a WebGL scene only once its section is near the screen. */
  function near(node, fn, margin) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: margin || "150% 0px" });
      io.observe(node);
    } else go();
    return go;
  }

  /* ============================================================================
     Projects
     ========================================================================= */
  var total = PROJECTS.length, repoLines = {};
  var indexList = document.getElementById("index");
  var projectsHost = document.getElementById("projects");
  var deck = null;

  function meta(p, i) {
    var m = el("div", "meta");
    m.appendChild(el("span", "no", pad(i + 1) + " / " + pad(total)));
    m.appendChild(el("span", "sep"));
    m.appendChild(el("span", "lbl", p.kind));
    m.appendChild(el("span", "sep"));
    m.appendChild(el("span", "lbl", p.period));
    return m;
  }
  function chip(p) {
    var c = el("span", "chip" + (/season/i.test(p.status) ? " live" : ""));
    c.appendChild(el("i")); c.appendChild(document.createTextNode(p.status));
    return c;
  }
  function title(p, cls) {
    var h = el("h3", "p-title" + (cls ? " " + cls : ""));
    if (p.logo) {
      var lg = document.createElement("img");
      lg.className = "logo"; lg.src = src(p.slug, p.logo); lg.alt = p.name || ""; lg.decoding = "async";
      h.appendChild(lg); h.appendChild(el("span", "dash", "– ")); h.appendChild(document.createTextNode(p.title));
    } else h.textContent = p.title;
    return h;
  }
  function specList(p) {
    var box = el("div");
    box.appendChild(el("span", "lbl", "Specification"));
    var dl = el("dl", "spec");
    dl.style.marginTop = ".6rem";
    p.specs.forEach(function (row) {
      var r = el("div", "row");
      r.appendChild(el("dt", null, row[0])); r.appendChild(el("span", "ldr")); r.appendChild(el("dd", null, row[1]));
      dl.appendChild(r);
    });
    box.appendChild(dl);
    if (p.repo) { var rl = el("div", "repo"); rl.appendChild(el("span", null, "github.com/L13V/" + p.repo)); repoLines[p.repo] = rl; box.appendChild(rl); }
    return box;
  }
  function notes(p) {
    if (!p.notes || !p.notes.length) return null;
    var ol = el("ol", "notes");
    p.notes.forEach(function (t) { var li = document.createElement("li"); li.appendChild(el("span", null, t)); ol.appendChild(li); });
    return ol;
  }
  function links(p, box) {
    (p.links || []).forEach(function (l) { var a = el("a", "plink", l.label); a.href = l.href; a.rel = "noopener"; box.appendChild(a); });
  }
  function actBtn(icon, label, sub, onClick) {
    var b = el("button", "act"); b.type = "button";
    b.setAttribute("aria-haspopup", "dialog");
    b.appendChild(icon);
    var t = el("span"); t.appendChild(document.createTextNode(label)); if (sub) t.appendChild(el("small", null, sub));
    b.appendChild(t);
    b.addEventListener("click", onClick);
    return b;
  }
  var ICON = {
    branch: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="4" cy="3.5" r="1.75"/><circle cx="4" cy="12.5" r="1.75"/><circle cx="12" cy="5" r="1.75"/><path d="M4 5.25v5.5M12 6.75c0 3-3 3.5-6.6 4.6"/></svg>',
    out: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5h-2v7h7v-2M7 2h3v3M10 2 5.5 6.5"/></svg>',
    code: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3 1.5 6 4 9M8 3l2.5 3L8 9"/></svg>',
    grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1"/><rect x="9" y="9" width="5.5" height="5.5" rx="1"/></svg>',
    cube: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.5 14 4.8v6.4L8 14.5 2 11.2V4.8z"/><path d="M2 4.8 8 8l6-3.2M8 8v6.5"/></svg>'
  };
  function ico(html, cls) { var s = el("span", "ico" + (cls ? " " + cls : "")); if (html) s.innerHTML = html; return s; }

  /* ── index of work ── */
  var peek = document.getElementById("peek"), peekX = 0, peekY = 0, peekTX = 0, peekTY = 0, peekOn = false;
  PROJECTS.forEach(function (p, i) {
    ACC[p.slug] = accentOf(p, i);
    TITLES[p.slug] = p.name ? p.name + " – " + p.title : p.title;
    var li = document.createElement("li");
    var a = el("a"); a.href = "#p-" + p.slug; a.style.setProperty("--pa", ACC[p.slug]);
    a.appendChild(el("span", "ix-no", pad(i + 1)));
    var t = el("span", "ix-t", p.name || p.title);
    if (p.name) t.appendChild(el("small", null, p.title));
    a.appendChild(t);
    a.appendChild(el("span", "ix-k", p.kind));
    a.appendChild(el("span", "ix-y", p.period));
    a.appendChild(el("span", "ix-ar", "→"));
    li.appendChild(a); indexList.appendChild(li);
    a.addEventListener("pointerenter", function () {
      if (!fine) return;
      peek.textContent = ""; peek.style.setProperty("--pa", ACC[p.slug]);
      var thumbFile = p.slug === "2026_59" ? "rico-poster.webp" : p.media && p.media[0] && p.media[0].type === "image" ? p.media[0].file : null;
      if (thumbFile) { var im = el("img"); im.src = src(p.slug, thumbFile); im.alt = ""; if (/\.svg$/.test(thumbFile) || p.slug === "2026_59") im.className = "contain"; peek.appendChild(im); }
      else peek.appendChild(el("div", "tile", pad(i + 1)));
      peekOn = true; peek.classList.add("on");
    });
    a.addEventListener("pointerleave", function () { peekOn = false; peek.classList.remove("on"); });
  });
  if (fine) {
    addEventListener("pointermove", function (e) { peekTX = e.clientX + 30; peekTY = e.clientY; });
    Engine.add({ update: function () {
      if (!peekOn && !peek.classList.contains("on")) return;
      peekX += (peekTX - peekX) * 0.16; peekY += (peekTY - peekY) * 0.16;
      peek.style.transform = "translate3d(" + peekX + "px," + (peekY - peek.offsetHeight / 2) + "px,0) scale(" + (peekOn ? 1 : 0.85) + ")";
    } });
  }

  PROJECTS.forEach(function (p, i) {
    if (p.stage === "model") buildModelStage(p, i);
    else if (p.stage === "research") buildResearch(p, i);
    else buildCard(p, i);
  });

  /* ============================================================================
     01 · the model stage — the scroll turns the robot, the highlights come in
     ========================================================================= */
  function buildModelStage(p, i) {
    var s = el("section", "p-model"); s.id = "p-" + p.slug; s.style.setProperty("--pa", ACC[p.slug]);
    var wrap = el("div", "mstage-wrap"), stage = el("div", "mstage");
    var word = el("div", "mword", (p.name || p.title).toUpperCase());
    word.setAttribute("aria-hidden", "true");
    stage.appendChild(word);

    var model = (p.media || []).filter(function (m) { return m.type === "model"; })[0];
    var host = el("div", "mcanvas");
    if (model && model.poster) { var po = el("div", "poster"); po.style.backgroundImage = "url('" + src(p.slug, model.poster) + "')"; host.appendChild(po); }
    stage.appendChild(host);

    var head = el("div", "mhead"); head.appendChild(meta(p, i)); head.appendChild(chip(p)); stage.appendChild(head);

    var hls = (p.highlights || []).slice(0, 4).map(function (h, k) {
      var c = el("div", "mcall h" + k);
      c.appendChild(el("i", null, pad(k + 1)));
      c.appendChild(el("b", null, h[0])); c.appendChild(el("span", null, h[1]));
      stage.appendChild(c); return c;
    });

    var lg = el("div", "mlogo");
    if (p.logo) { var im = el("img"); im.src = src(p.slug, p.logo); im.alt = p.name || ""; lg.appendChild(im); }
    else lg.appendChild(el("h3", "p-title", p.name || p.title));
    lg.appendChild(el("p", null, p.title));
    stage.appendChild(lg);

    var hint = el("div", "mhint");
    var entM = model ? reg(p.slug, { slug: p.slug, m: model, accent: ACC[p.slug] }) : null;
    if (model) {
      var exp = el("button", "mexp", "Explore in 3D ↗"); exp.type = "button";
      exp.addEventListener("click", function () { openIn(p.slug, entM); });
      hint.appendChild(exp);
    }
    hint.appendChild(el("span", "lbl", fine ? "Drag to spin · scroll to speed it up" : "Scroll to speed it up"));
    var rail = el("div", "mrail"), railI = el("i"); rail.appendChild(railI); hint.appendChild(rail);
    stage.appendChild(hint);
    wrap.appendChild(stage); s.appendChild(wrap);

    /* below the stage: the words, the buttons, the spec sheet */
    var body = el("div", "wrap p-body");
    var L = el("div"), R = el("div");
    L.setAttribute("data-rv", ""); R.setAttribute("data-rv", ""); R.style.setProperty("--d", ".12s");
    L.appendChild(title(p));
    L.appendChild(el("p", "summary", p.summary));
    var acts = el("div", "acts");
    if (p.action && p.action.length) actionButtons(p, acts);
    if (p.code) {
      acts.appendChild(codeButton(p.code));
      p.code.files.forEach(function (f) {
        if (!f.image) return;
        reg(p.slug, { slug: p.slug, accent: ACC[p.slug], label: "DIAGRAM", group: p.code.group, m: { type: "image", url: f.image, caption: f.note || f.title } });
      });
    }
    links(p, acts);
    L.appendChild(acts);
    var n = notes(p); if (n) L.appendChild(n);
    R.appendChild(specList(p));
    body.appendChild(L); body.appendChild(R);
    s.appendChild(body);
    projectsHost.appendChild(s);

    var view = null, ww = 0;
    if (model) near(s, function () {
      mount3D(host, src(p.slug, model.file), Object.assign(optsOf(model), { scrub: true, margin: innerWidth > 900 ? 1.7 : 1.1 }), function (h) { view = h; if (view) view.setView(last); });
    });
    /* The robot turns on its own, like a turntable, and the highlights take
       turns; scrolling spins it faster (backwards, if you scroll up). It
       stays until you scroll on. */
    var last = { az: -0.7, el: 0.03, zoom: 1.1 }, q = 0, wtop = 0, wlen = 1, clock = 0, shownHl = -2;
    pinned(wrap, function (v) {
      q = v;
      ww = ww || word.offsetWidth;
      word.style.transform = "translate3d(" + lerp(innerWidth * 0.55, -ww + innerWidth * 0.3, q) + "px,-50%,0)";
      railI.style.transform = "scaleX(" + q + ")";
    }, 8);
    Engine.add({
      measure: function (vh) { wtop = absTop(wrap); wlen = wrap.offsetHeight; },
      update: function (y, vh, dt) {
        if (y + vh < wtop || y > wtop + wlen) { clock = 0; return; }   /* off screen: rest */
        var on = y > wtop - vh * 0.35;
        var sv = Engine.vel() / vh;
        last.az += dt * (0.3 + Math.max(-4, Math.min(4, sv * 2.2)));
        clock += dt * (on ? 1 + boost() * 0.6 : 0);
        last.el = 0.04 + Math.sin(last.az * 0.5) * 0.09;
        last.zoom = lerp(1.1, 0.95, smooth(q));
        if (view) view.setView(last);
        var k = on ? Math.floor(clock / 3.4) % hls.length : -1;
        if (k !== shownHl) { shownHl = k; hls.forEach(function (c, j) { c.classList.toggle("on", j === k); }); }
      }
    });
    Snap.add(function () { return wtop; });
    Snap.add(snapTop(body.querySelector(".p-title")));
    addEventListener("resize", function () { ww = 0; });
  }

  /* "See it in action" opens the viewer on the match; "More media" at the top */
  function actionButtons(p, box) {
    CLIPS[p.slug] = p.action.map(function (m) { return { slug: p.slug, m: m, accent: ACC[p.slug], label: m.label || "VIDEO", group: m.group }; });
    var lead = p.action.filter(function (m) { return m.label === "MATCH"; })[0] || p.action[0];
    var th = ico(null, "thumb");
    if (lead.type === "youtube") th.style.backgroundImage = "url('https://img.youtube.com/vi/" + lead.id + "/mqdefault.jpg')";
    box.appendChild(actBtn(th, "See it in action", lead.caption, function () { openIn(p.slug, CLIPS[p.slug][p.action.indexOf(lead)], true); }));
    box.appendChild(actBtn(ico(ICON.grid), "More media", "Video · diagrams", function () { openIn(p.slug, CLIPS[p.slug][0], true); }));
  }

  /* ============================================================================
     02 · the research story
     ========================================================================= */
  function buildResearch(p, i) {
    var D = window.UWB_TRIALS;
    var s = el("section", "p-research"); s.id = "p-" + p.slug; s.style.setProperty("--pa", ACC[p.slug]);

    /* opening */
    var open = el("div", "wrap r-open");
    var mrow = el("div", "meta"); mrow.style.justifyContent = "space-between";
    mrow.appendChild(meta(p, i)); mrow.appendChild(chip(p));
    open.appendChild(mrow);
    open.appendChild(el("p", "lbl r-kicker", p.kicker || p.kind));
    var head = el("h2", "r-head"), cut = p.headline.indexOf(",");
    var plain = cut >= 0 ? p.headline.slice(0, cut + 1) : p.headline, em = cut >= 0 ? p.headline.slice(cut + 1).trim() : "";
    function headWords(text, into) {
      text.split(" ").forEach(function (t, k) {
        if (!t) return;
        var w = el("span", "w"), inner = el("span", null, t);
        inner.style.transitionDelay = (k * 0.08) + "s";
        w.appendChild(inner); into.appendChild(w); into.appendChild(document.createTextNode(" "));
      });
    }
    headWords(plain, head);
    if (em) { var emEl = el("em"); headWords(em, emEl); head.appendChild(document.createElement("br")); head.appendChild(emEl); }
    open.appendChild(head);
    var intro = el("div", "r-intro");
    var sm = el("p", "summary", p.summary); sm.setAttribute("data-rv", "");
    intro.appendChild(sm);
    var paper = el(p.paper ? "a" : "div", "r-paper"); paper.setAttribute("data-rv", ""); paper.style.setProperty("--d", ".15s");
    paper.appendChild(el("b", null, p.paperTitle || p.title));
    if (p.paper) {
      paper.href = src(p.slug, p.paper); paper.target = "_blank"; paper.rel = "noopener";
      paper.appendChild(document.createTextNode("IEEE-format conference paper · " + p.period + (p.paperPages ? " · " + p.paperPages + " pages" : "") + " · "));
      paper.appendChild(el("span", "go", "Read the paper (PDF) ↗"));
    } else paper.appendChild(document.createTextNode("IEEE-format conference paper · " + p.period));
    intro.appendChild(paper);
    open.appendChild(intro);
    s.appendChild(open);
    var headIO = passing(head, function (q) { if (q > 0.12) head.classList.add("in"); });

    /* the pinned story */
    var story = el("div", "story"), stage = el("div", "sstage");
    var cv = el("div", "scanvas"); stage.appendChild(cv);
    stage.appendChild(el("div", "sload", D ? "Loading the rig…" : "Trial data unavailable"));
    var labels = el("div", "slabels"); stage.appendChild(labels);
    var COLS = p.anchorColors;
    function label(text, color, big) { var l = el("div", "slabel" + (big ? " big" : ""), text); l.style.setProperty("--c", color); labels.appendChild(l); return l; }
    var aLabels = D ? D.anchors.map(function (a, k) { return label("A" + k + " · z " + a[2].toFixed(2) + " m", COLS[k]); }) : [];
    var tagLabel = label("Tag", "#f5f5f7", true), estLabel = label("Estimate", "#fc6255", true);
    var blockLabel = label("Concrete block", "#fc6255"), candLabel = label("LM step", "#f5f5f7");

    var chapters = el("div", "chapters");
    var RANGES = [[0, 0.15], [0.15, 0.3], [0.3, 0.46], [0.46, 0.62], [0.62, 0.78], [0.78, 1.01]];
    var chapEls = p.chapters.map(function (c, k) {
      var d = el("div", "chap");
      d.appendChild(el("span", "n", pad(k + 1) + " — " + pad(p.chapters.length)));
      d.appendChild(el("h3", null, c.title));
      d.appendChild(el("p", null, c.body));
      if (c.eq) d.appendChild(el("div", "eq", c.eq));
      if (c.chips) { var cs = el("div", "chips"); c.chips.forEach(function (t) { cs.appendChild(el("span", null, t)); }); d.appendChild(cs); }
      chapters.appendChild(d); return d;
    });
    stage.appendChild(chapters);
    var rail = el("div", "srail"), railB = RANGES.map(function () { var x = el("i"), b = el("b"); x.appendChild(b); rail.appendChild(x); return b; });
    stage.appendChild(rail);

    /* the readout in the corner */
    var hud = el("div", "hud"), rng = el("div", "rng"), rngB = [];
    var hit = D && find(D, "concrete", 2), base = D && find(D, "baseline", null);
    var trueD = D ? D.anchors.map(function (a) { return Math.hypot(a[0] - D.truth[0], a[1] - D.truth[1], a[2] - D.truth[2]); }) : [];
    (D ? D.anchors : []).forEach(function (a, k) {
      var c = el("div"); c.style.setProperty("--c", COLS[k]);
      c.appendChild(el("span", null, "A" + k)); var b = el("b", null, trueD[k].toFixed(3) + " m"); c.appendChild(b);
      rng.appendChild(c); rngB.push(b);
    });
    hud.appendChild(rng);
    function hr(k, v, cls) { var r = el("div", cls || ""); r.appendChild(el("span", null, k)); var b = el("b", null, v); r.appendChild(b); hud.appendChild(r); return { r: r, b: b }; }
    var hSolve = hr("SOLVER", "—", "hsolve"), hErr = hr("3D RMSE", "—", "herr"), hFix = hr("FIX RATE", "100%", "hfix");
    stage.appendChild(hud);
    story.appendChild(stage); s.appendChild(story);

    /* the scene follows the scroll; labels follow the scene */
    var scene = null, P = 0;
    /* labels sit up and to the right of their point, but never off screen */
    function place(l, pt, on) {
      l.classList.toggle("on", !!on);
      if (!on) return;
      var w = l.offsetWidth, x = pt.x + 12;
      if (x + w > cv.clientWidth - 8) x = pt.x - 12 - w;
      l.style.transform = "translate3d(" + Math.round(Math.max(8, x)) + "px," + Math.round(pt.y - 26) + "px,0)";
    }
    if (D) near(story, function () {
      when3D(function () {
        try {
          scene = window.__mountUWB(cv, {
            base: "media/uwb/", data: D, colors: COLS,
            onFrame: function (o) {
              o.anchors.forEach(function (a, k) { place(aLabels[k], a, a.on); });
              place(tagLabel, o.tag, P > 0.31 && P < 0.97);
              place(estLabel, o.est, o.est.on);
              place(blockLabel, o.block, o.block.on);
              place(candLabel, o.cand, o.cand.on);
              if (o.cand.on) { candLabel.textContent = "LM step " + o.step + " / " + o.steps; hSolve.b.textContent = "step " + o.step + " of " + o.steps; }
              rngB[2].textContent = (trueD[2] + (hit.bias / 100) * o.inflate).toFixed(3) + " m";
              rngB[2].classList.toggle("bad", o.inflate > 0.05);
              var err = lerp(base.rmse, hit.rmse, o.drift);
              hErr.b.textContent = err.toFixed(1) + " cm";
              hErr.r.classList.toggle("bad", o.drift > 0.05);
            }
          });
          scene.setProgress(P);
        } catch (e) { cv.classList.add("failed"); }
      });
    }, "100% 0px");
    /* The story plays itself, a chapter at a time. Where you've scrolled to
       picks the chapter; that chapter plays slowly and then holds on its last
       frame until you scroll on. Scrolling speeds it up, a flick lands on
       the next chapter, and scrolling back rewinds. */
    var N = RANGES.length, stTop = 0, stLen = 1, lastP = -1;
    var AUTO = 0.021;   /* story per second: a chapter takes 7–10 s on its own */
    var RUSH = 0.55;    /* catching up to a chapter you've scrolled to */
    function render(q) {
      if (scene) scene.setProgress(q);
      chapEls.forEach(function (c, k) {
        c.classList.toggle("on", q >= RANGES[k][0] && q < RANGES[k][1]);
        c.classList.toggle("past", q >= RANGES[k][1]);
      });
      railB.forEach(function (b, k) { b.style.transform = "scaleX(" + span(q, RANGES[k][0], RANGES[k][1] - 0.003) + ")"; });
      hud.classList.toggle("on", q > 0.4);
      hSolve.r.style.display = q > 0.62 && q < 0.8 ? "" : "none";
      if (q < 0.62) hSolve.b.textContent = "—";
    }
    Engine.add({
      measure: function (vh) { stTop = absTop(story); stLen = Math.max(1, story.offsetHeight - vh); },
      update: function (y, vh, dt, force) {
        if (y < stTop - vh * 2) P = 0;                     /* well above: rewound */
        else if (y > stTop + stLen + vh * 2) P = 1;        /* well below: played out */
        else {
          /* each chapter gets an equal share of the scroll */
          var k = y < stTop - vh * 0.3 ? -1 : Math.min(N - 1, Math.floor(clamp01((y - stTop) / stLen) * N + 1e-6));
          var lo = k < 0 ? 0 : RANGES[k][0];
          var hi = k < 0 ? 0 : k === N - 1 ? 1 : RANGES[k][1] - 0.003;
          var b = boost();
          if (P < lo) P = Math.min(lo, P + dt * RUSH * (1 + b));
          else if (P > hi) P = Math.max(hi, P - dt * RUSH * (1 + b));
          else P = Math.min(hi, P + dt * AUTO * (1 + b * 1.6));
        }
        if (P !== lastP || force) { lastP = P; render(P); }
      }
    });
    Snap.add(function () { var out = []; for (var k = 0; k < N; k++) out.push(stTop + (k / N) * stLen + (k ? 2 : 0)); return out; });
    Snap.add(snapTop(open.querySelector(".r-head"), NAV + 90));

    if (D) s.appendChild(results(p, D));
    s.appendChild(researchTail(p));
    projectsHost.appendChild(s);
  }

  function find(D, mat, a) { return D.trials.filter(function (t) { return t.mat === mat && t.a === a; })[0]; }
  function avg(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function sd(a) { var m = avg(a); return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1)); }

  /* count a number up when it comes into view */
  function countUp(node, to, dec, dur) {
    var started = false;
    passing(node, function (q) {
      if (started || q < 0.15) return;
      started = true;
      var t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / (dur || 1400)), e = 1 - Math.pow(1 - k, 4);
        node.firstChild.nodeValue = (to * e).toFixed(dec);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  function results(p, D) {
    var box = el("div", "wrap results");
    var MATS = p.materials;
    var colorOf = {}; MATS.forEach(function (m) { colorOf[m.id] = m.color; });
    var base = find(D, "baseline", null);
    var obs = D.trials.filter(function (t) { return t.a !== null; });
    var byMat = MATS.slice(1).map(function (m) {
      var ts = obs.filter(function (t) { return t.mat === m.id; }).sort(function (a, b) { return a.a - b.a; });
      var r = ts.map(function (t) { return t.rmse; });
      return { m: m, ts: ts, mean: avg(r), sd: sd(r), r2d: avg(ts.map(function (t) { return t.r2d; })), rz: avg(ts.map(function (t) { return t.rz; })),
        p95: avg(ts.map(function (t) { return t.p95; })), bias: avg(ts.map(function (t) { return t.bias; })), rsd: avg(ts.map(function (t) { return t.rsd; })) };
    });
    var conc = byMat[byMat.length - 1];

    var intro = el("div"); intro.setAttribute("data-rv", ""); intro.setAttribute("data-snap", "");
    var h = el("h3", "r-sub"); h.innerHTML = "One blocked anchor. <em>Up to nine times</em> the error.";
    intro.appendChild(h);
    intro.appendChild(el("p", "r-lede", "Five materials, each placed in one anchor's line of sight in turn, 30 seconds a trial, with smoothing and outlier rejection switched off so nothing hid a bad link. Everything below is drawn from those logs."));
    box.appendChild(intro);

    /* the three numbers */
    var stats = el("div", "stats");
    function stat(val, dec, unit, text, hot) {
      var d = el("div", "stat"); d.setAttribute("data-rv", "");
      var b = el("span", "big" + (hot ? " hot" : "")); b.appendChild(document.createTextNode("0")); if (unit) b.appendChild(el("small", null, unit));
      d.appendChild(b); d.appendChild(el("p", null, text)); stats.appendChild(d);
      countUp(b, val, dec);
    }
    stat(base.rmse, 1, "cm", "3D error on a clear line — centimeter-level, as promised.");
    stat(conc.mean, 1, "cm", "with a concrete block on one link, averaged over the four anchors.", true);
    stat(100, 0, "%", "fix rate in every one of the 21 trials. The signal was never lost — it was just late.");
    box.appendChild(stats);

    /* severity bars */
    var tip = el("div", "tip");
    function showTip(host, x, y, rows, ttl) {
      tip.textContent = ""; tip.appendChild(el("b", null, ttl));
      rows.forEach(function (r) { var d = el("div"); d.appendChild(el("span", null, r[0])); d.appendChild(el("span", null, r[1])); tip.appendChild(d); });
      if (tip.parentNode !== host) host.appendChild(tip);
      tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("on");
    }
    function hideTip() { tip.classList.remove("on"); }

    var sev = el("div", "panel"); sev.setAttribute("data-rv", ""); sev.setAttribute("data-snap", "");
    var sh = el("div", "panel-hd"), sht = el("div");
    sht.appendChild(el("h4", null, "Which material hurts most?"));
    sht.appendChild(el("p", null, "Mean 3D error with one anchor blocked, across the four anchors; whiskers are the spread between them. Dashed: the clear line."));
    sh.appendChild(sht); sev.appendChild(sh);
    var bars = el("div", "bars"), MAX = 70;
    var axis = el("div", "axis"); bars.appendChild(axis);
    [0, 20, 40, 60].forEach(function (v) {
      var t = el("span", null, v); t.style.bottom = "calc(" + (v / MAX * 100) + "% )"; axis.appendChild(t);
      var g = el("div", "gl"); g.style.bottom = "calc(3.2rem + (100% - 3.2rem) * " + (v / MAX) + ")"; bars.appendChild(g);
    });
    var bl = el("div", "base-line"); bl.style.bottom = "calc(3.2rem + (100% - 3.2rem) * " + (base.rmse / MAX) + ")";
    bl.appendChild(el("span", null, "clear " + base.rmse.toFixed(1) + " cm")); bars.appendChild(bl);
    var rowsAll = [{ m: MATS[0], mean: base.rmse, sd: 0, r2d: base.r2d, rz: base.rz, p95: base.p95, bias: null, rsd: null }].concat(byMat);
    rowsAll.forEach(function (r, k) {
      var b = el("div", "bar"); b.tabIndex = 0;
      b.style.setProperty("--c", r.m.color); b.style.setProperty("--i", k);
      b.style.setProperty("--h", (r.mean / MAX * 100) + "%");
      var f = el("div", "fill"); b.appendChild(f);
      b.style.setProperty("--top", ((r.mean + (r.sd || 0)) / MAX * 100) + "%");
      if (r.sd) {
        var e = el("div", "err");
        e.style.setProperty("--lo", (Math.max(0, r.mean - r.sd) / MAX * 100) + "%");
        e.style.setProperty("--hi", ((r.mean + r.sd) / MAX * 100) + "%");
        b.appendChild(e);
      }
      var v = el("span", "val", r.mean.toFixed(1)); v.appendChild(el("small", null, " cm")); b.appendChild(v);
      b.appendChild(el("span", "nm", r.m.short));
      function on() {
        var rr = [["3D RMSE", r.mean.toFixed(1) + " cm"], ["2D", r.r2d.toFixed(1) + " cm"], ["Z", r.rz.toFixed(1) + " cm"], ["95th pct", r.p95.toFixed(1) + " cm"]];
        if (r.bias != null) rr.push(["Range bias", r.bias.toFixed(1) + " cm"], ["Range scatter", r.rsd.toFixed(1) + " cm"]);
        if (r.m.density) rr.push(["Density", r.m.density + " kg/m³"]);
        var br = b.getBoundingClientRect(), pr = bars.getBoundingClientRect();
        showTip(bars, br.left - pr.left + br.width / 2, pr.height - 3.2 * 16 - (r.mean / MAX) * (pr.height - 3.2 * 16), rr, r.m.label);
      }
      b.addEventListener("pointerenter", on); b.addEventListener("focus", on);
      b.addEventListener("pointerleave", hideTip); b.addEventListener("blur", hideTip);
      bars.appendChild(b);
    });
    sev.appendChild(bars);
    box.appendChild(sev);

    /* mechanism scatter + anchor grid */
    var g2 = el("div", "grid2"); g2.setAttribute("data-snap", "");
    var mech = el("div", "panel"); mech.setAttribute("data-rv", "");
    var mh = el("div", "panel-hd"), mht = el("div");
    mht.appendChild(el("h4", null, "Every centimeter of delay became a centimeter of error."));
    mht.appendChild(el("p", null, "Each trial's error against the extra range the obstruction added to its blocked link."));
    mh.appendChild(mht); mech.appendChild(mh);
    var xs = obs.map(function (t) { return t.bias; }), ys = obs.map(function (t) { return t.rmse; });
    var mx = avg(xs), my = avg(ys), sxy = 0, sxx = 0, syy = 0;
    xs.forEach(function (x, k) { sxy += (x - mx) * (ys[k] - my); sxx += (x - mx) * (x - mx); syy += (ys[k] - my) * (ys[k] - my); });
    var slope = sxy / sxx, icpt = my - slope * mx, rr = sxy / Math.sqrt(sxx * syy);
    var sc = el("div", "scatter"), W = 560, H = 340, m = { l: 40, r: 14, t: 14, b: 36 }, XM = 50, YM = 80;
    var sv = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Scatter of 3D error against injected range bias, with a fitted line" });
    function X(v) { return m.l + v / XM * (W - m.l - m.r); }
    function Y(v) { return H - m.b - v / YM * (H - m.t - m.b); }
    [0, 20, 40, 60, 80].forEach(function (v) { sv.appendChild(svg("line", { "class": "gl", x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) })); var t = svg("text", { x: m.l - 8, y: Y(v) + 3, "text-anchor": "end" }); t.textContent = v; sv.appendChild(t); });
    [0, 10, 20, 30, 40, 50].forEach(function (v) { var t = svg("text", { x: X(v), y: H - m.b + 16, "text-anchor": "middle" }); t.textContent = v; sv.appendChild(t); });
    var xl = svg("text", { x: W - m.r, y: H - 4, "text-anchor": "end" }); xl.textContent = "range bias on the blocked link (cm)"; sv.appendChild(xl);
    var yl = svg("text", { x: m.l, y: m.t - 2 }); yl.textContent = "3D RMSE (cm)"; sv.appendChild(yl);
    sv.appendChild(svg("line", { "class": "ax", x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0) }));
    var fit = svg("line", { "class": "fit", x1: X(0), y1: Y(icpt), x2: X(48), y2: Y(icpt + slope * 48) });
    var flen = Math.hypot(X(48) - X(0), Y(icpt + slope * 48) - Y(icpt));
    fit.style.strokeDasharray = flen; fit.style.strokeDashoffset = flen; fit.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.2,.7,.1,1) .9s";
    sv.appendChild(fit);
    obs.forEach(function (t, k) {
      var c = svg("circle", { "class": "dot", cx: X(t.bias), cy: Y(t.rmse), r: 0, fill: colorOf[t.mat], stroke: "#050507", "stroke-width": 1.5 });
      c.style.transition = "r .5s cubic-bezier(.3,1.6,.5,1) " + (0.2 + k * 0.035) + "s";
      c.addEventListener("pointerenter", function () {
        var br = c.getBoundingClientRect(), pr = sc.getBoundingClientRect();
        var mt = MATS.filter(function (q) { return q.id === t.mat; })[0];
        showTip(sc, br.left - pr.left + br.width / 2, br.top - pr.top, [["Blocked", "A" + t.a], ["Range bias", t.bias.toFixed(1) + " cm"], ["3D RMSE", t.rmse.toFixed(1) + " cm"]], mt.label);
      });
      c.addEventListener("pointerleave", hideTip);
      sv.appendChild(c);
    });
    sc.appendChild(sv); mech.appendChild(sc);
    var eq = el("div", "eqn", "RMSE ≈ " + icpt.toFixed(1) + " cm + " + slope.toFixed(3) + " · Δd");
    eq.appendChild(el("small", null, "r = " + rr.toFixed(2) + " across " + obs.length + " trials · the near-unity slope belongs to this anchor layout, not to UWB in general"));
    mech.appendChild(eq);
    var lg = el("div", "legend");
    MATS.slice(1).forEach(function (q) { var sp = el("span"); var ii = el("i"); ii.style.setProperty("--c", q.color); sp.appendChild(ii); sp.appendChild(document.createTextNode(q.short)); lg.appendChild(sp); });
    mech.appendChild(lg);
    passing(mech, function (q) {
      if (q < 0.2 || mech._done) return; mech._done = true;
      fit.style.strokeDashoffset = 0;
      sv.querySelectorAll(".dot").forEach(function (c) { c.setAttribute("r", 5.5); });
    });
    g2.appendChild(mech);

    var heat = el("div", "panel"); heat.setAttribute("data-rv", "");
    var hh = el("div", "panel-hd"), hht = el("div");
    hht.appendChild(el("h4", null, "Which anchor you block matters, too."));
    hht.appendChild(el("p", null, "3D error (cm) for every material and blocked anchor."));
    hh.appendChild(hht); heat.appendChild(hh);
    var grid = el("div", "heat");
    grid.appendChild(el("div", "h"));
    [0, 1, 2, 3].forEach(function (a) { var c = el("div", "h col" + (a === 2 ? " hot" : ""), "A" + a); c.style.color = a === 2 ? p.anchorColors[2] : ""; grid.appendChild(c); });
    var ci = 0;
    byMat.forEach(function (r) {
      grid.appendChild(el("div", "h", r.m.short));
      r.ts.forEach(function (t) {
        var k = clamp01(t.rmse / 75);
        var c = el("div", "c", t.rmse.toFixed(0));
        c.style.setProperty("--i", ci++);
        c.style.setProperty("--bgc", heatColor(k));
        c.style.setProperty("--fgc", k > 0.42 ? "#0b0c10" : "#f5f5f7");
        c.title = r.m.label + " on A" + t.a + ": " + t.rmse.toFixed(1) + " cm";
        grid.appendChild(c);
      });
    });
    heat.appendChild(grid);
    heat.appendChild(el("p", "heat-note", "Blocking A2 hurt most for almost every solid — " + find(D, "concrete", 2).rmse.toFixed(1) + " cm under concrete. Neither its geometry nor its distance from the tag explains why. Still open."));
    g2.appendChild(heat);
    box.appendChild(g2);

    /* replay explorer */
    box.appendChild(explorer(p, D));

    /* findings */
    var fs = el("div", "finds"); fs.setAttribute("data-snap", "");
    var FC = { Supported: "#5cd0b3", Rejected: "#fc6255", Lunar: "#f5c04f", Next: "#7d97ff" };
    p.findings.forEach(function (f, k) {
      var d = el("div", "find"); d.setAttribute("data-rv", ""); d.style.setProperty("--d", (k * 0.08) + "s");
      d.style.setProperty("--fc", FC[f.verdict] || "var(--pa)");
      d.appendChild(el("span", "v", f.verdict)); d.appendChild(el("h5", null, f.title)); d.appendChild(el("p", null, f.body));
      fs.appendChild(d);
    });
    box.appendChild(fs);
    return box;
  }
  function heatColor(k) {
    var a = [245, 192, 79], b = [236, 75, 63], t = Math.min(1, k * 1.15);
    return "rgba(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + "," + (0.1 + 0.9 * Math.pow(k, 0.75)).toFixed(3) + ")";
  }

  /* Replay a trial: the logged fixes, top-down on the bench, at 3× speed. */
  function explorer(p, D) {
    var panel = el("div", "panel"); panel.setAttribute("data-rv", ""); panel.setAttribute("data-snap", "");
    var hd = el("div", "panel-hd"), ht = el("div");
    ht.appendChild(el("h4", null, "Replay a trial."));
    ht.appendChild(el("p", null, "Every fix the tag logged, seen from above the bench, played at three times speed. Pick a material and the anchor it blocks."));
    hd.appendChild(ht); panel.appendChild(hd);
    var ex = el("div", "explorer");
    var cw = el("div", "ex-canvas"), can = el("canvas"); cw.appendChild(can);
    var tl = el("div", "ex-t"); cw.appendChild(tl);
    ex.appendChild(cw);
    var side = el("div", "ex-side");
    var mseg = el("div", "seg"), aseg = el("div", "seg");
    mseg.setAttribute("role", "group"); mseg.setAttribute("aria-label", "Material");
    aseg.setAttribute("role", "group"); aseg.setAttribute("aria-label", "Blocked anchor");
    var state = { mat: "concrete", a: 2 };
    var mBtns = p.materials.map(function (m) {
      var b = el("button"); b.type = "button"; b.style.setProperty("--c", m.color);
      b.appendChild(el("i")); b.appendChild(document.createTextNode(m.short));
      b.addEventListener("click", function () { state.mat = m.id; if (m.id === "baseline") state.a = null; else if (state.a === null) state.a = 2; pick(); });
      mseg.appendChild(b); return { b: b, id: m.id };
    });
    var aBtns = [0, 1, 2, 3].map(function (a) {
      var b = el("button"); b.type = "button"; b.style.setProperty("--c", p.anchorColors[a]);
      b.appendChild(el("i")); b.appendChild(document.createTextNode("A" + a));
      b.addEventListener("click", function () { if (state.mat !== "baseline") { state.a = a; pick(); } });
      aseg.appendChild(b); return b;
    });
    side.appendChild(el("span", "lbl", "Material")); side.appendChild(mseg);
    side.appendChild(el("span", "lbl", "Blocked anchor")); side.appendChild(aseg);
    var ro = el("div", "readout");
    function rrow(k) { var d = el("div"); d.appendChild(el("span", null, k)); var b = el("b", null, "—"); d.appendChild(b); ro.appendChild(d); return b; }
    var rRun = rrow("RMSE so far"), rFin = rrow("Trial RMSE"), rBias = rrow("Range bias"), rFix = rrow("Fixes");
    side.appendChild(ro);
    side.appendChild(el("span", "lbl", "Height error over time"));
    var spark = el("canvas", "spark"); side.appendChild(spark);
    var ctrl = el("div", "ex-ctrl"), play = el("button"); play.type = "button"; play.setAttribute("aria-label", "Pause");
    var prog = el("div", "prog"), progI = el("i"); prog.appendChild(progI);
    ctrl.appendChild(play); ctrl.appendChild(prog); side.appendChild(ctrl);
    ex.appendChild(side); panel.appendChild(ex);

    var PLAY = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';
    var PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5h2v9H3zM7 1.5h2v9H7z" fill="currentColor"/></svg>';
    var trial = null, t0 = 0, paused = false, visible = false, raf = 0, pausedAt = 0;
    var ctx = can.getContext("2d"), sctx = spark.getContext("2d");
    function pick() {
      trial = find(D, state.mat, state.mat === "baseline" ? null : state.a);
      mBtns.forEach(function (o) { o.b.setAttribute("aria-pressed", String(o.id === state.mat)); });
      aBtns.forEach(function (b, k) { b.setAttribute("aria-pressed", String(state.a === k)); b.disabled = state.mat === "baseline"; });
      rFin.textContent = trial.rmse.toFixed(1) + " cm";
      rBias.textContent = trial.bias == null ? "— (clear)" : (trial.bias >= 0 ? "+" : "") + trial.bias.toFixed(1) + " cm";
      t0 = performance.now(); pausedAt = 0;
      if (paused) draw(0);
    }
    play.innerHTML = PAUSE;
    play.addEventListener("click", function () {
      paused = !paused;
      play.innerHTML = paused ? PLAY : PAUSE; play.setAttribute("aria-label", paused ? "Play" : "Pause");
      if (paused) pausedAt = performance.now() - t0; else { t0 = performance.now() - pausedAt; loop(); }
    });

    /* paper frame → canvas: x along the bench, y across it */
    var XR = [-0.72, 1.8], YR = [-0.52, 0.96];
    function size() {
      var dpr = Math.min(devicePixelRatio || 1, 2);
      can.width = cw.clientWidth * dpr; can.height = cw.clientHeight * dpr;
      spark.width = spark.clientWidth * dpr; spark.height = spark.clientHeight * dpr;
    }
    function draw(elapsed) {
      var w = can.width, h = can.height, dpr = w / Math.max(cw.clientWidth, 1);
      var sx = w / (XR[1] - XR[0]), sy = h / (YR[1] - YR[0]), s = Math.min(sx, sy);
      var cx = w / 2 - ((XR[0] + XR[1]) / 2) * s, cy = h / 2 + ((YR[0] + YR[1]) / 2) * s;
      function P(x, y) { return [cx + x * s, cy - y * s]; }
      ctx.clearRect(0, 0, w, h);
      // the bench
      var b0 = P(-0.03, -0.06), b1 = P(1.59, 0.71);
      ctx.strokeStyle = "rgba(245,245,247,.14)"; ctx.lineWidth = 1 * dpr; ctx.setLineDash([]);
      ctx.fillStyle = "rgba(245,245,247,.025)";
      roundRect(ctx, b0[0], b1[1], b1[0] - b0[0], b0[1] - b1[1], 10 * dpr); ctx.fill(); ctx.stroke();
      // range lines, the blocked one red
      var T = P(D.truth[0], D.truth[1]);
      D.anchors.forEach(function (a, k) {
        var A = P(a[0], a[1]), blocked = trial.a === k;
        ctx.strokeStyle = blocked ? "rgba(252,98,85,.9)" : hexA(p.anchorColors[k], 0.28);
        ctx.setLineDash(blocked ? [] : [4 * dpr, 5 * dpr]); ctx.lineWidth = (blocked ? 1.6 : 1) * dpr;
        ctx.beginPath(); ctx.moveTo(T[0], T[1]); ctx.lineTo(A[0], A[1]); ctx.stroke();
        if (blocked) {
          var ux = A[0] - T[0], uy = A[1] - T[1], L = Math.hypot(ux, uy); ux /= L; uy /= L;
          var bx = T[0] + ux * 0.1 * s, by = T[1] + uy * 0.1 * s;
          ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.atan2(uy, ux));
          ctx.fillStyle = hexA(colorFor(trial.mat), 0.85); ctx.fillRect(-0.05 * s, -0.11 * s, 0.1 * s, 0.22 * s);
          ctx.restore();
        }
      });
      ctx.setLineDash([]);
      D.anchors.forEach(function (a, k) {
        var A = P(a[0], a[1]);
        ctx.fillStyle = p.anchorColors[k];
        ctx.beginPath(); ctx.arc(A[0], A[1], 5 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.font = (11 * dpr) + "px 'Geist Mono', monospace"; ctx.fillStyle = "rgba(245,245,247,.75)";
        ctx.fillText("A" + k + "  z " + a[2].toFixed(2) + " m", A[0] + (a[0] > 1 ? -96 : 10) * dpr, A[1] + (a[1] > 0.3 ? -10 : 18) * dpr);
      });
      // fixes so far
      var hz = trial.hz * 3, n = Math.min(trial.n, Math.floor(elapsed / 1000 * hz));
      var col = colorFor(trial.mat), sum = 0, mxp = 0, myp = 0;
      for (var i = 0; i < n; i++) {
        var ex_ = trial.ex[i] / 1000, ey_ = trial.ey[i] / 1000, ez_ = trial.ez[i] / 1000;
        sum += ex_ * ex_ + ey_ * ey_ + ez_ * ez_; mxp += ex_; myp += ey_;
        var Q = P(D.truth[0] + ex_, D.truth[1] + ey_), age = (n - i) / hz;
        ctx.globalAlpha = Math.max(0.12, 1 - age / 4);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(Q[0], Q[1], (i === n - 1 ? 4.5 : 2.2) * dpr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // truth crosshair
      ctx.strokeStyle = "#f5f5f7"; ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.arc(T[0], T[1], 7 * dpr, 0, Math.PI * 2); ctx.moveTo(T[0] - 12 * dpr, T[1]); ctx.lineTo(T[0] + 12 * dpr, T[1]); ctx.moveTo(T[0], T[1] - 12 * dpr); ctx.lineTo(T[0], T[1] + 12 * dpr); ctx.stroke();
      ctx.font = (11 * dpr) + "px 'Geist Mono', monospace"; ctx.fillStyle = "rgba(245,245,247,.6)";
      ctx.fillText("true position", T[0] + 12 * dpr, T[1] + 22 * dpr);
      if (n > 3) {
        var M = P(D.truth[0] + mxp / n, D.truth[1] + myp / n);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.moveTo(T[0], T[1]); ctx.lineTo(M[0], M[1]); ctx.stroke(); ctx.setLineDash([]);
      }
      // a 10 cm scale bar
      var s0 = P(1.45, -0.42), s1 = P(1.55, -0.42);
      ctx.strokeStyle = "rgba(245,245,247,.5)"; ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.moveTo(s0[0], s0[1] - 4 * dpr); ctx.lineTo(s0[0], s0[1] + 4 * dpr); ctx.moveTo(s1[0], s1[1] - 4 * dpr); ctx.lineTo(s1[0], s1[1] + 4 * dpr); ctx.stroke();
      ctx.fillStyle = "rgba(245,245,247,.55)"; ctx.fillText("10 cm", s0[0] - 46 * dpr, s1[1] + 4 * dpr);

      rRun.textContent = n ? (Math.sqrt(sum / n) * 100).toFixed(1) + " cm" : "—";
      rFix.textContent = n + " / " + trial.n;
      tl.textContent = "t = " + (n / trial.hz).toFixed(1) + " s  ·  3× speed";
      progI.style.transform = "scaleX(" + n / trial.n + ")";
      // Z sparkline
      var sw = spark.width, sh = spark.height;
      sctx.clearRect(0, 0, sw, sh);
      sctx.strokeStyle = "rgba(245,245,247,.12)"; sctx.lineWidth = 1;
      sctx.beginPath(); sctx.moveTo(0, sh / 2); sctx.lineTo(sw, sh / 2); sctx.stroke();
      sctx.strokeStyle = col; sctx.lineWidth = 1.5 * dpr; sctx.beginPath();
      for (var j = 0; j < n; j++) {
        var zx = j / (trial.n - 1) * sw, zy = sh / 2 - (trial.ez[j] / 1000) / 0.3 * (sh / 2);
        if (j) sctx.lineTo(zx, zy); else sctx.moveTo(zx, zy);
      }
      sctx.stroke();
      return n >= trial.n;
    }
    function loop() {
      if (raf) return;
      raf = requestAnimationFrame(function f(now) {
        raf = 0;
        if (!visible || paused) return;
        var el_ = now - t0;
        if (draw(el_) && el_ > trial.n / (trial.hz * 3) * 1000 + 1800) t0 = now;
        raf = requestAnimationFrame(f);
      });
    }
    function colorFor(id) { var m = p.materials.filter(function (q) { return q.id === id; })[0]; return m ? m.color : "#fff"; }
    pick();
    if ("ResizeObserver" in window) new ResizeObserver(function () { size(); if (paused) draw(pausedAt); }).observe(cw);
    size();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !paused) { t0 = performance.now() - (pausedAt || 0); pausedAt = 0; loop(); }
        else if (!visible) pausedAt = performance.now() - t0;
      }).observe(cw);
    } else { visible = true; loop(); }
    return panel;
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }

  function researchTail(p) {
    var t = el("div", "wrap r-tail"); t.setAttribute("data-snap", "");
    var L = el("div"), R = el("div");
    L.setAttribute("data-rv", ""); R.setAttribute("data-rv", ""); R.style.setProperty("--d", ".12s");
    L.appendChild(el("span", "lbl", "The rig"));
    L.appendChild(el("p", "summary", "Five nodes on a bench: four anchors clamped at four heights, one tag on a stand at a tape-measured point. Firmware on the ESP32, a Python server logging every fix and raw range over Wi-Fi, and printed fixtures to hold it all where the survey said it was."));
    var acts = el("div", "acts");
    if (p.paper) {
      var pa = el("a", "act"); pa.href = src(p.slug, p.paper); pa.target = "_blank"; pa.rel = "noopener";
      pa.appendChild(ico('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4 1.5h5.5L13 5v9.5H4z"/><path d="M9.5 1.5V5H13M6.5 8.5h4M6.5 11h4"/></svg>'));
      var pt = el("span"); pt.appendChild(document.createTextNode("Read the paper")); pt.appendChild(el("small", null, "PDF" + (p.paperPages ? " · " + p.paperPages + " pages" : "")));
      pa.appendChild(pt); acts.appendChild(pa);
    }
    var media = (p.media || []).map(function (m) { return reg(p.slug, { slug: p.slug, m: m, accent: ACC[p.slug], label: "HARDWARE" }); });
    if (media.length) {
      var th = ico(null, "thumb still"); th.style.backgroundImage = "url('" + src(p.slug, p.media[0].file) + "')";
      if (p.media[0].bg) th.style.backgroundColor = p.media[0].bg;
      acts.appendChild(actBtn(th, "See the hardware", media.length + " renders", function () { openIn(p.slug, media[0]); }));
    }
    links(p, acts);
    L.appendChild(acts);
    L.appendChild(el("p", "limits", "Scope, honestly: a benchtop study with a stationary tag, links under 2 m, one take per material–anchor cell, room temperature and air. The vacuum, thermal extremes and charged regolith of the Moon are future work, as is blocking more than one link at once."));
    R.appendChild(specList(p));
    t.appendChild(L); t.appendChild(R);
    return t;
  }

  /* ============================================================================
     03+ · the card deck
     ========================================================================= */
  function buildCard(p, i) {
    if (!deck) {
      deck = el("div", "wrap deck"); deck.id = "more";
      var hd = el("div", "sec-head"); hd.style.padding = "0 0 clamp(1.6rem,4vh,2.6rem)"; hd.style.border = "0";
      var ht = el("h2", "sec-title"); ht.innerHTML = "More <em>from the bench</em>";
      ht.setAttribute("data-rv", ""); ht.setAttribute("data-snap", "");
      hd.appendChild(ht); deck.appendChild(hd);
      projectsHost.appendChild(deck);
    }
    var k = deck.querySelectorAll(".card").length;
    var mark = el("div"); mark.className = "card-mark"; deck.appendChild(mark);
    var c = el("article", "card"); c.id = "p-" + p.slug;
    c.style.setProperty("--pa", ACC[p.slug]); c.style.setProperty("--k", k);
    var tx = el("div", "card-tx");
    var top = el("div", "meta"); top.style.justifyContent = "space-between";
    top.appendChild(meta(p, i)); top.appendChild(chip(p));
    tx.appendChild(top);
    tx.appendChild(title(p));
    tx.appendChild(el("p", "summary", p.summary));
    var n = notes(p); if (n) tx.appendChild(n);
    var lk = el("div", "acts"); links(p, lk); tx.appendChild(lk);
    c.appendChild(tx);
    tx.appendChild(el("div", "card-big", pad(i + 1)));
    var vis = el("div", "card-vis");
    var mot = el("div", "motif");
    motif(p, mot);
    vis.appendChild(mot);
    var sp = specList(p); sp.querySelector(".lbl").style.display = "none";
    var dl = sp; dl.style.padding = "0 clamp(1.2rem,3vw,2.2rem) clamp(1.2rem,3vw,2rem)";
    vis.appendChild(dl);
    c.appendChild(vis);
    c.appendChild(el("div", "card-shade"));
    deck.appendChild(c);
  }
  /* each card is pushed back as the next one slides over it */
  function wireDeck() {
    if (!deck) return;
    var cards = Array.prototype.slice.call(deck.querySelectorAll(".card"));
    var marks = Array.prototype.slice.call(deck.querySelectorAll(".card-mark"));
    cards.forEach(function (c, k) {
      /* each card's snap point is where it has just come to rest */
      Snap.add(function () { return absTop(marks[k]) - (parseFloat(c.style.top) || NAV + 13 + k * 14); });
    });
    cards.forEach(function (c, k) {
      /* a card taller than the screen sticks by its bottom edge instead, so
         none of it is ever hidden under the next one */
      Engine.add({
        measure: function (vh) {
          c.style.top = "";
          var want = 64 + 13 + k * 14;
          if (c.offsetHeight + want + 16 > vh) c.style.top = (vh - c.offsetHeight - 16) + "px";
        },
        update: function () {}
      });
    });
    cards.forEach(function (c, k) {
      var next = marks[k + 1]; if (!next) return;
      var shade = c.querySelector(".card-shade"), top = 0, stick = 0, sticky = true, prev = -1;
      Engine.add({
        measure: function (vh) { top = absTop(next); stick = Math.max(64 + 13 + (k + 1) * 14, vh - cards[k + 1].offsetHeight - 16); sticky = getComputedStyle(c).position === "sticky"; },
        update: function (y, vh, dt, force) {
          var q = sticky ? clamp01((y + vh - top) / Math.max(1, vh - stick)) : 0;
          if (q === prev && !force) return; prev = q;
          c.style.transform = q ? "scale(" + (1 - q * 0.05) + ")" : "";
          shade.style.opacity = String(q * 0.55);
        }
      });
    });
  }

  /* small, true-to-the-project animations for cards without pictures */
  function motif(p, box) {
    var kind = p.motif;
    if (kind === "media" && p.media && p.media.length) {
      var m = p.media[0], ent = reg(p.slug, { slug: p.slug, m: m, accent: ACC[p.slug], no: 1 });
      var b = el("button", "mplate"); b.type = "button"; b.setAttribute("aria-label", "Enlarge: " + (m.caption || ""));
      var im = el("img"); im.src = src(p.slug, m.file); im.alt = m.caption || ""; im.loading = "lazy";
      b.appendChild(im); b.appendChild(el("span", "cap", m.caption || ""));
      b.addEventListener("click", function () { openIn(p.slug, ent); });
      box.appendChild(b);
      return;
    }
    var W = 400, H = 260, s = svg("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true" });
    box.appendChild(s);
    var tick = null;
    if (kind === "swarm") {
      /* three drones flying a figure-eight in formation */
      var path = svg("path", { "class": "trace", d: lemniscate(W / 2, H / 2, 150, 70) });
      s.appendChild(path);
      [[W / 2 - 60, H - 26], [W / 2, H - 26], [W / 2 + 60, H - 26]].forEach(function (q, k) {
        s.appendChild(svg("circle", { "class": "dim", cx: q[0], cy: q[1], r: 9 }));
        var t = svg("text", { x: q[0], y: q[1] + 3.5, "text-anchor": "middle" }); t.textContent = k + 1; s.appendChild(t);
      });
      var drones = [0, 1, 2].map(function (k) {
        var g = svg("g", {});
        [[-7, -7], [7, -7], [-7, 7], [7, 7]].forEach(function (o) { g.appendChild(svg("circle", { cx: o[0], cy: o[1], r: 4.2, fill: "none", stroke: "var(--pa)", "stroke-width": 1.4 })); });
        g.appendChild(svg("rect", { x: -3.5, y: -3.5, width: 7, height: 7, rx: 1.5, fill: "var(--pa)" }));
        s.appendChild(g); return g;
      });
      var L = path.getTotalLength();
      tick = function (t) {
        drones.forEach(function (g, k) {
          var u = ((t * 0.07 + k * 0.06) % 1) * L, pt = path.getPointAtLength(u), pt2 = path.getPointAtLength((u + 2) % L);
          var a = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
          g.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ") rotate(" + a + ")");
        });
      };
    } else if (kind === "path") {
      /* an autonomous path drawn out, and a robot following it */
      s.appendChild(svg("rect", { "class": "dim", x: 16, y: 16, width: W - 32, height: H - 32, rx: 14 }));
      s.appendChild(svg("line", { "class": "dim", x1: W / 2, y1: 16, x2: W / 2, y2: H - 16, "stroke-dasharray": "4 6" }));
      var d = "M 52 200 C 120 210, 150 80, 210 96 S 300 190, 348 70";
      s.appendChild(svg("path", { "class": "trace", d: d }));
      var lit = svg("path", { "class": "lit", d: d }); s.appendChild(lit);
      var pl = lit.getTotalLength(); lit.style.strokeDasharray = pl;
      [[52, 200], [210, 96], [348, 70]].forEach(function (q) { s.appendChild(svg("circle", { cx: q[0], cy: q[1], r: 4, fill: "var(--pa)" })); });
      var bot = svg("g", {});
      bot.appendChild(svg("rect", { x: -13, y: -13, width: 26, height: 26, rx: 4, fill: "rgba(5,5,7,.9)", stroke: "var(--pa)", "stroke-width": 1.6 }));
      bot.appendChild(svg("path", { d: "M 4 -6 L 10 0 L 4 6", fill: "none", stroke: "var(--pa)", "stroke-width": 1.6 }));
      s.appendChild(bot);
      var lbl = svg("text", { x: 28, y: 36 }); lbl.textContent = "auto · path following"; s.appendChild(lbl);
      tick = function (t) {
        var c = (t * 0.18) % 1.3, k = smooth(clamp01(c));
        lit.style.strokeDashoffset = pl * (1 - k);
        var pt = lit.getPointAtLength(k * pl), pt2 = lit.getPointAtLength(Math.min(pl, k * pl + 2));
        var a = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
        bot.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ") rotate(" + a + ")");
      };
    } else if (kind === "records") {
      /* records written one at a time, from the terminal */
      var types = ["A", "AAAA", "CNAME", "TXT", "MX", "A"];
      var rows = types.map(function (t, k) {
        var y = 40 + k * 34, g = svg("g", {});
        var bg = svg("rect", { x: 24, y: y - 20, width: W - 48, height: 28, rx: 7, fill: "var(--pa)", opacity: 0 });
        g.appendChild(bg);
        var ty = svg("text", { x: 38, y: y - 1, "class": "rec", fill: "var(--pa)" }); ty.textContent = t; g.appendChild(ty);
        var nm = svg("text", { x: 108, y: y - 1, "class": "rec" }); nm.textContent = k === 2 ? "www" : "@"; nm.setAttribute("fill", "var(--fg-2)"); g.appendChild(nm);
        var bar = svg("rect", { x: 160, y: y - 11, width: 0, height: 6, rx: 3, fill: "var(--fg-4)" }); g.appendChild(bar);
        var ok = svg("text", { x: W - 44, y: y - 1, "class": "rec", fill: "var(--pa)", opacity: 0 }); ok.textContent = "✓"; g.appendChild(ok);
        s.appendChild(g); return { bg: bg, bar: bar, ok: ok, w: 120 + (k * 37 % 60) };
      });
      tick = function (t) {
        var c = (t * 0.5) % (rows.length + 2);
        rows.forEach(function (r, k) {
          var q = clamp01(c - k);
          r.bar.setAttribute("width", r.w * smooth(q));
          r.ok.setAttribute("opacity", q >= 1 ? 1 : 0);
          r.bg.setAttribute("opacity", q > 0 && q < 1 ? 0.12 : 0);
        });
      };
    } else if (kind === "minimap") {
      /* this page, in miniature, with you on it */
      var frame = svg("rect", { "class": "dim", x: 150, y: 14, width: 100, height: H - 28, rx: 8 }); s.appendChild(frame);
      var blocks = svg("g", {}); s.appendChild(blocks);
      var you = svg("rect", { x: 144, y: 14, width: 112, height: 20, rx: 4, fill: "none", stroke: "var(--pa)", "stroke-width": 1.6 }); s.appendChild(you);
      var youT = svg("text", { x: 264, y: 28, fill: "var(--pa)" }); youT.textContent = "you are here"; s.appendChild(youT);
      var built = false;
      function build() {
        built = true; blocks.textContent = "";
        var secs = document.querySelectorAll("main > section, main > div > section, .deck .card, footer");
        var total = document.documentElement.scrollHeight, y0 = 18, hh = H - 36;
        Array.prototype.forEach.call(secs, function (sec) {
          var t = absTop(sec) / total * hh, hgt = Math.max(2, sec.offsetHeight / total * hh - 2);
          var col = getComputedStyle(sec).getPropertyValue("--pa").trim() || "rgba(245,245,247,.25)";
          blocks.appendChild(svg("rect", { x: 156, y: y0 + t, width: 88, height: hgt, rx: 2, fill: col, opacity: 0.35 }));
        });
      }
      tick = function () {
        if (!built) build();
        var total = document.documentElement.scrollHeight, hh = H - 36;
        var y = 18 + scrollY / total * hh, hv = Math.max(6, innerHeight / total * hh);
        you.setAttribute("y", y - 2); you.setAttribute("height", hv + 4);
        youT.setAttribute("y", y + hv / 2 + 4);
      };
      addEventListener("resize", function () { built = false; });
    }
    if (tick) {
      var on = false, raf = 0;
      var loopM = function (now) { raf = 0; if (!on) return; tick(now / 1000); raf = requestAnimationFrame(loopM); };
      if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (on && !raf) raf = requestAnimationFrame(loopM); }).observe(box);
      else { on = true; raf = requestAnimationFrame(loopM); }
    }
  }
  function lemniscate(cx, cy, a, b) {
    var d = "";
    for (var k = 0; k <= 120; k++) {
      var t = k / 120 * Math.PI * 2, den = 1 + Math.sin(t) * Math.sin(t);
      var x = cx + a * Math.cos(t) / den, y = cy - 18 + b * 1.6 * Math.sin(t) * Math.cos(t) / den;
      d += (k ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return d + " Z";
  }
  wireDeck();

  /* ============================================================================
     Capabilities — rows of type that slide across as you pass
     ========================================================================= */
  /* the rows drift on their own, in alternating directions; scrolling gives
     them a push */
  var mqHost = document.getElementById("mq"), rowsMq = [];
  STACK.forEach(function (row, k) {
    var r = el("div", "mq"); r.setAttribute("data-rv", "");
    r.appendChild(el("span", "lbl mq-lbl", row[0]));
    var tr = el("div", "mq-track"), items = row[1].split(" · ");
    for (var rep = 0; rep < 4; rep++) items.forEach(function (it) { tr.appendChild(el("span", null, it)); tr.appendChild(el("span", "dot", "·")); });
    r.appendChild(tr); mqHost.appendChild(r);
    rowsMq.push({ r: r, tr: tr, dir: k % 2 ? 1 : -1, pos: Math.random() * 400, w: 0, top: 0, h: 0, speed: 0 });
  });
  Engine.add({
    measure: function () { rowsMq.forEach(function (o) { o.w = o.tr.scrollWidth / 4; o.top = absTop(o.r); o.h = o.r.offsetHeight; }); },
    update: function (y, vh, dt) {
      var kick = Math.min(1600, Math.abs(Engine.vel()) * 0.55);
      rowsMq.forEach(function (o) {
        if (y + vh < o.top || y > o.top + o.h || !o.w) return;
        o.speed += (46 + kick - o.speed) * Math.min(1, dt * 4);
        o.pos = (o.pos + o.dir * o.speed * dt) % o.w;
        if (o.pos < 0) o.pos += o.w;
        o.tr.style.transform = "translate3d(" + (-o.w - o.pos).toFixed(1) + "px,0,0)";
      });
    }
  });

  var bench = document.getElementById("bench");
  var BC = ["#22d3ee", "#a78bfa", "#ffc21a"];
  BENCH.forEach(function (row, k) {
    var d = el("div", "bcard"); d.setAttribute("data-rv", ""); d.style.setProperty("--d", (k * 0.1) + "s"); d.style.setProperty("--pa", BC[k % BC.length]);
    d.appendChild(el("span", "n", pad(k + 1)));
    d.appendChild(el("h3", null, row[0])); d.appendChild(el("p", null, row[1]));
    d.addEventListener("pointermove", function (e) { var r = d.getBoundingClientRect(); d.style.setProperty("--mx", (e.clientX - r.left) + "px"); d.style.setProperty("--my", (e.clientY - r.top) + "px"); });
    bench.appendChild(d);
  });

  /* ── outro ── */
  var outroField = Field(document.getElementById("field2"), { host: document.querySelector(".outro-pin"), every: 2200 });
  var wm = document.getElementById("wordmark"), ocLinks = document.getElementById("cta2");
  SITE.links.forEach(function (l, i) { var a = el("a", "btn" + (i === 0 ? " pri" : ""), l.label); a.href = l.href; a.rel = "noopener"; ocLinks.appendChild(a); });
  pinned(document.querySelector(".outro"), function (q) {
    wm.style.transform = "translate3d(-50%," + lerp(60, 0, smooth(q)) + "%,0)";
    outroField.fade(0.4 + q * 0.6);
  }, 10);

  /* ============================================================================
     Header: progress, solid bar, active link
     ========================================================================= */
  var bar = document.getElementById("bar"), nav = document.querySelector(".nav"), pill = document.querySelector(".pill");
  var ind = pill.querySelector(".ind"), navLinks = Array.prototype.slice.call(pill.querySelectorAll("a[href^='#']"));
  /* [section, which link it lights]: the card deck after the research is still Work */
  var targets = [["work", 0], ["p-uwb", 1], ["more", 0], ["stack", 2]].map(function (t) { return { n: document.getElementById(t[0]), link: t[1] }; }).filter(function (t) { return t.n; });
  var tops = [], heroEnd = 0, active = -2;
  Engine.add({
    measure: function (vh) {
      tops = targets.map(function (t) { return absTop(t.n); });
      heroEnd = absTop(document.querySelector(".statement"));
    },
    update: function (y, vh) {
      var h = document.documentElement.scrollHeight - vh;
      bar.style.transform = "scaleX(" + (h > 0 ? y / h : 0) + ")";
      nav.classList.toggle("solid", y > heroEnd - vh * 0.5);
      var a = -1;
      for (var k = 0; k < tops.length; k++) if (y + vh * 0.4 >= tops[k]) a = targets[k].link;
      if (a !== active) {
        active = a;
        navLinks.forEach(function (l, k) { l.classList.toggle("on", k === a); });
        if (a >= 0) { var l = navLinks[a]; ind.style.opacity = 1; ind.style.width = l.offsetWidth + "px"; ind.style.transform = "translateX(" + l.offsetLeft + "px)"; }
        else ind.style.opacity = 0;
      }
    }
  });

  /* ── reveal on arrival ── */
  (function () {
    var nodes = [];
    Engine.add({
      measure: function () { nodes = Array.prototype.slice.call(document.querySelectorAll("[data-rv]:not(.in)")).map(function (n) { return { n: n, top: absTop(n) }; }); },
      update: function (y, vh) {
        for (var k = 0; k < nodes.length; k++) {
          var o = nodes[k];
          if (!o.done && y + vh * 0.9 > o.top) { o.done = true; o.n.classList.add("in"); }
        }
      }
    });
  })();

  /* ── in-page links glide ── */
  var glide = 0;
  function stopGlide() { cancelAnimationFrame(glide); glide = 0; }
  ["wheel", "touchstart", "keydown"].forEach(function (t) { addEventListener(t, stopGlide, { passive: true }); });
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    var target = id ? document.getElementById(id) : document.body;
    if (!target) return;
    e.preventDefault();
    stopGlide();
    var padT = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    var from = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
    var to = Math.max(0, Math.min(max, id && id !== "top" ? absTop(target) - (target.classList.contains("p-model") || target.classList.contains("p-research") ? 0 : padT) : 0));
    var dist = Math.abs(to - from), dur = Math.min(1600, 500 + dist * 0.12), t0 = performance.now();
    if (document.hidden) { window.scrollTo(0, to); return; }
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), ease = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo({ top: from + (to - from) * ease, behavior: "instant" });
      glide = k < 1 ? requestAnimationFrame(step) : 0;
    })(t0);
    if (id && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
  });

  /* ============================================================================
     Source viewer — excerpts fetched from GitHub at a pinned commit, so the
     gutter numbers are the file's own and "on GitHub" lands on the same lines.
     ========================================================================= */
  function svgIn(n, s) { n.insertAdjacentHTML("afterbegin", s); return n; }
  var KW = /^(abstract|boolean|break|case|catch|class|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|new|package|private|protected|public|record|return|static|super|switch|this|throw|throws|try|var|void|volatile|while|true|false|null)$/;
  function highlight(line, st, into) {
    var i = 0, n = line.length, plain = "";
    function flush() { if (plain) { into.appendChild(document.createTextNode(plain)); plain = ""; } }
    function tok(cls, s) { flush(); into.appendChild(el("span", cls, s)); }
    while (i < n) {
      var rest = line.slice(i), m;
      if (st.block) {
        var e = rest.indexOf("*/"), end = e < 0 ? n : i + e + 2;
        tok("t-c", line.slice(i, end)); i = end; if (e >= 0) st.block = false; continue;
      }
      if (rest.indexOf("//") === 0) { tok("t-c", rest); break; }
      if (rest.indexOf("/*") === 0) { st.block = true; tok("t-c", "/*"); i += 2; continue; }
      if (rest[0] === '"' && (m = /^"(?:[^"\\]|\\.)*"?/.exec(rest))) { tok("t-s", m[0]); i += m[0].length; continue; }
      if ((m = /^@[A-Za-z]\w*/.exec(rest))) { tok("t-a", m[0]); i += m[0].length; continue; }
      if (!/[\w$]/.test(line[i - 1] || "") && (m = /^\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?[dDfFlL]?/.exec(rest))) { tok("t-n", m[0]); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_$][\w$]*/.exec(rest))) {
        var w = m[0], call = /^\s*\(/.test(line.slice(i + w.length));
        if (KW.test(w)) tok("t-k", w); else if (call) tok("t-f", w); else if (/^[A-Z]/.test(w)) tok("t-t", w); else plain += w;
        i += w.length; continue;
      }
      plain += line[i]; i += 1;
    }
    flush();
  }
  var rawCache = {};
  function getFile(c, path) {
    var url = "https://raw.githubusercontent.com/" + c.repo + "/" + c.ref + "/" + c.root + path;
    if (!rawCache[url]) {
      rawCache[url] = fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(r.status)); });
      rawCache[url].catch(function () { delete rawCache[url]; });
    }
    return rawCache[url];
  }
  function codeView(c) {
    var gh = "https://github.com/" + c.repo;
    function blob(f) { return gh + "/blob/" + c.ref + "/" + c.root + f.path; }
    var box = el("div", "code"), hd = el("div", "code-hd"), id = svgIn(el("div", "code-id"), ICON.branch);
    var repo = el("a", "code-repo"); repo.href = gh; repo.rel = "noopener"; repo.target = "_blank";
    var rp = c.repo.split("/");
    repo.appendChild(el("span", null, rp[0] + " / ")); repo.appendChild(document.createTextNode(rp[1]));
    id.appendChild(repo);
    var ref = el("a", "code-ref", "@ " + c.ref.slice(0, 7));
    ref.href = gh + "/tree/" + c.ref; ref.rel = "noopener"; ref.target = "_blank"; ref.title = "The exact commit these excerpts are from";
    id.appendChild(ref); hd.appendChild(id);
    var acts = el("div", "code-acts");
    var edit = svgIn(el("a", "code-act pri", "Open in editor"), ICON.code);
    edit.rel = "noopener"; edit.target = "_blank"; edit.title = "github.dev: VS Code in the browser, nothing to install";
    var browse = svgIn(el("a", "code-act", "Repository"), ICON.out);
    browse.href = gh; browse.rel = "noopener"; browse.target = "_blank";
    acts.appendChild(edit); acts.appendChild(browse); hd.appendChild(acts); box.appendChild(hd);

    var body = el("div", "code-body"), rail = el("div", "code-rail"), tabs = el("div", "code-tabs");
    tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Code excerpts");
    var note = el("p", "code-note"), noteTx = el("span");
    note.appendChild(el("span", "lbl", "Why it's here")); note.appendChild(noteTx);
    rail.appendChild(tabs); rail.appendChild(note);
    var pane = el("div", "code-pane"); pane.setAttribute("role", "tabpanel");
    var cbar = el("div", "code-bar"), path = el("span", "code-path");
    var onGh = svgIn(el("a", "code-gh"), ICON.out), onGhTx = document.createTextNode("");
    onGh.appendChild(onGhTx); onGh.rel = "noopener"; onGh.target = "_blank"; onGh.title = "Open these lines on GitHub";
    cbar.appendChild(path); cbar.appendChild(onGh);
    var scroll = el("div", "code-scroll"); scroll.tabIndex = 0;
    pane.appendChild(cbar); pane.appendChild(scroll);
    body.appendChild(rail); body.appendChild(pane); box.appendChild(body);

    var btns = [], cur = -1, started = false;
    c.files.forEach(function (f, i) {
      var b = el("button", "code-tab"); b.type = "button"; b.setAttribute("role", "tab");
      b.appendChild(el("b", null, pad(i + 1))); b.appendChild(el("span", "tt", f.title));
      b.appendChild(el("span", "loc", f.image ? "Diagram" : f.path.split("/").pop() + " · L" + f.lines[0] + "–" + f.lines[1]));
      b.addEventListener("click", function () { select(i); });
      btns.push(b); tabs.appendChild(b);
    });
    tabs.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var k = (cur + d + btns.length) % btns.length; select(k); btns[k].focus();
    });
    function render(f, text) {
      var all = text.replace(/\r/g, "").split("\n"), a = f.lines[0], z = Math.min(f.lines[1], all.length);
      var slice = all.slice(a - 1, z), cut = Infinity;
      slice.forEach(function (l) { if (l.trim()) cut = Math.min(cut, /^\s*/.exec(l)[0].length); });
      if (!isFinite(cut)) cut = 0;
      var st = { block: false };
      all.slice(0, a - 1).forEach(function (l) { highlight(l, st, document.createDocumentFragment()); });
      var pre = el("div", "code-lines");
      slice.forEach(function (l, k) {
        var row = el("div", "ln"); row.style.animationDelay = Math.min(k * 9, 260) + "ms";
        var no = el("a", "ln-no", String(a + k)); no.href = blob(f) + "#L" + (a + k); no.tabIndex = -1; no.rel = "noopener"; no.target = "_blank";
        var tx = el("span", "ln-tx");
        if (l.trim()) highlight(l.slice(cut), st, tx); else tx.textContent = " ";
        row.appendChild(no); row.appendChild(tx); pre.appendChild(row);
      });
      scroll.textContent = ""; scroll.appendChild(pre); scroll.scrollTop = 0; scroll.scrollLeft = 0;
    }
    function load() {
      var i = cur, f = c.files[i];
      scroll.textContent = "";
      if (f.image) { var fig = el("div", "code-fig"), im = el("img"); im.src = f.image; im.alt = f.title; fig.appendChild(im); scroll.appendChild(fig); return; }
      scroll.appendChild(el("div", "code-msg", "Fetching " + f.path.split("/").pop() + "…"));
      getFile(c, f.path).then(function (t) { if (cur === i) render(f, t); }, function () {
        if (cur !== i) return;
        scroll.textContent = "";
        var msg = el("div", "code-msg"), pp = el("span", null, "GitHub didn't answer. ");
        var a = el("a", null, "Read it there instead"); a.href = onGh.href; a.rel = "noopener";
        pp.appendChild(a); msg.appendChild(pp); scroll.appendChild(msg);
      });
    }
    function select(i) {
      if (i === cur) return;
      cur = i;
      var f = c.files[i];
      btns.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); b.tabIndex = k === i ? 0 : -1; });
      noteTx.textContent = f.note || "";
      onGh.hidden = !!f.image;
      if (f.image) {
        path.textContent = ""; path.appendChild(el("b", null, f.title));
        edit.href = "https://github.dev/" + c.repo + "/tree/" + c.ref;
        if (started) load();
        return;
      }
      var dirs = f.path.split("/"), file = dirs.pop();
      path.textContent = "";
      var bd = document.createElement("bdi");
      bd.appendChild(document.createTextNode(c.root.replace(/^src\/main\/java\//, "") + (dirs.length ? dirs.join("/") + "/" : "")));
      bd.appendChild(el("b", null, file)); path.appendChild(bd);
      onGhTx.nodeValue = "L" + f.lines[0] + "–" + f.lines[1];
      onGh.href = blob(f) + "#L" + f.lines[0] + "-L" + f.lines[1];
      edit.href = "https://github.dev/" + c.repo + "/blob/" + c.ref + "/" + c.root + f.path;
      if (started) load();
    }
    function start() { if (!started) { started = true; load(); } }
    select(0);
    var x = el("button", "code-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close the code viewer");
    hd.appendChild(x);
    return { box: box, start: start, close: x, focus: function () { btns[cur].focus(); } };
  }
  /* code reads in its own colour, apart from the project's accent */
  var CODE_ACCENT = "#a78bfa";
  function codeButton(c) {
    var excerpts = c.files.filter(function (f) { return !f.image; }).length;
    var b = actBtn(ico(null), "Read the code", (c.files.length > excerpts ? "Architecture + " : "") + excerpts + " excerpts", function () {
      if (!ov) {
        ov = el("div", "cv");
        ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Source code, " + c.repo);
        ov.style.setProperty("--pa", CODE_ACCENT);
        v = codeView(c); ov.appendChild(v.box);
        ov.addEventListener("click", function (e) { if (e.target === ov) shut(); });
        v.close.addEventListener("click", shut);
        document.body.appendChild(ov);
      }
      ov.hidden = false; document.body.style.overflow = "hidden";
      document.addEventListener("keydown", key);
      v.start(); v.focus();
    });
    b.style.setProperty("--pa", CODE_ACCENT);
    b.querySelector(".ico").textContent = "</>";
    var ov = null, v = null;
    function shut() { ov.hidden = true; document.body.style.overflow = ""; document.removeEventListener("keydown", key); b.focus(); }
    function key(e) { if (e.key === "Escape") shut(); }
    return b;
  }

  /* ============================================================================
     Media viewer — images, video, YouTube and live 3D in one playlist.
     ========================================================================= */
  var lb = document.getElementById("lb"), stage = document.getElementById("lb-stage");
  var capN = document.getElementById("lb-cap"), figN = document.getElementById("lb-fig"), ctN = document.getElementById("lb-ct");
  var prev = document.getElementById("lb-prev"), next = document.getElementById("lb-next"), xBtn = document.getElementById("lb-x");
  var at = 0, list = [], back = null, node = null, lbViewer = null, mountToken = 0, rows = [];
  var sideList = document.getElementById("lb-list");
  function urlOf(f) { return f.m.url || src(f.slug, f.m.file); }
  function kindOf(f) { if (f.label) return f.label; var m = f.m; return m.type === "model" ? "3D MODEL" : m.type === "image" ? "FIG " + pad(f.no || at + 1) : "VIDEO"; }
  function isVid(f) { return f.m.type === "youtube" || f.m.type === "video"; }
  function nextVid(from) { for (var j = from + 1; j < list.length; j++) if (isVid(list[j])) return j; return -1; }
  function mediaList(slug, noModel) {
    var all = (CLIPS[slug] || []).concat(MEDIA[slug] || []);
    return noModel ? all.filter(function (e) { return e.m.type !== "model"; }) : all;
  }
  function buildSide(slug) {
    sideList.textContent = ""; rows = [];
    document.getElementById("lb-side-t").textContent = TITLES[slug] || "";
    document.getElementById("lb-side-n").textContent = list.length + (list.length === 1 ? " item" : " items");
    var grp = null;
    list.forEach(function (f, i) {
      if (f.group && f.group !== grp) { grp = f.group; var gh = el("li", "lb-grp"); gh.appendChild(el("span", "lbl", grp)); sideList.appendChild(gh); }
      var li = document.createElement("li"), b = el("button", "lb-item"); b.type = "button";
      var th = el("span", "lb-th"), m = f.m;
      if (m.type === "youtube") { th.style.backgroundImage = "url('https://img.youtube.com/vi/" + m.id + "/mqdefault.jpg')"; th.className += " vid"; }
      else if (m.type === "video") { if (m.poster) th.style.backgroundImage = "url('" + src(f.slug, m.poster) + "')"; th.className += " vid"; }
      else if (m.type === "model") { if (m.poster) th.style.backgroundImage = "url('" + src(f.slug, m.poster) + "')"; th.className += " mdl contain"; th.appendChild(el("span", null, "3D")); }
      else { th.style.backgroundImage = "url('" + urlOf(f) + "')"; if (/\.svg$/i.test(urlOf(f)) || m.bg) th.className += " contain"; if (m.bg) th.style.backgroundColor = m.bg; }
      var it = el("span", "lb-it");
      it.appendChild(el("span", "k", kindOf(f))); it.appendChild(el("span", "c", m.caption || ""));
      var st = el("span", "st", ""); it.appendChild(st);
      b.appendChild(th); b.appendChild(it);
      b.addEventListener("click", function () { at = i; show(); });
      li.appendChild(b); sideList.appendChild(li);
      rows.push({ b: b, st: st });
    });
  }
  function markSide() {
    var nv = isVid(list[at]) ? nextVid(at) : -1;
    rows.forEach(function (r, i) {
      r.b.setAttribute("aria-current", i === at ? "true" : "false");
      r.st.textContent = i === at ? (isVid(list[i]) ? "Now playing" : "Now showing") : i === nv ? "Up next" : "";
    });
    if (rows[at]) rows[at].b.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  var ytWait = null;
  function ytApi(cb) {
    if (window.YT && window.YT.Player) return cb();
    if (!ytWait) {
      ytWait = [];
      var prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prevReady) prevReady(); ytWait.forEach(function (f) { f(); }); ytWait = []; };
      var s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
    }
    ytWait.push(cb);
  }
  function ended(token) { if (token !== mountToken || lb.hidden) return; var j = nextVid(at); if (j >= 0) { at = j; show(); } }
  function clear() {
    mountToken += 1;
    if (lbViewer && lbViewer.dispose) lbViewer.dispose();
    lbViewer = null;
    if (node && node.parentNode) node.parentNode.removeChild(node);
    node = null;
  }
  function show() {
    clear();
    var f = list[at], m = f.m, n, mountUrl = null, mountOpts = null, token = mountToken;
    lb.style.setProperty("--pa", f.accent || "var(--brand)");
    if (m.type === "model") {
      n = el("div", "lb-model"); mountUrl = src(f.slug, m.file); mountOpts = optsOf(m);
    } else if (m.type === "youtube") {
      n = document.createElement("iframe");
      n.src = "https://www.youtube-nocookie.com/embed/" + m.id + "?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
      n.id = "lb-yt-" + token; n.allow = "autoplay; encrypted-media; picture-in-picture";
      n.setAttribute("allowfullscreen", ""); n.title = m.caption || "Video";
      if (m.vertical) n.className = "vert";
    } else if (m.type === "video") {
      n = document.createElement("video"); n.src = src(f.slug, m.file);
      n.controls = true; n.autoplay = true; n.playsInline = true;
      if (m.poster) n.poster = src(f.slug, m.poster);
      n.addEventListener("ended", function () { ended(token); });
    } else { n = document.createElement("img"); n.src = urlOf(f); n.alt = m.caption || ""; if (m.bg) n.style.background = m.bg; }
    node = n; stage.appendChild(n);
    if (m.type === "youtube") ytApi(function () { if (token !== mountToken) return; new YT.Player(n, { events: { onStateChange: function (e) { if (e.data === 0) ended(token); } } }); });
    if (mountUrl) mount3D(n, mountUrl, mountOpts, function (h) { if (token !== mountToken) { if (h && h.dispose) h.dispose(); return; } lbViewer = h; });
    capN.textContent = m.caption || "";
    figN.textContent = kindOf(f);
    ctN.textContent = (at + 1) + " of " + list.length;
    prev.hidden = next.hidden = list.length < 2;
    markSide();
  }
  function openIn(slug, entry, noModel) {
    list = mediaList(slug, noModel);
    at = Math.max(0, list.indexOf(entry));
    back = document.activeElement;
    lb.classList.toggle("solo", list.length < 2);
    buildSide(slug);
    lb.hidden = false; document.body.style.overflow = "hidden"; show(); xBtn.focus();
  }
  function close() { clear(); lb.hidden = true; document.body.style.overflow = ""; if (back && back.focus) back.focus(); }
  function step(d) { at = (at + d + list.length) % list.length; show(); }
  xBtn.addEventListener("click", close);
  prev.addEventListener("click", function () { step(-1); });
  next.addEventListener("click", function () { step(1); });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target === stage) close(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {
      var f = [xBtn, prev, next].filter(function (b) { return !b.hidden; }).concat(lb.classList.contains("solo") ? [] : rows.map(function (r) { return r.b; }));
      var i = f.indexOf(document.activeElement); e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  var tx = 0, ty = 0;
  lb.addEventListener("touchstart", function (e) { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── live repo facts ── */
  if (typeof fetch === "function") {
    fetch("https://api.github.com/users/L13V/repos?per_page=100&sort=updated")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("x")); })
      .then(function (d) {
        d.forEach(function (r) {
          var line = repoLines[r.name]; if (!line) return;
          if (r.stargazers_count > 0) line.appendChild(el("span", null, "★ " + r.stargazers_count));
          var when = r.pushed_at || r.updated_at;
          if (when) line.appendChild(el("span", null, "pushed " + new Date(when).toLocaleDateString("en-US", { month: "short", year: "numeric" })));
        });
      })
      .catch(function () {});
  }

  Engine.measure();
})();
