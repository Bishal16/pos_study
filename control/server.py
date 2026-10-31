#!/usr/bin/env python3
"""UniPOS Control Panel: local site that runs a fixed set of scripts.

    python3 -I control/server.py            # http://127.0.0.1:8770
    CONTROL_DRY_RUN=1 python3 -I ...         # deploy only echoes what it would run

Listens on 127.0.0.1 only. The browser sends an action name, never a command.
POSTs need the per-start token that is injected into the pages.
"""
import glob, json, os, re, secrets, shutil, signal, subprocess, sys, threading, time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("CONTROL_PORT", "8770"))
HERE = os.path.dirname(os.path.abspath(__file__))
STUDY = os.path.dirname(HERE)
PROJECTS = os.path.dirname(STUDY)
WEB = os.path.join(HERE, "web")
RUNS = os.path.join(HERE, "runs")
HISTORY = os.path.join(RUNS, "history.json")
DEPLOY = os.path.join(PROJECTS, "deploy-script", "deploy")
DRY_RUN = os.environ.get("CONTROL_DRY_RUN") == "1"
TOKEN = secrets.token_urlsafe(24)
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
STATIC = {"/atlas": os.path.join(STUDY, "atlas-src", "index.html"),
          "/erd": os.path.join(STUDY, "erd-src", "out", "index.html")}
MASK = re.compile(r"(?i)\b(pass|password|passwd|pwd|token|secret)(\s*[=:]\s*)\S+")
CANCELLABLE = {"pull", "status", "refresh", "refresh-nofetch"}
os.makedirs(RUNS, exist_ok=True)


def mask(line):
    return MASK.sub(lambda m: m.group(1) + m.group(2) + "***", line)


def git(repo, *args):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, timeout=20)
    return r.stdout.strip() if r.returncode == 0 else None


def repos():
    """Same discovery as pull-all.sh / status-all.sh: */.git and */*/.git."""
    out = []
    for gitdir in sorted(glob.glob(os.path.join(PROJECTS, "*", ".git")) + glob.glob(os.path.join(PROJECTS, "*", "*", ".git"))):
        if os.path.isdir(gitdir):
            out.append(os.path.dirname(gitdir))
    return out


def repo_info(path):
    info = {"name": os.path.relpath(path, PROJECTS)}
    info["branch"] = git(path, "rev-parse", "--abbrev-ref", "HEAD")
    head = git(path, "log", "-1", "--format=%h%x1f%cs%x1f%an%x1f%s")
    if head:
        info["commit"], info["date"], info["author"], info["subject"] = head.split("\x1f", 3)
    info["upstream"] = git(path, "rev-parse", "--abbrev-ref", "@{u}")
    if info["upstream"]:
        lr = git(path, "rev-list", "--left-right", "--count", "HEAD...@{u}")
        if lr:
            info["ahead"], info["behind"] = map(int, lr.split())
    st = git(path, "status", "--porcelain")
    info["dirty"] = len(st.splitlines()) if st else 0
    if info.get("behind"):
        inc = git(path, "log", "--format=%h %cs %an: %s", "-20", "HEAD..@{u}")
        info["incoming"] = inc.splitlines() if inc else []
    fh = os.path.join(path, ".git", "FETCH_HEAD")
    info["fetchedAt"] = datetime.fromtimestamp(os.path.getmtime(fh)).isoformat(timespec="minutes") if os.path.exists(fh) else None
    return info


def services():
    return sorted(os.path.basename(p)[:-len("-service")] for p in glob.glob(os.path.join(PROJECTS, "*-service"))
                  if os.path.isfile(os.path.join(p, "pom.xml")))


def load_history():
    try:
        with open(HISTORY) as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def last_deploy(env, svc):
    for h in reversed(load_history()):
        if h["action"] == "deploy" and h.get("dryRun", False) == DRY_RUN and h.get("args", {}).get("env") == env and h.get("args", {}).get("service") == svc:
            return h
    return None


def precheck(env, svc):
    path = os.path.join(PROJECTS, f"{svc}-service")
    info = repo_info(path)
    st = git(path, "status", "--porcelain") or ""
    info["files"] = st.splitlines()[:200]
    info["full"] = git(path, "rev-parse", "HEAD")
    info["env"], info["service"] = env, svc
    info["lastDeploy"] = last_deploy(env, svc)
    info["tools"] = {t: bool(shutil.which(t)) for t in ("mvn", "sshpass")}
    info["deployScript"] = os.access(DEPLOY, os.X_OK)
    info["envFile"] = os.path.exists(os.path.join(PROJECTS, "deploy-script", f"pos-{env}.env"))  # existence only, never read
    info["dryRun"] = DRY_RUN
    return info


