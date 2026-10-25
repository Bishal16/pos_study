(function () {
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DOM = { authentication: "d-id", authorization: "d-id", configuration: "d-id", product: "d-md", customer: "d-md", purchase: "d-pr", approval: "d-pr", inventory: "d-pr",
  sales: "d-sell", policy: "d-sell", promotion: "d-sell", payment: "d-sell", accounts: "d-fin", vat: "d-fin", report: "d-fin", compliance: "d-sup", notification: "d-sup" };
const color = s => `var(--${DOM[s] || "d-sup"})`;
const STATUS = ["", "keep", "change", "drop", "new"];
const TYPES = ["String", "UUID", "Integer", "Long", "BigDecimal", "Boolean", "LocalDate", "LocalDateTime", "Double"];
const W = 300, HH = 30, RH = 17;
const fit = (txt, px, cw) => { const n = Math.max(4, Math.floor(px / cw)); return txt.length > n ? txt.slice(0, n - 1) + "…" : txt; };

const S = { idx: null, data: {}, view: "home", svc: null, sel: null, notes: {}, props: [], layout: {}, localPos: {}, expanded: {}, vb: {},
  db: null, user: null, downloads: null, canWrite: null, uid: null, ro: false, dragging: false, resetArm: 0, msg: "" };

/* ---------------- loading ---------------- */
let EMBED = null;
try { EMBED = JSON.parse(document.getElementById("erd-data").textContent); } catch (e) { EMBED = null; }
async function getJSON(p) {
  const key = p.replace(/^data\//, "").replace(/\.json$/, "");
  if (EMBED && EMBED[key]) return EMBED[key];
  const r = await fetch(p); if (!r.ok) throw new Error(p + " " + r.status); return r.json();
}
async function loadSvc(s) { if (!S.data[s]) S.data[s] = await getJSON("data/" + s + ".json"); return S.data[s]; }

/* ---------------- design layer (shared db) ---------------- */
let unsubLayout = null, writeChain = Promise.resolve();
async function initShared() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") { setSync(location.protocol === "file:" ? "file" : "off"); return; }
  const [db, user, downloads] = await Promise.all([c.use("db"), c.use("user"), c.use("downloads")]);
  S.downloads = downloads; S.user = user;
  if (!db) { setSync("off"); return; }
  S.db = db;
  if (user) { S.canWrite = await user.can("data.write"); S.uid = await user.id(); }
  setSync(S.canWrite === false ? "ro" : "live");
  db.collection("notes").onSnapshot(snap => { const n = {}; snap.docs.forEach(d => { n[d.id] = d.data(); }); S.notes = n; refresh(); }, () => setSync("off"));
  db.collection("proposals").onSnapshot(snap => { S.props = snap.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); }, () => {});
  if (S.svc) subscribeLayout(S.svc);
}
function subscribeLayout(svc) {
  if (!S.db) return;
  if (unsubLayout) unsubLayout();
  unsubLayout = S.db.doc("layouts/" + svc).onSnapshot(d => { S.layout[svc] = d.exists ? (d.data().pos || {}) : {}; if (!S.dragging && S.view === "svc" && S.svc === svc) renderSvc(); }, () => {});
}
function setSync(st) {
  const el = $("sync"); el.className = "pill " + (st === "live" ? "live" : st === "ro" ? "ro" : "");
  el.textContent = st === "live" ? "Shared notes: live · you can edit" : st === "ro" ? "Shared notes: live · view only" : st === "file" ? "Offline copy · shared notes live only on the claude.ai link" : "Shared notes: not available here · view only";
}
const canEdit = () => !!S.db && !S.ro && S.canWrite !== false;
function write(fn, okMsg) {
  writeChain = writeChain.then(fn).then(() => { S.msg = okMsg || ""; refreshCard(); }).catch(e => {
    if (e && e.code === "invalid_argument") { S.ro = true; setSync("ro"); S.msg = "You can view this page but not change its shared notes."; }
    else if (e && e.code === "quota_exceeded") S.msg = "The shared store is full. Delete old notes or proposals first.";
    else S.msg = "Could not save right now. Try again in a moment.";
    refreshCard();
  });
  return writeChain;
}
const now = () => Date.now();

/* ---------------- routing ---------------- */
async function open(view, svc, sel, focus) {
  S.view = view; S.sel = sel || null; S.msg = "";
  if (view === "svc") {
    if (S.svc !== svc) { S.svc = svc; subscribeLayout(svc); }
    $("svcSel").value = svc;
    $("canvas").innerHTML = `<p class="cap">Loading ${esc(svc)}-service…</p>`;
    try { await loadSvc(svc); } catch (e) { $("canvas").innerHTML = `<p class="cap">Could not load data/${esc(svc)}.json.</p>`; return; }
  } else { $("svcSel").value = ""; }
  try { history.replaceState(null, "", view === "svc" ? "#" + svc : "#"); } catch (e) {}
  render();
  if (view === "svc" && focus) zoomTo(focus);
}
function render() { if (S.view === "home") renderHome(); else renderSvc(); refreshCard(); }
let rq = 0;
function refresh() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; if (!S.dragging) render(); }); }

/* ---------------- helpers ---------------- */
const noteKey = (svc, t, c) => svc + "~" + t + (c ? "~" + c : "");
function propsFor(svc) { return S.props.filter(p => p.svc === svc); }
function merged(svc) { return ErdCore.view(S.data[svc], S.notes, S.props); }

