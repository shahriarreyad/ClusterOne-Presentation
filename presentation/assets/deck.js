/* ClusterOne audit deck: navigation, scaling, TOC, fullscreen, lightbox, notes, interactive diagrams. No dependencies. */
(function () {
  "use strict";
  const slides = Array.from(document.querySelectorAll(".slide"));
  const deck = document.getElementById("deck");
  const counter = document.getElementById("counter");
  const progress = document.getElementById("progress");
  const titleNow = document.getElementById("title-now");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const notesBox = document.getElementById("notes");
  let cur = 0;

  const titleOf = (s) => s.dataset.title || (s.querySelector("h1,h2") || {}).textContent || "";

  /* ---------- scale the 1280×720 stage to the window ---------- */
  function fit() {
    if (window.matchMedia("(max-width: 760px)").matches) { deck.style.transform = ""; return; }
    const vp = document.getElementById("viewport");
    const s = Math.min(vp.clientWidth / 1300, vp.clientHeight / 736);
    deck.style.transform = "scale(" + s + ")";
  }
  window.addEventListener("resize", fit);

  /* ---------- navigation ---------- */
  function go(i, fromHash) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => {
      s.classList.toggle("active", k === i);
      s.classList.toggle("before", k < i);
      s.setAttribute("aria-hidden", k === i ? "false" : "true");
    });
    cur = i;
    counter.textContent = (i + 1) + " / " + slides.length;
    progress.style.width = ((i + 1) / slides.length * 100) + "%";
    titleNow.textContent = titleOf(slides[i]);
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;
    document.querySelectorAll("#toc button").forEach((b, k) => b.classList.toggle("cur", k === i));
    if (!fromHash) history.replaceState(null, "", "#" + (i + 1));
    renderNotes();
    slides[i].querySelectorAll(".diagram[data-diagram]").forEach((el) => el._render && el._render());
    if (window.matchMedia("(max-width: 760px)").matches) window.scrollTo(0, 0);
  }
  const next = () => go(cur + 1);
  const prev = () => go(cur - 1);
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  window.addEventListener("hashchange", () => go(parseInt(location.hash.slice(1), 10) - 1 || 0, true));

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    const open = document.querySelector(".overlay.open");
    if (e.key === "Escape") { if (open) closeOverlay(open); else notesBox.classList.remove("open"); return; }
    if (open) return;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case "PageDown": case " ": e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": e.preventDefault(); prev(); break;
      case "Home": go(0); break;
      case "End": go(slides.length - 1); break;
      case "f": case "F": toggleFullscreen(); break;
      case "t": case "T": openOverlay(document.getElementById("toc")); break;
      case "n": case "N": toggleNotes(); break;
    }
  });

  /* touch swipe */
  let tx = null;
  deck.addEventListener("touchstart", (e) => { if (!e.target.closest(".diagram")) tx = e.touches[0].clientX; }, { passive: true });
  deck.addEventListener("touchend", (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  });

  /* ---------- table of contents ---------- */
  const tocList = document.querySelector("#toc ol");
  slides.forEach((s, k) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = "<span>" + (k + 1) + "</span>" + titleOf(s);
    b.addEventListener("click", () => { closeOverlay(document.getElementById("toc")); go(k); });
    li.appendChild(b); tocList.appendChild(li);
  });
  document.getElementById("toc-btn").addEventListener("click", () => openOverlay(document.getElementById("toc")));

  /* ---------- overlays ---------- */
  let lastFocus = null;
  function openOverlay(el) { lastFocus = document.activeElement; el.classList.add("open"); (el.querySelector(".cur") || el.querySelector("button")).focus(); }
  function closeOverlay(el) { el.classList.remove("open"); if (lastFocus) lastFocus.focus(); }
  document.querySelectorAll(".overlay").forEach((o) => {
    o.addEventListener("click", (e) => { if (e.target === o || e.target.closest(".close")) closeOverlay(o); });
  });

  /* ---------- fullscreen ---------- */
  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement) { (d.documentElement.requestFullscreen || function () {}).call(d.documentElement); }
    else { d.exitFullscreen(); }
  }
  document.getElementById("fs-btn").addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => setTimeout(fit, 60));

  /* ---------- speaker notes ---------- */
  function renderNotes() {
    const n = slides[cur].querySelector("aside.notes");
    notesBox.innerHTML = "<h4>Speaker notes · slide " + (cur + 1) + "</h4>" + (n ? n.innerHTML : "<p>No notes for this slide.</p>");
  }
  function toggleNotes() { notesBox.classList.toggle("open"); }
  document.getElementById("notes-btn").addEventListener("click", toggleNotes);

  /* ---------- print ---------- */
  document.getElementById("print-btn").addEventListener("click", () => window.print());

  /* ---------- screenshots: callout pins + lightbox ---------- */
  const lb = document.getElementById("lightbox");
  document.querySelectorAll(".shot").forEach((shot) => {
    const img = shot.querySelector("img");
    (shot.dataset.pins || "").split(";").filter(Boolean).forEach((p, k) => {
      const [x, y] = p.split(",");
      const pin = document.createElement("span");
      pin.className = "pin"; pin.textContent = k + 1;
      pin.style.left = x + "%"; pin.style.top = y + "%";
      shot.appendChild(pin);
    });
    const hint = document.createElement("span"); hint.className = "zoom-hint"; hint.textContent = "Click to enlarge";
    shot.appendChild(hint);
    shot.tabIndex = 0; shot.setAttribute("role", "button"); shot.setAttribute("aria-label", "Enlarge: " + img.alt);
    const open = () => {
      lb.querySelector("img").src = img.src; lb.querySelector("img").alt = img.alt;
      lb.querySelector("figcaption").textContent = img.alt;
      openOverlay(lb);
    };
    shot.addEventListener("click", open);
    shot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); open(); } });
    /* link legend items to pins */
    const list = document.querySelector('ol.callouts[data-for="' + shot.id + '"]');
    if (list) list.querySelectorAll("li").forEach((li, k) => {
      const pin = shot.querySelectorAll(".pin")[k];
      if (!pin) return;
      li.addEventListener("mouseenter", () => { pin.classList.add("hot"); li.classList.add("hot"); });
      li.addEventListener("mouseleave", () => { pin.classList.remove("hot"); li.classList.remove("hot"); });
    });
  });

  /* ---------- interactive diagrams ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const STYLE = window.C1_STYLE || {};
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  function clip(n, bx, by) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = bx - cx, dy = by - cy;
    if (!dx && !dy) return [cx, cy];
    const t = Math.min(dx ? (n.w / 2) / Math.abs(dx) : 1e9, dy ? (n.h / 2) / Math.abs(dy) : 1e9);
    return [cx + dx * t, cy + dy * t];
  }
  const storeKey = (id) => "c1deck-layout-" + id;
  const loadPos = (id) => { try { return JSON.parse(localStorage.getItem(storeKey(id)) || "null"); } catch (e) { return null; } };
  const savePos = (id, pos) => { try { localStorage.setItem(storeKey(id), JSON.stringify(pos)); } catch (e) { /* storage unavailable */ } };
  const clearPos = (id) => { try { localStorage.removeItem(storeKey(id)); } catch (e) { /* storage unavailable */ } };

  document.querySelectorAll(".diagram[data-diagram]").forEach((host) => {
    const spec = (window.C1_DIAGRAMS || {})[host.dataset.diagram];
    if (!spec) { host.textContent = "Diagram data missing."; return; }
    const panel = document.getElementById(host.dataset.panel);
    const home = {}; spec.nodes.forEach((n) => (home[n.id] = { x: n.x, y: n.y }));
    const saved = loadPos(spec.id);
    if (saved) spec.nodes.forEach((n) => { if (saved[n.id]) { n.x = saved[n.id].x; n.y = saved[n.id].y; } });
    const byId = {}; spec.nodes.forEach((n) => (byId[n.id] = n));

    const svg = el("svg", { viewBox: "0 0 " + spec.w + " " + (spec.h + 50), role: "img", "aria-label": spec.title });
    const defs = el("defs", {}, svg);
    const mk = el("marker", { id: "arr-" + spec.id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "#6b7390" }, mk);
    const gGroups = el("g", {}, svg), gEdges = el("g", {}, svg), gNodes = el("g", {}, svg), gLegend = el("g", {}, svg);

    spec.groups.forEach((g) => {
      el("rect", { x: g.x, y: g.y, width: g.w, height: g.h, rx: 14, fill: "#eef2fb", stroke: "#d5dcec" }, gGroups);
      const t = el("text", { x: g.x + 14, y: g.y + 18, "font-size": 12, fill: "#5a6485", "letter-spacing": 1 }, gGroups);
      t.textContent = g.label.toUpperCase();
    });

    const edgeEls = spec.edges.map((e) => {
      const lv = e[3] || "";
      const line = el("line", { stroke: "#6b7390", "stroke-width": 1.5, "marker-end": "url(#arr-" + spec.id + ")" }, gEdges);
      if (lv && STYLE[lv]) line.setAttribute("stroke-dasharray", STYLE[lv].dash);
      let label = null;
      if (e[2]) {
        label = el("text", { "font-size": 11, fill: "#3a4466", "text-anchor": "middle", "paint-order": "stroke", stroke: "#f7f9fd", "stroke-width": 4 }, gEdges);
        label.textContent = e[2];
      }
      return { e, line, label };
    });
    function drawEdges() {
      edgeEls.forEach(({ e, line, label }) => {
        const a = byId[e[0]], b = byId[e[1]];
        const [x1, y1] = clip(a, b.x + b.w / 2, b.y + b.h / 2);
        const [x2, y2] = clip(b, a.x + a.w / 2, a.y + a.h / 2);
        line.setAttribute("x1", x1); line.setAttribute("y1", y1); line.setAttribute("x2", x2); line.setAttribute("y2", y2);
        if (label) { label.setAttribute("x", (x1 + x2) / 2); label.setAttribute("y", (y1 + y2) / 2 - 5); }
      });
    }

    let selected = null;
    function select(n, g) {
      gNodes.querySelectorAll(".dnode").forEach((x) => x.classList.remove("sel"));
      g.classList.add("sel"); selected = n.id;
      if (!panel) return;
      const s = STYLE[n.lv] || {};
      const chipClass = { C: "ok", ins: "ok", I: "inf", T: "part", U: "no", lnk: "no", res: "res", step: "rec", alt: "inf", hub: "rec" }[n.lv] || "no";
      panel.innerHTML = "";
      const h = document.createElement("h3"); h.textContent = n.label; panel.appendChild(h);
      if (s.name) { const c = document.createElement("span"); c.className = "chip " + chipClass; c.textContent = s.name; panel.appendChild(c); }
      const p = document.createElement("p"); p.textContent = n.info; panel.appendChild(p);
    }

    spec.nodes.forEach((n) => {
      const s = STYLE[n.lv] || STYLE.C;
      const g = el("g", { class: "dnode", tabindex: 0, role: "button", "aria-label": n.label + ": " + n.sub }, gNodes);
      const r = el("rect", { width: n.w, height: n.h, rx: 10, fill: s.fill, stroke: s.stroke, "stroke-width": 1.8 }, g);
      if (s.dash) r.setAttribute("stroke-dasharray", s.dash);
      const t1 = el("text", { x: n.w / 2, y: n.h / 2 - 3, "font-size": 15, "font-weight": 600, fill: "#151b30", "text-anchor": "middle" }, g);
      t1.textContent = n.label;
      const t2 = el("text", { x: n.w / 2, y: n.h / 2 + 15, "font-size": 11.5, fill: "#4d5778", "text-anchor": "middle" }, g);
      t2.textContent = n.sub;
      const place = () => g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
      place(); n._place = place;

      /* drag with pointer events; a press without movement counts as a click */
      let start = null;
      g.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        const pt = toSvg(ev);
        start = { px: pt.x, py: pt.y, nx: n.x, ny: n.y, moved: false };
        g.setPointerCapture(ev.pointerId);
        g.classList.add("dragging");
      });
      g.addEventListener("pointermove", (ev) => {
        if (!start) return;
        const pt = toSvg(ev);
        const dx = pt.x - start.px, dy = pt.y - start.py;
        if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
        if (!start.moved) return;
        n.x = Math.max(0, Math.min(spec.w - n.w, start.nx + dx));
        n.y = Math.max(0, Math.min(spec.h + 50 - n.h, start.ny + dy));
        place(); drawEdges();
      });
      const end = () => {
        if (!start) return;
        g.classList.remove("dragging");
        if (start.moved) persist(); else select(n, g);
        start = null;
      };
      g.addEventListener("pointerup", end);
      g.addEventListener("pointercancel", end);
      g.addEventListener("keydown", (ev) => {
        const step = ev.shiftKey ? 20 : 6;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); select(n, g); }
        else if (moves[ev.key] && ev.altKey) { ev.preventDefault(); ev.stopPropagation(); n.x += moves[ev.key][0]; n.y += moves[ev.key][1]; place(); drawEdges(); persist(); }
        else if (moves[ev.key] || ev.key === "PageUp" || ev.key === "PageDown") { ev.stopPropagation(); }
      });
    });

    /* legend */
    let lx = 20;
    spec.legend.forEach((k) => {
      const s = STYLE[k];
      const r = el("rect", { x: lx, y: spec.h + 16, width: 26, height: 16, rx: 4, fill: s.fill, stroke: s.stroke, "stroke-width": 1.8 }, gLegend);
      if (s.dash) r.setAttribute("stroke-dasharray", s.dash);
      const t = el("text", { x: lx + 34, y: spec.h + 29, "font-size": 12.5, fill: "#3a4466" }, gLegend);
      t.textContent = s.name;
      lx += 46 + s.name.length * 7.2;
    });

    function toSvg(ev) {
      const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    function persist() {
      const pos = {}; spec.nodes.forEach((n) => (pos[n.id] = { x: n.x, y: n.y }));
      savePos(spec.id, pos);
    }

    host.appendChild(svg);
    drawEdges();
    host._render = drawEdges;

    /* tools: reset + open static SVG */
    const tools = document.createElement("div"); tools.className = "dtools";
    const reset = document.createElement("button"); reset.className = "btn"; reset.type = "button"; reset.textContent = "Reset layout";
    reset.addEventListener("click", () => {
      spec.nodes.forEach((n) => { n.x = home[n.id].x; n.y = home[n.id].y; n._place(); });
      drawEdges(); clearPos(spec.id);
    });
    tools.appendChild(reset);
    if (host.dataset.svg) {
      const a = document.createElement("a"); a.className = "btn"; a.href = host.dataset.svg; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Open SVG";
      tools.appendChild(a);
    }
    host.appendChild(tools);
  });

  /* ---------- start ---------- */
  fit();
  go((parseInt(location.hash.slice(1), 10) || 1) - 1, true);
})();
