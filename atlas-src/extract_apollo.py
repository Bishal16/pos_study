"""Read-only extractor: the Apollo gateway (apollo-server, origin/dev) -> apollo.json.
Stack, source files and which are reachable from Server.ts, the discovery filter, forwarded headers, how each service
registers in Consul (from its properties), which types are shared across subgraphs (from its schema files).
Terraform: only a short list of non-secret keys is read. Never reads .env files; env var NAMES come from .env.example.
Live block (best effort, GET only): dev Consul health + the gateway's root field count; the previous one is kept when unreachable.
Compose block: origin/dev's schemas composed locally (compose_check.cjs), to catch a change that would freeze the supergraph."""
import json, os, posixpath, re, shutil, subprocess, sys, tempfile, urllib.request
from datetime import datetime

ROOT = "/home/mahathir/Downloads/projects"
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "sync"))
from gitsrc import GitSrc  # noqa: E402

REPO = os.path.join(ROOT, "apollo-server")
OUT = os.path.join(HERE, "apollo.json")
SERVICES = ["authentication", "authorization", "configuration", "product", "customer", "purchase", "approval", "inventory", "sales",
            "policy", "promotion", "payment", "order", "accounts", "vat", "report", "compliance", "notification"]
CONSUL, GATEWAY = "http://192.168.20.190:8500", "http://192.168.20.190:4000/graphql"
TF_KEYS = ("PORT", "SERVICE_DISCOVERY", "INTROSPECTION_POLL_INTERVAL", "CONSUL_HOST", "NODE_ENV", "container_name", "host_port")


def source_files(g):
    """Every file under app/src with its line count and whether Server.ts reaches it through imports."""
    paths = [f for f in g.files("app/src/") if f.endswith(".ts")]
    text = dict(g.read_many(paths))
    seen, todo = set(), ["app/src/Server.ts"]
    while todo:
        f = todo.pop()
        if f in seen or f not in text:
            continue
        seen.add(f)
        for m in re.finditer(r"from\s+\"(\.[^\"]+)\"", text[f]):
            todo.append(posixpath.normpath(posixpath.join(posixpath.dirname(f), m.group(1))) + ".ts")
    return [{"f": f[len("app/src/"):], "lines": len(text.get(f, "").splitlines()), "used": f in seen} for f in paths], text


def service_row(s):
    g = GitSrc(os.path.join(ROOT, s + "-service"))
    if not g.ok():
        return {"id": s, "missing": True}, []
    files = g.files()
    # classpath:/config/ wins over classpath:/, as Spring Boot loads them
    p = next((f for f in files if f.endswith("resources/config/application.properties")), None) or \
        next((f for f in files if f.endswith("resources/application.properties")), "")
    prop = {}
    for line in g.read(p).splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if k.startswith(("spring.application.name", "spring.cloud.consul.discovery", "spring.graphql.path", "spring.profiles.active")):
                prop[k.strip()] = v.strip()
    d = "spring.cloud.consul.discovery."
    name = prop.get(d + "service-name") or prop.get("spring.application.name", "")
    schema = [f for f in files if f.startswith("src/main/resources/schema/") and f.endswith(".graphqls")]
    types = []
    for _, sdl in g.read_many(schema):
        for m in re.finditer(r"^\s*(extend\s+)?type\s+(\w+)([^{\n]*)", sdl, re.M):
            if m.group(2) not in ("Query", "Mutation"):
                types.append((m.group(2), bool(m.group(1)) or "@extends" in m.group(3), "@key" in m.group(3)))
    return {"id": s, "app": name, "consul": re.sub(r"[^A-Za-z0-9-]", "-", name),   # Spring Cloud Consul normalises the name for DNS
            "deployment": prop.get(d + "metadata.deployment", ""), "environment": prop.get(d + "metadata.environment", ""),
            "heartbeat": prop.get(d + "heartbeat.enabled") == "true", "dereg": prop.get(d + "deregister-critical-service-after", ""),
            "health": prop.get(d + "health-check-path", ""), "path": prop.get("spring.graphql.path", ""),
            "profile": prop.get("spring.profiles.active", ""), "keys": len({t[0] for t in types if t[2]})}, types