/* ================= HOME ================= */
function renderHome() {
  const idx = S.idx, svcs = Object.keys(idx.services);
  const nT = svcs.reduce((a, s) => a + Object.keys(idx.services[s].tables).length, 0);
  const nFk = svcs.reduce((a, s) => a + idx.services[s].fks, 0);
  const openP = S.props.filter(p => p.state !== "done");
  let h = `<p class="cap"><b>Code is the source of truth.</b> Tables, columns and relations come from each service's @Entity classes (built ${esc(idx.built)}). Notes, status and proposals are the shared design layer on top.</p>
  <div class="stats"><span><b>${svcs.length}</b> services</span><span><b>${nT}</b> tables</span><span><b>${nFk}</b> JPA foreign keys</span><span><b>${idx.xrefs.length}</b> cross-service id references</span><span><b>${Object.keys(S.notes).length}</b> notes</span><span><b>${openP.length}</b> open proposals</span></div>
  ${syncBanner()}
  <h2 class="sec">Services</h2><div class="svcgrid">${svcs.map(s => { const v = idx.services[s]; const nn = Object.keys(S.notes).filter(k => k.startsWith(s + "~")).length;
    return `<button class="svccard" data-svc="${s}"><span class="nm"><span class="dotc" style="background:${color(s)}"></span>${esc(s)}</span><span class="sub">${Object.keys(v.tables).length} tables · ${v.fks} FK</span><span class="sub">${v.refsOut} refs out · ${v.refsIn} in${nn ? " · " + nn + " notes" : ""}</span></button>`; }).join("")}</div>
  <h2 class="sec">Cross-service references</h2><p class="cap">Each line bundles the columns in one service that hold an id living in another service (no database foreign key). Click a line for the column list, a dot to open the service.</p>
  <div class="frame">${homeMap()}</div>
  <h2 class="sec">Changes</h2>${changesHTML()}`;
  $("canvas").innerHTML = h;
  attachPZ($("canvas").querySelector("svg"), "home");
}
function homeMap() {
  const idx = S.idx, svcs = Object.keys(idx.services), CX = 470, CY = 360, R = 290, P = {};
  svcs.forEach((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / svcs.length; P[s] = [CX + R * Math.cos(a), CY + R * Math.sin(a), a]; });
  const pairs = {}; idx.xrefs.forEach(x => { const k = x[0] + ">" + x[3]; pairs[k] = (pairs[k] || 0) + 1; });
  let b = "";
  Object.entries(pairs).forEach(([k, n]) => { const [a, c] = k.split(">"); const [x1, y1] = P[a], [x2, y2] = P[c]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, qx = mx + (CX - mx) * .45, qy = my + (CY - my) * .45;
    const hot = S.sel && S.sel.bundle && S.sel.bundle.join(">") === k ? " hot" : "";
    b += `<path class="bundle${hot}" data-bundle="${k}" d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" stroke-width="${(1 + Math.log2(n + 1) * 1.6).toFixed(1)}"><title>${a} → ${c}: ${n} column${n > 1 ? "s" : ""}</title></path>`;
    const lx = .25 * x1 + .5 * qx + .25 * x2, ly = .25 * y1 + .5 * qy + .25 * y2; b += `<text class="blbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${n}</text>`; });
  svcs.forEach(s => { const [x, y, a] = P[s], n = Object.keys(idx.services[s].tables).length, r = 6 + Math.sqrt(n) * 2.2, out = Math.cos(a) >= 0;
    const tx = x + Math.cos(a) * (r + 8), ty = y + Math.sin(a) * (r + 8);
    b += `<g class="snode" data-svc="${s}" tabindex="0" role="button" aria-label="Open ${s}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color(s)}"/><text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="${Math.abs(Math.cos(a)) < .2 ? "middle" : out ? "start" : "end"}">${esc(s)} <tspan class="cnt">${n}</tspan></text></g>`; });
  return `<svg viewBox="0 0 940 720" role="img" aria-label="Cross-service reference map">${b}</svg>`;
}
function changesHTML() {
  const d = S.idx.diff, openP = S.props.filter(p => p.state !== "done"), orphans = orphanNotes();
  let h = "";
  h += d.prev ? `<p class="cap"><b>Code changes since ${esc(d.prev)}</b> (${d.items.length})</p>` + (d.items.length ? `<ul class="list">${d.items.map(i => `<li><button class="lnk" data-go="${esc(i[0])}|${esc(i[1])}|${esc(i[2])}">${esc(i[0])}.${esc(i[1])}${i[2] ? "." + esc(i[2]) : ""}</button> <span class="muted">${esc(i[3])}</span></li>`).join("")}</ul>` : `<p class="cap">No schema changes.</p>`)
    : `<p class="cap"><b>First snapshot (${esc(S.idx.built)}).</b> After the next rebuild this lists every table and column added, removed or retyped in the code.</p>`;
  h += `<p class="cap"><b>Open proposals</b> (${openP.length})</p>` + (openP.length ? `<ul>${openP.map(p => `<li><button class="lnk" data-prop="${esc(p.id)}">${esc(propLabel(p))}</button></li>`).join("")}</ul>` : `<p class="cap">None yet. Open a service and use “Propose a change”.</p>`);
  h += `<p class="cap"><b>Orphaned notes</b> (${orphans.length}): notes whose table or column no longer exists in the code.</p>` + (orphans.length ? `<ul>${orphans.map(k => `<li class="mono">${esc(k.replace(/~/g, "."))} <span class="muted">${esc((S.notes[k].text || "").slice(0, 80))}</span></li>`).join("")}</ul>` : "");
  return `<div style="display:flex;flex-direction:column;gap:6px">${h}</div>`;
}
function syncBanner() {
  const st = S.status; if (!st || !st.generatedAt) return "";
  const c = st.counts || {}, changed = Object.entries(st.repos || {}).filter(([n, r]) => r.new).map(([n, r]) => n + " (" + r.new + ")");
  const cls = !st.fetchOk ? "warn" : "ok";
  const title = st.fetchSkipped ? "Built without fetching from GitLab: showing code as of each repo's last fetch" : !st.fetchOk ? "Last refresh could not reach GitLab: showing code as of each repo's last successful fetch" : "Built from origin/dev of every repo";
  const sch = (st.changes && st.changes.schema) || [];
  return `<div class="syncb ${cls}"><b>${esc(title)}</b><span>Refreshed ${esc(st.generatedAt.replace("T", " "))} · ${c.commits || 0} new commit(s) since the ${esc((st.changes && st.changes.since) || "previous refresh")}${changed.length ? " in " + esc(changed.join(", ")) : ""} · ${sch.length} schema change(s)</span>
   ${sch.length ? `<ul>${sch.slice(0, 40).map(i => `<li>${i[3].includes("removed") ? `<span class="mono">${esc(i[0])}.${esc(i[1])}${i[2] ? "." + esc(i[2]) : ""}</span>` : `<button class="lnk" data-go="${esc(i[0])}|${esc(i[1])}|${esc(i[2])}">${esc(i[0])}.${esc(i[1])}${i[2] ? "." + esc(i[2]) : ""}</button>`} <span class="muted">${esc(i[3])}</span></li>`).join("")}</ul>` : ""}</div>`;
}
function propLabel(p) { return p.kind === "table" ? `${p.svc}: new table ${p.table}` : p.kind === "column" ? `${p.svc}: new column ${p.table}.${p.col}` : `${p.svc}: ${p.table}.${p.col} → ${p.to ? p.to.svc + "." + p.to.table : "?"}`; }
function orphanNotes() {
  const sv = S.idx.services;
  return Object.keys(S.notes).filter(k => { const [s, t, c] = k.split("~"); const svc = sv[s]; if (!svc) return true;
    const ptab = S.props.some(p => p.svc === s && p.table === t), pcol = S.props.some(p => p.svc === s && p.table === t && p.col === c);
    if (!svc.tables[t]) return !ptab; if (c && !svc.tables[t].includes(c)) return !pcol; return false; });
}

