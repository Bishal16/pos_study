"""Read-only extractor: the Next.js frontend (1frontend/smartpos-web, origin/dev) -> fe.json.
Pages, which GraphQL operations each page reaches, which backend service owns each operation
(matched against data.json), API styles, auth facts. Never reads .env* files; records env var NAMES only."""
import json, os, posixpath, re, sys
from collections import Counter, defaultdict

ROOT = "/home/mahathir/Downloads/projects"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(ROOT, "1frontend", "smartpos-web")
OUT = os.path.join(HERE, "fe.json")
APP = "src/app/[locale]/"
STOP = ("src/components/ui/", "src/components/shared/", "src/lib/", "src/hooks/", "src/utils/", "src/i18n/",
        "src/components/root-layout/", "src/styles/", "src/types/", "src/actions/", "src/generated/")
KEY_FILES = [  # (path, why) — read these first
    ("src/app/[locale]/(protected)/layout.tsx", "Every logged-in page: session check, menu from the backend, sidebar + header"),
    ("src/lib/serverFetch.ts", "Main way to READ data: server-side GraphQL POST, adds token / merchant-id, caching"),
    ("src/lib/serverActionFetch.ts", "Main way to WRITE data: server action GraphQL POST + cache refresh after a mutation"),
    ("src/auth.ts", "Login: NextAuth credentials → GraphQL login → token kept in the session cookie"),
    ("src/proxy.ts", "Runs before every request: language prefix + redirect to /login when not signed in"),
    ("src/utils/getUserSession.ts", "Where token, userId and merchantId come from (merchant = env TEMP_MERCHANT_ID)"),
    ("codegen.ts", "Turns src/graphql/*.graphql into typed XxxDocument objects (needs a running backend)"),
    ("src/components/shared/data-table/SharedDataTable.tsx", "The table used by almost every list page"),
    ("src/components/shared/dialog/SharedDialog.tsx", "The create / edit pop-up used by most screens"),
    ("src/utils/sharedSchema.ts", "Reusable zod form rules (required text, required combobox …)"),
    ("src/hooks/useCommonStore.ts", "Confirm dialog, loading backdrop, combobox loading helpers"),
    ("src/i18n/messages/en", "English labels (Bangla in messages/bn)"),
]
TRACE_PAGE = "/procurement/product-procurement/purchase-request"

sys.path.insert(0, os.path.join(os.path.dirname(HERE), "sync"))
from gitsrc import GitSrc  # noqa: E402


def strip_gql_comments(s):
    return re.sub(r"#[^\n]*", "", s)


def root_fields(text, start):
    """Top-level field names of the selection set that starts at the first '{' after `start`."""
    i = text.find("{", start)
    if i < 0:
        return []
    depth, out, j, n = 0, [], i, len(text)
    paren = 0
    while j < n:
        c = text[j]
        if c == "(":
            paren += 1
        elif c == ")":
            paren -= 1
        elif paren == 0 and c == "{":
            depth += 1
        elif paren == 0 and c == "}":
            depth -= 1
            if depth == 0:
                break
        elif paren == 0 and depth == 1 and (c.isalpha() or c == "_"):
            m = re.match(r"[A-Za-z_]\w*", text[j:])
            w = m.group(0)
            prev = text[:j].rstrip()
            if not prev.endswith("...") and not prev.endswith(":"):
                out.append(w)
            # alias "a: field" -> take the real field
            rest = text[j + len(w):].lstrip()
            if rest.startswith(":"):
                m2 = re.match(r"\s*:\s*([A-Za-z_]\w*)", text[j + len(w):])
                if m2:
                    out[-1] = m2.group(1)
                    j += len(w) + m2.end()
                    continue
            j += len(w)
            continue
        j += 1
    return [w for w in out if w not in NOT_OPS]


NOT_OPS = {"on", "__typename", "boolean", "string", "number", "any", "const", "let", "return", "await", "if", "true", "false", "null"}
OP_RE = re.compile(r"\b(query|mutation)\s+([A-Za-z_]\w*)?\s*(?:\([^)]*\))?\s*\{", re.S)


def ops_in(text):
    """[(kind, docName, [root fields])] for every operation written in this text."""
    out = []
    for m in OP_RE.finditer(text):
        out.append((m.group(1), m.group(2) or "", root_fields(text, m.start())))
    return out


