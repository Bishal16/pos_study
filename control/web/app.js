// Shared helpers for the UniPOS Control pages.
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
  el.innerHTML = `<span class="brand">UniPOS Control</span>` +
    PAGES.map(([p, t]) => `<a href="/${p === 'index' ? '' : p + '.html'}" class="${p === here ? 'on' : ''}">${t}</a>`).join('') +
    `<span class="run" id="navrun"></span>`;
  document.body.prepend(el);
  pollRunning();
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
function renderGroups(sections, detail) {
  return `<div class="groups">${sections.map(s => `
    <div class="panel group"><h3><span class="badge b-${kindOf(s.title)}">${s.n}</span> ${esc(s.title)}</h3>
    ${s.items.length ? `<ul>${s.items.map(i => {
      const repo = i.split(/[ :]/)[0];
      const d = detail?.[repo];
      return d && d.lines.length && !(d.lines.length === 1 && /clean/.test(d.lines[0]))
        ? `<li><details><summary>${esc(i)}</summary><pre class="log">${esc(d.lines.join('\n'))}</pre></details></li>`
        : `<li>${esc(i)}</li>`;
    }).join('')}</ul>` : '<span class="muted">none</span>'}</div>`).join('')}</div>`;
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