/* ================= SERVICE ERD ================= */
let G = {}, V = null;
function autoLayout(v) {
  const names = v.tables.map(t => t.t), adj = {}; names.forEach(n => adj[n] = new Set());
  v.refs.forEach(r => { if (r.ts === v.svc && adj[r.ft] && adj[r.tt] && r.ft !== r.tt) { adj[r.ft].add(r.tt); adj[r.tt].add(r.ft); } });
  const seen = new Set(), order = [];
  [...names].sort((a, b) => adj[b].size - adj[a].size || a.localeCompare(b)).forEach(r => { if (seen.has(r)) return; const q = [r]; seen.add(r);
    while (q.length) { const c = q.shift(); order.push(c); [...adj[c]].sort().forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); } });
  const cols = order.length > 30 ? 6 : order.length > 16 ? 5 : order.length > 8 ? 4 : 3, pos = {}; let y = 30, rowMax = 0;
  order.forEach((t, i) => { const c = i % cols; if (c === 0 && i) { y += rowMax + 60; rowMax = 0; } pos[t] = [30 + c * (W + 110), y]; rowMax = Math.max(rowMax, boxH(v.tables.find(x => x.t === t))); });
  return pos;
}
function visibleCols(t) {
  const own = t.cols.filter(c => !c.inh), inh = t.cols.filter(c => c.inh);
  return { own, inh, showInh: !!S.expanded[S.svc + "~" + t.t] };
}
function boxH(t) { const vc = visibleCols(t); return HH + (vc.own.length + (vc.inh.length ? (vc.showInh ? vc.inh.length + 1 : 1) : 0)) * RH + 8; }
function geometry(v) {
  const auto = autoLayout(v), shared = S.layout[v.svc] || {}, local = S.localPos[v.svc] || {}; G = {};
  v.tables.forEach(t => { const p = local[t.t] || shared[t.t] || auto[t.t] || [30, 30]; const vc = visibleCols(t), rows = {};
    let i = 0; vc.own.forEach(c => rows[c.c] = i++); if (vc.inh.length) { i++; if (vc.showInh) vc.inh.forEach(c => rows[c.c] = i++); }
    G[t.t] = { x: p[0], y: p[1], h: boxH(t), rows }; });
}
const rowY = (t, c) => { const g = G[t]; const i = g.rows[c]; return i == null ? g.y + HH / 2 : g.y + HH + i * RH + RH / 2 + 2; };
function edgesSVG(v) {
  const sel = S.sel && S.sel.t ? S.sel : null; let b = "";
  v.refs.forEach(r => {
    if (!(r.kind === "fk" || r.kind === "soft") || r.ts !== v.svc || !G[r.ft] || !G[r.tt]) return;
    const a = G[r.ft], c = G[r.tt], sy = rowY(r.ft, r.fc), ty = rowY(r.tt, r.tc);
    let d;
    if (r.ft === r.tt) d = `M${a.x + W},${sy} C${a.x + W + 46},${sy} ${a.x + W + 46},${ty} ${a.x + W},${ty}`;
    else { const right = c.x > a.x + W / 2, left = c.x + W < a.x; const sx = right ? a.x + W : left ? a.x : a.x + W, tx = right ? c.x : left ? c.x + W : c.x + W;
      const k = Math.max(40, Math.abs(tx - sx) * .4); const c1 = right ? sx + k : left ? sx - k : sx + 46, c2 = right ? tx - k : left ? tx + k : tx + 46; d = `M${sx},${sy} C${c1},${sy} ${c2},${ty} ${tx},${ty}`; }
    const hot = sel && ((sel.t === r.ft && (!sel.c || sel.c === r.fc)) || (sel.t === r.tt && (!sel.c || sel.c === r.tc)));
    let cls = "e" + (r.kind === "soft" ? " soft" : "") + (r.inferred ? " inferred" : "") + (r.proposed ? " prop" : "") + (hot ? " hot" : sel ? " dim" : "");
    const mv = hot ? "-hot" : r.proposed ? "-prop" : "";
    const start = r.rel === "OneToOne" ? "one" : "crow";
    b += `<path class="${cls}" d="${d}" marker-start="url(#mk-${start}${mv})" marker-end="url(#mk-one${mv})"><title>${esc(r.ft)}.${esc(r.fc)} → ${esc(r.tt)}.${esc(r.tc)} · ${r.kind === "fk" ? "JPA " + (r.rel || "relation") : r.inferred ? "id column, target inferred from its name" : "id column, no foreign key"}${r.proposed ? " · PROPOSED" : ""}</title></path>`;
  });
  return b;
}
function markerDefs() {
  const m = (id, d, cls) => `<marker id="${id}" viewBox="0 0 14 12" refX="13" refY="6" markerWidth="14" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="mk ${cls}" d="${d}"/></marker>`;
  const crow = "M1,6 L13,0 M1,6 L13,6 M1,6 L13,12 M1,1 L1,11", one = "M8,0 L8,12 M11,0 L11,12";
  return `<defs>${["", "-hot", "-prop"].map(v => m("mk-crow" + v, crow, v.slice(1)) + m("mk-one" + v, one, v.slice(1))).join("")}</defs>`;
}
function boxSVG(v, t) {
  const g = G[t.t], vc = visibleCols(t), inc = S.data[v.svc].incoming.filter(x => x.tt === t.t).length;
  const st = t.status ? " st-" + t.status : "", selT = S.sel && S.sel.t === t.t && !S.sel.c, rel = S.sel && S.sel.t && S.sel.t !== t.t && v.refs.some(r => r.ts === v.svc && ((r.ft === S.sel.t && r.tt === t.t && (!S.sel.c || r.fc === S.sel.c)) || (r.tt === S.sel.t && r.ft === t.t && (!S.sel.c || r.tc === S.sel.c))));
  let b = `<g class="box${t.proposed ? " prop" : ""}${st}${selT ? " sel" : ""}${rel ? " rel" : ""}" data-t="${esc(t.t)}" transform="translate(${g.x},${g.y})">
   <rect class="b" width="${W}" height="${g.h}" rx="5"/><rect class="h" width="${W}" height="${HH - 2}" rx="5"/>
   <text class="tn" x="10" y="19">${esc(fit(t.t, inc ? W - 60 : W - 20, 7.3))}<title>${esc(t.t)}</title></text>`;
  const clsFits = t.t.length * 7.3 + (t.cls || "").length * 5.8 < W - 30;
  if (inc) b += `<text class="inbadge" x="${W - 8}" y="19" text-anchor="end" data-inc="${esc(t.t)}">↙ ${inc}<title>${inc} column(s) in other services point here</title></text>`;
  else if (t.proposed || clsFits) b += `<text class="tc" x="${W - 8}" y="19" text-anchor="end">${esc(t.proposed ? "proposed" : t.cls)}</text>`;
  if (t.dnote || t.status) b += `<circle class="ndot" cx="${W - 4}" cy="4" r="4"><title>has a note</title></circle>`;
  b += `<rect class="hdrhit" width="${W}" height="${HH - 2}"><title>Drag to move · click for details</title></rect>`;
  const row = (c, i) => {
    const y = HH + i * RH, r = v.refs.find(x => x.ft === t.t && x.fc === c.c);
    const tag = c.pk ? "PK" : r ? (r.kind === "fk" ? "FK" : r.kind === "xs" ? "→" : r.kind === "poly" ? "⋯" : "id") : "";
    const sel = S.sel && S.sel.t === t.t && S.sel.c === c.c ? " sel" : "", noted = c.dnote || c.status ? " noted" : "";
    let right, rlen;
    if (r && r.kind === "xs") { const lab = "→ " + r.ts; rlen = lab.length; right = `<text class="xchip" x="${W - 8}" y="${y + 13}" text-anchor="end" style="fill:${color(r.ts)}" data-go="${esc(r.ts)}|${esc(r.tt)}|${esc(r.tc)}">${esc(lab)}<title>${esc(r.ts)}.${esc(r.tt)}.${esc(r.tc)} (other service, no FK) · click to open</title></text>`; }
    else if (r && r.kind === "poly") { const lab = "→ " + (r.poly.length ? r.poly[0][0] + " ×" + r.poly.length : "unknown"); rlen = lab.length; right = `<text class="xchip" x="${W - 8}" y="${y + 13}" text-anchor="end" style="fill:var(--muted)" data-poly="${esc(t.t)}|${esc(c.c)}">${esc(lab)}<title>polymorphic id · click for its possible targets</title></text>`; }
    else { const ty = ErdCore.sqlType(c).slice(0, 18); rlen = ty.length; right = `<text class="ct" x="${W - 8}" y="${y + 13}" text-anchor="end">${esc(ty)}</text>`; }
    const nameTxt = fit(c.c + (c.nn && !c.pk ? " *" : ""), W - 40 - rlen * 5.8, 6.4);
    return `<g class="crow${sel}${noted}${c.proposed ? " prop" : ""}" data-c="${esc(c.c)}"><rect x="1" y="${y}" width="${W - 2}" height="${RH}"/><text class="ctag${r && r.kind === "fk" ? " fk" : ""}" x="8" y="${y + 13}">${tag}</text><text class="cn${c.inh ? " inh" : ""}" x="30" y="${y + 13}">${esc(nameTxt)}<title>${esc(c.c)}</title></text>${right}</g>`;
  };
  let i = 0; vc.own.forEach(c => b += row(c, i++));
  if (vc.inh.length) { const y = HH + i * RH; b += `<g class="crow" data-inh="${esc(t.t)}"><rect x="1" y="${y}" width="${W - 2}" height="${RH}"/><text class="cn inh" x="30" y="${y + 13}">${vc.showInh ? "− hide" : "+ " + vc.inh.length} audit columns (${esc(vc.inh[0].inh)})</text></g>`; i++;
    if (vc.showInh) vc.inh.forEach(c => b += row(c, i++)); }
  return b + "</g>";
}
function renderSvc() {
  const svc = S.svc; if (!S.data[svc]) return;
  V = merged(svc); geometry(V);
  const xs = Object.values(G), maxX = Math.max(...xs.map(g => g.x + W)) + 80, maxY = Math.max(...xs.map(g => g.y + g.h)) + 40, minX = Math.min(...xs.map(g => g.x)) - 30, minY = Math.min(...xs.map(g => g.y)) - 20;
  const base = { x: minX, y: minY, w: Math.max(900, maxX - minX), h: Math.max(500, maxY - minY) };
  const d = S.data[svc], nx = V.refs.filter(r => r.kind === "xs").length, open = propsFor(svc).filter(p => p.state !== "done").length;
  const rst = S.resetArm > now() ? "Click again to reset the shared layout" : "Auto-arrange";
  $("canvas").innerHTML = `<p class="cap"><b>${esc(svc)}-service</b> · ${V.tables.length} tables · ${V.refs.filter(r => r.kind === "fk").length} JPA foreign keys · ${nx} ids pointing to other services · ${d.incoming.length} columns elsewhere point here · source <span class="mono">${esc(d.head.branch)} ${esc(d.head.commit)}</span>${open ? ` · <b style="color:var(--prop)">${open} open proposals</b>` : ""}</p>
   <div class="tools"><span class="hint">Drag a table header to move it · drag the background to pan · Ctrl/⌘ + scroll or pinch to zoom · click a column to trace it</span>
   <button class="btn" id="zOut" aria-label="Zoom out">−</button><button class="btn" id="zIn" aria-label="Zoom in">+</button><button class="btn" id="zFit">Fit</button><button class="btn" id="autoBtn">${rst}</button>
   ${canEdit() ? `<button class="btn prop" id="proposeBtn">Propose a change</button>` : ""}<button class="btn" id="exportBtn">Export</button></div>
   <div class="frame"><svg id="erd" viewBox="${base.x} ${base.y} ${base.w} ${base.h}" role="img" aria-label="${esc(svc)} tables and references">${markerDefs()}<g id="edges">${edgesSVG(V)}</g><g id="boxes">${V.tables.map(t => boxSVG(V, t)).join("")}</g></svg></div>
   <p class="cap">Legend: <b>PK</b> primary key · <b style="color:var(--d-sell)">FK</b> JPA foreign key (solid line, crow's foot = many) · <b>id</b> id column without a foreign key (dashed; dotted = target guessed from the name) · <b>→</b> id that lives in another service (click to go there) · <b>⋯</b> polymorphic id · <b>*</b> NOT NULL · <span style="color:var(--prop)">purple dashed</span> = proposed · coloured header = status note.</p>`;
  const svg = $("erd"); attachPZ(svg, "svc:" + svc, base);
  $("autoBtn").onclick = () => { if (S.resetArm > now()) { S.resetArm = 0; S.localPos[svc] = {}; if (canEdit()) write(() => S.db.doc("layouts/" + svc).set({ pos: {}, by: S.uid, at: now() }), "Layout reset."); else { S.layout[svc] = {}; } delete S.vb["svc:" + svc]; renderSvc(); } else { S.resetArm = now() + 4000; renderSvc(); setTimeout(() => { if (S.view === "svc") renderSvc(); }, 4100); } };
  $("exportBtn").onclick = () => { S.sel = { export: 1 }; refreshCard(); };
  if ($("proposeBtn")) $("proposeBtn").onclick = () => { S.sel = { propose: 1, table: S.sel && S.sel.t || "" }; refreshCard(); };
}
function rebuildEdges() { const e = $("edges"); if (e) e.innerHTML = edgesSVG(V); }