# ---------------- jobs ----------------
LOCK = threading.Lock()
JOBS = {}          # id -> job dict (this server run)
CURRENT = [None]   # id of the running job


FETCH_ALL = r"""
echo "Fetching every repo (updates remote refs only; your files are not touched)..."
for gitdir in */.git */*/.git; do
  [ -d "$gitdir" ] || continue
  repo=$(dirname "$gitdir")
  git -C "$repo" rev-parse --abbrev-ref @{u} >/dev/null 2>&1 || continue
  if out=$(GIT_TERMINAL_PROMPT=0 timeout 40 git -C "$repo" fetch --quiet 2>&1); then echo "   fetched $repo"
  else echo "   FETCH FAILED $repo: $(echo "$out" | head -n 1)"; fi
done
echo
"""


DRY_PULL = r"""
echo "[DRY RUN] nothing is pulled"
ok=()
for gitdir in */.git */*/.git; do
  [ -d "$gitdir" ] || continue
  repo=$(dirname "$gitdir")
  echo ">> Pulling $repo ($(git -C "$repo" rev-parse --abbrev-ref HEAD))"; echo "   Already up to date."; sleep 0.25
  ok+=("$repo (up to date)")
done
echo; echo "================ PULL REPORT ================"
echo; echo "✔ Pulled successfully (${#ok[@]}):"; for i in "${ok[@]}"; do echo "   - $i"; done
echo; echo "⚠ Not pulled - local changes block it (0):"
echo; echo "✖ Not pulled - conflict / branch diverged (0):"
echo; echo "✖ Not pulled - other errors (0):"
echo "============================================="
"""


def command(action, args):
    if action == "pull":
        if DRY_RUN:  # same report format as pull-all.sh, nothing pulled
            return ["bash", "-c", DRY_PULL], PROJECTS
        return ["bash", os.path.join(PROJECTS, "pull-all.sh")], PROJECTS
    if action == "status":
        # fetch first (remote refs only, working copies untouched) so "not pulled" is current, then the user's script
        return ["bash", "-c", FETCH_ALL + 'bash "$1"', "status", os.path.join(PROJECTS, "status-all.sh")], PROJECTS
    if action == "refresh":
        return ["bash", os.path.join(STUDY, "sync", "refresh.sh")], STUDY
    if action == "refresh-nofetch":
        return ["bash", os.path.join(STUDY, "sync", "refresh.sh"), "--no-fetch"], STUDY
    if action == "deploy":
        if DRY_RUN:
            script = ('echo "[DRY RUN] would run: deploy $1 $2"; echo "🔨 Building $2-service..."; sleep 3; '
                      'echo "📤 Uploading WAR..."; sleep 3; echo "🗑️  Terraform destroy..."; sleep 3; '
                      'echo "🚀 Terraform apply..."; sleep 3; echo "🔄 Restarting Apollo..."; sleep 2; '
                      'echo "✅ Deployment completed successfully!"')
            return ["bash", "-c", script, "dry", args["env"], args["service"]], PROJECTS
        return [DEPLOY, args["env"], args["service"]], os.path.dirname(DEPLOY)
    raise ValueError("unknown action")


def validate(action, body):
    if action in ("pull", "status", "refresh", "refresh-nofetch"):
        return {}
    if action != "deploy":
        raise ValueError("unknown action")
    svc = body.get("service", "")
    if not re.fullmatch(r"[a-z]+", svc or "") or svc not in services():
        raise ValueError("unknown service")
    if action == "deploy":
        env = body.get("env")
        if env not in ("dev", "demo"):
            raise ValueError("env must be dev or demo")
        head = git(os.path.join(PROJECTS, f"{svc}-service"), "rev-parse", "HEAD")
        if not body.get("commit") or body["commit"] != head:
            raise ValueError("the service's commit changed since the pre-check; check again")
        if body.get("confirm") != svc:
            raise ValueError("type the service name to confirm")
        return {"env": env, "service": svc, "commit": head[:9]}
    raise ValueError("unknown action")


