"""Assemble UniPOS System Atlas (v2) from v1's published HTML (styles + data block), v2.js and data.json."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
V1 = os.path.join(HERE, "v1-explorer.html")
v1 = open(V1, encoding="utf-8").read()
styles = re.findall(r"<style>(.*?)</style>", v1, re.S)
v1css = styles[-1]  # the page's own style block (first one is the publish skeleton)
facts = json.load(open(os.path.join(HERE, "facts.json"), encoding="utf-8"))
facts.pop("_about", None)
data_block = "/* hand-written facts (atlas-src/facts.json) */\nconst __F = " + json.dumps(facts, ensure_ascii=False).replace("</", "<\\/") + ";\nconst {DOMAINS,SERVICES,CALLS,BADCALLS,TOPICS,INFRA,FLOWS,LEVELS} = __F;\n"
_sp = os.path.join(os.path.dirname(HERE), "sync", "status.json")
status = open(_sp, encoding="utf-8").read().replace("</", "<\\/") if os.path.exists(_sp) else "{}"
code = open(os.path.join(HERE, "data.json"), encoding="utf-8").read().replace("</", "<\\/")
js = open(os.path.join(HERE, "v2.js"), encoding="utf-8").read()

EXTRA_CSS = r"""
[hidden]{display:none!important}
svg.main .node.dimn{opacity:.22}
svg.main .node.hotn rect.b{stroke-width:2.2}
.e.flow{stroke-dasharray:7 5}
@media (prefers-reduced-motion:no-preference){.e.flow{animation:kflow .8s linear infinite}}
@keyframes kflow{to{stroke-dashoffset:-12}}
.key{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:4px}
.key.in{background:var(--d-sell)} .key.out{background:var(--accent)}

