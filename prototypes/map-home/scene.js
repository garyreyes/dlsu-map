// Prototype 3D campus: D13 "massing model" from the OSM snapshot in campus.json.
window.MapScene = (() => {
  "use strict";
  const T = window.THREE;

  // D13's three palette options. One green (the interface green, owner's choice) marks the selected building, its
  // floor band and "you are here" in every palette; the band sits on pale walls, so it reads even on the green ground.
  // `cityMix` is how far the off-campus city leans toward the ground colour, so the campus stays the brightest mass.
  const ACCENT = "#00703c";
  const PALETTES = {
    // Grounds are drawn unlit, so each swatch in the ⓘ sheet is exactly the colour on the map.
    A: { label: "Orange", ground: "#cf6530", building: "#e8edf3", path: "#f3d9c4", road: "#f7e6d8", cityMix: 0.32 },
    B: { label: "Green", ground: "#175f3c", building: "#f2eee5", path: "#5f9c7c", road: "#7fb396", cityMix: 0.5 },
    C: { label: "Grey", ground: "#c4c7c6", building: "#fbfbfa", path: "#ffffff", road: "#ffffff", cityMix: 0.32 },
  };
  const AO_HEIGHT = 6; // metres of soft darkening where walls meet the ground
  const TALL_CITY = 45; // off-campus towers above this height are drawn see-through so the campus leads
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FOV = 40, TILT = 0.9; // radians from straight down
  let renderer, scene, camera, controls, container, labelsEl, mapData;
  let palette = PALETTES.A;
  const insets = { top: 72, bottom: 0, left: 0 }; // screen space covered by the search pill, sheet or desktop panel
  const mats = {};
  const picks = []; // { mesh, info }
  let selected = null, ring = null, ringLabel = null, here = null, homeView = null, flight = null;
  let pickHandler = () => {};
  let needsRender = true;

  // ---------- geometry ----------
  const toPts = (flat) => { const p = []; for (let i = 0; i < flat.length; i += 2) p.push([flat[i], flat[i + 1]]); return p; };
  const signedArea = (pts) => pts.reduce((s, [x, z], i) => { const [x2, z2] = pts[(i + 1) % pts.length]; return s + x * z2 - x2 * z; }, 0);
  const centroid = (pts) => pts.reduce((a, [x, z]) => [a[0] + x / pts.length, a[1] + z / pts.length], [0, 0]);

  function pushTri(buf, a, b, c, n, ca, cb, cc) {
    // Keep the triangle front-facing along its intended normal.
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
    for (const [v, col] of [[a, ca], [b, cb], [c, cc]]) { buf.pos.push(...v); buf.nor.push(...n); buf.col.push(col, col, col); }
  }

  function addWalls(buf, pts, m, h) {
    const ccw = signedArea(pts) > 0;
    const aoTop = Math.min(h, m + AO_HEIGHT);
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1;
      const n = ccw ? [dz / len, 0, -dx / len] : [-dz / len, 0, dx / len];
      const bands = [[m, aoTop, 0.7, 1], [aoTop, h, 1, 1]];
      for (const [y0, y1, c0, c1] of bands) {
        if (y1 - y0 < 0.01) continue;
        pushTri(buf, [x1, y0, z1], [x2, y0, z2], [x2, y1, z2], n, c0, c0, c1);
        pushTri(buf, [x1, y0, z1], [x2, y1, z2], [x1, y1, z1], n, c0, c1, c1);
      }
    }
  }

  function addRoof(buf, pts, h) {
    const contour = pts.map(([x, z]) => new T.Vector2(x, z));
    const faces = T.ShapeUtils.triangulateShape(contour, []);
    for (const [a, b, c] of faces) {
      pushTri(buf, [pts[a][0], h, pts[a][1]], [pts[b][0], h, pts[b][1]], [pts[c][0], h, pts[c][1]], [0, 1, 0], 1, 1, 1);
    }
  }

  function toGeometry(buf) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(buf.nor, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(buf.col, 3));
    g.computeBoundingSphere();
    return g;
  }

  function massGeometry(pts, m, h) {
    const buf = { pos: [], nor: [], col: [] };
    addWalls(buf, pts, m, h);
    addRoof(buf, pts, h);
    return buf;
  }

  function ribbon(buf, pts, w, y) {
    for (let i = 0; i < pts.length - 1; i++) {
      let [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const ux = dx / len, uz = dz / len, ox = -uz * w / 2, oz = ux * w / 2;
      x1 -= ux * w / 2; z1 -= uz * w / 2; x2 += ux * w / 2; z2 += uz * w / 2;
      pushTri(buf, [x1 + ox, y, z1 + oz], [x2 + ox, y, z2 + oz], [x2 - ox, y, z2 - oz], [0, 1, 0], 1, 1, 1);
      pushTri(buf, [x1 + ox, y, z1 + oz], [x2 - ox, y, z2 - oz], [x1 - ox, y, z1 - oz], [0, 1, 0], 1, 1, 1);
    }
  }

  // ---------- scene ----------
  function makeMaterials() {
    mats.campus = new T.MeshLambertMaterial({ vertexColors: true });
    mats.city = new T.MeshLambertMaterial({ vertexColors: true });
    mats.seeThrough = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3 });
    mats.selected = new T.MeshLambertMaterial({ vertexColors: true });
    mats.ground = new T.MeshBasicMaterial();
    mats.foot = new T.MeshBasicMaterial({ depthWrite: false });
    mats.road = new T.MeshBasicMaterial({ depthWrite: false });
    mats.ring = new T.MeshLambertMaterial({ vertexColors: true });
  }

  function applyPalette() {
    const g = new T.Color(palette.ground), b = new T.Color(palette.building), a = new T.Color(ACCENT);
    mats.campus.color.copy(b);
    mats.city.color.copy(b).lerp(g, palette.cityMix);
    mats.seeThrough.color.copy(b).lerp(g, palette.cityMix);
    mats.selected.color.copy(b).lerp(a, 0.22);
    mats.ground.color.copy(g);
    mats.foot.color.set(palette.path);
    mats.road.color.set(palette.road);
    mats.ring.color.copy(a);
    scene.background = g.clone();
    scene.fog.color.copy(g);
    hemi.groundColor.set("#ffffff").lerp(g, 0.18);
    needsRender = true;
  }

  let hemi;
  function addLights() {
    hemi = new T.HemisphereLight(0xffffff, 0xd0d0d0, 0.72);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff4e6, 0.46);
    sun.position.set(-0.45, 1, 0.35);
    scene.add(sun);
  }

  function addGround() {
    const plane = new T.Mesh(new T.PlaneGeometry(6000, 6000), mats.ground);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
  }

  function addPaths(paths) {
    const foot = { pos: [], nor: [], col: [] }, road = { pos: [], nor: [], col: [] };
    for (const p of paths) {
      const pts = toPts(p.p);
      if (p.k === "foot") ribbon(foot, pts, 1.6, 0.08);
      else ribbon(road, pts, p.k === "road" ? 7 : 3.6, 0.05);
    }
    const roadMesh = new T.Mesh(toGeometry(road), mats.road);
    const footMesh = new T.Mesh(toGeometry(foot), mats.foot);
    roadMesh.renderOrder = 1; footMesh.renderOrder = 2;
    scene.add(roadMesh, footMesh);
  }

  function addBuildings(buildings) {
    const city = { pos: [], nor: [], col: [] };
    for (const b of buildings) {
      const pts = toPts(b.p);
      if (pts.length < 3) continue;
      if (b.t === "city" && b.h > TALL_CITY) {
        // Tall towers stay separate meshes: solid by default, see-through only while they hide the target.
        const m = new T.Mesh(toGeometry(massGeometry(pts, b.m, b.h)), mats.city);
        tallMeshes.push(m); scene.add(m);
        continue;
      }
      if (b.t === "city") {
        const g = massGeometry(pts, b.m, b.h);
        for (const k of ["pos", "nor", "col"]) city[k].push(...g[k]);
        continue;
      }
      const mesh = new T.Mesh(toGeometry(massGeometry(pts, b.m, b.h)), mats.campus);
      const [cx, cz] = centroid(pts);
      const info = { ...b, pts, cx, cz, label: b.short || b.name || "" };
      mesh.userData.info = info;
      picks.push({ mesh, info });
      scene.add(mesh);
    }
    cityMesh = new T.Mesh(toGeometry(city), mats.city);
    scene.add(cityMesh);
  }

  // ---------- occlusion ----------
  let cityMesh = null, seeThroughChecked = 0;
  const tallMeshes = [];
  const occRay = new T.Raycaster();
  const blockers = () => [...picks.map((p) => p.mesh), cityMesh, ...tallMeshes];

  function targetPoints() {
    const pts = bandPoints();
    if (!pts.length && selected) pts.push({ p: new T.Vector3(selected.cx, selected.h, selected.cz), ignore: [] });
    if (here) pts.push({ p: new T.Vector3(here.x, here.y, here.z), ignore: [] });
    return pts;
  }

  // A tower turns see-through only while it stands between the camera and the selection or "you are here".
  function updateSeeThrough() {
    const pts = targetPoints().map((t) => t.p);
    for (const m of tallMeshes) {
      const blocks = pts.some((p) => {
        const dir = p.clone().sub(camera.position), dist = dir.length();
        occRay.set(camera.position, dir.normalize()); occRay.far = dist;
        return occRay.intersectObject(m, false).length > 0;
      });
      const mat = blocks ? mats.seeThrough : mats.city;
      if (m.material !== mat) { m.material = mat; m.renderOrder = blocks ? 5 : 0; needsRender = true; }
    }
  }

  function visibleFrom(from, point, ignore = []) {
    const dir = point.clone().sub(from), dist = dir.length();
    occRay.set(from, dir.normalize());
    occRay.far = Math.max(0, dist - 1.5);
    return !occRay.intersectObjects(blockers(), false).some((h) => !ignore.includes(h.object));
  }

  // Try camera headings around the target and keep the first that sees the most of `points`.
  function clearHeading(target, dist, tilt, points) {
    const base = camera.position.clone().sub(controls.target).setY(0).normalize(), up = new T.Vector3(0, 1, 0);
    let best = null;
    for (const deg of [0, 30, -30, 60, -60, 90, -90, 135, -135, 180]) {
      const dir = base.clone().applyAxisAngle(up, (deg * Math.PI) / 180), pos = placeCamera(target, dir, dist, tilt);
      const seen = points.filter(({ p, ignore }) => visibleFrom(pos, p, ignore)).length;
      if (!best || seen > best.seen) best = { pos, seen };
      if (seen === points.length) break;
    }
    return best.pos;
  }

  function bandPoints() {
    if (!ring) return [];
    return ring.userData.pts.map(([x, z]) => ({ p: new T.Vector3(x, ring.userData.y, z), ignore: [] }));
  }

  // ---------- floor ring (signature move) ----------
  function offsetPolygon(pts, d) {
    const ccw = signedArea(pts) > 0, s = ccw ? 1 : -1, n = pts.length;
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
      const n1 = [(p[1] - a[1]) * s, -(p[0] - a[0]) * s], n2 = [(c[1] - p[1]) * s, -(c[0] - p[0]) * s];
      const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
      let mx = n1[0] / l1 + n2[0] / l2, mz = n1[1] / l1 + n2[1] / l2;
      const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const cos = Math.max(0.35, (mx * n1[0]) / l1 + (mz * n1[1]) / l1);
      return [p[0] + (mx * d) / cos, p[1] + (mz * d) / cos];
    });
  }

  function floorY(info, floor) {
    const levels = info.levels || Math.max(1, Math.round((info.h - info.m) / 3.4));
    const fh = (info.h - info.m) / levels;
    return { y: info.m + (floor - 1) * fh, fh, levels };
  }

  // The found room's floor drawn as a solid band one storey tall, just outside the walls.
  function showRing(info, floor) {
    clearRing();
    const { y, fh } = floorY(info, floor);
    const pts = offsetPolygon(info.pts, 0.6);
    const buf = { pos: [], nor: [], col: [] };
    addWalls(buf, pts, y + 0.1, y + fh - 0.1);
    addRoof(buf, pts, y + fh - 0.1);
    ring = new T.Mesh(toGeometry(buf), mats.ring);
    ring.renderOrder = 3;
    scene.add(ring);
    ring.userData = { pts, y: y + fh / 2 };
    needsRender = true;
  }

  function clearRing() {
    if (ring) { scene.remove(ring); ring.geometry.dispose(); ring = null; }
    needsRender = true;
  }

  // ---------- labels ----------
  const labelEls = new Map();
  const v3 = new T.Vector3();

  function project(x, y, z) {
    v3.set(x, y, z).project(camera);
    const r = container.getBoundingClientRect();
    return { x: (v3.x * 0.5 + 0.5) * r.width, y: (-v3.y * 0.5 + 0.5) * r.height, ok: v3.z < 1 && v3.z > -1 };
  }

  function labelFor(info) {
    if (!labelEls.has(info)) {
      const el = document.createElement("div");
      el.className = "lbl" + (info.t === "full" ? "" : " minor");
      el.textContent = info.label;
      labelsEl.appendChild(el);
      labelEls.set(info, el);
    }
    return labelEls.get(info);
  }

  // The floor chip and "you are here" are placed first; building labels give way to them.
  function placeLabels() {
    const placed = [placeRingLabel(), placeHere()].filter(Boolean);
    const mapBottom = container.clientHeight - insets.bottom;
    const order = picks.map((p) => p.info).filter((i) => i.label)
      .sort((a, b) => (b === selected) - (a === selected) || (b.t === "full") - (a.t === "full"));
    for (const info of order) {
      const el = labelFor(info), s = project(info.cx, info.h + 2, info.cz);
      const w = info.label.length * 8 + 20, box = [s.x - w / 2, s.y - 28, s.x + w / 2, s.y];
      const hit = placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);
      const inView = box[0] > insets.left + 4 && box[2] < container.clientWidth - 4 && box[1] > insets.top && box[3] < mapBottom - 4;
      const show = s.ok && !hit && inView && (info.t === "full" || camera.position.distanceTo(controls.target) < 520 || info === selected);
      el.hidden = !show;
      el.classList.toggle("sel", info === selected);
      if (show) { placed.push(box); el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`; }
    }
  }

  // The floor chip attaches only to a stretch of the band the camera can actually see (checked at most every 120 ms).
  let chipAnchor = null, chipChecked = 0;
  function placeRingLabel() {
    if (!ring || !ringLabel) { if (ringLabel) ringLabel.hidden = true; return null; }
    const w = container.clientWidth, now = performance.now();
    if (now - chipChecked > 120) {
      chipChecked = now;
      chipAnchor = null;
      let bestX = -Infinity;
      for (const { p } of bandPoints()) {
        const s = project(p.x, p.y, p.z);
        if (s.ok && s.x > 12 && s.x < w - 72 && s.x > bestX && visibleFrom(camera.position, p)) { bestX = s.x; chipAnchor = p; }
      }
    }
    ringLabel.hidden = !chipAnchor;
    if (!chipAnchor) return null;
    const s = project(chipAnchor.x, chipAnchor.y, chipAnchor.z);
    ringLabel.style.transform = `translate(${s.x}px, ${s.y}px) translate(8px, -50%)`;
    return [s.x + 2, s.y - 22, s.x + 62, s.y + 22]; // chip box plus a small margin
  }

  function placeHere() {
    if (!here) return null;
    const s = project(here.x, here.y, here.z);
    here.el.hidden = !s.ok;
    here.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    return s.ok ? [s.x - 14, s.y - 14, s.x + 14, s.y + 14] : null;
  }

  // ---------- camera ----------
  // Distance at which a circle of `radius` metres fits the map area left between the pill and the sheet.
  function fitDistance(radius) {
    const w = container.clientWidth - insets.left, h = Math.max(120, container.clientHeight - insets.top - insets.bottom);
    const vf = (FOV * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h));
    return (radius / Math.tan(Math.min(vf * (h / container.clientHeight), hf) / 2)) * 1.05;
  }

  function placeCamera(target, dir, dist, tilt = TILT) {
    return target.clone().addScaledVector(dir, dist * Math.sin(tilt)).setY(target.y + dist * Math.cos(tilt));
  }

  // Closest distance at which every point projects inside the uncovered map area (binary search on a scratch camera).
  const probe = new T.PerspectiveCamera();
  function fitPoints(points, target, dir, tilt) {
    const w = container.clientWidth, h = container.clientHeight, pad = 0.05;
    const box = { l: insets.left + w * pad, r: w * (1 - pad), t: insets.top + h * pad, b: h - insets.bottom - h * pad };
    const fits = (dist) => {
      probe.copy(camera); probe.position.copy(placeCamera(target, dir, dist, tilt)); probe.lookAt(target);
      probe.updateMatrixWorld(); probe.updateProjectionMatrix();
      return points.every((p) => {
        const v = p.clone().project(probe), x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        return v.z < 1 && x > box.l && x < box.r && y > box.t && y < box.b;
      });
    };
    let lo = 80, hi = 4000;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  const footprintPoints = (infos) => infos.flatMap((i) => i.pts.flatMap(([x, z]) => [new T.Vector3(x, 0, z), new T.Vector3(x, Math.min(i.h, 40), z)]));

  function defaultView() {
    // Taft Avenue toward the bottom of the screen, like the official campus map (PLAN §5).
    const fullInfo = picks.filter((p) => p.info.t === "full").map((p) => p.info);
    const [cx, cz] = centroid(fullInfo.map((i) => [i.cx, i.cz]));
    const taft = mapData.paths.filter((p) => /Taft/i.test(p.n || "")).flatMap((p) => toPts(p.p));
    const [tx, tz] = taft.length ? centroid(taft) : [cx + 1, cz];
    const dir = new T.Vector3(tx - cx, 0, tz - cz).normalize();
    const target = new T.Vector3(cx, 0, cz);
    return { target, pos: placeCamera(target, dir, fitPoints(footprintPoints(fullInfo), target, dir, TILT)) };
  }

  function applyInsets() {
    const w = container.clientWidth, h = container.clientHeight, d = insets.bottom - insets.top, l = insets.left;
    // Shift the projection so the camera target sits in the middle of the uncovered map area.
    if (d >= 0) camera.setViewOffset(w + l, h + d, 0, d, w, h);
    else camera.setViewOffset(w + l, h - d, 0, 0, w, h);
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function flyTo(target, pos, ms = 650) {
    if (reduceMotion || ms === 0) { controls.target.copy(target); camera.position.copy(pos); controls.update(); needsRender = true; return; }
    flight = { t0: performance.now(), ms, fromT: controls.target.clone(), fromP: camera.position.clone(), target, pos };
    needsRender = true;
  }

  function stepFlight(now) {
    if (!flight) return;
    const k = ease((now - flight.t0) / flight.ms);
    controls.target.lerpVectors(flight.fromT, flight.target, k);
    camera.position.lerpVectors(flight.fromP, flight.pos, k);
    if (k >= 1) flight = null;
    needsRender = true;
  }

  // Closer and lower than the overview, so the floor band reads as a storey, from a heading that sees it.
  const BUILDING_TILT = 1.02;
  function viewFor(info) {
    const foot = Math.max(...info.pts.map(([x, z]) => Math.hypot(x - info.cx, z - info.cz)));
    const dist = Math.min(1200, Math.max(130, fitDistance(Math.max(foot, info.h * 0.5) * 1.7)));
    const target = new T.Vector3(info.cx, Math.min(info.h * 0.4, 20), info.cz);
    const points = ring ? bandPoints() : [{ p: new T.Vector3(info.cx, info.h, info.cz), ignore: [info.mesh] }];
    return { target, pos: clearHeading(target, dist, BUILDING_TILT, points) };
  }

  // ---------- loop + picking ----------
  function frame(now) {
    requestAnimationFrame(frame);
    stepFlight(now);
    if (controls.update()) needsRender = true;
    if (!needsRender) return;
    needsRender = false;
    // Fog tracks the camera so the edge of the map data fades out instead of ending in cut-off roads.
    const d = camera.position.distanceTo(controls.target);
    scene.fog.near = d * 0.9; scene.fog.far = d * 1.55;
    if (!flight && now - seeThroughChecked > 150) { seeThroughChecked = now; updateSeeThrough(); }
    renderer.render(scene, camera);
    placeLabels();
  }

  function setupPicking() {
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    let down = null;
    renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 450) return;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(picks.map((p) => p.mesh))[0];
      pickHandler(hit ? hit.object.userData.info : null);
    });
  }

  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    applyInsets();
  }

  // ---------- public API ----------
  function init(el, labels, data, paletteKey) {
    container = el; labelsEl = labels;
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    scene = new T.Scene();
    scene.fog = new T.Fog(0xffffff, 1500, 3400);
    camera = new T.PerspectiveCamera(FOV, 1, 5, 8000);
    controls = new T.MapControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false,
      minDistance: 90, maxDistance: 2600, maxPolarAngle: 1.22 });
    controls.addEventListener("change", () => { needsRender = true; });
    mapData = data;
    makeMaterials(); addLights(); addGround(); addPaths(data.paths); addBuildings(data.buildings);
    ringLabel = document.createElement("div"); ringLabel.className = "lbl floor"; ringLabel.hidden = true; labels.appendChild(ringLabel);
    setPalette(paletteKey);
    setupPicking();
    window.addEventListener("resize", resize); resize();
    homeView = defaultView();
    camera.position.copy(homeView.pos); controls.target.copy(homeView.target); controls.update();
    requestAnimationFrame(frame);
  }

  function setInsets(top, bottom, left = 0) {
    insets.top = top; insets.bottom = bottom; insets.left = left;
    applyInsets();
  }

  function setPalette(key) {
    palette = PALETTES[key] || PALETTES.A;
    applyPalette();
    return palette;
  }

  function select(slug, floor, floorText) {
    if (selected && selected.mesh) selected.mesh.material = mats.campus;
    const p = picks.find((q) => q.info.slug === slug || q.info === slug);
    selected = p ? p.info : null;
    if (p) { p.mesh.material = mats.selected; selected.mesh = p.mesh; }
    chipChecked = 0;
    if (p && floor) { showRing(p.info, floor); ringLabel.textContent = floorText; } else clearRing();
    if (p) { const v = viewFor(p.info); flyTo(v.target, v.pos); }
    needsRender = true;
  }

  // "You are here" sits at the chosen floor's height, so it reads on the right building even when its base is hidden.
  function setHere(slug, floor) {
    if (here) { here.el.remove(); here = null; }
    const p = picks.find((q) => q.info.slug === slug);
    if (p) {
      const el = document.createElement("div"); el.className = "here"; labelsEl.appendChild(el);
      const { y, fh } = floorY(p.info, floor || 1);
      here = { el, x: p.info.cx, z: p.info.cz, y: y + fh / 2 };
      if (selected && selected !== p.info) frameBoth(p, selected);
    }
    needsRender = true;
  }

  // Route preview: keep both "you are here" and the destination's floor band in view, from a heading that sees them.
  function frameBoth(from, b) {
    const a = from.info, [cx, cz] = centroid([[a.cx, a.cz], [b.cx, b.cz]]);
    const target = new T.Vector3(cx, 0, cz);
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const dist = Math.min(1600, fitPoints(footprintPoints([a, b]), target, dir, TILT) * 1.05);
    const points = [...bandPoints(), { p: new T.Vector3(here.x, here.y, here.z), ignore: [from.mesh] }];
    chipChecked = 0;
    flyTo(target, clearHeading(target, dist, TILT, points));
  }

  return {
    PALETTES, init, setPalette, select, setHere, setInsets,
    flyHome: (ms) => { homeView = defaultView(); flyTo(homeView.target, homeView.pos, ms); },
    onPick: (fn) => { pickHandler = fn; },
    buildings: () => picks.map((p) => p.info),
  };
})();