/* ---------------- pan / zoom / drag ---------------- */
function attachPZ(svg, key, baseIn) {
  if (!svg) return;
  const vb0 = svg.viewBox.baseVal, base = baseIn || { x: vb0.x, y: vb0.y, w: vb0.width, h: vb0.height };
  const v = S.vb[key] ? { ...S.vb[key] } : { ...base };
  if (!S.vb[key] && key.startsWith("svc:") && base.w > 1700) { const k = 1700 / base.w; v.w = 1700; v.h = base.h * k; }
  const apply = () => { svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`); S.vb[key] = { ...v }; };
  apply();
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
  const zoom = (f, cx, cy) => { const c = cx == null ? { x: v.x + v.w / 2, y: v.y + v.h / 2 } : pt({ clientX: cx, clientY: cy }); const nw = Math.min(base.w * 2, Math.max(base.w / 14, v.w * f)), k = nw / v.w;
    v.x = c.x - (c.x - v.x) * k; v.y = c.y - (c.y - v.y) * k; v.w = nw; v.h = v.h * k; apply(); };
  svg.addEventListener("wheel", e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
  const pts = new Map(); let mode = null, last = null, pinch = null, drag = null, moved = 0;
  svg.addEventListener("pointerdown", e => {
    pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
    const hdr = e.target.closest(".hdrhit");
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); mode = "pinch"; return; }
    if (hdr && key.startsWith("svc:")) { const t = hdr.closest(".box").dataset.t, p = pt(e); drag = { t, ox: p.x - G[t].x, oy: p.y - G[t].y }; mode = "drag"; S.dragging = true; }
    else if (e.target.closest(".crow,.xchip,.inbadge,.bundle,.snode")) { mode = "click"; }
    else { mode = "pan"; last = pt(e); }
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    if (mode === "pinch" && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom(pinch / d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d; return; }
    if (mode === "drag" && drag) { const p = pt(e); const x = Math.round(p.x - drag.ox), y = Math.round(p.y - drag.oy); G[drag.t].x = x; G[drag.t].y = y;
      (S.localPos[S.svc] = S.localPos[S.svc] || {})[drag.t] = [x, y];
      const g = svg.querySelector(`.box[data-t="${CSS.escape(drag.t)}"]`); if (g) g.setAttribute("transform", `translate(${x},${y})`); rebuildEdges(); return; }
    if (mode === "pan" && last) { const p = pt(e); v.x -= p.x - last.x; v.y -= p.y - last.y; apply(); }
  });
  const end = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (mode === "drag" && drag) { S.dragging = false; const t = drag.t; drag = null;
      if (moved > 4) saveLayout(); else { S.sel = { t }; render(); } }
    if (!pts.size) { if (mode !== "click") svg.dataset.moved = moved > 4 ? "1" : ""; mode = null; last = null; }
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  const zi = $("zIn"), zo = $("zOut"), zf = $("zFit");
  if (key.startsWith("svc:") && zi) { zi.onclick = () => zoom(1 / 1.25); zo.onclick = () => zoom(1.25); zf.onclick = () => { Object.assign(v, base); apply(); }; }
  svg._zoomTo = (x, y, w) => { const k = base.h / base.w; v.w = Math.min(base.w, Math.max(w, 600)); v.h = v.w * k; v.x = x - v.w / 2; v.y = y - v.h / 2; apply(); };
}
let saveTimer = 0;
function saveLayout() {
  const svc = S.svc;
  if (!canEdit()) { S.msg = "Layout changed on this screen only (view only, not saved)."; refreshCard(); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { const pos = {}; Object.entries(G).forEach(([t, g]) => pos[t] = [g.x, g.y]);
    write(() => S.db.doc("layouts/" + svc).set({ pos, by: S.uid, at: now() }).then(() => { S.localPos[svc] = {}; }), "Layout saved for everyone."); }, 700);
}
function zoomTo(f) {
  const svg = $("erd"); if (!svg || !G[f.t]) return; const g = G[f.t];
  S.sel = { t: f.t, c: f.c || null }; renderSvc(); refreshCard();
  const s2 = $("erd"); if (s2 && s2._zoomTo) s2._zoomTo(g.x + W / 2, g.y + g.h / 2, 1100);
}

/* ================= CARD ================= */
function refreshCard() {
  const el = $("card"), s = S.sel;
  let h = "";
  if (S.view === "home" && !s) h = homeCard();
  else if (s && s.bundle) h = bundleCard(s.bundle);
  else if (s && s.prop) h = proposalCard(s.prop);
  else if (S.view === "svc" && s && s.export) h = exportCard();
  else if (S.view === "svc" && s && s.propose) h = proposeCard(s);
  else if (S.view === "svc" && s && s.inc) h = incomingCard(s.inc);
  else if (S.view === "svc" && s && s.poly) h = polyCard(s.poly);
  else if (S.view === "svc" && s && s.t && s.c) h = columnCard(s.t, s.c);
  else if (S.view === "svc" && s && s.t) h = tableCard(s.t);
  else if (S.view === "svc") h = svcCard();
  else h = homeCard();
  if (S.msg) h += `<p class="msg">${esc(S.msg)}</p>`;
  el.innerHTML = h;
  resolveNames();
}
function homeCard() {
  return `<p class="kind">How to use</p><h3>A living ERD</h3>
  <ul><li>Pick a service (or a dot on the map) to see its tables and how they connect.</li><li>Click a column to trace everything it points to and everything pointing at it, across services.</li>
  <li>Notes, a status (keep / change / drop / new) and proposed tables, columns or references are shared with everyone who can open this page.</li>
  <li>When the code changes, the ERD is regenerated from it. Notes stay attached by table and column name; if their target disappears they show under <b>Orphaned notes</b>.</li>
  <li><b>Export</b> gives DBML (open it in dbdiagram.io), PostgreSQL DDL or Mermaid, per service or all at once.</li></ul>`;
}
function svcCard() {
  const d = S.data[S.svc], byTo = {}; V.refs.filter(r => r.kind === "xs").forEach(r => { byTo[r.ts] = (byTo[r.ts] || 0) + 1; });
  const byFrom = {}; d.incoming.forEach(r => { byFrom[r.fs] = (byFrom[r.fs] || 0) + 1; });
  return `<p class="kind">Service</p><h3>${esc(S.svc)}-service</h3><div class="chips"><span class="chip">${V.tables.length} tables</span><span class="chip">${esc(d.head.branch)} · ${esc(d.head.commit)}</span></div>
   <div><h4>Ids pointing to other services</h4>${Object.keys(byTo).length ? `<ul>${Object.entries(byTo).map(([s, n]) => `<li><button class="lnk" data-bundle="${esc(S.svc)}>${esc(s)}">${esc(s)}</button> · ${n}</li>`).join("")}</ul>` : "<p class='muted'>None.</p>"}</div>
   <div><h4>Other services pointing here</h4>${Object.keys(byFrom).length ? `<ul>${Object.entries(byFrom).map(([s, n]) => `<li><button class="lnk" data-bundle="${esc(s)}>${esc(S.svc)}">${esc(s)}</button> · ${n}</li>`).join("")}</ul>` : "<p class='muted'>None.</p>"}</div>
   <div><h4>Tables</h4><ul class="plain list">${V.tables.map(t => `<li><button class="lnk" data-focus="${esc(t.t)}">${esc(t.t)}</button> <span class="muted">${t.cols.length} cols${t.proposed ? " · proposed" : ""}</span></li>`).join("")}</ul></div>`;
}
function noteBlock(svc, t, c) {
  const k = noteKey(svc, t, c), n = S.notes[k];
  let h = `<div><h4>Note</h4>`;
  if (n && (n.text || n.status)) h += `${n.status ? `<div class="chips"><span class="chip ${n.status === "drop" ? "bad" : n.status === "change" ? "warn" : n.status === "new" ? "prop" : "ok"}">status: ${esc(n.status)}</span></div>` : ""}${n.text ? `<div class="note"></div>` : ""}<p class="muted" style="font-size:.78rem;margin:4px 0 0">by <span data-uid="${esc(n.by || "")}">someone</span>${n.at ? " · " + new Date(n.at).toLocaleDateString() : ""}</p>`;
  else h += `<p class="muted" style="margin:0;font-size:.86rem">No note yet.</p>`;
  h += `</div>`;
  if (canEdit()) h += `<div class="form" data-notekey="${esc(k)}"><label>Note<textarea id="noteText" maxlength="4000"></textarea></label><label>Status<select id="noteStatus">${STATUS.map(s => `<option value="${s}" ${n && n.status === s ? "selected" : ""}>${s || "—"}</option>`).join("")}</select></label>
    <div class="row2"><button class="btn primary" data-act="saveNote">Save note</button>${n ? `<button class="btn" data-act="delNote">Delete note</button>` : ""}</div></div>`;
  else h += `<p class="muted" style="font-size:.8rem;margin:0">${S.db ? "View only: you can't change notes here." : "Shared notes are not available in this view."}</p>`;
  return h;
}
function fillNoteForm(svc, t, c) {
  const n = S.notes[noteKey(svc, t, c)], box = document.querySelector("#card .note"); if (box && n) box.textContent = n.text || "";
  const ta = $("noteText"); if (ta && n) ta.value = n.text || "";
}
function tableCard(tn) {
  const t = V.tables.find(x => x.t === tn); if (!t) return svcCard();
  const d = S.data[S.svc], out = V.refs.filter(r => r.ft === tn), inc = d.incoming.filter(r => r.tt === tn), local = V.refs.filter(r => r.tt === tn && r.ts === S.svc && r.ft !== tn);
  const props = propsFor(S.svc).filter(p => p.table === tn);
  setTimeout(() => fillNoteForm(S.svc, tn), 0);
  return `<p class="kind">Table · ${esc(S.svc)}</p><h3 class="mono">${esc(tn)}</h3>
   <div class="chips">${t.proposed ? `<span class="chip prop">proposed</span>` : `<span class="chip">${esc(t.cls)}</span>`}<span class="chip">${t.cols.length} columns</span>${t.status ? `<span class="chip warn">${esc(t.status)}</span>` : ""}</div>
   ${t.file ? `<dl class="rows"><dt>Source</dt><dd class="mono">${esc(t.file)}</dd>${t.ext ? `<dt>Extends</dt><dd class="mono">${esc(t.ext)}</dd>` : ""}</dl>` : ""}
   <div><h4>Points to</h4>${out.length ? `<ul>${out.map(r => refLi(r)).join("")}</ul>` : "<p class='muted' style='margin:0'>Nothing.</p>"}</div>
   <div><h4>Pointed at by (this service)</h4>${local.length ? `<ul>${local.map(r => `<li><button class="lnk" data-go="${esc(S.svc)}|${esc(r.ft)}|${esc(r.fc)}">${esc(r.ft)}.${esc(r.fc)}</button></li>`).join("")}</ul>` : "<p class='muted' style='margin:0'>Nothing.</p>"}</div>
   <div><h4>Pointed at by (other services)</h4>${inc.length ? `<ul class="list">${inc.map(r => `<li><button class="lnk" data-go="${esc(r.fs)}|${esc(r.ft)}|${esc(r.fc)}">${esc(r.fs)}.${esc(r.ft)}.${esc(r.fc)}</button>${r.kind === "poly" ? " <span class='muted'>(polymorphic)</span>" : ""}</li>`).join("")}</ul>` : "<p class='muted' style='margin:0'>Nothing.</p>"}</div>
   ${props.length ? `<div><h4>Proposals</h4><ul>${props.map(p => `<li><button class="lnk" data-prop="${esc(p.id)}">${esc(propLabel(p))}</button> <span class="muted">${esc(p.state)}</span></li>`).join("")}</ul></div>` : ""}
   ${noteBlock(S.svc, tn)}
   ${canEdit() ? `<button class="btn prop" data-act="proposeHere" data-table="${esc(tn)}">Propose a column or reference here</button>` : ""}`;
}
function refLi(r) {
  if (r.kind === "poly") return `<li><span class="mono">${esc(r.fc)}</span> → one of ${r.poly.length ? r.poly.map(p => `<button class="lnk" data-go="${esc(p[0])}|${esc(p[1])}|">${esc(p[0])}.${esc(p[1])}</button>`).join(", ") : "an unknown table"} <span class="muted">(polymorphic)</span></li>`;
  const kind = r.kind === "fk" ? "JPA " + (r.rel || "FK") + (r.implicit ? ", default column name" : "") : r.kind === "xs" ? "other service, no FK" : r.inferred ? "no FK, target inferred from name" : "no FK";
  return `<li><span class="mono">${esc(r.fc)}</span> → <button class="lnk" data-go="${esc(r.ts)}|${esc(r.tt)}|${esc(r.tc)}">${r.ts !== S.svc ? esc(r.ts) + "." : ""}${esc(r.tt)}.${esc(r.tc)}</button> <span class="muted">(${esc(kind)}${r.proposed ? ", proposed" : ""})</span></li>`;
}
function columnCard(tn, cn) {
  const t = V.tables.find(x => x.t === tn); const c = t && t.cols.find(x => x.c === cn); if (!c) return tableCard(tn);
  const r = V.refs.find(x => x.ft === tn && x.fc === cn), d = S.data[S.svc];
  const incOther = d.incoming.filter(x => x.tt === tn && (x.tc === cn || (!x.tc && c.pk))), incLocal = V.refs.filter(x => x.ts === S.svc && x.tt === tn && x.tc === cn);
  setTimeout(() => fillNoteForm(S.svc, tn, cn), 0);
  return `<p class="kind">Column · ${esc(S.svc)}.${esc(tn)}</p><h3 class="mono">${esc(cn)}</h3>
   <div class="chips"><span class="chip">${esc(ErdCore.sqlType(c))}</span><span class="chip">Java ${esc(c.t)}</span>${c.pk ? `<span class="chip ok">primary key</span>` : ""}${c.nn ? `<span class="chip">not null</span>` : ""}${c.uq ? `<span class="chip">unique</span>` : ""}${c.inh ? `<span class="chip">inherited · ${esc(c.inh)}</span>` : ""}${c.proposed ? `<span class="chip prop">proposed</span>` : ""}</div>
   ${c.f ? `<dl class="rows"><dt>Java field</dt><dd class="mono">${esc(c.f)}</dd></dl>` : ""}
   ${r ? `<div><h4>Points to</h4><ul>${refLi(r)}</ul></div>` : ""}
   ${incLocal.length + incOther.length ? `<div><h4>Pointed at by</h4><ul class="list">${incLocal.map(x => `<li><button class="lnk" data-go="${esc(S.svc)}|${esc(x.ft)}|${esc(x.fc)}">${esc(x.ft)}.${esc(x.fc)}</button></li>`).join("")}${incOther.map(x => `<li><button class="lnk" data-go="${esc(x.fs)}|${esc(x.ft)}|${esc(x.fc)}">${esc(x.fs)}.${esc(x.ft)}.${esc(x.fc)}</button></li>`).join("")}</ul></div>` : ""}
   ${noteBlock(S.svc, tn, cn)}`;
}
function incomingCard(tn) { const inc = S.data[S.svc].incoming.filter(r => r.tt === tn);
  return `<p class="kind">Incoming references</p><h3 class="mono">${esc(S.svc)}.${esc(tn)}</h3><p class="muted" style="margin:0;font-size:.86rem">${inc.length} column(s) in other services hold an id of this table. None has a database foreign key.</p><ul class="list">${inc.map(r => `<li><button class="lnk" data-go="${esc(r.fs)}|${esc(r.ft)}|${esc(r.fc)}">${esc(r.fs)}.${esc(r.ft)}.${esc(r.fc)}</button></li>`).join("")}</ul>`; }
function polyCard(p) { const [tn, cn] = p; const r = V.refs.find(x => x.ft === tn && x.fc === cn);
  return `<p class="kind">Polymorphic reference</p><h3 class="mono">${esc(tn)}.${esc(cn)}</h3><p style="margin:0;font-size:.88rem">This id points to a different table depending on a level column next to it in the same row. It cannot have a foreign key.</p><ul>${r && r.poly.length ? r.poly.map(x => `<li><button class="lnk" data-go="${esc(x[0])}|${esc(x[1])}|">${esc(x[0])}.${esc(x[1])}</button></li>`).join("") : "<li>Target unknown: no level column found.</li>"}</ul>${noteBlock(S.svc, tn, cn)}`; }
function bundleCard(b) { const [a, c] = b, list = S.idx.xrefs.filter(x => x[0] === a && x[3] === c);
  return `<p class="kind">Cross-service references</p><h3>${esc(a)} → ${esc(c)}</h3><p class="muted" style="margin:0;font-size:.86rem">${list.length} column(s) in ${esc(a)} hold an id that lives in ${esc(c)}. There is no foreign key; the services keep them consistent in code.</p>
   <ul class="list">${list.map(x => `<li><button class="lnk" data-go="${esc(x[0])}|${esc(x[1])}|${esc(x[2])}">${esc(x[1])}.${esc(x[2])}</button> → <button class="lnk" data-go="${esc(x[3])}|${esc(x[4])}|${esc(x[5])}">${esc(x[4])}.${esc(x[5])}</button></li>`).join("")}</ul>`; }
function proposalCard(id) {
  const p = S.props.find(x => x.id === id); if (!p) return `<p class="muted">This proposal was removed.</p>`;
  return `<p class="kind">Proposal · ${esc(p.svc)}</p><h3>${esc(propLabel(p))}</h3><div class="chips"><span class="chip ${p.state === "done" ? "ok" : "prop"}">${esc(p.state)}</span>${p.type ? `<span class="chip">${esc(p.type)}</span>` : ""}</div>
   ${p.note ? `<div class="note" id="propNote"></div>` : ""}<p class="muted" style="font-size:.78rem;margin:0">by <span data-uid="${esc(p.by || "")}">someone</span>${p.at ? " · " + new Date(p.at).toLocaleDateString() : ""}</p>
   <div class="row2"><button class="btn" data-go="${esc(p.svc)}|${esc(p.table)}|${esc(p.col || "")}">Show in ERD</button>${canEdit() ? `<button class="btn" data-act="toggleProp" data-id="${esc(p.id)}">${p.state === "done" ? "Reopen" : "Mark done (now in code)"}</button><button class="btn" data-act="delProp" data-id="${esc(p.id)}">Delete</button>` : ""}</div>`;
}
function proposeCard(s) {
  const svcs = Object.keys(S.idx.services), tables = V.tables.map(t => t.t);
  return `<p class="kind">Propose a change · ${esc(S.svc)}</p><h3>New table, column or reference</h3><p class="muted" style="margin:0;font-size:.85rem">Proposals show dashed in purple until the code catches up; then mark them done.</p>
   <div class="form"><label>Kind<select id="pKind"><option value="column">Column on a table</option><option value="table">New table</option><option value="ref">Reference from a column</option></select></label>
   <label>Table<input id="pTable" list="pTables" value="${esc(s.table || "")}" placeholder="e.g. bom_lines" autocomplete="off"></label><datalist id="pTables">${tables.map(t => `<option value="${esc(t)}">`).join("")}</datalist>
   <label id="lCol">Column<input id="pCol" placeholder="e.g. component_sku_id" autocomplete="off"></label>
   <label id="lType">Java type<select id="pType">${TYPES.map(t => `<option>${t}</option>`).join("")}</select></label>
   <div id="refBox" hidden><label>Points to service<select id="pTs">${svcs.map(x => `<option ${x === S.svc ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Points to table<select id="pTt"></select></label></div>
   <label>Why (note)<textarea id="pNote" maxlength="2000" placeholder="What this is for"></textarea></label>
   <div class="row2"><button class="btn primary" data-act="saveProp">Save proposal</button><button class="btn" data-act="cancel">Cancel</button></div></div>`;
}
function exportCard() {
  return `<p class="kind">Export</p><h3>Copy or download the ERD</h3><p class="muted" style="margin:0;font-size:.85rem">Includes notes, status and open proposals. DBML opens in dbdiagram.io; the SQL is PostgreSQL DDL; Mermaid renders in GitLab and VS Code.</p>
   <div class="form"><label>Format<select id="xFmt"><option value="dbml">DBML</option><option value="sql">PostgreSQL DDL</option><option value="mermaid">Mermaid</option></select></label>
   <label>Scope<select id="xScope"><option value="svc">${esc(S.svc)}-service only</option><option value="all">All services (with cross-service references)</option></select></label>
   <div class="row2"><button class="btn primary" data-act="genExport">Generate</button><button class="btn" data-act="copyExport">Copy</button>${S.downloads ? `<button class="btn" data-act="dlExport">Download</button>` : ""}</div>
   <textarea class="export" id="xOut" readonly aria-label="Export output"></textarea></div>`;
}
async function resolveNames() {
  const els = [...document.querySelectorAll("#card [data-uid]")].filter(e => e.dataset.uid); if (!els.length || !S.user) return;
  const ids = [...new Set(els.map(e => e.dataset.uid))]; const ps = await S.user.profiles(ids);
  els.forEach(e => { const p = ps[e.dataset.uid]; e.textContent = p && p.isMe ? "you" : (p && p.name) || "someone"; });
  const pn = $("propNote"); if (pn && S.sel && S.sel.prop) { const p = S.props.find(x => x.id === S.sel.prop); if (p) pn.textContent = p.note || ""; }
}

/* ---------------- export ---------------- */
async function genExport() {
  const fmt = $("xFmt").value, scope = $("xScope").value, out = $("xOut"); out.value = "Generating…";
  let text = "";
  if (scope === "svc") { const v = merged(S.svc); text = fmt === "dbml" ? ErdCore.dbml(v) : fmt === "sql" ? ErdCore.sql(v) : ErdCore.mermaid(v); }
  else { const svcs = Object.keys(S.idx.services); await Promise.all(svcs.map(loadSvc)); const known = new Set(); svcs.forEach(s => Object.keys(S.idx.services[s].tables).forEach(t => known.add(s + "." + t)));
    S.props.filter(p => p.kind === "table" && p.state !== "done").forEach(p => known.add(p.svc + "." + p.table));
    text = svcs.map(s => { const v = merged(s); return fmt === "dbml" ? ErdCore.dbml(v, { all: true, known }) : fmt === "sql" ? ErdCore.sql(v) : "## " + s + "\n\n" + ErdCore.mermaid(v); }).join("\n"); }
  out.value = text; out.dataset.name = "unipos-" + (scope === "svc" ? S.svc : "all") + (fmt === "dbml" ? ".dbml.txt" : fmt === "sql" ? ".sql.txt" : "-erd.md");
}
async function copyExport() { const out = $("xOut"); if (!out.value) await genExport();
  try { await navigator.clipboard.writeText(out.value); S.msg = "Copied."; } catch (e) { out.focus(); out.select(); S.msg = "Press Ctrl+C (⌘C) to copy the selected text."; }
  const m = document.querySelector("#card .msg"); if (m) m.textContent = S.msg; else $("card").insertAdjacentHTML("beforeend", `<p class="msg">${esc(S.msg)}</p>`); }
async function dlExport() { const out = $("xOut"); if (!out.value) await genExport();
  try { await S.downloads.save({ filename: out.dataset.name || "unipos-erd.txt", data: out.value }); } catch (e) { const m = e && e.code === "declined" ? "Download cancelled." : "Downloads aren't available here; use Copy."; $("card").insertAdjacentHTML("beforeend", `<p class="msg">${esc(m)}</p>`); } }

/* ---------------- events ---------------- */
function go(spec) { const [s, t, c] = spec.split("|"); if (!S.idx.services[s]) return; open("svc", s, null, { t, c: c || null }); }
document.addEventListener("click", e => {
  const svg = e.target.closest("svg"); if (svg && svg.dataset.moved === "1") { svg.dataset.moved = ""; return; }
  const a = e.target.closest("[data-svc]"); if (a && !e.target.closest("#card")) { open("svc", a.dataset.svc); return; }
  const g = e.target.closest("[data-go]"); if (g) { go(g.dataset.go); return; }
  const bu = e.target.closest("[data-bundle]"); if (bu) { S.sel = { bundle: bu.dataset.bundle.split(">") }; if (S.view === "home") renderHome(); refreshCard(); return; }
  const pr = e.target.closest("[data-prop]"); if (pr) { S.sel = { prop: pr.dataset.prop }; refreshCard(); return; }
  const fo = e.target.closest("[data-focus]"); if (fo) { zoomTo({ t: fo.dataset.focus }); return; }
  const inc = e.target.closest("[data-inc]"); if (inc) { S.sel = { inc: inc.dataset.inc }; refreshCard(); return; }
  const po = e.target.closest("[data-poly]"); if (po) { S.sel = { poly: po.dataset.poly.split("|"), t: po.dataset.poly.split("|")[0] }; S.sel.c = null; refreshCard(); return; }
  const ih = e.target.closest("[data-inh]"); if (ih) { const k = S.svc + "~" + ih.dataset.inh; S.expanded[k] = !S.expanded[k]; renderSvc(); return; }
  const cr = e.target.closest(".crow[data-c]"); if (cr) { const t = cr.closest(".box").dataset.t; S.sel = { t, c: cr.dataset.c }; renderSvc(); refreshCard(); return; }
  const act = e.target.closest("[data-act]"); if (act) { doAct(act.dataset.act, act); return; }
});
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("snode")) { e.preventDefault(); open("svc", e.target.dataset.svc); } });
document.addEventListener("change", e => {
  if (e.target.id === "pKind") syncProposeForm();
  if (e.target.id === "pTs") fillTargetTables();
});
function syncProposeForm() { const k = $("pKind").value; $("lCol").hidden = k === "table"; $("lType").hidden = k !== "column"; $("refBox").hidden = k !== "ref"; if (k === "ref") fillTargetTables(); }
function fillTargetTables() { const s = $("pTs").value; $("pTt").innerHTML = Object.keys(S.idx.services[s].tables).sort().map(t => `<option>${esc(t)}</option>`).join(""); }
const NAME = /^[a-z][a-z0-9_]{0,62}$/;
function doAct(act, el) {
  if (act === "saveNote") { const k = el.closest("[data-notekey]").dataset.notekey, text = $("noteText").value.trim(), status = $("noteStatus").value;
    if (!text && !status) { S.msg = "Write a note or pick a status first."; refreshCard(); return; }
    write(() => S.db.doc("notes/" + k).set({ text, status, by: S.uid, at: now() }), "Note saved for everyone."); }
  else if (act === "delNote") { const k = el.closest("[data-notekey]").dataset.notekey; write(() => S.db.doc("notes/" + k).delete(), "Note deleted."); }
  else if (act === "proposeHere") { S.sel = { propose: 1, table: el.dataset.table }; refreshCard(); }
  else if (act === "cancel") { S.sel = null; S.msg = ""; refreshCard(); }
  else if (act === "saveProp") {
    const kind = $("pKind").value, table = $("pTable").value.trim(), col = $("pCol").value.trim(), note = $("pNote").value.trim();
    if (!NAME.test(table)) { S.msg = "Table name: lowercase letters, digits and underscores."; showMsg(); return; }
    if (kind !== "table" && !NAME.test(col)) { S.msg = "Column name: lowercase letters, digits and underscores."; showMsg(); return; }
    const doc = { svc: S.svc, kind, table, note, state: "open", by: S.uid, at: now() };
    if (kind === "column") { doc.col = col; doc.type = $("pType").value; }
    if (kind === "ref") { const ts = $("pTs").value, tt = $("pTt").value; doc.col = col; doc.to = { svc: ts, table: tt, col: (S.idx.services[ts].tables[tt] || ["id"])[0] }; }
    write(() => S.db.collection("proposals").add(doc).then(ref => { S.sel = { prop: ref.id }; }), "Proposal saved for everyone.");
  }
  else if (act === "toggleProp") { const p = S.props.find(x => x.id === el.dataset.id); if (p) write(() => S.db.doc("proposals/" + p.id).update({ state: p.state === "done" ? "open" : "done", at: now() })); }
  else if (act === "delProp") { const id = el.dataset.id; write(() => S.db.doc("proposals/" + id).delete().then(() => { S.sel = null; }), "Proposal deleted."); }
  else if (act === "genExport") genExport();
  else if (act === "copyExport") copyExport();
  else if (act === "dlExport") dlExport();
}
function showMsg() { const m = document.querySelector("#card .msg"); if (m) m.textContent = S.msg; else $("card").insertAdjacentHTML("beforeend", `<p class="msg">${esc(S.msg)}</p>`); }

