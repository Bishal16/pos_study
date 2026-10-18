"""UniPOS daily refresh: fetch origin/dev, rebuild Atlas + Living ERD data, report changes and drift.
Never touches working copies: only `git fetch` (updates remote refs) and reads via `git cat-file`.
Run:  python3 -I sync/refresh.py      (or sync/refresh.sh, which logs)"""
import datetime, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STUDY = os.path.dirname(HERE)
ROOT = os.path.dirname(STUDY)
ATLAS, ERD = os.path.join(STUDY, "atlas-src"), os.path.join(STUDY, "erd-src")
STATE, REPORTS = os.path.join(HERE, "state"), os.path.join(HERE, "reports")
for p in (STATE, REPORTS):
    os.makedirs(p, exist_ok=True)
sys.path.insert(0, HERE)
from gitsrc import GitSrc  # noqa: E402

SERVICES = ["authentication", "authorization", "configuration", "product", "customer", "purchase", "approval", "inventory",
            "sales", "policy", "promotion", "payment", "accounts", "vat", "report", "compliance", "notification"]
REPOS = {s: os.path.join(ROOT, s + "-service") for s in SERVICES}
REPOS["frontend"] = os.path.join(ROOT, "1frontend", "smartpos-web")
NOW = datetime.datetime.now().replace(microsecond=0)
NO_FETCH = "--no-fetch" in sys.argv


