// Shared helpers for the UniPOS Control pages.
// Saved light/dark choice, applied before paint (same logic as theme-early.js, which the Atlas and ERD inline)
try { const t = localStorage.getItem('unipos-theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; } catch (e) {}
const PAGES = [['index', 'Home'], ['pull', 'Pull'], ['status', 'Status'], ['deploy', 'Deploy'], ['study', 'Study'], ['history', 'History']];
const PAGE_OF = { pull: 'pull', status: 'status', refresh: 'study', 'refresh-nofetch': 'study', deploy: 'deploy', build: 'deploy' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, el = document) => el.querySelector(s);

async function api(path, body) {
  const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Token': document.querySelector('meta[name="ctl-token"]')?.content || '' }, body: JSON.stringify(body) };
  const r = await fetch(path, opt);
  const j = await r.json().catch(() => ({ error: r.statusText }));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

function ago(t) {
  if (!t) return 'never';
  const d = typeof t === 'number' ? new Date(t * 1000) : new Date(t);
  const s = (Date.now() - d) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400 * 2) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
}
const when = t => t ? new Date(t * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const dur = j => j.end ? Math.round(j.end - j.start) + ' s' : '';
const label = a => ({ 'refresh-nofetch': 'refresh (no fetch)' }[a] || a);

function nav() {
  const here = (location.pathname.replace(/^\//, '').replace(/\.html$/, '') || 'index');
  const el = document.createElement('nav');
  el.className = 'top';
  el.innerHTML = `<a class="brand" href="/">UniPOS Control</a>` +
    PAGES.map(([p, t]) => `<a href="/${p === 'index' ? '' : p + '.html'}" class="${p === here ? 'on' : ''}">${t}</a>`).join('') +
    `<span class="run" id="navrun"></span><button class="theme" id="themebtn" type="button"></button>`;
  document.body.prepend(el);
  themeButton($('#themebtn'));
  if (location.protocol === 'file:') {
    // opened from disk: nothing can reach the server, so say how to open it properly
    el.querySelectorAll('a').forEach(x => { x.removeAttribute('href'); x.title = 'Open http://127.0.0.1:8770/ to use the control panel'; x.style.cursor = 'not-allowed'; });
    const n = document.createElement('div');
    n.className = 'note warn';
    n.innerHTML = 'This page was opened as a file, so it can\'t run anything. Start the control panel with <code>control/start.sh</code>, then open <a href="http://127.0.0.1:8770/">http://127.0.0.1:8770/</a>.';
    document.querySelector('main').prepend(n);
    return;
  }
  pollRunning();
}
function themeButton(b) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : mq.matches;
  const paint = () => { b.textContent = isDark() ? '☀ Light' : '☾ Dark'; b.title = `Switch to ${isDark() ? 'light' : 'dark'} mode`; };
  b.onclick = () => {
    const t = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('unipos-theme', t); } catch (e) {}
    paint();
  };
  mq.addEventListener('change', paint);
  paint();
}
async function pollRunning() {
  try {
    const h = await api('/api/history');
    const el = $('#navrun');
    if (h.runningId) {
      const a = h.runningId.replace(/^\d{8}-\d{6}-/, '');
      el.innerHTML = `<a href="/${PAGE_OF[a]}.html"><span class="spin"></span> ${esc(label(a))} running</a>`;
    } else el.textContent = '';
    window.__running = h.runningId;
  } catch (e) { }
  setTimeout(pollRunning, 4000);
}

// Runs (or re-attaches to) a job and streams its log into `logEl`.
// opts: {onText(fullText), onDone(state), cancelBtn}
async function runJob(action, body, logEl, opts = {}) {
  const { id } = await api('/api/run/' + action, body || {});
  return attachJob(id, logEl, opts);
}
async function attachJob(id, logEl, opts = {}) {
  let from = 0, text = '';
  logEl.textContent = '';
  if (opts.cancelBtn) opts.cancelBtn.onclick = async () => { try { await api('/api/cancel/' + id, {}); } catch (e) { alertNote(e.message); } };
  for (;;) {
    const s = await api(`/api/job/${id}?from=${from}`);
    if (s.text) {
      text += s.text;
      const stick = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 30;
      logEl.textContent = text;
      if (stick) logEl.scrollTop = logEl.scrollHeight;
      opts.onText?.(text, s);
    }
    from = s.next;
    if (opts.cancelBtn) opts.cancelBtn.hidden = !(s.running && s.cancellable);
    if (!s.running) { opts.onDone?.(s, text); return s; }
    await new Promise(r => setTimeout(r, 900));
  }
}
function alertNote(msg, kind = 'bad') {
  if (location.protocol === 'file:') return;  // the file:// banner already explains
  const n = document.createElement('div');
  n.className = 'note ' + kind;
  n.textContent = msg;
  $('main').prepend(n);
  setTimeout(() => n.remove(), 9000);
}

// "Title (n):" followed by "   - item" lines, as printed by pull-all.sh and status-all.sh
function parseSections(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^(\S.*?) \((\d+)\):\s*$/);
    if (m) { cur = { title: m[1], n: +m[2], items: [] }; out.push(cur); continue; }
    const it = line.match(/^\s+- (.*)$/);
    if (it && cur) cur.items.push(it[1]);
    else if (line.trim() && !/^\s/.test(line)) cur = null;
  }
  return out;
}
// ">> repo (branch)" blocks from status-all.sh
function parseRepoBlocks(text) {
  const blocks = {};
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^>> (\S+) \((.*)\)$/);
    if (m) { cur = blocks[m[1]] = { branch: m[2], lines: [] }; continue; }
    if (/^=+/.test(line) || line.startsWith('==')) cur = null;
    if (cur && line.trim()) cur.lines.push(line.replace(/^ {3}/, ''));
  }
  return blocks;
}
function kindOf(title) {
  if (/^✔/.test(title)) return 'ok';
  if (/^⚠|^↑/.test(title)) return 'warn';
  if (/^✖/.test(title)) return 'bad';
  return 'info';
}
const NICE = { 'Not pulled - local changes block it': 'Blocked by local changes', 'Not pulled - conflict / branch diverged': 'Conflict / diverged', 'Not pulled - other errors': 'Errors', 'Pulled successfully': 'Pulled' };
const plain = t => { const x = t.replace(/^[^\p{L}\p{N}]+\s*/u, ''); return NICE[x] || x; };
// "repo (note)" / "repo -> reason" / "repo: n file(s)" → [name, note]
function splitItem(i) {
  const m = i.match(/^(\S+)\s*(?:\((.*)\)|->\s*(.*)|:\s*(.*))?$/);
  return m ? [m[1], m[2] || m[3] || m[4] || ''] : [i, ''];
}
// Result cards: one per section, rows expandable when there is detail for the repo
function renderGroups(sections, detail) {
  return `<div class="gcards">${sections.map(s => {
    const k = kindOf(s.title);
    const rows = s.items.map(i => {
      const [name, note] = splitItem(i);
      const d = (s.detail || detail)?.[name];
      const chip = note ? `<span class="chip ${/updated|new commit/.test(note) ? 'c-' + k : ''}">${esc(note)}</span>` : '';
      return d && d.lines.length && !(d.lines.length === 1 && /clean/.test(d.lines[0]))
        ? `<details class="grow-d"><summary class="grow"><span class="chev">›</span><span class="nm">${esc(name)}</span>${chip}</summary><pre class="log">${esc(d.lines.join('\n'))}</pre></details>`
        : `<div class="grow"><span class="chev"></span><span class="nm">${esc(name)}</span>${chip}</div>`;
    }).join('');
    return `<section class="gcard c-${k}"><header><span class="dot"></span>${esc(plain(s.title))}<span class="cnt">${s.n}</span></header>
      <div class="rows">${rows || '<div class="empty">None</div>'}</div></section>`;
  }).join('')}</div>`;
}
function renderKpis(sections) {
  return `<div class="kpis">${sections.map(s => `<div class="kpi c-${kindOf(s.title)} ${s.n ? '' : 'zero'}"><div class="num">${s.n}</div><div class="lbl">${esc(plain(s.title))}</div></div>`).join('')}</div>`;
}

