/*!
 * VSL Player · Stefanía Blue Coach
 * Reproductor propio (sin dependencias) para páginas de Systeme.io.
 *
 * USO (bloque HTML de Systeme.io):
 *   <div data-vsl data-src="https://TU-USUARIO.github.io/vsl/clase.mp4"
 *        data-poster="https://TU-USUARIO.github.io/vsl/poster.jpg"
 *        data-reveal-at="150" data-key="guia-seguro"></div>
 *   <script src="https://TU-USUARIO.github.io/vsl/vsl-player.js"></script>
 *
 * Todo lo que lleve la clase  vsl-hide  se oculta y se muestra al segundo
 * data-reveal-at (tiempo REAL de reproducción, no tiempo de página).
 *
 * Opciones (data-*):  src, poster, reveal-at (s, 150), key, curve (3),
 *                     duration (solo pruebas)
 * Modo prueba:  agrega  ?qa=1  a la URL → muestra todo y permite saltar.
 */
(function () {
  "use strict";

  var COLORS = {
    ivory: "#FAF7F2", navy: "#1F3A5F", gold: "#C9A96E",
    sky: "#A7C7E7", rose: "#E8C4C0"
  };

  var CSS = [
    ".vsl-hide{display:none!important}",
    ".vsl-wrap{max-width:860px;margin:0 auto;font-family:Montserrat,'Nunito Sans',Arial,sans-serif;color:" + COLORS.navy + "}",
    ".vsl-frame{position:relative;aspect-ratio:16/9;background:" + COLORS.navy + ";border:1px solid " + COLORS.gold + ";border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(31,58,95,.18)}",
    ".vsl-frame video{width:100%;height:100%;display:block;object-fit:cover;pointer-events:none;background:" + COLORS.navy + "}",
    ".vsl-shield{position:absolute;inset:0;z-index:2}",
    ".vsl-overlay{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(31,58,95,.55);text-align:center;padding:18px}",
    ".vsl-overlay.vsl-soft{background:transparent;justify-content:flex-start;align-items:flex-start;padding:14px;pointer-events:none}",
    ".vsl-btn{cursor:pointer;border:1px solid " + COLORS.gold + ";background:" + COLORS.ivory + ";color:" + COLORS.navy + ";font:600 15px/1.2 inherit;font-family:inherit;padding:13px 22px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:auto}",
    ".vsl-btn:hover{background:#fff}",
    ".vsl-btn.vsl-ghost{background:transparent;color:" + COLORS.ivory + ";border-color:" + COLORS.ivory + "}",
    ".vsl-title{color:" + COLORS.ivory + ";font-weight:700;font-size:clamp(16px,3.4vw,22px)}",
    ".vsl-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}",
    ".vsl-bar{height:8px;margin-top:12px;border-radius:999px;background:rgba(167,199,231,.45);overflow:hidden}",
    ".vsl-fill{height:100%;width:0;background:" + COLORS.gold + ";border-radius:999px}",
    ".vsl-note{text-align:center;font-size:13px;margin-top:10px;opacity:.8}",
    ".vsl-qa{margin-top:8px;font-size:12px;text-align:center}",
    ".vsl-qa button{margin:0 4px;padding:4px 10px;border-radius:6px;border:1px solid " + COLORS.navy + ";background:" + COLORS.ivory + ";cursor:pointer}"
  ].join("\n");

  function injectCss() {
    if (document.getElementById("vsl-css")) return;
    var s = document.createElement("style");
    s.id = "vsl-css";
    s.appendChild(document.createTextNode(CSS));
    document.head.appendChild(s);
  }

  // Los .vsl-hide deben ocultarse lo antes posible (antes de que el JS cargue).
  injectCss();

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function mmss(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  function track(name, data) {
    try {
      var payload = { event: "vsl_" + name };
      for (var k in data) payload[k] = data[k];
      (window.dataLayer = window.dataLayer || []).push(payload);
      window.dispatchEvent(new CustomEvent("vsl:event", { detail: payload }));
    } catch (e) {}
  }
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function init(root, opts) {
    opts = opts || {};
    var qa = /[?&]qa=1\b/.test(location.search);
    var storageKey = "vsl:" + (opts.key || "default");
    var revealAt = Number(opts.revealAt) || 150;
    var curve = Number(opts.curve) || 3;
    var loop = String(opts.loop) === "1";       // data-loop="1": al terminar, vuelve a empezar
    var pausable = String(opts.pausable) === "1"; // data-pausable="1": la persona puede pausar/continuar tocando el video
    var state = store.get(storageKey); // {t, revealed, done}

    root.textContent = "";
    var wrap = el("div", "vsl-wrap");
    var frame = el("div", "vsl-frame");
    var video = document.createElement("video");
    video.src = opts.src;
    if (opts.poster) video.poster = opts.poster;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback");
    video.setAttribute("x-webkit-airplay", "deny");
    video.disablePictureInPicture = true;
    video.controls = false;
    var shield = el("div", "vsl-shield"); // bloquea clic derecho, doble clic, arrastres
    ["contextmenu", "dblclick", "dragstart"].forEach(function (ev) {
      shield.addEventListener(ev, function (e) { e.preventDefault(); });
    });
    frame.appendChild(video);
    frame.appendChild(shield);

    var bar = el("div", "vsl-bar");
    var fill = el("div", "vsl-fill");
    bar.appendChild(fill);
    var note = el("div", "vsl-note", "Sube el volumen para escucharlo bien.");
    wrap.appendChild(frame);
    if (String(opts.bar) !== "0") wrap.appendChild(bar);
    if (String(opts.note) !== "0") wrap.appendChild(note);
    root.appendChild(wrap);

    // ---- estado del reproductor ----
    var maxT = 0, lastT = 0, internal = false, revealed = false, started = false;
    var milestones = { 25: false, 50: false, 75: false };
    var lastSave = 0;

    function duration() { return Number(opts.duration) || video.duration || 0; }

    function setTime(t) {
      internal = true;
      try { video.currentTime = t; } catch (e) {}
      maxT = Math.max(maxT, t);
      lastT = t;
      setTimeout(function () { internal = false; }, 250);
    }

    function reveal(why) {
      if (revealed) return;
      revealed = true;
      var nodes = document.querySelectorAll(".vsl-hide");
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove("vsl-hide");
      var s = store.get(storageKey); s.revealed = true; store.set(storageKey, s);
      track("reveal", { why: why || "time", at: Math.round(video.currentTime || 0) });
      window.dispatchEvent(new CustomEvent("vsl:reveal"));
    }

    function save(force) {
      var now = Date.now();
      if (!force && now - lastSave < 1000) return;
      lastSave = now;
      var s = store.get(storageKey);
      s.t = Math.floor(maxT);
      store.set(storageKey, s);
    }

    // ---- barra falsa: sube rápido al inicio y se frena; llega a 100% al final real ----
    function fakeProgress(p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      return 1 - Math.pow(1 - p, curve);
    }
    function frameLoop() {
      var d = duration();
      if (d > 0) fill.style.width = (fakeProgress(video.currentTime / d) * 100).toFixed(2) + "%";
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);

    // ---- bloqueo de saltos ----
    video.addEventListener("seeking", function () {
      if (qa || internal) return;
      if (Math.abs(video.currentTime - lastT) > 0.75) setTime(lastT);
    });
    video.addEventListener("timeupdate", function () {
      var t = video.currentTime, d = duration();
      if (!internal && !video.seeking) {
        lastT = t;
        if (t > maxT) maxT = t;
      }
      if (!revealed && (t >= revealAt || state.revealed)) reveal("time");
      if (d > 0) {
        var pct = (t / d) * 100;
        [25, 50, 75].forEach(function (m) {
          if (!milestones[m] && pct >= m) { milestones[m] = true; track("progress_" + m, {}); }
        });
      }
      save(false);
    });
    video.addEventListener("ended", function () {
      var s = store.get(storageKey); s.t = 0; s.done = true; s.revealed = true; store.set(storageKey, s);
      track("progress_100", {});
      reveal("ended");
      if (loop) { // bucle: vuelve al inicio y sigue sonando
        maxT = 0; lastT = 0;
        setTime(0);
        track("loop", {});
        var p = video.play(); if (p && p.catch) p.catch(function () {});
      }
    });
    video.addEventListener("pause", function () {
      // Sin pausa: si no ha terminado y la pestaña está visible, se reanuda.
      if (!pausable && !video.ended && document.visibilityState === "visible" && started && !qa) {
        var p = video.play(); if (p && p.catch) p.catch(function () {});
      }
    });
    if (pausable) {
      var pauseOv = null;
      var lastToggle = 0;
      // Un solo punto de control para reproducir/pausar (evita dobles disparos)
      function toggle(e) {
        if (e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }
        var now = Date.now();
        if (now - lastToggle < 350) return; // ignora el segundo evento de un mismo toque
        lastToggle = now;
        if (!started) return;
        if (video.paused) {
          var p = video.play(); if (p && p.catch) p.catch(function () {});
        } else {
          video.pause();
        }
      }
      function showPaused() {
        if (pauseOv || video.ended || !started) return;
        pauseOv = el("div", "vsl-overlay vsl-soft vsl-paused");
        pauseOv.style.justifyContent = "center"; pauseOv.style.alignItems = "center";
        var btn = el("button", "vsl-btn", "▶ Toca para continuar");
        btn.type = "button";
        btn.style.touchAction = "manipulation";
        btn.addEventListener("click", toggle); // el botón sí ejecuta la acción sobre el video real
        pauseOv.appendChild(btn);
        frame.appendChild(pauseOv);
        track("pause", { at: Math.round(video.currentTime) });
      }
      function hidePaused() {
        if (pauseOv) { removeOverlay(pauseOv); pauseOv = null; }
      }
      shield.style.cursor = "pointer";
      shield.style.touchAction = "manipulation";
      shield.addEventListener("click", toggle);
      video.addEventListener("pause", showPaused);
      video.addEventListener("play", hidePaused);
      video.addEventListener("playing", hidePaused);
    }
    document.addEventListener("visibilitychange", function () { save(true); });
    window.addEventListener("pagehide", function () { save(true); });

    // ---- botones y pantallas ----
    function removeOverlay(o) { if (o && o.parentNode) o.parentNode.removeChild(o); }

    function showSoundButton() {
      var o = el("div", "vsl-overlay vsl-soft");
      var b = el("button", "vsl-btn", "🔊 Toca para activar el sonido");
      b.type = "button";
      b.addEventListener("click", function () {
        video.muted = false;
        if (video.currentTime < 10) setTime(0);
        track("unmute", {});
        removeOverlay(o);
      });
      o.appendChild(b);
      frame.appendChild(o);
    }

    function startMuted() {
      started = true;
      video.muted = true;
      var p = video.play();
      track("start", {});
      if (p && p.catch) p.catch(function () { showPlayButton(); });
      showSoundButton();
    }

    function showPlayButton() {
      var o = el("div", "vsl-overlay");
      o.appendChild(el("div", "vsl-title", "Tu video está listo"));
      var b = el("button", "vsl-btn", "▶ Ver ahora");
      b.type = "button";
      b.addEventListener("click", function () {
        started = true; video.muted = false; video.play(); removeOverlay(o); track("start", {});
        var soft = frame.querySelector(".vsl-soft"); removeOverlay(soft);
      });
      o.appendChild(b);
      frame.appendChild(o);
    }

    function showResume(t) {
      var o = el("div", "vsl-overlay");
      o.appendChild(el("div", "vsl-title", "¿Seguimos donde lo dejaste?"));
      var row = el("div", "vsl-row");
      var go = el("button", "vsl-btn", "Continuar en " + mmss(t));
      var again = el("button", "vsl-btn vsl-ghost", "Empezar de nuevo");
      go.type = again.type = "button";
      go.addEventListener("click", function () {
        removeOverlay(o); started = true; video.muted = false;
        setTime(t); video.play(); track("resume", { at: t });
      });
      again.addEventListener("click", function () {
        removeOverlay(o); started = true; video.muted = false;
        maxT = 0; setTime(0); video.play(); track("restart", {});
      });
      row.appendChild(go); row.appendChild(again);
      o.appendChild(row);
      frame.appendChild(o);
    }

    video.addEventListener("loadedmetadata", function () {
      var d = duration();
      var t = Number(state.t) || 0;
      if (state.revealed) reveal("returning");
      if (qa) { reveal("qa"); }
      if (t > 5 && d && t < d - 10 && !state.done) showResume(t);
      else startMuted();
    });

    // ---- modo prueba ----
    if (qa) {
      var q = el("div", "vsl-qa");
      var b1 = el("button", null, "+30 s"); var b2 = el("button", null, "Revelar venta"); var b3 = el("button", null, "Borrar memoria");
      b1.type = b2.type = b3.type = "button";
      b1.onclick = function () { setTime(video.currentTime + 30); };
      b2.onclick = function () { reveal("qa"); };
      b3.onclick = function () { try { localStorage.removeItem(storageKey); } catch (e) {} location.reload(); };
      q.appendChild(el("span", null, "MODO PRUEBA: ")); q.appendChild(b1); q.appendChild(b2); q.appendChild(b3);
      wrap.appendChild(q);
    }

    return { video: video, reveal: reveal };
  }

  function auto() {
    var nodes = document.querySelectorAll("[data-vsl]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.getAttribute("data-vsl-ready")) continue;
      n.setAttribute("data-vsl-ready", "1");
      init(n, {
        src: n.getAttribute("data-src"),
        poster: n.getAttribute("data-poster"),
        revealAt: n.getAttribute("data-reveal-at"),
        key: n.getAttribute("data-key"),
        curve: n.getAttribute("data-curve"),
        loop: n.getAttribute("data-loop"),
        pausable: n.getAttribute("data-pausable"),
        bar: n.getAttribute("data-bar"),
        note: n.getAttribute("data-note"),
        duration: n.getAttribute("data-duration")
      });
    }
  }

  window.VSLPlayer = { init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
})();