def summarize(job, text):
    a = job["action"]
    if a in ("refresh", "refresh-nofetch"):
        m = re.findall(r"UniPOS refresh: .*", text)
        return m[-1] if m else ""
    if a == "pull":
        parts = re.findall(r"^(✔ Pulled successfully|⚠ Not pulled - local changes block it|✖ Not pulled - conflict / branch diverged|✖ Not pulled - other errors) \((\d+)\):", text, re.M)
        return " · ".join(f"{t.split(' - ')[-1] if ' - ' in t else 'pulled'} {n}" for t, n in parts)
    if a == "status":
        parts = re.findall(r"^(✔ Clean|⚠ Not committed|↑ Not pushed) \((\d+)\):", text, re.M)
        return " · ".join(f"{t[2:].lower()} {n}" for t, n in parts)
    if a == "deploy":
        if job.get("stopped"):
            return "EMERGENCY STOP by user"
        return "deployed" if "Deployment completed successfully" in text else "deploy failed"
    return ""


def notify(msg):
    if shutil.which("notify-send"):
        try:
            subprocess.run(["notify-send", "UniPOS Control", msg], timeout=5)
        except Exception:
            pass


def run_job(job, argv, cwd):
    logpath = os.path.join(RUNS, job["id"] + ".log")
    env = dict(os.environ, LANG=os.environ.get("LANG", "C.UTF-8"), TERM="dumb")
    try:
        p = subprocess.Popen(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             stdin=subprocess.DEVNULL, start_new_session=True, env=env)
    except OSError as e:
        p = None
        with open(logpath, "a") as f:
            f.write(f"could not start: {e}\n")
    job["pid"] = p.pid if p else None
    if p:
        with open(logpath, "ab") as f:
            for raw in iter(p.stdout.readline, b""):
                f.write(mask(raw.decode("utf-8", "replace")).encode())
                f.flush()
        p.wait()
    job["exit"] = p.returncode if p else 127
    job["end"] = time.time()
    with open(logpath, encoding="utf-8", errors="replace") as f:
        job["summary"] = summarize(job, f.read())
    entry = {k: job[k] for k in ("id", "action", "args", "start", "end", "exit", "summary")}
    entry["dryRun"] = job.get("dryRun", False)
    with LOCK:
        hist = load_history() + [entry]
        with open(HISTORY, "w") as f:
            json.dump(hist[-200:], f, indent=1)
        CURRENT[0] = None
    ok = "OK" if job["exit"] == 0 else f"FAILED (exit {job['exit']})"
    notify(f"{job['action']} {' '.join(str(v) for v in job['args'].values())} — {ok}. {job['summary']}")


def start(action, body):
    args = validate(action, body)
    argv, cwd = command(action, args)
    with LOCK:
        if CURRENT[0]:
            cur = JOBS[CURRENT[0]]
            raise RuntimeError(f"busy: {cur['action']} is running")
        jid = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + action
        job = {"id": jid, "action": action, "args": args, "start": time.time(), "end": None, "exit": None,
               "summary": "", "dryRun": DRY_RUN and action in ("deploy", "pull")}
        JOBS[jid] = job
        CURRENT[0] = jid
    open(os.path.join(RUNS, jid + ".log"), "w").close()
    threading.Thread(target=run_job, args=(job, argv, cwd), daemon=True).start()
    return job


def job_state(jid, offset):
    if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[a-z-]+", jid):
        raise ValueError("bad id")
    path = os.path.join(RUNS, jid + ".log")
    if not os.path.exists(path):
        raise FileNotFoundError
    job = JOBS.get(jid) or next((h for h in load_history() if h["id"] == jid), None) or {"id": jid}
    with open(path, "rb") as f:
        f.seek(offset)
        chunk = f.read()
    return {"job": {k: v for k, v in job.items() if k != "pid"}, "text": chunk.decode("utf-8", "replace"),
            "next": offset + len(chunk), "running": job.get("end") is None and jid in JOBS,
            "cancellable": job.get("action") in CANCELLABLE, "stoppable": job.get("action") == "deploy"}


