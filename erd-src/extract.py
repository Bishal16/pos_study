"""UniPOS Living ERD — read-only extractor. Code is the source of truth.
Reads every service's @Entity classes from its fetched origin/dev ref (working copies untouched)
and writes erd-src/raw.json. Never reads property values; never touches the repos."""
import json, os, re, subprocess, sys

ROOT = "/home/mahathir/Downloads/projects"
HERE = os.path.dirname(os.path.abspath(__file__))
SERVICES = ["authentication", "authorization", "configuration", "product", "customer", "purchase", "approval",
            "inventory", "sales", "policy", "promotion", "payment", "accounts", "vat", "report", "compliance", "notification"]


sys.path.insert(0, os.path.join(os.path.dirname(HERE), "sync"))
from gitsrc import GitSrc  # noqa: E402


class Repo:
    """Reads a service straight from origin/dev (never the working copy)."""
    def __init__(self, svc):
        self.svc, self.path = svc, os.path.join(ROOT, svc + "-service")
        self.g = GitSrc(self.path)

    def head(self):
        return self.g.head()

    def java(self):
        fs = [f for f in self.g.files("src/main/java/") if f.endswith(".java")]
        yield from self.g.read_many(fs)


def strip_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return "\n".join(l for l in src.splitlines() if not l.strip().startswith("//"))


def snake(n):
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", "_", n).lower()


FIELD = re.compile(r"^\s*(?:private|protected|public)\s+(?!static\b)(?:final\s+)?([\w<>,\s?.\[\]]+?)\s+(\w+)\s*(?:=[^;]*)?;")


def parse_fields(body):
    fields, ann = [], []
    depth = 0
    for line in body.splitlines():
        st = line.strip()
        if depth == 0 and st.startswith("@"):
            ann.append(st)
            depth += st.count("(") - st.count(")")
            continue
        if depth > 0:  # multi-line annotation
            ann[-1] += " " + st
            depth += st.count("(") - st.count(")")
            continue
        fm = FIELD.match(line)
        if not fm:
            if "(" in st and "{" in st:
                ann = []
            continue
        typ, name = re.sub(r"\s+", "", fm.group(1)), fm.group(2)
        a = " ".join(ann)
        ann = []
        if "@Transient" in a:
            continue
        f = {"f": name, "t": typ}
        cm = re.search(r"@Column\s*\(([^)]*)\)", a)
        jm = re.search(r"@JoinColumn\s*\(([^)]*)\)", a)
        args = (cm.group(1) if cm else "") + " " + (jm.group(1) if jm else "")
        nm = re.search(r"\bname\s*=\s*\"([^\"]+)\"", args)
        f["c"] = nm.group(1) if nm else snake(name)
        if re.search(r"nullable\s*=\s*false", args):
            f["nn"] = 1
        if re.search(r"unique\s*=\s*true", args):
            f["uq"] = 1
        lm = re.search(r"length\s*=\s*(\d+)", args)
        if lm:
            f["len"] = int(lm.group(1))
        pm = re.search(r"precision\s*=\s*(\d+)", args)
        if pm:
            f["prec"] = int(pm.group(1))
        if re.search(r"@(Embedded)?Id\b", a):
            f["pk"] = 1
        if "@Enumerated" in a:
            f["enum"] = 1
        rk = re.search(r"@(ManyToOne|OneToMany|OneToOne|ManyToMany)\b", a)
        if rk:
            f["rel"] = rk.group(1)
            f["to"] = re.sub(r"^(List|Set|Collection)<(.+)>$", r"\2", typ).split(".")[-1]
            if "mappedBy" in a or rk.group(1) == "OneToMany" or (rk.group(1) == "ManyToMany" and "@JoinTable" not in a):
                f["virt"] = 1  # no column in this table
            elif not jm:
                f["implicit"] = 1  # JPA default join-column name
        if re.search(r"@ElementCollection", a):
            f["virt"] = 1
        fields.append(f)
    return fields


def main():
    out = {"services": {}}
    for svc in SERVICES:
        repo = Repo(svc)
        if not os.path.isdir(repo.path):
            print("missing", svc, file=sys.stderr)
            continue
        ents, supers = [], {}
        for rel, src in repo.java():
            s = strip_comments(src)
            m = re.search(r"\bclass\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+(\w+))?", s)
            if not m:
                continue
            cls, ext = m.group(1), m.group(2)
            is_entity = re.search(r"@Entity\b(?!Listeners)", s) is not None
            is_super = "@MappedSuperclass" in s
            if not (is_entity or is_super):
                continue
            fields = parse_fields(s[m.end():])
            if is_super and not is_entity:
                supers[cls] = {"ext": ext, "fields": fields}
                continue
            tm = re.search(r"@Table\s*\([^)]*?name\s*=\s*\"([^\"]+)\"", s, re.S)
            ents.append({"cls": cls, "table": tm.group(1) if tm else snake(cls), "ext": ext, "fields": fields,
                         "file": rel})
        # fold inherited columns from @MappedSuperclass chains
        for e in ents:
            seen, ext = set(), e["ext"]
            while ext and ext in supers and ext not in seen:
                seen.add(ext)
                for f in supers[ext]["fields"]:
                    if not any(x["f"] == f["f"] for x in e["fields"]):
                        e["fields"].append(dict(f, inh=ext))
                ext = supers[ext]["ext"]
        out["services"][svc] = {"head": repo.head(), "entities": ents}
        print(f"{svc:15} tables={len(ents):3} supers={list(supers)}")
    with open(os.path.join(HERE, "raw.json"), "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print("tables", sum(len(v["entities"]) for v in out["services"].values()))


if __name__ == "__main__":
    main()
