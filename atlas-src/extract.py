"""Read-only extractor: UniPOS service repos -> data.json (entities, GraphQL ops, client call ops, Kafka listeners, port/app).
Never reads property values of secret-looking keys."""
import json, os, re, subprocess, sys, zipfile

ROOT = "/home/mahathir/Downloads/projects"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
WAR = "/home/mahathir/Downloads/projects/_unipos-study/walton-infra-copy/unipos-collect-2026-10-18/order-service/order-0.0.1.war"
SERVICES = ["authentication", "authorization", "configuration", "product", "customer", "purchase", "approval",
            "inventory", "sales", "policy", "promotion", "payment", "accounts", "vat", "report", "compliance", "notification"]
URLKEY = {"inventory": "inventory", "product": "product", "configuration": "configuration", "config": "configuration",
          "purchase": "purchase", "approval": "approval", "authentication": "authentication", "auth": "authentication",
          "authorization": "authorization", "accounts": "accounts", "account": "accounts", "accounting": "accounts",
          "generalLedger": "accounts", "customer": "customer", "vat": "vat", "payment": "payment", "order": "order",
          "sales": "sales", "policy": "policy", "promotion": "promotion", "report": "report", "notification": "notification"}
SOFT = [  # field name -> (target service, meaning)
    (r"^merchantId$", "configuration", "merchant"), (r"^(salesHubId|businessAreaId|originSalesHubId|requesterSalesHubId|initiatorSalesHubId|senderSalesHubId|receiverSalesHubId|anchorSalesHubId)$", "configuration", "business area / sales hub"),
    (r"^(merchantBinId|binId)$", "configuration", "merchant BIN"), (r"^(productSkuId|skuId)$", "product", "SKU"),
    (r"^relatedId$", "product", "product level (category…SKU)"), (r"^(personId|customerId|partyRelatedId)$", "customer", "person / party"),
    (r"^(customerAccountId)$", "accounts", "customer account"), (r"^(userId|requesterUserId|assignedUserId|actionByUserId|fromUserId|toUserId|surveyerEmployeeId|followupEmployeeId)$", "authentication", "user"),
    (r"^roleId$", "authorization", "role"), (r"^(approvalId|approvalPathId|workflowId)$", "approval", "approval"),
    (r"^(deliveryProductControllerId)$", "purchase", "DO line"), (r"^(salesInvoiceId|invoiceId)$", "sales", "invoice")]
SECRET = re.compile(r"(pass|secret|key|token|credential|pwd)", re.I)


sys.path.insert(0, os.path.join(os.path.dirname(HERE), "sync"))
from gitsrc import GitSrc  # noqa: E402


class Repo:
    """Reads a service straight from origin/dev (never the working copy)."""
    def __init__(self, svc):
        self.svc, self.path = svc, os.path.join(ROOT, svc + "-service")
        self.g = GitSrc(self.path)
        self._text = None

    def files(self):
        fs = self.g.files("src/main/")
        if self._text is None:
            want = [f for f in fs if f.endswith((".java", ".graphqls", ".properties"))]
            self._text = dict(self.g.read_many(want))
        return fs

    def read(self, rel):
        if self._text is None:
            self.files()
        return self._text.get(rel, "")


def strip_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return "\n".join(l for l in src.splitlines() if not l.strip().startswith("//"))


def snake(n):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", n).lower()


FIELD = re.compile(r"^\s*(?:private|protected|public)\s+(?!static|final\s+static)(?:final\s+)?([\w<>,\s?.\[\]]+?)\s+(\w+)\s*(?:=[^;]*)?;")


