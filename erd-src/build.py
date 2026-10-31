"""UniPOS Living ERD — build step. raw.json (from extract.py) -> out/ (page + per-service data) and dbml/ (one file per service).
Run:  python3 -I extract.py && python3 -I build.py"""
import datetime, glob, json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT, DATA, DBML, SNAP = (os.path.join(HERE, p) for p in ("out", "out/data", "dbml", "snapshots"))
for p in (OUT, DATA, DBML, SNAP):
    os.makedirs(p, exist_ok=True)
raw = json.load(open(os.path.join(HERE, "raw.json")))["services"]

# ---------- tables ----------
def pkcol(e):
    for f in e["fields"]:
        if f.get("pk"):
            return f["c"]
    return "id"

tables = {s: {e["table"]: e for e in v["entities"]} for s, v in raw.items()}
bycls = {s: {e["cls"]: e for e in v["entities"]} for s, v in raw.items()}

# ---------- reference rules (by COLUMN name; code is the source of truth) ----------
RULES = [
    (r"merchant_id", "configuration", "merchants"),
    (r"(sales_hub_id|business_area_id|initiator_sales_hub_id|requester_sales_hub_id|origin_sales_hub_id|sender_sales_hub_id|receiver_sales_hub_id|requester_business_area_id|related_business_area_id|anchor_sales_hub_id)", "configuration", "business_areas"),
    (r"(merchant_bin_id|bin_id)", "configuration", "merchant_bins"),
    (r"(upazila_id)", "configuration", "bd_adm_upazila"),
    (r"(product_sku_id|sku_id)", "product", "product_skus"),
    (r"customer_account_id", "accounts", "customer_accounts"),
    (r"(customer_id|person_id)", "customer", "persons"),
    (r"(user_id|requester_user_id|assigned_user_id|action_by_user_id|from_user_id|to_user_id|requester_id)", "authentication", "users"),
    (r"(surveyer_employee_id|followup_employee_id|sales_by_employee_id|reference_employee_id)", "authentication", "employees"),
    (r"role_id", "authorization", "roles"),
    (r"approval_id", "approval", "approval_requests"),
    (r"approval_path_id", "approval", "approval_paths"),
    (r"workflow_id", "approval", "approval_workflows"),
    (r"delivery_product_controller_id", "purchase", "do_product_controllers"),
    (r"(sales_invoice_id|invoice_id)", "sales", "sales_invoices"),
    (r"bank_id", "accounts", "banks"),
    (r"bank_account_id", "accounts", "bank_accounts"),
]
PROD_POLY = [["product", t] for t in ("product_categories", "product_lines", "product_models", "product_skus", "product_batches")]
LOC_POLY = [["inventory", t] for t in ("pos_store_houses", "pos_store_house_zones", "pos_store_zone_lines", "store_zone_line_racks", "line_rack_grids", "line_rack_floors", "rack_grid_containers")]
PARTY_POLY = [["customer", "persons"], ["customer", "business_organizations"]]

def plural_candidates(prefix):
    return [prefix + "s", prefix + "es", prefix, re.sub(r"y$", "ies", prefix)]