/* ---------------- search ---------------- */
let INDEX = [];
function buildIndex() {
  Object.entries(S.idx.services).forEach(([s, v]) => { INDEX.push({ k: s, l: s + "-service", t: "service", go: s + "||" });
    Object.entries(v.tables).forEach(([t, cols]) => { INDEX.push({ k: t, l: s + "." + t, t: "table", go: s + "|" + t + "|" });
      cols.forEach(c => INDEX.push({ k: t + "." + c, l: s + "." + t + "." + c, t: "column", go: s + "|" + t + "|" + c })); }); });
  INDEX.forEach(x => x.kl = x.l.toLowerCase());
}
function search(q) { q = q.trim().toLowerCase(); if (q.length < 2) return []; const pri = { service: 0, table: 1, column: 2 };
  return INDEX.filter(x => x.kl.includes(q)).map(x => ({ x, r: (x.kl.split(".").pop().startsWith(q) ? 0 : 10) + pri[x.t] })).sort((a, b) => a.r - b.r || a.x.l.length - b.x.l.length).slice(0, 16).map(o => o.x); }
const qi = $("q"), qr = $("qres"); let qsel = 0, qlist = [];
qi.addEventListener("input", () => { qlist = search(qi.value); qsel = 0; qr.hidden = !qlist.length; qi.setAttribute("aria-expanded", String(!!qlist.length));
  qr.innerHTML = qlist.map((x, i) => `<li role="option" id="qo${i}" aria-selected="${i === 0}" data-i="${i}"><span class="chip">${x.t}</span><span class="mono">${esc(x.l)}</span></li>`).join(""); });