def compose():
    """Compose origin/dev's real schemas with the gateway's own library. Needs node + apollo-server/app/node_modules; keeps the last result otherwise."""
    prev = None
    try:
        prev = json.load(open(OUT)).get("compose")
    except (OSError, ValueError):
        pass
    mods, node = os.path.join(REPO, "app", "node_modules"), shutil.which("node")
    if not node or not os.path.isdir(os.path.join(mods, "@apollo", "composition")):
        print("compose check skipped: node or node_modules missing", file=sys.stderr)
        return prev
    with tempfile.TemporaryDirectory() as tmp:
        for s in SERVICES:
            g = GitSrc(os.path.join(ROOT, s + "-service"))
            with open(os.path.join(tmp, s + ".graphql"), "w") as fh:
                fh.write("\n".join(t for _, t in g.read_many([f for f in g.files("src/main/resources/schema/") if f.endswith(".graphqls")])))
        r = subprocess.run([node, "--max-old-space-size=3000", os.path.join(HERE, "compose_check.cjs"), tmp, mods], capture_output=True, text=True, timeout=540)
    if r.returncode:
        print("compose check failed:", r.stderr[-300:], file=sys.stderr)
        return prev
    return dict(json.loads(r.stdout), at=datetime.now().isoformat(timespec="minutes"))


def live(filt):
    prev = None
    try:
        prev = json.load(open(OUT)).get("live")
    except (OSError, ValueError):
        pass
    get = lambda u: json.load(urllib.request.urlopen(u, timeout=5))
    try:
        out = {"at": datetime.now().isoformat(timespec="minutes"), "services": {}}
        for n in sorted(get(f"{CONSUL}/v1/catalog/services")):
            if n == "consul":
                continue
            passing = get(f"{CONSUL}/v1/health/service/{n}?passing=true")
            ok = [x["Service"] for x in passing if all((x["Service"].get("Meta") or {}).get(k) == v for k, v in filt.items())]
            addrs = [x["Address"] for x in ok]
            out["services"][n] = {"total": len(get(f"{CONSUL}/v1/health/service/{n}")), "usable": len(ok), "first": addrs[0] if addrs else "",
                                  "outside": sorted({a for a in addrs if not a.startswith("172.")})}
        req = urllib.request.Request(GATEWAY, data=json.dumps({"query": "{__schema{queryType{fields{name}} mutationType{fields{name}}}}"}).encode(),
                                     headers={"content-type": "application/json"})
        sch = json.load(urllib.request.urlopen(req, timeout=15))["data"]["__schema"]
        out["rootFields"] = sum(len(sch[t]["fields"]) for t in ("queryType", "mutationType") if sch[t])
        return out
    except Exception as e:  # off the office network / VPN: keep the last good snapshot
        print("live check skipped:", type(e).__name__, file=sys.stderr)
        return prev


def main():
    g = GitSrc(REPO)
    if not g.ok():
        sys.exit("apollo-server: origin/dev not found")
    src, text = source_files(g)
    h = g.head()
    pkg = json.loads(g.read("app/package.json"))
    keep = ("@apollo/gateway", "@apollo/server", "@apollo/composition", "express", "graphql", "undici", "multer", "winston")
    tfv = g.read("IaC/terraform/environments/dev/terraform.tfvars")
    dev = {k: (re.search(rf"^\s*{k}\s*=\s*\"?([^\"\n]*)", tfv, re.M) or [None, ""])[1].strip() for k in TF_KEYS}
    reg = text["app/src/discovery/ConsulServiceRegistry.ts"]
    filt = dict(re.findall(r"Meta\?\.(\w+)\s*===\s*\"(\w+)\"", reg))
    ds = text["app/src/datasource/AuthenticatedDataSource.ts"]
    forwarded = re.findall(r"\"([\w-]+)\"", re.search(r"FORWARDED_HEADERS\s*=\s*\[(.*?)\]", ds, re.S).group(1))
    rows, types = [], {}
    for s in SERVICES:
        r, ts = service_row(s)
        rows.append(r)
        for name, ext, key in ts:
            types.setdefault(name, {"owner": set(), "ext": set()})["ext" if ext else "owner"].add(s)
    shared = [{"t": t, "owner": sorted(v["owner"]), "ext": sorted(v["ext"])} for t, v in sorted(types.items()) if v["ext"]]
    shared.sort(key=lambda x: (-len(x["ext"]), x["t"]))
    data = {"head": {"commit": h.get("commit"), "date": h.get("date"), "author": h.get("author"), "subject": h.get("subject")},
            "stack": {k: pkg["dependencies"][k] for k in keep if k in pkg["dependencies"]}, "node": pkg.get("engines", {}).get("node", ""),
            "files": src, "env": re.findall(r"^([A-Z][A-Z0-9_]+)=", g.read("app/.env.example"), re.M), "dev": dev,
            "filter": filt, "forwarded": forwarded, "services": rows, "shared": shared,
            "live": live(filt), "compose": compose()}
    json.dump(data, open(OUT, "w"), separators=(",", ":"))
    print(f"apollo {data['head']['commit']}: {len(src)} source files ({sum(not f['used'] for f in src)} not reachable), "
          f"{len(rows)} services, {len(shared)} extended types, live={'yes' if data['live'] else 'no'}, composes={(data['compose'] or {}).get('ok')}")


if __name__ == "__main__":
    main()