def parse_entity(src):
    s = strip_comments(src)
    if "@Entity" not in s:
        return None
    m = re.search(r"\bclass\s+(\w+)(?:\s+extends\s+(\w+))?", s)
    if not m:
        return None
    cls, ext = m.group(1), m.group(2)
    tm = re.search(r"@Table\s*\([^)]*?name\s*=\s*\"([^\"]+)\"", s, re.S)
    table = tm.group(1) if tm else snake(cls)
    body = s[m.end():]
    fields, rels, ann = [], [], []
    for line in body.splitlines():
        st = line.strip()
        if st.startswith("@"):
            ann.append(st)
            continue
        fm = FIELD.match(line)
        if not fm:
            if st and not st.startswith("@") and ("(" in st and ")" in st and "{" in st):
                ann = []  # method start
            continue
        typ, name = re.sub(r"\s+", "", fm.group(1)), fm.group(2)
        a = " ".join(ann)
        ann = []
        col = None
        cm = re.search(r"@(?:Column|JoinColumn)\s*\([^)]*?name\s*=\s*\"([^\"]+)\"", a)
        if cm:
            col = cm.group(1)
        f = {"n": name, "t": typ, "c": col or snake(name)}
        if "@Id" in a.split("@IdClass")[0] and re.search(r"@Id\b", a):
            f["pk"] = 1
        rk = re.search(r"@(ManyToOne|OneToMany|OneToOne|ManyToMany)\b", a)
        if rk:
            tgt = re.sub(r"^(List|Set|Collection)<(.+)>$", r"\2", typ).split(".")[-1]
            f["rel"] = rk.group(1)
            f["to"] = tgt
            rels.append({"k": rk.group(1), "to": tgt, "f": name})
        if "@Enumerated" in a:
            f["enum"] = 1
        for pat, svc, meaning in SOFT:
            if re.match(pat, name) and "rel" not in f:
                f["soft"] = [svc, meaning]
                break
        fields.append(f)
    return {"cls": cls, "table": table, "ext": ext, "fields": fields, "rels": rels}


def parse_ops(src):
    ops = []
    s = "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))
    for m in re.finditer(r"(?:extend\s+)?type\s+(Query|Mutation)\s*\{(.*?)\n\s*\}", s, re.S):
        kind = "Q" if m.group(1) == "Query" else "M"
        for lm in re.finditer(r"^\s*(\w+)\s*(\(([^)]*)\))?\s*:\s*([\[\]\w!]+)", m.group(2), re.M):
            args = re.sub(r"\s+", " ", (lm.group(3) or "")).strip()
            ops.append({"k": kind, "n": lm.group(1), "a": args[:120], "r": lm.group(4)})
    return ops


def parse_client(src, cls):
    s = strip_comments(src)
    vk = re.search(r"\$\{([\w.-]+?)\.url\}", s)
    tgt = None
    if vk:
        tgt = URLKEY.get(vk.group(1).split(".")[-1])
    if not tgt:
        base = re.sub(r"(Service)?GraphQLClient$", "", cls)
        base = base[0].lower() + base[1:] if base else base
        tgt = URLKEY.get(base)
    ops = []
    for m in re.finditer(r"\b(query|mutation)\b\s*(?:\w+\s*)?(?:\([^)]*\))?\s*\{\s*(\w+)", s):
        if m.group(2) not in ops and m.group(2) not in ("query", "mutation"):
            ops.append(m.group(2))
    return tgt, ops


def parse_kafka(src):
    s = strip_comments(src)
    lis, prod = [], []
    for m in re.finditer(r"@KafkaListener\s*\((.*?)\)\s*\n", s, re.S):
        a = m.group(1)
        # topics = "a" | {"a", "b"} | AppConstant.A | {X.A, "b"}; constants come back as "@const:A", resolved in main()
        tm = re.search(r"topics\s*=\s*(\{[^}]*\}|\"[^\"]*\"|[\w.]+)", a)
        if re.search(r"topics\s*=", a) and not tm:
            print("warn: unparsed @KafkaListener topics:", " ".join(a.split())[:120], file=sys.stderr)
        topics = [x or "@const:" + c.split(".")[-1] for x, c in re.findall(r"\"([\w.${}:-]+)\"|\b([A-Za-z_][\w.]*[A-Z_][A-Z0-9_]*)\b", tm.group(1))] if tm else []
        g = re.search(r"groupId\s*=\s*\"([^\"]+)\"", a)
        for t in topics:
            t = re.sub(r"^\$\{[\w.-]+:([\w.-]+)\}$", r"\1", t)
            lis.append({"t": t, "g": g.group(1) if g else ""})
    for m in re.finditer(r"\.send\(\s*\"([\w.-]+)\"", s):
        prod.append(m.group(1))
    for m in re.finditer(r"\b[A-Z_]+\(\"([a-zA-Z]+(?:-[a-zA-Z]+)*-events?)\"\)", s):
        prod.append(m.group(1))
    for m in re.finditer(r"TOPIC\w*\s*=\s*\"([\w.-]+)\"", s):
        prod.append(m.group(1))
    if "@KafkaListener" not in s:
        for m in re.finditer(r"@Value\(\"\$\{([\w.-]*topic[\w.-]*)(?::([\w.-]+))?\}\"\)", s):
            prod.append(m.group(2) or "${" + m.group(1) + "}")
    return lis, prod