qi.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!qlist.length) return; qsel = (qsel + (e.key === "ArrowDown" ? 1 : -1) + qlist.length) % qlist.length; [...qr.children].forEach((c, i) => c.setAttribute("aria-selected", String(i === qsel))); qi.setAttribute("aria-activedescendant", "qo" + qsel); }
  else if (e.key === "Enter" && qlist[qsel]) { pick(qlist[qsel]); } else if (e.key === "Escape") qr.hidden = true; });
qr.addEventListener("mousedown", e => { const l = e.target.closest("li"); if (!l) return; e.preventDefault(); pick(qlist[+l.dataset.i]); });
qi.addEventListener("blur", () => setTimeout(() => { qr.hidden = true; }, 150));
function pick(x) { qr.hidden = true; qi.blur(); const [s, t, c] = x.go.split("|"); if (!t) open("svc", s); else open("svc", s, null, { t, c: c || null }); }

/* ---------------- boot ---------------- */
$("homeBtn").onclick = () => open("home");
$("svcSel").onchange = e => { if (e.target.value) open("svc", e.target.value); else open("home"); };
(async function boot() {
  try { S.status = await getJSON("data/status.json"); } catch (e) { S.status = null; }
  try { S.idx = await getJSON("data/index.json"); }
  catch (e) { $("canvas").innerHTML = `<p class="cap">The ERD data could not be loaded. Open this page through its claude.ai link.</p>`; return; }
  $("svcSel").innerHTML = `<option value="">Choose a service…</option>` + Object.keys(S.idx.services).map(s => `<option value="${s}">${s}-service (${Object.keys(S.idx.services[s].tables).length})</option>`).join("");
  $("sub").textContent = `Every table of every UniPOS service, drawn from the @Entity code (built ${S.idx.built}). Notes, status and proposed changes are shared with everyone who can open this page.`;
  buildIndex();
  const h = (location.hash || "").replace(/^#/, "");
  if (h && S.idx.services[h]) open("svc", h); else open("home");
  initShared();
})();
})();