def resolve_import(src_file, spec, files):
    if spec.startswith("@/"):
        base = "src/" + spec[2:]
    elif spec.startswith("@protected/"):
        base = "src/app/[locale]/(protected)/" + spec[len("@protected/"):]
    elif spec.startswith("."):
        base = posixpath.normpath(posixpath.join(posixpath.dirname(src_file), spec))
    else:
        return None
    for cand in (base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"):
        if cand in files:
            return cand
    return None


IMPORT_RE = re.compile(r"""(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)""")


def main():
    g = GitSrc(REPO)
    if not g.ok():
        print("frontend: origin/dev not found", file=sys.stderr)
        return
    allf = g.files()
    want = [f for f in allf if (f.startswith("src/") and f.endswith((".ts", ".tsx", ".graphql"))) or f in ("package.json", "codegen.ts", "next.config.ts")]
    T = dict(g.read_many(want))
    fileset = set(T)

    # ---- backend op index (from the backend extractor) ----
    try:
        back = json.load(open(os.path.join(HERE, "data.json")))
    except (OSError, ValueError):
        back = {}
    owner = defaultdict(list)
    for svc, d in back.items():
        for o in d.get("ops", []):
            if svc not in owner[o["n"]]:
                owner[o["n"]].append(svc)

    # ---- operations ----
    docs = {}            # DocName -> fields   (src/graphql/*.graphql → XxxDocument)
    file_ops = {}        # file -> set(fields) written inline in that file
    gql_files = [f for f in T if f.endswith(".graphql")]
    for f in gql_files:
        for kind, name, fields in ops_in(strip_gql_comments(T[f])):
            if name:
                docs[name] = {"kind": kind, "fields": fields, "file": f}
    for f, t in T.items():
        if f.endswith((".ts", ".tsx")) and ("query" in t or "mutation" in t):
            fs = set()
            for kind, name, fields in ops_in(t):
                fs.update(fields)
            if fs:
                file_ops[f] = fs

    def doc_refs(t):
        return {m.group(1) for m in re.finditer(r"\b([A-Z]\w*?)Document\b", t) if m.group(1) in docs}

    # ---- pages ----
    pages = [f for f in allf if f.startswith(APP) and f.endswith("/page.tsx") or f == APP + "page.tsx"]
    page_dirs = {posixpath.dirname(p) for p in pages}

    def own_files(pdir):
        """Files under the page folder that don't belong to a nested page."""
        out = []
        for f in fileset:
            if f.startswith(pdir + "/") and f.endswith((".ts", ".tsx")):
                rel = f[len(pdir) + 1:]
                if "/" in rel:
                    seg = rel.split("/", 1)[0]
                    # route groups and folders holding other pages are not part of this page
                    if seg.startswith("(") or any(pd.startswith(pdir + "/" + seg) for pd in page_dirs):
                        continue
                out.append(f)
        return out

    def walk(start_files):
        seen, queue, depth = set(), [(f, 0) for f in start_files], {}
        while queue:
            f, d = queue.pop()
            if f in seen:
                continue
            seen.add(f)
            if d >= 5:
                continue
            for m in IMPORT_RE.finditer(T.get(f, "")):
                tgt = resolve_import(f, m.group(1) or m.group(2), fileset)
                if tgt and not tgt.startswith(STOP) and not (tgt.startswith(APP) and tgt.endswith("page.tsx")):
                    queue.append((tgt, d + 1))
        return seen

    def url_of(p):
        rel = posixpath.dirname(p)[len(APP):] if p != APP + "page.tsx" else ""
        segs = [s for s in rel.split("/") if s and not (s.startswith("(") and s.endswith(")"))]
        return "/" + "/".join(segs), ("protected" if "(protected)" in p else "auth" if "(auth)" in p else "public")

    out_pages = []
    for p in sorted(pages):
        url, area = url_of(p)
        files = walk([p] + own_files(posixpath.dirname(p)))
        fields, refs = set(), set()
        legacy = modern = mock = False
        token_any = False
        for f in files:
            t = T.get(f, "")
            fields |= file_ops.get(f, set())
            r = doc_refs(t)
            refs |= r
            if f.startswith("src/services/"):
                legacy = True
                if "fetch(" not in t and f not in file_ops:
                    mock = True
            if r:
                modern = True
            if "dummy-data" in t:
                mock = True
            if re.search(r"server(Action)?Fetch[\s\S]{0,200}?\btoken\b", t):
                token_any = True
        for r in refs:
            fields |= set(docs[r]["fields"])
        ops = []
        for fld in sorted(fields):
            ops.append({"op": fld, "svc": owner.get(fld, [])})
        comps = sorted(f for f in files if f != p and not f.startswith("src/services/"))
        svcs = sorted({s for o in ops for s in o["svc"]})
        parts = url.strip("/").split("/")
        out_pages.append({
            "url": url, "area": area, "file": p, "module": parts[0] if area == "protected" and parts[0] else area,
            "style": "both" if legacy and modern else "legacy" if legacy else "modern" if modern else "static",
            "mock": mock, "ops": ops, "svcs": svcs, "comps": comps[:40],
            "services": sorted(f for f in files if f.startswith("src/services/")),
            "docs": sorted({docs[r]["file"] for r in refs}), "token": token_any,
        })

    # ---- modules ----
    mods = defaultdict(lambda: {"pages": 0, "svcs": Counter(), "ops": set(), "legacy": 0, "modern": 0, "mock": 0, "unknown": set()})
    for pg in out_pages:
        m = mods[pg["module"]]
        m["pages"] += 1
        m["svcs"].update(pg["svcs"])
        m["ops"] |= {o["op"] for o in pg["ops"]}
        m["unknown"] |= {o["op"] for o in pg["ops"] if not o["svc"]}
        m["legacy"] += pg["style"] in ("legacy", "both")
        m["modern"] += pg["style"] in ("modern", "both")
        m["mock"] += pg["mock"]
    modules = {k: {"pages": v["pages"], "svcs": dict(v["svcs"].most_common()), "ops": len(v["ops"]), "legacy": v["legacy"],
                   "modern": v["modern"], "mock": v["mock"], "unknown": sorted(v["unknown"])} for k, v in mods.items()}

    # ---- stack ----
    pkg = json.loads(T.get("package.json") or (g.read("package.json") or "{}"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    pick = ["next", "react", "typescript", "tailwindcss", "@apollo/client", "next-auth", "next-intl", "zustand",
            "react-hook-form", "zod", "@tanstack/react-table", "@graphql-codegen/cli", "recharts", "lucide-react"]
    stack = {k: deps[k] for k in pick if k in deps}

    # ---- auth / API style facts (counted from code) ----
    svc_files = [f for f in T if f.startswith("src/services/")]
    public_ep = [f for f in svc_files if "NEXT_PUBLIC_GRAPHQL_ENDPOINT" in T[f]]
    facts = {
        "servicesFiles": len(svc_files),
        "browserFetchFiles": len(public_ep),
        "browserFetchWithAuth": sum(1 for f in public_ep if re.search(r"Authorization", T[f])),
        "browserFetchWithMerchant": sum(1 for f in public_ep if "merchant-id" in T[f]),
        "serverFetchFiles": sum(1 for f, t in T.items() if re.search(r"\bserverFetch\b", t) and f != "src/lib/serverFetch.ts"),
        "serverActionFetchFiles": sum(1 for f, t in T.items() if re.search(r"\bserverActionFetch\b", t) and f != "src/lib/serverActionFetch.ts"),
        "apolloHookFiles": sum(1 for t in T.values() if re.search(r"\buse(Query|Mutation|LazyQuery|SuspenseQuery)\(", t)),
        "graphqlFiles": len(gql_files),
        "graphqlOps": len(docs),
        "superAdminRefs": sum(1 for t in T.values() if "SUPER_ADMIN_ID" in t),
        "tempMerchant": "TEMP_MERCHANT_ID" in T.get("src/utils/getUserSession.ts", ""),
        "sessionMinutes": (lambda m: int(m.group(1)) * int(m.group(2)) if m else None)(re.search(r"maxAge:\s*(\d+)\s*\*\s*(\d+)\s*\*\s*60", T.get("src/lib/next-auth/auth.config.ts", "") + T.get("src/auth.ts", ""))),
        "todoSearch": sum(t.count("TODO: implement search") for t in T.values()),
        "envNames": sorted({m.group(1) for t in T.values() for m in re.finditer(r"process\.env\.([A-Z0-9_]+)", t)}),
        "tests": any(k in deps for k in ("jest", "vitest", "@playwright/test", "cypress")),
    }
    ext = Counter(os.path.splitext(f)[1] or "(none)" for f in allf)
    unknown = sorted({o["op"] for pg in out_pages for o in pg["ops"] if not o["svc"]})

    keyf = []
    for path, why in KEY_FILES:
        exists = path in fileset or any(f.startswith(path + "/") for f in allf)
        lines = T[path].count("\n") + 1 if path in T else None
        keyf.append({"path": path, "why": why, "exists": exists, "lines": lines})

    trace = next((pg for pg in out_pages if pg["url"] == TRACE_PAGE), None)
    data = {
        "head": g.head(), "stack": stack, "scripts": pkg.get("scripts", {}), "pages": out_pages, "modules": modules,
        "facts": facts, "files": len(allf), "ext": dict(ext.most_common(8)), "unknownOps": unknown, "keyFiles": keyf,
        "legacyNoAuth": sorted(f for f in public_ep if "Authorization" not in T[f])[:5],
        "localDocs": [d for d in ("CLAUDE.md", "ONBOARDING.md") if os.path.isfile(os.path.join(REPO, d))],  # existence only
        "trace": {"url": TRACE_PAGE, "page": trace, "create": next((pg for pg in out_pages if pg["url"] == TRACE_PAGE + "/create-new"), None)},
    }
    with open(OUT, "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    mapped = sum(1 for pg in out_pages for o in pg["ops"] if o["svc"])
    total = sum(len(pg["ops"]) for pg in out_pages)
    print(f"frontend {data['head']['commit']}: {len(out_pages)} pages, {len(modules)} modules, "
          f"{mapped}/{total} page-op links mapped to a service, {len(unknown)} unknown ops, "
          f"mock pages {sum(p['mock'] for p in out_pages)}")


if __name__ == "__main__":
    main()