def props(repo, files):
    port = app = None
    urls, topics, boot = {}, {}, {}
    for f in files:
        if not re.search(r"resources/(config/)?application(-prod)?\.properties$", f):
            continue
        for line in repo.read(f).splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = [x.strip() for x in line.split("=", 1)]
            if SECRET.search(k) or "ENC(" in v:
                continue
            if k == "server.port" and not port:
                port = v
            elif k == "spring.application.name" and not app:
                app = v
            elif k.endswith(".url") and f.endswith("-prod.properties") and v.startswith("http"):
                urls[k] = v
            elif "topic" in k.lower() and re.fullmatch(r"[\w.-]+", v):
                topics[k] = v
            elif "bootstrap" in k.lower():
                boot[os.path.basename(f)] = v
    return port, app, urls, topics, boot


def main():
    data = {}
    for svc in SERVICES:
        repo = Repo(svc)
        if not os.path.isdir(repo.path):
            print("missing", svc, file=sys.stderr)
            continue
        files = repo.files()
        ents, ops, calls, lis, prod, consts = [], [], {}, [], [], {}
        for f in files:
            if f.endswith(".java"):
                src = repo.read(f)
                for m in re.finditer(r"static\s+final\s+String\s+(\w+)\s*=\s*\"([^\"]+)\"", src):
                    consts.setdefault(m.group(1), m.group(2))
                if "@Entity" in src:
                    e = parse_entity(src)
                    if e:
                        ents.append(e)
                cls = os.path.basename(f)[:-5]
                if cls.endswith("GraphQLClient") or cls.endswith("GraphqlClient"):
                    tgt, cops = parse_client(src, cls)
                    if tgt and tgt != svc:
                        calls.setdefault(tgt, [])
                        calls[tgt] += [o for o in cops if o not in calls[tgt]]
                if "Kafka" in src or "kafka" in src or "Outbox" in cls:
                    l, p = parse_kafka(src)
                    lis += l
                    prod += p
            elif f.endswith(".graphqls") and "/schema/" in f:
                ops += parse_ops(repo.read(f))
        port, app, urls, ptopics, boot = props(repo, files)
        def resolve(t):
            if t.startswith("@const:"):
                t = consts.get(t[7:], t[7:])
            m = re.fullmatch(r"\$\{([\w.-]+)\}", t)
            return ptopics.get(m.group(1), t) if m else t
        lis = [dict(x, t=resolve(x["t"])) for x in lis]
        prod = [resolve(x) for x in prod]
        jwt = any(("JwtDecoder" in repo.read(f) or "oauth2ResourceServer" in repo.read(f)) for f in files if f.endswith(".java"))
        seen = set()
        ops = [o for o in ops if not (o["n"] in seen or seen.add(o["n"]))]
        data[svc] = {"entities": ents, "ops": ops, "calls": calls, "listen": [dict(t) for t in {tuple(x.items()) for x in lis}],
                     "produce": sorted(set(prod)), "port": port, "app": app, "urls": urls, "jwt": jwt, "boot": boot, "head": repo.g.head()}
    # order-service from the war (schema only)
    if os.path.exists(WAR):
        ops = []
        with zipfile.ZipFile(WAR) as z:
            for n in z.namelist():
                if n.endswith(".graphqls") and "/schema/" in n:
                    ops += parse_ops(z.read(n).decode("utf-8", "replace"))
        data["order"] = {"entities": [], "ops": ops, "calls": {}, "listen": [], "produce": [], "port": "10515", "app": "order-service", "urls": {}, "warOnly": 1}
    with open(OUT, "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    for k, v in data.items():
        print(f"{k:15} ent={len(v['entities']):3} rels={sum(len(e['rels']) for e in v['entities']):3} ops={len(v['ops']):4} calls={ {t: len(o) for t, o in v['calls'].items()} } listen={len(v['listen'])} produce={v['produce']}")
    print("bytes", os.path.getsize(OUT))


if __name__ == "__main__":
    main()