refs = {s: [] for s in raw}
unresolved = []
for s, tb in tables.items():
    for t, e in tb.items():
        cols = {f["c"] for f in e["fields"]}
        for f in e["fields"]:
            if f.get("virt"):
                continue
            c = f["c"]
            if f.get("rel"):  # JPA relation -> real FK
                tgt = bycls[s].get(f["to"])
                if tgt:
                    refs[s].append({"ft": t, "fc": c, "ts": s, "tt": tgt["table"], "tc": pkcol(tgt), "kind": "fk", "rel": f["rel"], **({"implicit": 1} if f.get("implicit") else {})})
                else:
                    unresolved.append(f"{s}.{t}.{c} -> class {f['to']}")
                continue
            if f.get("pk") or not c.endswith("_id"):
                continue
            if c in ("related_id", "party_related_id"):
                if c == "party_related_id":
                    poly = PARTY_POLY
                elif cols & {"store_location_level_id", "store_location_level"}:
                    poly = LOC_POLY
                elif s == "product" and "level_id" in cols:
                    poly = PROD_POLY
                elif any(re.search(r"(hierarchy_level|product_scope|stock_level|item_level|applicable_level|source_level|offering_product_level|productscope)", x) for x in cols):
                    poly = PROD_POLY
                else:
                    poly = []
                poly = [p for p in poly if p[1] in tables.get(p[0], {})]
                refs[s].append({"ft": t, "fc": c, "kind": "poly", "poly": poly, "ts": "", "tt": "", "tc": ""})
                continue
            hit = None
            for rx, ts, tt in RULES:
                if re.fullmatch(rx, c):
                    hit = (ts, tt)
                    break
            if hit and hit[0] == "accounts" and hit[1] == "customer_accounts" and s == "customer":
                hit = ("customer", "customer_accounts")
            if hit:
                ts, tt = hit
                if (ts, tt) == (s, t):
                    continue
                if tt in tables.get(ts, {}):
                    refs[s].append({"ft": t, "fc": c, "ts": ts, "tt": tt, "tc": pkcol(tables[ts][tt]), "kind": "soft" if ts == s else "xs"})
                else:
                    unresolved.append(f"{s}.{t}.{c} -> {ts}.{tt} (table not found)")
                continue
            # same-service inference by name: sales_type_id -> sales_types
            prefix = c[:-3]
            for cand in plural_candidates(prefix):
                if cand in tb and cand != t:
                    refs[s].append({"ft": t, "fc": c, "ts": s, "tt": cand, "tc": pkcol(tb[cand]), "kind": "soft", "inferred": 1})
                    break

# ---------- per-service data ----------
def pktype(e):
    for f in e["fields"]:
        if f.get("pk"):
            return f["t"]
    return "Long"

def col(f, s):
    t = f["t"]
    if f.get("rel") and not f.get("virt") and f.get("to") in bycls[s]:
        t = pktype(bycls[s][f["to"]])
    return {k: v for k, v in {"c": f["c"], "f": f["f"], "t": t, "pk": f.get("pk"), "nn": f.get("nn"), "uq": f.get("uq"), "len": f.get("len"), "prec": f.get("prec"),
                              "enum": f.get("enum"), "inh": f.get("inh"), "virt": f.get("virt"), "rel": f.get("rel"), "to": f.get("to")}.items() if v}

incoming = {s: [] for s in raw}
for s, rs in refs.items():
    for r in rs:
        if r["kind"] == "poly":
            for ps, pt in r["poly"]:
                if ps != s:
                    incoming[ps].append({"fs": s, "ft": r["ft"], "fc": r["fc"], "tt": pt, "kind": "poly"})
        elif r["ts"] != s:
            incoming[r["ts"]].append({"fs": s, "ft": r["ft"], "fc": r["fc"], "tt": r["tt"], "tc": r["tc"], "kind": r["kind"]})

today = datetime.date.today().isoformat()
snapshot = {s: {t: {f["c"]: f["t"] for f in e["fields"] if not f.get("virt")} for t, e in tb.items()} for s, tb in tables.items()}
prev_files = sorted(f for f in glob.glob(os.path.join(SNAP, "*.json")) if os.path.basename(f)[:-5] < today)
diff = {"prev": None, "items": []}
if prev_files:
    prev = json.load(open(prev_files[-1]))
    diff["prev"] = os.path.basename(prev_files[-1])[:-5]
    for s in sorted(set(prev) | set(snapshot)):
        a, b = prev.get(s, {}), snapshot.get(s, {})
        for t in sorted(set(b) - set(a)):
            diff["items"].append([s, t, "", "table added"])
        for t in sorted(set(a) - set(b)):
            diff["items"].append([s, t, "", "table removed"])
        for t in sorted(set(a) & set(b)):
            for c in sorted(set(b[t]) - set(a[t])):
                diff["items"].append([s, t, c, "column added"])
            for c in sorted(set(a[t]) - set(b[t])):
                diff["items"].append([s, t, c, "column removed"])
            for c in sorted(set(a[t]) & set(b[t])):
                if a[t][c] != b[t][c]:
                    diff["items"].append([s, t, c, f"type {a[t][c]} → {b[t][c]}"])
json.dump(snapshot, open(os.path.join(SNAP, today + ".json"), "w"), separators=(",", ":"))