def git(path, *args, timeout=90):
    try:
        r = subprocess.run(["git", "-C", path, *args], capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()
    except subprocess.TimeoutExpired:
        return 124, "", "timed out"


def load(p, default):
    try:
        with open(p) as fh:
            return json.load(fh)
    except Exception:
        return default


prev_status = load(os.path.join(HERE, "status.json"), {})
prev_repos = prev_status.get("repos", {})

# ---------- 1. fetch + heads ----------
fetch, repos = {}, {}
for name, path in REPOS.items():
    if not os.path.isdir(os.path.join(path, ".git")):
        continue
    if NO_FETCH:
        fetch[name] = {"ok": None, "msg": "skipped (--no-fetch)"}
    else:
        rc, _, err = git(path, "fetch", "--quiet", "origin", "dev")
        msg = "" if rc == 0 else (err.splitlines() or ["failed"])[-1]
        if "Could not resolve host" in msg or "Failed to connect" in msg or "timed out" in msg:
            msg = "GitLab unreachable (office network / VPN?)"
        fetch[name] = {"ok": rc == 0, "msg": msg[:160]}
    g = GitSrc(path)
    if not g.ok():
        repos[name] = {"commit": "", "missing": True}
        continue
    h = g.head()
    _, full, _ = git(path, "rev-parse", "origin/dev")
    h["full"] = full
    fh = os.path.join(path, ".git", "FETCH_HEAD")
    h["fetchedAt"] = datetime.datetime.fromtimestamp(os.path.getmtime(fh)).isoformat(timespec="minutes") if os.path.exists(fh) else ""
    prev = prev_repos.get(name, {}).get("full")
    h["new"], h["commits"] = 0, []
    if prev and prev != full:
        _, cnt, _ = git(path, "rev-list", "--count", f"{prev}..{full}")
        _, log, _ = git(path, "log", "--format=%h%x09%cs%x09%an%x09%s", f"{prev}..{full}", "-n", "15")
        h["new"] = int(cnt or 0)
        h["commits"] = [dict(zip(("c", "d", "a", "s"), l.split("\t"))) for l in log.splitlines() if l]
    repos[name] = h

# ---------- 2. rebuild data ----------
def run(*cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"FAILED: {' '.join(cmd)} in {cwd}\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}")
    return r.stdout

run("python3", "-I", "extract.py", cwd=ATLAS)
run("python3", "-I", "extract.py", cwd=ERD)
run("python3", "-I", "build.py", cwd=ERD)

code = load(os.path.join(ATLAS, "data.json"), {})
facts = load(os.path.join(ATLAS, "facts.json"), {})
raw = load(os.path.join(ERD, "raw.json"), {}).get("services", {})
schema = {s: {e["table"]: {f["c"]: f["t"] for f in e["fields"] if not f.get("virt")} for e in v["entities"]} for s, v in raw.items()}

# ---------- 3. changes since previous refresh ----------
prev_code = load(os.path.join(STATE, "atlas-prev.json"), None)
prev_schema = load(os.path.join(STATE, "schema-prev.json"), None)
changes = {"baseline": prev_code is None, "schema": [], "ops": [], "calls": [], "kafka": []}

def url_edges(d):
    out = {}
    for k, v in (d.get("urls") or {}).items():
        m = re.match(r"https?://([a-z]+)-service:(\d+)", v)
        if m:
            out[m.group(1)] = int(m.group(2))
    return out

def edges(c):
    e = set()
    for s, d in c.items():
        for t in (d.get("calls") or {}):
            e.add((s, t))
        for t in url_edges(d):
            t = {"account": "accounts", "orders": "order"}.get(t, t)
            if t != s:
                e.add((s, t))
    return e

def kafka(c):
    k = set()
    for s, d in c.items():
        for l in d.get("listen") or []:
            k.add(("listens", s, l["t"], l.get("g", "")))
        for p in d.get("produce") or []:
            k.add(("publishes", s, p, ""))
    return k

if prev_schema is not None:
    for s in sorted(set(prev_schema) | set(schema)):
        a, b = prev_schema.get(s, {}), schema.get(s, {})
        for t in sorted(set(b) - set(a)):
            changes["schema"].append([s, t, "", "table added"])
        for t in sorted(set(a) - set(b)):
            changes["schema"].append([s, t, "", "table removed"])
        for t in sorted(set(a) & set(b)):
            for c in sorted(set(b[t]) - set(a[t])):
                changes["schema"].append([s, t, c, "column added"])
            for c in sorted(set(a[t]) - set(b[t])):
                changes["schema"].append([s, t, c, "column removed"])
            for c in sorted(set(a[t]) & set(b[t])):
                if a[t][c] != b[t][c]:
                    changes["schema"].append([s, t, c, f"type {a[t][c]} → {b[t][c]}"])
if prev_code is not None:
    for s in sorted(set(prev_code) | set(code)):
        a = {o["n"] for o in (prev_code.get(s) or {}).get("ops", [])}
        b = {o["n"] for o in (code.get(s) or {}).get("ops", [])}
        for o in sorted(b - a):
            changes["ops"].append([s, o, "operation added"])
        for o in sorted(a - b):
            changes["ops"].append([s, o, "operation removed"])
    ea, eb = edges(prev_code), edges(code)
    changes["calls"] = [[a, b, "call added"] for a, b in sorted(eb - ea)] + [[a, b, "call removed"] for a, b in sorted(ea - eb)]
    ka, kb = kafka(prev_code), kafka(code)
    changes["kafka"] = [list(x) + ["added"] for x in sorted(kb - ka)] + [list(x) + ["removed"] for x in sorted(ka - kb)]

# ---------- 4. drift: hand-written Atlas facts vs code ----------
drift = []
F_S = {s["id"]: s for s in facts.get("SERVICES", [])}
for s in sorted(set(code) - set(F_S)):
    drift.append({"kind": "service", "svc": s, "msg": f"{s}-service exists in code but not in the Atlas"})
for s in sorted(set(F_S) - set(code)):
    drift.append({"kind": "service", "svc": s, "msg": f"{s}-service is in the Atlas but not found in code"})
for s, d in code.items():
    f = F_S.get(s)
    if not f:
        continue
    if d.get("port") and str(f.get("port")) != str(d["port"]):
        drift.append({"kind": "port", "svc": s, "msg": f"port is {d['port']} in code, {f.get('port')} in the Atlas"})
    if s != "order" and bool(d.get("jwt")) != (f.get("jwt") is True):
        drift.append({"kind": "jwt", "svc": s, "msg": f"{'verifies' if d.get('jwt') else 'does not verify'} the JWT in code; the Atlas says the opposite"})
    boot = [v for v in (d.get("boot") or {}).values()]
    if any("172.10.10.108" in v for v in boot) and not any("172.10.10.108" in x for x in f.get("find", [])):
        drift.append({"kind": "kafka", "svc": s, "msg": "Kafka address typo 172.10.10.108 in code is not listed in its findings"})
fe = {(a, b) for a, tos in facts.get("CALLS", {}).items() for b in tos}
ce = edges(code)
for a, b in sorted(ce - fe):
    drift.append({"kind": "call", "svc": a, "msg": f"calls {b} in code; missing from the Atlas call matrix"})
for a, b in sorted(fe - ce):
    drift.append({"kind": "call", "svc": a, "msg": f"Atlas lists a call to {b}; no client or URL found in code"})
ports = {s: int(d["port"]) for s, d in code.items() if d.get("port")}
bad_code = {}
for s, d in code.items():
    for t, p in url_edges(d).items():
        t = {"account": "accounts", "orders": "order"}.get(t, t)
        if t in ports and ports[t] != p:
            bad_code[f"{s}>{t}"] = f"configured port {p}, {t} runs on {ports[t]}"
for k in sorted(set(bad_code) - set(facts.get("BADCALLS", {}))):
    drift.append({"kind": "port", "svc": k.split(">")[0], "msg": f"wrong port {k.replace('>', ' → ')}: {bad_code[k]} (not in the Atlas)"})
for k in sorted(set(facts.get("BADCALLS", {})) - set(bad_code)):
    drift.append({"kind": "port", "svc": k.split(">")[0], "msg": f"Atlas lists a wrong port {k.replace('>', ' → ')}, but code now matches"})
f_topics = {t["id"]: t for t in facts.get("TOPICS", [])}
code_topics = {x[2] for x in kafka(code) if not x[2].startswith("${")}
for t in sorted(code_topics - set(f_topics)):
    drift.append({"kind": "kafka", "svc": "", "msg": f"topic {t} used in code; not in the Atlas topic list"})
for t, ft in f_topics.items():
    code_cons = {s for (k, s, tp, g) in kafka(code) if k == "listens" and tp == t}
    atlas_cons = {c[0] for c in ft.get("c", []) if not c[0] == "none"}
    for s in sorted(code_cons - atlas_cons):
        drift.append({"kind": "kafka", "svc": s, "msg": f"{s} listens to {t} in code; the Atlas doesn't show it"})
    for s in sorted(atlas_cons - code_cons):
        drift.append({"kind": "kafka", "svc": s, "msg": f"Atlas shows {s} listening to {t}; no listener in code"})
changed_svcs = sorted(n for n, h in repos.items() if h.get("new"))
for s in changed_svcs:
    if s in F_S:
        drift.append({"kind": "review", "svc": s, "msg": f"{repos[s]['new']} new commit(s): re-check its findings in the Atlas"})

# ---------- 5. status + report ----------
published = load(os.path.join(HERE, "published.json"), {})
fetch_ok = bool(fetch) and all(v["ok"] is True for v in fetch.values())
counts = {"commits": sum(h.get("new", 0) for h in repos.values()), "repos": len(changed_svcs) + (1 if repos.get("frontend", {}).get("new") else 0),
          "schema": len(changes["schema"]), "ops": len(changes["ops"]), "calls": len(changes["calls"]), "kafka": len(changes["kafka"]), "drift": len(drift)}
history = ([{"at": NOW.isoformat(timespec="minutes"), "fetchOk": fetch_ok, "fetchSkipped": NO_FETCH, **counts}] + prev_status.get("history", []))[:30]
status = {"generatedAt": NOW.isoformat(timespec="minutes"), "ref": "origin/dev", "fetchOk": fetch_ok, "fetchSkipped": NO_FETCH, "fetch": fetch, "repos": repos,
          "changes": changes, "counts": counts, "drift": drift, "history": history, "published": published}
json.dump(status, open(os.path.join(HERE, "status.json"), "w"), indent=1, ensure_ascii=False)
shutil.copy(os.path.join(HERE, "status.json"), os.path.join(ERD, "out", "data", "status.json"))

L = [f"# UniPOS refresh — {NOW:%Y-%m-%d %H:%M}", "",
     f"Source: `origin/dev` of every repo. Fetch: {'OK' if fetch_ok else ('**skipped (--no-fetch)**: showing code as of the last fetch' if NO_FETCH else '**FAILED for some repos — showing code as of their last successful fetch**')}.", "",
     f"**{counts['commits']} new commit(s)** in {counts['repos']} repo(s) · {counts['schema']} schema change(s) · {counts['ops']} GraphQL operation change(s) · "
     f"{counts['calls']} call change(s) · {counts['kafka']} Kafka change(s) · **{counts['drift']} item(s) to review**", ""]
if changes["baseline"]:
    L += ["_First run: this is the baseline. Changes are listed from the next run on._", ""]
L += ["## Repos", "", "| repo | origin/dev | date | new commits | fetch |", "|---|---|---|---|---|"]
for n, h in repos.items():
    f = fetch.get(n, {})
    last = (" · last OK fetch " + h["fetchedAt"].replace("T", " ")) if h.get("fetchedAt") else ""
    L.append(f"| {n} | `{h.get('commit', '')}` | {h.get('date', '')} | {h.get('new', 0)} | {'ok' if f.get('ok') else ('skipped' if f.get('ok') is None else 'FAILED: ' + f.get('msg', '') + last)} |")
for n, h in repos.items():
    if h.get("commits"):
        L += ["", f"### {n}", *[f"- `{c['c']}` {c['d']} {c['a']}: {c['s']}" for c in h["commits"]]]
for key, title in (("schema", "Schema"), ("ops", "GraphQL operations"), ("calls", "Service calls"), ("kafka", "Kafka")):
    if changes[key]:
        L += ["", f"## {title}", *["- " + " · ".join(str(x) for x in row if x) for row in changes[key]]]
L += ["", "## To review (Atlas facts vs code)"] + (["- " + (f"**{d['svc']}** " if d["svc"] else "") + d["msg"] for d in drift] or ["- Nothing: the Atlas matches the code."])
L += ["", "## Published pages", f"- Last publish: {published.get('at', 'never')} (built {published.get('generatedAt', '—')})",
      f"- This build: {status['generatedAt']} → {'already published' if published.get('generatedAt') == status['generatedAt'] else 'not published yet: ask Claude to “publish the refresh”'}"]
rp = os.path.join(REPORTS, f"{NOW:%Y-%m-%d}.md")
open(rp, "w").write("\n".join(L) + "\n")

# ---------- 6. Atlas page (embeds status) ----------
run("python3", "-I", "build.py", cwd=ATLAS)
run("python3", "-I", "build.py", cwd=ERD)   # re-embed the fresh status.json in the ERD page

# ---------- 7. remember this run ----------
shutil.copy(os.path.join(ATLAS, "data.json"), os.path.join(STATE, "atlas-prev.json"))
json.dump(schema, open(os.path.join(STATE, "schema-prev.json"), "w"), separators=(",", ":"))

summary = f"{counts['commits']} new commits · {counts['schema']} schema · {counts['ops']} ops · {counts['drift']} to review" + ("" if fetch_ok else (" · NOT FETCHED (--no-fetch)" if NO_FETCH else " · FETCH FAILED"))
print("UniPOS refresh:", summary)
print("report:", rp)
if shutil.which("notify-send") and os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
    subprocess.run(["notify-send", "UniPOS refresh", summary + "\n" + rp], capture_output=True)