// Shared page for Pull / Status. cfg: {action, steps?, progress(text,total)→{step,done,label}, render(state,text)→Promise<html>|html}
function runPage(cfg) {
  let total = 0;
  const live = $('#live'), bar = $('#bar'), cur = $('#cur');
  const lastLine = j => j ? `Last run ${esc(ago(j.end || j.start))} · ${esc(when(j.end || j.start))}${j.end ? ' · ' + esc(dur(j)) : ''}` : 'Not run yet from this site';
  function progress(text, mode) {
    const p = cfg.progress(text, total);
    const pct = mode === 'done' ? 100 : total ? Math.min(98, Math.round(p.done / total * 100)) : 0;
    bar.style.width = pct + '%';
    bar.parentElement.classList.toggle('indet', mode !== 'done' && !p.done);
    cur.innerHTML = mode === 'done' ? '' : `<span class="pulse"></span>${esc(p.label || 'Starting…')}<span class="muted">${total ? ` · ${p.done}/${total}` : ''}</span>`;
    if (cfg.steps) $('#steps').innerHTML = cfg.steps.map((t, i) => {
      const st = mode === 'done' ? 'done' : i < p.step ? 'done' : i === p.step ? 'active' : 'pending';
      return (i ? `<i class="link ${st !== 'pending' ? 'done' : ''}"></i>` : '') + `<span class="step ${st}"><span class="n">${st === 'done' ? '✓' : i + 1}</span>${t}</span>`;
    }).join('');
  }
  async function show(s, text) {
    $('#go').disabled = false;
    live.hidden = true;
    const ok = s.job.exit === 0;
    $('#last').innerHTML = (ok ? '<span class="badge b-ok">done</span> ' : `<span class="badge b-bad">exit ${s.job.exit ?? '?'}</span> `) + lastLine(s.job);
    $('#result').innerHTML = await cfg.render(s, text);
  }
  async function go(attachId) {
    $('#go').disabled = true; $('#result').innerHTML = '';
    live.hidden = false; progress('', 'run');
    try {
      total = (await api('/api/repos')).repos.length;
      const opts = { cancelBtn: $('#cancel'), onText: t => progress(t, 'run'), onDone: show };
      attachId ? await attachJob(attachId, $('#log'), opts) : await runJob(cfg.action, {}, $('#log'), opts);
    } catch (e) { alertNote(e.message); $('#go').disabled = false; live.hidden = true; }
  }
  $('#go').onclick = () => go();
  (async () => {
    const h = await api('/api/history');
    if (h.runningId && h.runningId.endsWith('-' + cfg.action)) return go(h.runningId);
    if (new URLSearchParams(location.search).get('run') && !h.runningId) { history.replaceState(null, '', location.pathname); return go(); }
    const lastRun = [...h.history].reverse().find(x => x.action === cfg.action && !!x.dryRun === !!h.dryRun);
    // Read-only pages (Status) re-check by themselves when the saved result is old, so it never shows stale work
    const age = lastRun ? (Date.now() - new Date(lastRun.end || lastRun.start)) / 60000 : Infinity;
    if (cfg.autoRunAfterMin && age > cfg.autoRunAfterMin && !h.runningId) return go();
    $('#last').innerHTML = lastLine(lastRun);
    if (lastRun) await attachJob(lastRun.id, $('#log'), { onDone: show });
  })().catch(e => alertNote(e.message));
}

// Minimal markdown: headings, tables, lists, paragraphs, **bold**, `code`
function md(src) {
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const lines = src.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>${inline(l.slice(n + 1))}</h${n}>`); }
    else if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      out.push('<div class="scroll"><table><tr>' + cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr>' +
        rows.slice(2).map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table></div>');
    }
    else if (/^- /.test(l)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      i--;
      out.push('<ul>' + items.map(x => `<li>${inline(x)}</li>`).join('') + '</ul>');
    }
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('\n');
}

document.addEventListener('DOMContentLoaded', nav);