def cancel(jid, body):
    job = JOBS.get(jid)
    if not job or job.get("end") is not None:
        raise ValueError("not running")
    if job["action"] == "deploy":
        if body.get("emergency") is not True:
            raise ValueError("a deploy can only be stopped with the emergency stop")
        job["stopped"] = True
        with open(os.path.join(RUNS, jid + ".log"), "a") as f:
            f.write(f"\n⛔ EMERGENCY STOP by user at {datetime.now():%H:%M:%S}. Local deploy process killed; "
                    "commands already sent to the server may still finish or be left half-done. Check the service on the server.\n")
    elif job["action"] not in CANCELLABLE:
        raise ValueError("cannot be cancelled")
    pgid = job["pid"]
    os.killpg(pgid, signal.SIGTERM)

    def hard_kill():
        time.sleep(4)
        try:
            os.killpg(pgid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    threading.Thread(target=hard_kill, daemon=True).start()


def study():
    def load(p):
        try:
            with open(p) as f:
                return json.load(f)
        except (OSError, ValueError):
            return None
    st = load(os.path.join(STUDY, "sync", "status.json")) or {}
    reports = sorted(glob.glob(os.path.join(STUDY, "sync", "reports", "*.md")))
    text = open(reports[-1], encoding="utf-8").read() if reports else ""
    return {"generatedAt": st.get("generatedAt"), "fetchOk": st.get("fetchOk"), "fetchSkipped": st.get("fetchSkipped"),
            "counts": st.get("counts"), "drift": st.get("drift"), "since": (st.get("changes") or {}).get("since"),
            "history": (st.get("history") or [])[:10], "published": load(os.path.join(STUDY, "sync", "published.json")),
            "report": text, "reportName": os.path.basename(reports[-1]) if reports else None}


# ---------------- http ----------------
class H(BaseHTTPRequestHandler):
    server_version = "UniPOSControl"

    def log_message(self, fmt, *a):
        pass

    def send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else (json.dumps(body) if not isinstance(body, str) else body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.end_headers()
        self.wfile.write(data)

    def guard(self):
        if self.headers.get("Host") not in ALLOWED_HOSTS:
            self.send(403, {"error": "bad host"})
            return False
        return True

    def do_GET(self):
        if not self.guard():
            return
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/repos":
                return self.send(200, {"repos": [repo_info(r) for r in repos()], "running": CURRENT[0] and JOBS[CURRENT[0]]["action"],
                                       "runningId": CURRENT[0], "history": load_history()[-50:], "dryRun": DRY_RUN})
            if u.path == "/api/services":
                return self.send(200, {"services": services(), "dryRun": DRY_RUN})
            if u.path == "/api/precheck":
                env, svc = q.get("env"), q.get("service", "")
                if env not in ("dev", "demo") or svc not in services():
                    return self.send(400, {"error": "bad env or service"})
                return self.send(200, precheck(env, svc))
            if u.path == "/api/history":
                return self.send(200, {"history": load_history(), "runningId": CURRENT[0], "dryRun": DRY_RUN})
            if u.path == "/api/study":
                return self.send(200, study())
            if u.path.startswith("/api/job/"):
                return self.send(200, job_state(u.path[len("/api/job/"):], int(q.get("from", "0"))))
            if u.path in STATIC:
                with open(STATIC[u.path], "rb") as f:
                    return self.send(200, f.read(), "text/html; charset=utf-8")
            return self.static(u.path)
        except FileNotFoundError:
            return self.send(404, {"error": "not found"})
        except ValueError as e:
            return self.send(400, {"error": str(e)})

    def static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        if not re.fullmatch(r"[a-z]+\.(html|css|js)", name):
            return self.send(404, "not found", "text/plain")
        fp = os.path.join(WEB, name)
        with open(fp, "rb") as f:
            data = f.read()
        ctype = {"html": "text/html", "css": "text/css", "js": "text/javascript"}[name.rsplit(".", 1)[1]] + "; charset=utf-8"
        if name.endswith(".html"):
            data = data.replace(b"</head>", f'<meta name="ctl-token" content="{TOKEN}"></head>'.encode(), 1)
        self.send(200, data, ctype)

    def do_POST(self):
        if not self.guard():
            return
        if not secrets.compare_digest(self.headers.get("X-Token", ""), TOKEN):
            return self.send(403, {"error": "bad token (reload the page)"})
        u = urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}") if n < 10000 else {}
            if u.path.startswith("/api/run/"):
                job = start(u.path[len("/api/run/"):], body)
                return self.send(200, {"id": job["id"]})
            if u.path.startswith("/api/cancel/"):
                cancel(u.path[len("/api/cancel/"):], body)
                return self.send(200, {"ok": True})
            return self.send(404, {"error": "not found"})
        except RuntimeError as e:
            return self.send(409, {"error": str(e)})
        except (ValueError, KeyError) as e:
            return self.send(400, {"error": str(e)})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"UniPOS Control on http://127.0.0.1:{PORT}/" + ("  [DRY RUN: deploy only echoes]" if DRY_RUN else ""), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