/* v2: lens tokens */
:root{ --v-keep:#DCEFE3; --v-change:#F6E7C8; --v-build:#D6E6F7; --v-decide:#E7DFF2; --v-remove:#F5D9D6; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --v-keep:#1E3B2C; --v-change:#3E3219; --v-build:#1C3049; --v-decide:#33284A; --v-remove:#4A2522; }}
:root[data-theme="dark"]{ --v-keep:#1E3B2C; --v-change:#3E3219; --v-build:#1C3049; --v-decide:#33284A; --v-remove:#4A2522; }
.bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}
.tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;min-width:0}
.search{position:relative;min-width:0;flex:1 1 280px}
#q{font:inherit;font-size:.9rem;width:100%;min-width:0;box-sizing:border-box;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink)}
#q:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
#qres{position:absolute;z-index:20;left:0;right:0;top:calc(100% + 4px);margin:0;padding:4px;list-style:none;background:var(--surface);border:1px solid var(--line);border-radius:6px;max-height:360px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.18)}
#qres li{display:flex;gap:8px;align-items:baseline;padding:5px 6px;border-radius:4px;cursor:pointer;font-size:.86rem;overflow:hidden}
#qres li .mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#qres li[aria-selected="true"],#qres li:hover{background:var(--tint)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{font:inherit;font-size:.86rem;border:0;background:var(--surface);color:var(--ink);padding:6px 11px;cursor:pointer}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.crumbs{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.86rem;color:var(--muted)}
.crumbs button{font:inherit;border:0;background:none;color:var(--accent);padding:2px 2px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.crumbs button:last-of-type{color:var(--ink);text-decoration:none;font-weight:600}
.scroller svg{min-width:0}
.frame{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--surface)}
.frame svg.main{width:100%;height:auto;max-height:78vh;touch-action:none;cursor:grab}
.frame svg.main:active{cursor:grabbing}
.frame.mini svg{width:100%;height:auto;max-height:260px}
.minicap{font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.zoombar,.player,.svcpick{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.84rem}
.zoombar .hint{color:var(--muted);margin-right:auto;font-size:.8rem}
.zoombar button,.player button{font:inherit;font-size:.84rem;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:4px 10px;cursor:pointer;min-width:34px}
.player input[type=range]{flex:1 1 140px;accent-color:var(--accent)}
.player .pnum{color:var(--muted)}
.svcpick select{font:inherit;font-size:.86rem;padding:5px 8px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink);max-width:100%}
.oplbl{font-family:var(--f-mono);font-size:10px;fill:var(--accent);paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round}
.oplbl.bad{fill:var(--bad)}
.hotpath{stroke:var(--accent);stroke-width:4;fill:none}
.hotbox{fill:none;stroke:var(--accent);stroke-width:3}
.mk-hot{fill:var(--accent)}
.row{cursor:pointer}
.row .rowhit{fill:transparent}
.row:hover .rowhit{fill:var(--tint)}
.row.dimrow{opacity:.28}
.row.act .rowhit{fill:var(--tint)}
.row.act .e{stroke:var(--accent);stroke-width:2.6}
.row.act .lbl{fill:var(--ink);font-weight:600}
.row.act .stepn{fill:var(--accent);stroke:var(--accent)}
.row.act .stepn-t{fill:var(--bg)}
.enthead{fill:var(--tint)}
.fl{font-family:var(--f-mono);font-size:10.5px;fill:var(--ink)}
.ftag{fill:var(--accent);font-weight:600;font-size:9px}
.ftype{font-family:var(--f-mono);font-size:10px;fill:var(--muted)}
.ftype.rel{fill:var(--accent)}
.soft{font-family:var(--f-mono);font-size:10px;fill:var(--d-sell);text-decoration:underline;cursor:pointer}
.jump,.more{cursor:pointer}
.morelbl{font-size:11px;fill:var(--accent)}
.card-n{font-family:var(--f-mono);font-size:11px;fill:var(--muted)}
.node.ent rect.b{fill:var(--surface)}
/* lenses */
[data-lens="problems"] svg.main .node.sev0{opacity:.3}
[data-lens="problems"] svg.main .node.sev1 rect.b{stroke:var(--warn);stroke-width:2.4}
[data-lens="problems"] svg.main .node.sev2 rect.b{stroke:var(--bad);stroke-width:3.2}
[data-lens="problems"] svg.main .node.topic.ok{opacity:.3}
[data-lens="problems"] svg.main .e:not(.bad):not(.warn):not(.idle):not(.hot-out):not(.hot-in){opacity:.15}
[data-lens="odcl"] svg.main .node.v-keep rect.b{fill:var(--v-keep)}
[data-lens="odcl"] svg.main .node.v-change rect.b{fill:var(--v-change)}
[data-lens="odcl"] svg.main .node.v-build rect.b{fill:var(--v-build)}
[data-lens="odcl"] svg.main .node.v-decide rect.b{fill:var(--v-decide)}
[data-lens="odcl"] svg.main .node.v-remove rect.b{fill:var(--v-remove)}
.chip.v{color:var(--ink)} .chip.v-keep{background:var(--v-keep)} .chip.v-change{background:var(--v-change)} .chip.v-build{background:var(--v-build)} .chip.v-decide{background:var(--v-decide)} .chip.v-remove{background:var(--v-remove)}
/* card extras */
.cta{font:inherit;font-size:.88rem;text-align:left;border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:6px;padding:7px 10px;cursor:pointer}
.cta:hover{background:var(--tint)}
.ctabs{display:flex;flex-wrap:wrap;gap:4px}
.ctabs button{font:inherit;font-size:.8rem;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:4px 8px;cursor:pointer}
.ctabs button[aria-selected="true"]{background:var(--accent);border-color:var(--accent);color:var(--bg)}
.cfilter{font:inherit;font-size:.86rem;padding:6px 9px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink);width:100%;box-sizing:border-box}
.tlist,.oplist{max-height:420px;overflow:auto;list-style:none;padding-left:0 !important}
.oplist li{font-size:.8rem;overflow-wrap:anywhere}
.lnk{font:inherit;border:0;background:none;color:var(--accent);cursor:pointer;padding:0;text-align:left;text-decoration:underline;text-underline-offset:2px}
.lnk.on{font-weight:700;color:var(--ink)}
.muted{color:var(--muted)}
.tdetail{border:1px solid var(--line);border-radius:6px;padding:8px;max-height:360px;overflow:auto}
table.cols{border-collapse:collapse;width:100%;font-size:.78rem}
table.cols td{padding:2px 6px 2px 0;vertical-align:top;overflow-wrap:anywhere}
/* sync level */
.syncbanner{display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:12px 14px;border:1px solid var(--line);border-left-width:6px}
.syncbanner.ok{border-color:var(--ok)} .syncbanner.warn{border-color:var(--warn)} .syncbanner.bad{border-color:var(--bad)} .syncbanner.idle{border-color:var(--idle)}
.syncbanner span{color:var(--muted);font-size:.9rem}
.stats{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.88rem;color:var(--muted)} .stats b{color:var(--ink);font-variant-numeric:tabular-nums}
h3.synch{font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:10px 0 2px;font-weight:600}
.tablewrap{overflow-x:auto}
table.synct{border-collapse:collapse;width:100%;font-size:.84rem}
table.synct th{text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line);padding:4px 8px}
table.synct td{border-bottom:1px solid var(--tint);padding:4px 8px;white-space:nowrap}
table.synct td.num{text-align:right;font-variant-numeric:tabular-nums}
ul.cl{margin:0;padding-left:18px;font-size:.86rem;display:flex;flex-direction:column;gap:2px}
ul.cl li.warn{color:var(--warn)}
details summary{cursor:pointer;font-size:.88rem}
.hint{color:var(--muted);font-size:.86rem;margin:0}
"""

BODY = """
<div class="wrap">
  <header>
    <h1>UniPOS System Atlas</h1>
    <p>UniPOS as built today: from the front door down to every table. Pick a level, a lens, or search for anything. Click a box for details; double-click a service to go inside.</p>
  </header>
  <div class="bar">
    <nav class="levels" id="levels" role="tablist" aria-label="Detail level"></nav>
    <div class="tools">
      <div class="search">
        <input id="q" type="search" placeholder="Search a table, column, operation, topic or port" role="combobox" aria-expanded="false" aria-controls="qres" aria-autocomplete="list" autocomplete="off" aria-label="Search">
        <ul id="qres" role="listbox" hidden></ul>
      </div>
      <div class="seg" id="lens" role="group" aria-label="Lens"><button data-lens="asis" aria-pressed="true">As-is</button><button data-lens="problems" aria-pressed="false">Problems</button><button data-lens="odcl" aria-pressed="false">ODCL plan</button></div>
    </div>
  </div>
  <div class="crumbs" id="crumbs" aria-label="Breadcrumb"></div>
  <div class="legend" id="legend"></div>
  <div class="main">
    <section class="canvas" aria-live="polite">
      <div class="subtabs" id="subtabs" role="tablist" aria-label="Flow" hidden></div>
      <p class="cap" id="cap"></p>
      <div class="scroller" id="scroller"></div>
    </section>
    <aside class="card" id="card"></aside>
  </div>
</div>
"""

head = """<meta charset="utf-8">
<title>UniPOS System Atlas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
"""
html = head + "<style>" + v1css + EXTRA_CSS + "</style>\n" + BODY + \
    '<script type="application/json" id="code">' + code + "</script>\n" + '<script type="application/json" id="status">' + status + "</script>\n<script>\n" + data_block + "\n" + js + "\n</script>\n"
out = os.path.join(HERE, "index.html")
open(out, "w", encoding="utf-8").write(html)
open(os.path.join(HERE, "check.js"), "w", encoding="utf-8").write(data_block + "\n" + js)
print("wrote", out, len(html), "bytes")
