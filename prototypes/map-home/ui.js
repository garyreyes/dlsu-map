// Prototype screens S1–S5 and the ⓘ sheet (docs/user-flows.md). No routing yet: S5 is the confirm step only.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { rooms, aliases, floorLabels } = window.ROOM_DATA;
  const Scene = window.MapScene;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: fine */ } },
  };

  const state = { view: "home", to: null, from: null, pending: null, recents: store.get("recents", []), palette: store.get("palette", "A") };
  let buildings = [];
  const byPrefix = {};

  // ---------- codes ----------
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  const floorLabel = (b, n) => (floorLabels[b.slug] && floorLabels[b.slug][n]) || `${n}F`;
  const floorWords = (b, n) => (floorLabel(b, n) === "G" ? "Ground floor (G)" : `${ord(n)} floor (${floorLabel(b, n)})`);

  function parseCode(raw) {
    const s = raw.toUpperCase().replace(/[\s-]+/g, "");
    const m = s.match(/^([A-Z]{1,2})(\d{3,4})([A-Z]?)(?:\/\d{1,4})?$/);
    if (!m) return null;
    const prefix = aliases[m[1]] || m[1];
    return { prefix, typed: m[1], num: +m[2], code: prefix + m[2] + m[3] };
  }

  function roomInfo(r) {
    const p = parseCode(r.code), b = byPrefix[p.prefix];
    return { ...r, building: b, floor: Math.floor(p.num / 100) };
  }

  function lev(a, b) {
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return d[b.length];
  }

  function suggest(code, prefix) {
    const pool = rooms.filter((r) => r.code.startsWith(prefix));
    return (pool.length ? pool : rooms).map((r) => ({ r, d: lev(code, r.code) })).sort((a, b) => a.d - b.d).slice(0, 3).map((x) => roomInfo(x.r));
  }

  function search(q) {
    const t = q.trim();
    if (!t) return { kind: "empty" };
    const up = t.toUpperCase().replace(/[\s-]+/g, "");
    const bMatches = buildings.filter((b) => b.t === "full" && (b.name.toUpperCase().includes(t.toUpperCase()) || b.prefix === up));
    const p = parseCode(t);
    if (p) {
      const room = rooms.find((r) => r.code === p.code);
      if (room) return { kind: "room", room: roomInfo(room), typed: p.typed, buildings: [] };
      const b = byPrefix[p.prefix];
      if (!b) return { kind: "noPrefix", prefix: p.typed };
      const floor = Math.floor(p.num / 100);
      const why = b.levels && floor > b.levels ? `${b.short} has no ${ord(floor)} floor.` : `${p.code} isn't in our list.`;
      return { kind: "reject", why, suggestions: suggest(p.code, p.prefix) };
    }
    const alias = aliases[up.replace(/\d.*$/, "")];
    const partial = rooms.filter((r) => r.code.startsWith(alias ? alias + up.slice(up.search(/\d|$/)) : up)).slice(0, 6).map(roomInfo);
    return { kind: "list", rooms: partial, buildings: bMatches };
  }

  // ---------- rendering helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ICON = {
    pin: '<svg class="i" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    clock: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bldg: '<svg class="i" viewBox="0 0 24 24"><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2"/></svg>',
    search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
    share: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
    close: '<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    tree: '<svg class="i" viewBox="0 0 24 24"><path d="M12 22v-6"/><path d="M12 2 5 12h4l-3 4h12l-3-4h4z"/></svg>',
    down: '<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    arrow: '<svg class="i arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
    wifi: '<svg class="i" viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5v.01"/></svg>',
    list: '<svg class="i" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    flag: '<svg class="i" viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    info: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5v.01"/></svg>',
  };
  const roomRow = (r, icon = "pin", act = "room") => `<button class="row" data-act="${act}" data-code="${r.code}">${ICON[icon]}
    <span class="row-text"><span class="row-title num">${r.code} · ${esc(r.name)}</span>
    <span class="row-sub">${esc(r.building.short)} · ${floorLabel(r.building, r.floor)}</span></span></button>`;
  const bRow = (b, act = "building") => `<button class="row" data-act="${act}" data-slug="${b.slug}">${ICON.bldg}
    <span class="row-text"><span class="row-title">${esc(b.name)}</span><span class="row-sub">${b.levels} floors</span></span>
    <span class="code-tag">${b.prefix}</span></button>`;

  // ---------- search screen (S2) ----------
  function renderResults() {
    const q = $("q").value, res = search(q), out = [];
    $("clearQ").hidden = !q;
    if (res.kind === "empty") {
      const recent = state.recents.map((c) => rooms.find((r) => r.code === c)).filter(Boolean).map(roomInfo);
      if (recent.length) out.push('<div class="h">Recent</div>', ...recent.map((r) => roomRow(r, "clock")));
      else out.push('<div class="h">Try</div>', ...["ST311", "AG1104"].map((c) => roomRow(roomInfo(rooms.find((r) => r.code === c)), "search")), bRow(byPrefix.AG));
    } else if (res.kind === "room") {
      out.push(roomRow(res.room));
      if (res.typed !== res.room.code.replace(/\d.*$/, "")) out.push(`<p class="note">Also written ${esc(res.typed)}${res.room.code.replace(/^[A-Z]+/, "")}.</p>`);
    } else if (res.kind === "reject") {
      out.push(`<p class="err">${esc(res.why)}</p>`, '<div class="h">Did you mean</div>', ...res.suggestions.map((r) => roomRow(r)));
    } else if (res.kind === "noPrefix") {
      out.push(`<p class="err">No building uses ${esc(res.prefix)}.</p>`, '<div class="h">Buildings and their codes</div>', ...buildings.filter((b) => b.t === "full").map((b) => bRow(b)));
    } else {
      out.push(...res.rooms.map((r) => roomRow(r)), ...res.buildings.map((b) => bRow(b)));
      if (!out.length) out.push(`<p class="note">No room or building matches “${esc(q)}”. Room codes look like ST311 or AG1104.</p>`);
    }
    $("results").innerHTML = out.join("");
  }

  function openSearch(prefill = "") {
    $("search").hidden = false; $("q").value = prefill; renderResults(); $("q").focus();
  }
  const closeSearch = () => { $("search").hidden = true; };

  // ---------- sheet views ----------
  const VIEWS = {
    home() {
      const recent = state.recents.map((c) => rooms.find((r) => r.code === c)).filter(Boolean).map(roomInfo).slice(0, 5);
      const hint = `<button class="hint" data-act="search">${ICON.search}<span>Type a room, like <b class="num">ST311</b></span></button>`;
      return recent.length ? hint + '<div class="h">Recent</div>' + recent.map((r) => roomRow(r, "clock")).join("") : hint;
    },
    room() {
      const r = state.to, b = r.building;
      return `<div class="block"><div class="card-head"><div class="card-titles">
          <div class="code num">${r.code}</div><div class="name">${esc(r.name)}</div>
          <div class="meta">${esc(b.short)} · <strong>${floorWords(b, r.floor)}</strong></div>
          ${r.code.startsWith("ST") ? `<div class="aside">Also written C${r.code.slice(2)}</div>` : ""}
          ${r.sample ? '<span class="sample">Sample room: not from a real directory</span>' : ""}
        </div>
        <button class="icon-btn" data-act="share" aria-label="Copy a link to ${r.code}">${ICON.share}</button>
        <button class="icon-btn" data-act="clear" aria-label="Close">${ICON.close}</button></div>${directionsBtn()}</div>` + whereSection();
    },
    building() {
      const b = state.to.building;
      if (b.t !== "full") {
        return `<div class="card-head"><div class="card-titles"><div class="name">${esc(b.name || "Campus building")}</div>
          <div class="meta">Not searchable yet. It has no room list in the app.</div></div>
          <button class="icon-btn" data-act="clear" aria-label="Close">${ICON.close}</button></div>`;
      }
      return `<div class="block"><div class="card-head"><div class="card-titles"><div class="code">${esc(b.short)}</div><div class="name">${esc(b.name)}</div>
        <div class="meta">${b.levels} floors · rooms start with <strong>${b.prefix}</strong></div></div>
        <button class="icon-btn" data-act="clear" aria-label="Close">${ICON.close}</button></div>${directionsBtn()}</div>` + whereSection();
    },
    preview() {
      const to = state.to, from = state.from;
      const toText = to.code ? to.code : to.building.short;
      return `<div class="h2">Your route</div><div class="trip">
          <button class="chip" data-act="editFrom"><small>From</small> ${esc(from.text)}</button>${ICON.arrow}
          <button class="chip" data-act="editTo"><small>To</small> <span class="num">${esc(toText)}</span></button></div>
        <button class="primary" data-act="start">Start</button>
        <details class="opts"><summary>Route options ${ICON.down}</summary>
          <div class="seg" role="group" aria-label="Stairs or elevator">${["Stairs", "Auto", "Elevator"].map((o) =>
            `<button data-act="mode" data-mode="${o}" aria-pressed="${(state.mode || "Auto") === o}">${o}</button>`).join("")}</div>
          <p class="note">Auto takes the elevator for 3 or more floors.</p></details>
        <p class="note">Prototype: routes and step-by-step directions come next.</p>`;
    },
    info() {
      const pal = Scene.PALETTES;
      return `<div class="card-head"><div class="card-titles"><div class="name">DLSU 3D Campus Navigator</div>
          <div class="meta">Prototype of the map home screen</div></div>
          <button class="icon-btn" data-act="closeInfo" aria-label="Close">${ICON.close}</button></div>
        <div class="h2">Map colours</div>
        <div class="seg" role="group" aria-label="Map colours">${Object.entries(pal).map(([k, p]) =>
          `<button data-act="palette" data-key="${k}" aria-pressed="${state.palette === k}"><span class="swatch" style="background:${p.ground}"></span>${p.label}</button>`).join("")}</div>
        <p class="note">The three options from decision D13. Compare them outdoors on your phone.</p>
        <div class="info-row">${ICON.wifi}<p><span class="row-title">Offline</span><br><span class="row-sub">Saving the map for offline use isn't in this prototype yet.</span></p></div>
        <div class="info-row">${ICON.list}<p><span class="row-title">Rooms</span><br><span class="row-sub">ST311, ST402, ST404 and ST406 come from the STRC lobby directory. Every other room is a sample.</span></p></div>
        <div class="info-row">${ICON.flag}<p><span class="row-title">Report a problem</span><br><span class="row-sub">Coming with the beta.</span></p></div>
        <div class="info-row">${ICON.info}<p><span class="row-title">Credits</span><br><span class="row-sub">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, snapshot 2026-10-19. Student project, not an official DLSU app.</span></p></div>`;
    },
  };

  // The card's one primary action. With the sheet collapsed it is the only way forward, so it lives in the first block.
  const directionsBtn = () => `<button class="primary" data-act="directions">Directions</button>`;

  function whereSection() {
    const pend = state.pending;
    let body;
    if (pend && pend.kind === "floors") {
      const b = pend.building;
      body = `<div class="h">${esc(b.name)}: which floor?</div><div class="chips">${Array.from({ length: b.levels }, (_, i) => i + 1).map((n) =>
        `<button class="chip num" data-act="floor" data-n="${n}">${floorLabel(b, n)}</button>`).join("")}</div>
        <button class="secondary" data-act="whereBack">Pick another building</button>`;
    } else if (pend && pend.kind === "outside") {
      body = `<div class="h">Next to a building</div>${buildings.filter((b) => b.t === "full").map((b) => bRow(b, "nextTo")).join("")}
        <button class="secondary" data-act="whereBack">Back</button>`;
    } else {
      body = `<label class="field">${ICON.search}<input id="fromCode" placeholder="I'm in room… like AG1104" autocomplete="off"
          autocapitalize="characters" spellcheck="false" enterkeyhint="done" aria-label="The room you're in"></label>
        <p class="err" id="fromErr" hidden></p>
        <div class="h">Or pick a building</div>${buildings.filter((b) => b.t === "full").map((b) => bRow(b, "fromBuilding")).join("")}
        <button class="row" data-act="outside">${ICON.tree}<span class="row-text"><span class="row-title">I'm outside</span>
        <span class="row-sub">Next to a building</span></span></button>`;
    }
    return `<div class="h2">Where are you?</div>${body}`;
  }

  function render(view = state.view) {
    state.view = view;
    $("sheetBody").innerHTML = VIEWS[view]();
    $("sheetBody").scrollTop = 0;
    const to = state.to;
    $("pillText").textContent = to ? (to.code || to.building.short || to.building.name || "Campus building") : "Where to?";
    $("pillText").classList.toggle("set", !!to);
    setSheet(view === "home" ? "peek" : view === "info" ? "full" : "half");
    const input = $("fromCode");
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") setFromCode(input.value); });
  }

  // ---------- actions ----------
  function chooseRoom(code) {
    const r = roomInfo(rooms.find((x) => x.code === code));
    state.to = r; state.pending = null;
    state.recents = [code, ...state.recents.filter((c) => c !== code)].slice(0, 5);
    store.set("recents", state.recents);
    closeSearch();
    render(state.from ? "preview" : "room"); // sheet first, so the camera frames the building above it
    Scene.select(r.building.slug, r.floor, floorLabel(r.building, r.floor));
  }

  function chooseBuilding(info) {
    closeSearch();
    state.to = { building: info }; state.pending = null;
    render(state.from && info.t === "full" ? "preview" : "building");
    Scene.select(info, null);
  }

  function setFrom(from) {
    state.from = from; state.pending = null;
    Scene.setHere(from.slug, from.floor);
    render("preview");
  }

  function setFromCode(raw) {
    const p = parseCode(raw), room = p && rooms.find((r) => r.code === p.code);
    if (!room) {
      const err = $("fromErr"); err.hidden = false;
      err.textContent = p ? `${p.code} isn't in our list. Try a building below.` : "Room codes look like AG1104 or ST311.";
      return;
    }
    const r = roomInfo(room);
    if (state.to && state.to.code === r.code) { toast(`You're already at ${r.code}.`); return; }
    setFrom({ text: r.code, slug: r.building.slug, floor: r.floor });
  }

  const ACTIONS = {
    search: () => openSearch(),
    room: (el) => chooseRoom(el.dataset.code),
    building: (el) => chooseBuilding(buildings.find((b) => b.slug === el.dataset.slug)),
    clear: () => { state.to = null; state.pending = null; Scene.select(null); render("home"); },
    share: () => copy(`${location.origin}${location.pathname}?to=${state.to.code}`, "Link copied"),
    directions: () => {
      setSheet("half");
      const where = $("sheetBody").querySelector(".h2"), input = $("fromCode");
      if (where) where.scrollIntoView({ block: "start" });
      if (input) input.focus({ preventScroll: true });
    },
    // Show the picked building on the map while its floors are offered, so nothing has to be remembered.
    fromBuilding: (el) => { const b = buildings.find((x) => x.slug === el.dataset.slug);
      state.pending = { kind: "floors", building: b }; render(); Scene.setHere(b.slug); },
    floor: (el) => { const b = state.pending.building, n = +el.dataset.n;
      setFrom({ text: `${b.short} ${floorLabel(b, n)}`, slug: b.slug, floor: n }); },
    outside: () => { state.pending = { kind: "outside" }; render(); },
    nextTo: (el) => { const b = buildings.find((x) => x.slug === el.dataset.slug); setFrom({ text: `Outside ${b.short}`, slug: b.slug }); },
    whereBack: () => { state.pending = null; Scene.setHere(null); render(); },
    editFrom: () => { state.from = null; Scene.setHere(null); render(state.to.code ? "room" : "building"); },
    editTo: () => openSearch(),
    start: () => toast("Step-by-step directions aren't in this prototype yet."),
    mode: (el) => { state.mode = el.dataset.mode; render(); $("sheetBody").querySelector("details").open = true; },
    palette: (el) => { state.palette = el.dataset.key; store.set("palette", state.palette); applyPalette(); render("info"); },
    closeInfo: () => render(state.to ? (state.from ? "preview" : state.to.code ? "room" : "building") : "home"),
  };

  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
  }

  // ---------- small UI pieces ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function copy(text, done) {
    const ok = () => toast(done), fail = () => toast(`Copy this link: ${text}`);
    try { navigator.clipboard.writeText(text).then(ok, fail); } catch { fail(); }
  }

  // The interface green is fixed in the CSS tokens; a palette only changes the map.
  const applyPalette = () => Scene.setPalette(state.palette);

  // Sheet snaps: "peek" shows only the first block, "half" keeps the map visible above it, "full" is for reading.
  const SNAPS = ["peek", "half", "full"];
  const wide = () => window.matchMedia("(min-width: 768px)").matches;
  let sheetMode = "peek";

  function setSheet(mode) {
    sheetMode = mode;
    const sheet = $("sheet"), body = $("sheetBody");
    sheet.dataset.snap = mode;
    const first = body.firstElementChild ? body.firstElementChild.offsetHeight + 48 : 88;
    const hide = mode === "peek" && state.view !== "home" ? Math.max(0, sheet.offsetHeight - first) : 0;
    sheet.style.transform = `translateY(${hide}px)`;
    const pill = document.querySelector(".top").getBoundingClientRect(), visible = sheet.offsetHeight - hide;
    document.documentElement.style.setProperty("--sheet-visible", `${visible}px`);
    // Phones: the map is what's left between the pill and the sheet. Wide screens: what's right of the panel.
    if (wide()) Scene.setInsets(16, 0, sheet.getBoundingClientRect().right + 8);
    else Scene.setInsets(pill.bottom + 8, visible);
  }

  function setupSheetDrag() {
    const sheet = $("sheet"), handle = $("handle");
    let start = null;
    const step = (dir) => setSheet(SNAPS[Math.min(2, Math.max(0, SNAPS.indexOf(sheetMode) + dir))]);
    handle.addEventListener("pointerdown", (e) => { start = { y: e.clientY }; sheet.classList.add("dragging"); handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointermove", (e) => { if (start && e.clientY > start.y) sheet.style.transform = `translateY(${e.clientY - start.y}px)`; });
    handle.addEventListener("pointerup", (e) => {
      if (!start) return;
      sheet.classList.remove("dragging");
      const dy = e.clientY - start.y;
      if (Math.abs(dy) < 6) setSheet(sheetMode === "peek" ? "half" : "peek");
      else step(dy > 0 ? -1 : 1);
      start = null;
    });
    handle.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheet(sheetMode === "peek" ? "half" : "peek"); } });
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const data = await (await fetch("campus.json")).json();
      Scene.init($("map"), $("labels"), data, state.palette);
    } catch (err) {
      $("loading").textContent = "The map couldn't load. Reload the page to try again.";
      return;
    }
    $("loading").remove();
    buildings = Scene.buildings();
    for (const b of buildings) if (b.prefix) byPrefix[b.prefix] = b;
    applyPalette();
    Scene.onPick((info) => { if (info) chooseBuilding(info); });
    document.addEventListener("click", onClick);
    $("openSearch").addEventListener("click", () => openSearch());
    $("closeSearch").addEventListener("click", closeSearch);
    $("clearQ").addEventListener("click", () => { $("q").value = ""; renderResults(); $("q").focus(); });
    $("q").addEventListener("input", renderResults);
    $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const first = $("results").querySelector("[data-act]"); if (first) first.click(); } });
    $("openInfo").addEventListener("click", () => render("info"));
    $("recenter").addEventListener("click", () => Scene.flyHome());
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("search").hidden) closeSearch(); });
    setupSheetDrag();
    render("home");
    Scene.flyHome(0); // frame the campus in the space the sheet leaves, from the first frame
  }
  boot();
})();