index = {"built": today, "diff": diff, "services": {}, "xrefs": []}
for s, v in raw.items():
    data = {"svc": s, "head": v["head"], "tables": [{"t": e["table"], "cls": e["cls"], "file": e["file"], "ext": e.get("ext"), "cols": [col(f, s) for f in e["fields"]]} for e in v["entities"]],
            "refs": refs[s], "incoming": incoming[s]}
    json.dump(data, open(os.path.join(DATA, s + ".json"), "w"), separators=(",", ":"), ensure_ascii=False)
    index["services"][s] = {"head": v["head"], "tables": {e["table"]: [f["c"] for f in e["fields"] if not f.get("virt")] for e in v["entities"]},
                            "refsOut": sum(1 for r in refs[s] if r["kind"] == "xs"), "refsIn": len(incoming[s]), "fks": sum(1 for r in refs[s] if r["kind"] == "fk")}
    for r in refs[s]:
        if r["kind"] == "xs":
            index["xrefs"].append([s, r["ft"], r["fc"], r["ts"], r["tt"], r["tc"]])
json.dump(index, open(os.path.join(DATA, "index.json"), "w"), separators=(",", ":"), ensure_ascii=False)

# ---------- DBML on disk (one per service + everything) via the shared core ----------
gen = r"""
const core=require(process.argv[1]); const fs=require('fs'); const dir=process.argv[2], out=process.argv[3];
const idx=JSON.parse(fs.readFileSync(dir+'/index.json'));
const known=new Set(); const all=[];
for(const s of Object.keys(idx.services)){ for(const t of Object.keys(idx.services[s].tables)) known.add(s+'.'+t); }
for(const s of Object.keys(idx.services)){ const d=JSON.parse(fs.readFileSync(dir+'/'+s+'.json')); const v=core.view(d,{},[]);
  fs.writeFileSync(out+'/'+s+'.dbml', core.dbml(v)); all.push(core.dbml(v,{all:true,known,header:false})); }
fs.writeFileSync(out+'/_all-services.dbml','// UniPOS · all services · generated from @Entity code\n\n'+all.join('\n'));
"""
subprocess.run(["node", "-e", gen, os.path.join(HERE, "erd-core.js"), DATA, DBML], check=True)

# ---------- page ----------
tpl = open(os.path.join(HERE, "page.html"), encoding="utf-8").read()
# embed every data file too, so an exported copy opened from disk (file://) works without fetch()
_bundle = {}
for _f in sorted(os.listdir(DATA)):
    if _f.endswith(".json"):
        _bundle[_f[:-5]] = json.load(open(os.path.join(DATA, _f), encoding="utf-8"))
_sp = os.path.join(os.path.dirname(HERE), "sync", "status.json")
if os.path.exists(_sp):
    _bundle["status"] = json.load(open(_sp, encoding="utf-8"))
tpl = tpl.replace("<script>/*ERD_CORE*/</script>", '<script type="application/json" id="erd-data">' + json.dumps(_bundle, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>\n<script>/*ERD_CORE*/</script>")
page = tpl.replace("/*ERD_CORE*/", open(os.path.join(HERE, "erd-core.js"), encoding="utf-8").read()) \
          .replace("/*APP_JS*/", open(os.path.join(HERE, "app.js"), encoding="utf-8").read())
# "⌂ Control" button: active only when served by the local control panel (control/server.py)
_hb = os.path.join(os.path.dirname(HERE), "control", "web", "home-button.html")
if os.path.exists(_hb):
    _hbs = open(_hb, encoding="utf-8").read()
    page = page.replace("</body>", _hbs + "</body>", 1) if "</body>" in page else page + _hbs
# saved light/dark choice, applied before paint (shared with the control panel)
_te = os.path.join(os.path.dirname(HERE), "control", "web", "theme-early.js")
if os.path.exists(_te):
    page = page.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<script>' + open(_te, encoding="utf-8").read() + '</script>\n', 1)
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)

n_ref = sum(len(v) for v in refs.values())
kinds = {}
for sv, v in refs.items():
    for r in v:
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
        if r["kind"] == "poly" and not r["poly"]:
            print("  poly target unknown:", sv, r["ft"], r["fc"], sorted(c for c in index["services"][sv]["tables"][r["ft"]] if "level" in c or "type" in c or "scope" in c))
print("tables", sum(len(t) for t in tables.values()), "refs", n_ref, kinds, "unresolved", len(unresolved))
for u in unresolved[:30]:
    print("  unresolved:", u)
print("diff vs", diff["prev"], len(diff["items"]), "changes")
