/* ===================== Level 7: Frontend (smartpos-web) =====================
   Data: fe.json from extract_fe.py (origin/dev, code is the source of truth); hand-written text: facts.json FRONTEND.
   Loaded before v2.js; only functions here, so nothing runs before v2.js has defined state, S, CODE, esc … */
const FE = (()=>{ try{ return JSON.parse(document.getElementById("fe").textContent)||null; }catch(e){ return null; } })();
const FEH = __F.FRONTEND || {};
const FE_TABS = [["map","Screen map"],["trace","How a page works"],["path","Request & login"],["ai","Start with AI"]];

function feMod(k){ return (FEH.modName||{})[k] || k; }
function feSvc(s, attr="data-jump"){
  const d = S[s] ? DOMAINS[S[s].dom].cls : "";
  return S[s] ? `<button class="fesvc" ${attr}="${esc(s)}" title="Open ${esc(s)}-service (level 6)"><i style="background:var(--${d})"></i>${esc(s)}</button>` : `<span class="fesvc"><i></i>${esc(s)}</span>`;
}
function fePage(url){ return FE.pages.find(p=>p.url===url); }
function feShort(f){ return f.replace("src/app/[locale]/(protected)/","@protected/").replace("src/app/[locale]/","app/"); }
function feFill(t){
  const tp = FE.trace.page, unk = FE.unknownOps[0] || "someOperation", legacy = (FE.legacyNoAuth||[])[0] || "src/services/queries/…";
  return t.replace(/\{file\}/g, tp ? tp.file : "src/app/[locale]/(protected)/…/page.tsx").replace(/\{url\}/g, "/inventory/store-management/my-new-screen")
    .replace(/\{newop\}/g, (FE.trace.page&&FE.trace.page.ops.find(o=>o.svc.length)||{op:"getAllPurchaseRequests"}).op).replace(/\{op\}/g, unk).replace(/\{service\}/g, legacy).replace(/\{jwt\}/g, JWT_SVCS.length);
}
function feCap(){
  if(!FE) return "<b>Frontend.</b> No data yet: run sync/refresh.sh (it runs atlas-src/extract_fe.py).";
  const h=FE.head, n=FE.pages.length;
  return {
    map:`<b>Every screen of the Next.js frontend, grouped by module (${n} pages, origin/dev ${esc(h.commit)} · ${esc(h.date)}).</b> Click a module to list its pages, then a page to see the files and the backend operations it calls; a service name opens that service's inside view.`,
    trace:`<b>One real feature traced end to end: Purchase Request.</b> What happens from the URL to the database table, and which file does each step. Every box names the file to open.`,
    path:`<b>How a request leaves the browser.</b> Login, where the token and the merchant id come from, and the three ways this code base calls the GraphQL API. Counts come from the code.`,
    ai:`<b>Start contributing with an AI assistant.</b> Setup, the files to read first, the recipe for a new screen, safe first tasks found in the code, and prompts you can copy.`
  }[state.fetab] || "";
}
function feHTML(){
  if(!FE) return `<p class="hint">No frontend data. Run <span class="mono">sync/refresh.sh</span>.</p>`;
  return ({map:feMap, trace:feTrace, path:fePath, ai:feAI}[state.fetab] || feMap)();
}

/* ---------- Screen map ---------- */
function feMap(){
  const f=FE.facts, mods=Object.entries(FE.modules).sort((a,b)=>b[1].pages-a[1].pages);
  const big=mods.filter(([k,m])=>m.pages>=5 && !["public","auth"].includes(k)), small=mods.filter(x=>!big.includes(x));
  const unkPages=FE.pages.filter(p=>p.ops.some(o=>!o.svc.length)).length, mock=FE.pages.filter(p=>p.mock).length;
  const svcs=new Set(FE.pages.flatMap(p=>p.svcs));
  let h=`<div class="stats"><span><b>${FE.pages.length}</b> pages</span><span><b>${big.length}</b> business modules</span><span><b>${f.graphqlOps}</b> typed operations in ${f.graphqlFiles} .graphql files</span><span><b>${f.servicesFiles}</b> legacy service files</span><span><b>${svcs.size}</b> backend services called</span></div>`;
  if(FE.unknownOps.length) h+=`<div class="syncbanner bad"><b>${FE.unknownOps.length} operations the frontend calls don't exist in any backend schema</b><span>Used on ${unkPages} pages, mostly configuration and users &amp; permissions. They were probably renamed or removed (e.g. the old SearchSalesHub API); those screens are likely broken. Marked <span class="fewarn">✕</span> below.</span></div>`;
  if(mock) h+=`<div class="syncbanner warn"><b>${mock} pages show mock data</b><span>Their service files return hard-coded rows instead of calling the backend. Marked <span class="fewarn">mock</span>.</span></div>`;
  h+=`<div class="fesearch"><input id="feq" type="search" placeholder="Search pages or operations, e.g. purchase-order or getAllBrands" value="${esc(state.feq||"")}" aria-label="Search pages or operations"></div>`;
  const q=(state.feq||"").trim().toLowerCase();
  if(q){
    const hits=FE.pages.filter(p=>p.url.toLowerCase().includes(q)||p.ops.some(o=>o.op.toLowerCase().includes(q)));
    return h+`<h3 class="synch">${hits.length} page(s) match “${esc(q)}”</h3>`+fePageTable(hits, true);
  }
  h+=`<div class="fetiles">${big.map(([k,m])=>feTile(k,m)).join("")}</div>`;
  if(small.length) h+=`<p class="hint" style="margin-top:8px">Also: ${small.map(([k,m])=>`<button class="lnk ${state.femod===k?"on":""}" data-femod="${esc(k)}">${esc(feMod(k))} (${m.pages})</button>`).join(" · ")}</p>`;
  if(state.femod && FE.modules[state.femod]){
    const pages=FE.pages.filter(p=>p.module===state.femod);
    h+=`<h3 class="synch">${esc(feMod(state.femod))}: ${pages.length} page(s)</h3>`+fePageTable(pages, false);
  }
  return h;
}
function feTile(k,m){
  const top=Object.keys(m.svcs).slice(0,4), tot=Math.max(1,m.legacy+m.modern);
  return `<button class="fetile ${state.femod===k?"on":""}" data-femod="${esc(k)}">
    <span class="fen">${esc(feMod(k))}</span><span class="fec"><b>${m.pages}</b> pages · ${m.ops} operations</span>
    <span class="febar" title="${m.modern} modern / ${m.legacy} legacy pages"><i style="width:${Math.round(m.modern/tot*100)}%"></i></span>
    <span class="fedots">${top.map(s=>`<span title="${esc(s)}-service"><i style="background:var(--${S[s]?DOMAINS[S[s].dom].cls:"line"})"></i>${esc(s)}</span>`).join("")}</span>
    ${m.unknown.length||m.mock?`<span class="fewarns">${m.unknown.length?`<span class="fewarn">✕ ${m.unknown.length} missing ops</span>`:""}${m.mock?`<span class="fewarn">mock ${m.mock}</span>`:""}</span>`:""}
  </button>`;
}
function fePageTable(pages, showMod){
  if(!pages.length) return `<p class="hint">None.</p>`;
  const style={modern:["modern","ok"],legacy:["legacy","warn"],both:["mixed","idle"],static:["no API","idle"]};
  return `<div class="tablewrap"><table class="synct fetable"><thead><tr><th>page</th><th>style</th><th>backend services</th><th class="num">ops</th><th></th></tr></thead><tbody>${pages.map(p=>{
    const st=style[p.style], unk=p.ops.filter(o=>!o.svc.length).length;
    const path=showMod?p.url:(p.url.replace("/"+p.module,"")||"/");
    return `<tr class="${state.fepage===p.url?"on":""}"><td><button class="lnk" data-fepage="${esc(p.url)}">${esc(path)}</button></td><td><span class="chip ${st[1]}">${st[0]}</span></td>
      <td>${p.svcs.map(s=>feSvc(s)).join(" ")||'<span class="muted">—</span>'}</td><td class="num">${p.ops.length}</td>
      <td>${unk?`<span class="fewarn" title="${unk} operation(s) not in any backend schema">✕ ${unk}</span>`:""}${p.mock?` <span class="fewarn">mock</span>`:""}</td></tr>`; }).join("")}</tbody></table></div>`;
}

/* ---------- How a page works ---------- */
function feTrace(){
  const t=FE.trace, p=t.page, c=t.create;
  if(!p) return `<div class="syncbanner warn"><b>The traced page ${esc(t.url)} is gone from origin/dev</b><span>The frontend changed; pick another feature in atlas-src/extract_fe.py (TRACE_PAGE).</span></div>`;
  const has=(pg,needle)=>pg&&pg.comps.concat(pg.docs,[pg.file]).some(f=>f.includes(needle));
  const ent=(CODE.purchase&&CODE.purchase.entities||[]).find(e=>e.table==="purchase_requests");
  const step=(n,who,title,file,text,extra="",ok=true)=>`<li class="festep ${ok?"":"gone"}"><span class="fsn">${n}</span><div><p class="fsw">${who}</p><p class="fst">${title}</p>${file?`<p class="mono fsf">${esc(file)}${ok?"":" · not found in code any more"}</p>`:""}<p class="fsx">${text}</p>${extra}</div></li>`;
  const listOp=p.ops.find(o=>/^getAllPurchaseRequests$/i.test(o.op)), addOp=(c||p).ops.find(o=>/^addPurchaseRequest$/i.test(o.op));
  let h=`<div class="fetrace"><section><h3 class="synch">A · Opening the list</h3><ol class="festeps">
   ${step(1,"Browser","You open /en/procurement/product-procurement/purchase-request","src/proxy.ts","Runs first on every request: adds the language prefix and sends you to /login if you have no session.")}
   ${step(2,"Next.js server","The logged-in frame is drawn","src/app/[locale]/(protected)/layout.tsx","Checks the session and loads the sidebar from <span class='mono'>getAllMenusForCurrentUser</span>.",feSvc("authorization"))}
   ${step(3,"Next.js server · Server Component","page.tsx asks for the data",p.file,"<span class='mono'>getUserSession()</span> gives the token and merchant id; then <span class='mono'>serverFetch</span> with <span class='mono'>GetAllPurchaseRequestsDocument</span> and cache tag <span class='mono'>purchase-request</span>.")}
   ${step(4,"Next.js server","serverFetch sends the GraphQL POST","src/lib/serverFetch.ts","POST to <span class='mono'>GRAPHQL_ENDPOINT</span> with <span class='mono'>Authorization: Bearer …</span>, <span class='mono'>merchant-id</span>, <span class='mono'>user-id</span>. The query text comes from:",`<p class="mono fsf">src/graphql/purchaseRequest.graphql</p>`,has(p,"purchaseRequest.graphql"))}
   ${step(5,"Kong :8000 → Apollo gateway :4000","Routed to the right service","","The gateway sees the field <span class='mono'>getAllPurchaseRequests</span> and forwards it to the purchase subgraph (neither checks the token).")}
   ${step(6,"purchase-service","Resolver runs the query","",`Operation <span class='mono'>getAllPurchaseRequests</span>${listOp?"":" (not found in the purchase schema!)"}.`,`<button class="lnk" data-sgo='${esc(JSON.stringify({svc:"purchase",op:"getAllPurchaseRequests"}))}'>open the operation in level 6 ›</button>`)}
   ${step(7,"PostgreSQL","Rows come from the table",ent?ent.table:"","Owned by purchase-service only.",ent?`<button class="lnk" data-sgo='${esc(JSON.stringify({svc:"purchase",table:ent.cls}))}'>open purchase_requests in level 6 ›</button>`:"",!!ent)}
   ${step(8,"Browser · Client component","The table appears","…/purchase-request/_components/TableView.tsx","<span class='mono'>SharedDataTable</span> with columns from <span class='mono'>TableColumns.tsx</span>. Paging and delete call <span class='mono'>serverActionFetch</span>.","",has(p,"TableView.tsx"))}
  </ol></section>
  <section><h3 class="synch">B · Saving a new request</h3><ol class="festeps">
   ${step(1,"Browser","Click “Create” → /…/purchase-request/create-new",c?c.file:"",`The form page.`,"",!!c)}
   ${step(2,"Browser · Client component","The form",".../_components/create-update/CreateUpdate.tsx","react-hook-form with the zod rules in <span class='mono'>schema.ts</span>. Dropdowns load approval paths and workflows:",feSvc("approval")+" "+feSvc("product")+" "+feSvc("configuration"),has(c||p,"CreateUpdate.tsx"))}
   ${step(3,"Next.js server · Server Action","Submit","src/lib/serverActionFetch.ts","<span class='mono'>AddPurchaseRequestDocument</span> with token, merchantId and userId, plus <span class='mono'>revalidate: {updateTag: \"purchase-request\"}</span>.")}
   ${step(4,"purchase-service","Saves the request","",`Operation <span class='mono'>addPurchaseRequest</span>${addOp&&addOp.svc.length?"":" (not found in the backend schema!)"}.`,`<button class="lnk" data-sgo='${esc(JSON.stringify({svc:"purchase",op:"addPurchaseRequest"}))}'>open the operation in level 6 ›</button>`)}
   ${step(5,"Next.js cache","The list refreshes by itself","","The cache tag <span class='mono'>purchase-request</span> is invalidated, so step A3 runs again with fresh data.")}
  </ol></section></div>`;
  const files=[...new Set([p.file].concat(p.docs,p.comps,c?[c.file].concat(c.comps):[]))].filter(f=>f.includes("purchase-request")||f.includes("purchaseRequest"));
  h+=`<h3 class="synch">The files of this feature (${files.length}, from code)</h3><ul class="cl">${files.map(f=>`<li class="mono">${esc(feShort(f))}</li>`).join("")}</ul>
   <p class="hint">A new screen copies this shape: see <b>Start with AI → Recipe</b>.</p>`;
  return h;
}

/* ---------- Request & login ---------- */
function fePath(){
  const f=FE.facts, srv=f.serverFetchFiles+f.serverActionFetchFiles;
  const b=`<text class="t3" x="20" y="28">LOGGED-IN SCREENS (server path)</text>`+
    node("browser",20,48,150,58,"Browser","session cookie")+node("frontend",230,48,190,58,"Next.js server",".192 · PM2 :3000")+
    node("kong",480,48,140,58,"Kong",":8000")+node("gateway",660,48,160,58,"Apollo gateway",":4000")+
    `<g class="node"><rect class="b" x="860" y="40" width="190" height="74" rx="5"/><text class="t1" x="874" y="66">${SERVICES.length} services</text><text class="t2" x="874" y="86">${JWT_SVCS.length} check the token</text><text class="t2" x="874" y="102">${SERVICES.length-JWT_SVCS.length} don't</text></g>`+
    line(170,77,228,77,"ok","page")+line(420,77,478,77,"ok","")+`<text class="lbl" x="449" y="40" text-anchor="middle">Bearer token</text>`+line(620,77,658,77,"ok","")+line(820,77,858,77,"ok","")+
    `<text class="lbl" x="325" y="130" text-anchor="middle">${srv} files use serverFetch / serverActionFetch</text>`+
    `<text class="t3" x="20" y="178">LEGACY SCREENS (browser path)</text>`+
    node("browser",20,196,150,58,"Browser","client component")+
    `<path class="e warn" d="M170,225 C 300,225 380,225 478,225" marker-end="url(#m-warn)"/>`+
    `<text class="lbl warn" x="325" y="214" text-anchor="middle">fetch(NEXT_PUBLIC_GRAPHQL_ENDPOINT)</text>`+
    `<text class="lbl" x="325" y="246" text-anchor="middle">${f.browserFetchFiles} files · ${f.browserFetchWithAuth} send a token · ${f.browserFetchWithMerchant} send merchant-id</text>`+
    `<g class="node"><rect class="b" x="480" y="196" width="140" height="58" rx="5"/><text class="t1" x="494" y="222">Kong</text><text class="t2" x="494" y="240">same route</text></g>`+
    line(620,225,858,225,"warn","")+`<g class="node"><rect class="b" x="860" y="196" width="190" height="58" rx="5"/><text class="t1" x="874" y="222">service</text><text class="t2" x="874" y="240">rejects if it checks JWT</text></g>`+
    `<text class="t3" x="20" y="306">LOGIN</text>`+
    node("frontend",20,322,190,52,"src/auth.ts","NextAuth credentials")+line(210,348,858,348,"ok","login(email, password) → accessToken")+
    `<g class="node"><rect class="b" x="860" y="322" width="190" height="52" rx="5"/><circle class="dot d-id" cx="872" cy="344" r="4"/><text class="t1" x="882" y="348">authentication</text></g>`;
  let h=`<div class="frame">${svgWrap(1070,394,b,"Frontend request paths: server-side fetch with token, legacy browser fetch without token, and login")}</div>`;
  h+=`<div class="fecols"><section><h3 class="synch">Login and session</h3><ol class="cl">
     <li><span class="mono">src/auth.ts</span>: NextAuth Credentials provider calls the <span class="mono">login</span> mutation ${feSvc("authentication")}.</li>
     <li>The <span class="mono">accessToken</span> and the user go into the NextAuth <b>cookie</b> (session ${f.sessionMinutes?f.sessionMinutes+" minutes":"time-limited"}). Nothing in localStorage; the backend refresh token isn't used.</li>
     <li><span class="mono">src/proxy.ts</span> redirects to <span class="mono">/login</span> when there is no session.</li>
     <li>The sidebar comes from <span class="mono">getAllMenusForCurrentUser</span> ${feSvc("authorization")}. It only hides links: no page or button checks a permission.</li>
     <li><b>Which company?</b> ${f.tempMerchant?`<span class="mono">getUserSession()</span> returns the merchant from env <span class="mono">TEMP_MERCHANT_ID</span>, not from the user: one frontend = one merchant. For ODCL, set it to ODCL's merchant.`:"Taken from the user's session."} "Super admin" is that env id compared with <span class="mono">SUPER_ADMIN_ID</span> (${f.superAdminRefs} files).</li></ol></section>
   <section><h3 class="synch">Three ways to call the API</h3><div class="tablewrap"><table class="synct"><thead><tr><th>style</th><th>where</th><th class="num">files</th><th>token</th></tr></thead><tbody>
     <tr><td><b>Modern</b> (use this)</td><td class="mono">src/graphql/*.graphql → serverFetch / serverActionFetch</td><td class="num">${srv}</td><td>when the caller passes it</td></tr>
     <tr><td>Legacy</td><td class="mono">src/services/**: fetch() in the browser</td><td class="num">${f.browserFetchFiles}</td><td class="bad">${f.browserFetchWithAuth} of ${f.browserFetchFiles}</td></tr>
     <tr><td>Apollo hooks</td><td class="mono">useQuery / useMutation</td><td class="num">${f.apolloHookFiles}</td><td>—</td></tr></tbody></table></div>
     <h3 class="synch">Watch out</h3><ul class="cl">
     <li class="warn">${f.browserFetchFiles-f.browserFetchWithAuth} legacy files send no token. Calls into the ${JWT_SVCS.length} services that check it (${JWT_SVCS.join(", ")}) can fail.</li>
     <li class="warn">No backend, no build: <span class="mono">npm run build</span> / <span class="mono">dev</span> download the schema for codegen from <span class="mono">GRAPHQL_ENDPOINT</span>.</li>
     <li class="warn">${f.tests?"":"No automated tests: check by hand in the browser. "}${f.todoSearch} list screens have “TODO: implement search” (search does nothing).</li></ul>
     <h3 class="synch">Environment variable names</h3><div class="chips">${f.envNames.filter(n=>!["NODE_ENV","NEXT_RUNTIME"].includes(n)).map(n=>`<span class="chip">${esc(n)}</span>`).join("")}</div>
     <p class="hint">Values live in <span class="mono">.env.development</span> / <span class="mono">.env.production</span> on each machine, never in git.</p></section></div>`;
  return h;
}

/* ---------- Start with AI ---------- */
function feAI(){
  const f=FE.facts, unkPages=FE.pages.filter(p=>p.ops.some(o=>!o.svc.length)).sort((a,b)=>b.ops.filter(o=>!o.svc.length).length-a.ops.filter(o=>!o.svc.length).length);
  const mock=FE.pages.filter(p=>p.mock);
  let h=`<div class="fecols"><section><h3 class="synch">1 · Set up</h3><ol class="cl">${(FEH.setup||[]).map(s=>`<li><b>${s[0]}.</b> ${s[1]}</li>`).join("")}</ol>
    <p class="hint">Scripts on origin/dev: ${Object.keys(FE.scripts).filter(k=>["dev","build","lint","type-check","codegen:dev"].includes(k)).map(k=>`<span class="mono">npm run ${esc(k)}</span>`).join(" · ")}</p>
    ${FE.localDocs&&FE.localDocs.length?`<p class="hint">Your local folder also has ${FE.localDocs.map(d=>`<span class="mono">${esc(d)}</span>`).join(" and ")} (git-ignored, not on GitLab). Worth reading, and good to give an AI as context.</p>`:""}</section>
   <section><h3 class="synch">2 · Read these first</h3><ol class="cl">${FE.keyFiles.map(k=>`<li class="${k.exists?"":"warn"}"><span class="mono">${esc(feShort(k.path))}</span>${k.lines?` <span class="muted">${k.lines} lines</span>`:""}${k.exists?"":" <b>(moved or removed)</b>"}<br><span class="muted">${esc(k.why)}</span></li>`).join("")}</ol></section></div>
  <div class="fecols"><section><h3 class="synch">3 · Recipe: a new list + form screen</h3><ol class="cl">${(FEH.recipe||[]).map(r=>`<li><span class="mono">${r[0]}</span><br><span class="muted">${r[1]}</span></li>`).join("")}</ol>
    <p class="hint">See it for real in <button class="lnk" data-fetab="trace">How a page works</button>.</p>
    <h3 class="synch">Ground rules</h3><ul class="cl">${(FEH.rules||[]).map(r=>`<li>${feFill(r)}</li>`).join("")}</ul></section>
   <section><h3 class="synch">4 · Safe first tasks (found in the code)</h3><ul class="cl">
    <li><b>Fix screens calling removed operations</b>: ${FE.unknownOps.length} operations on ${unkPages.length} pages. Start with ${unkPages.slice(0,3).map(p=>`<button class="lnk" data-fepage="${esc(p.url)}" data-femod="${esc(p.module)}">${esc(p.url)}</button>`).join(", ")}.</li>
    <li><b>Make search work</b>: ${f.todoSearch} list screens have <span class="mono">// TODO: implement search</span>.</li>
    ${mock.length?`<li><b>Replace mock data</b> on ${mock.length} pages: ${mock.slice(0,4).map(p=>`<button class="lnk" data-fepage="${esc(p.url)}" data-femod="${esc(p.module)}">${esc(p.url)}</button>`).join(", ")}.</li>`:""}
    <li><b>Send the token</b> from ${f.browserFetchFiles-f.browserFetchWithAuth} legacy service files, or move them to the modern style (prompt 4 below).</li></ul>
    <h3 class="synch">5 · Prompts to copy</h3>${(FEH.prompts||[]).map((p,i)=>{ const t=feFill(p[1]); return `<div class="feprompt"><div class="fph"><b>${i+1}. ${esc(p[0])}</b><button class="fecopy" data-copy="${esc(t)}">Copy</button></div><pre>${esc(t)}</pre></div>`; }).join("")}
    <p class="hint">Placeholders are filled with real examples from the code; change them for your task.</p></section></div>`;
  return h;
}

/* ---------- right-hand card ---------- */
function feCard(){
  if(!FE) return `<p class="hint">No frontend data.</p>`;
  if(state.fetab==="path" && state.sel && INFRA[state.sel]) return null;   // normal infra card
  const p=state.fepage&&fePage(state.fepage);
  if(p && (state.fetab==="map" || state.fetab==="ai")){
    const by={}; p.ops.forEach(o=>(o.svc.length?o.svc:["?"]).forEach(s=>(by[s]=by[s]||[]).push(o.op)));
    const prompt=feFill((FEH.prompts||[])[0]?.[1]||"").replace(FE.trace.page?FE.trace.page.file:"\u0000",p.file);
    return `<p class="kind">Frontend page · ${esc(feMod(p.module))}</p><h2 class="mono" style="overflow-wrap:anywhere">${esc(p.url)}</h2>
     <div class="chips"><span class="chip">${p.style}</span>${p.mock?`<span class="chip warn">mock data</span>`:""}${p.token?`<span class="chip ok">sends token</span>`:""}</div>
     <dl class="rows"><dt>URL</dt><dd class="mono">/en${esc(p.url)}</dd><dt>File</dt><dd class="mono">${esc(feShort(p.file))}</dd></dl>
     <div><h3>Backend operations (${p.ops.length})</h3>${Object.keys(by).length?Object.entries(by).map(([s,ops])=>`<p style="margin:6px 0 2px">${s==="?"?`<span class="fewarn">✕ not in any backend schema</span>`:feSvc(s,"data-open")}</p><ul class="feops">${ops.map(o=>`<li class="mono ${s==="?"?"bad":""}">${s==="?"?esc(o):`<button class="lnk" data-cgo='${esc(JSON.stringify({svc:s,op:o}))}'>${esc(o)}</button>`}</li>`).join("")}</ul>`).join(""):`<p class="hint">None found.</p>`}</div>
     ${p.docs.length?`<div><h3>Query files</h3><ul class="feops">${p.docs.map(f=>`<li class="mono">${esc(f)}</li>`).join("")}</ul></div>`:""}
     ${p.services.length?`<div><h3>Legacy service files</h3><ul class="feops">${p.services.map(f=>`<li class="mono">${esc(f)}</li>`).join("")}</ul></div>`:""}
     ${p.comps.length?`<details><summary>Components (${p.comps.length})</summary><ul class="feops">${p.comps.map(f=>`<li class="mono">${esc(feShort(f))}</li>`).join("")}</ul></details>`:""}
     <button class="cta fecopy" data-copy="${esc(prompt)}">Copy an AI prompt: “explain this screen”</button>`;
  }
  if(state.femod && FE.modules[state.femod] && state.fetab==="map"){
    const m=FE.modules[state.femod];
    return `<p class="kind">Frontend module</p><h2>${esc(feMod(state.femod))}</h2>
     <dl class="rows"><dt>Pages</dt><dd>${m.pages} (${m.modern} modern, ${m.legacy} legacy)</dd><dt>Operations</dt><dd>${m.ops}</dd>${m.mock?`<dt>Mock data</dt><dd>${m.mock} pages</dd>`:""}</dl>
     <div><h3>Backend services it calls</h3><ul class="feops">${Object.entries(m.svcs).map(([s,n])=>`<li>${feSvc(s,"data-open")} <span class="muted">${n} page(s)</span></li>`).join("")}</ul></div>
     ${m.unknown.length?`<div><h3>Not in any backend schema (${m.unknown.length})</h3><ul class="feops">${m.unknown.map(o=>`<li class="mono bad">${esc(o)}</li>`).join("")}</ul></div>`:""}
     <p class="hint">Click a page in the list for its files and operations.</p>`;
  }
  const h=FE.head;
  return `<p class="kind">Frontend</p><h2>smartpos-web</h2>
   <dl class="rows"><dt>Branch</dt><dd class="mono">origin/dev</dd><dt>Commit</dt><dd class="mono">${esc(h.commit)} · ${esc(h.date)}</dd><dt>Last author</dt><dd>${esc(h.author)}</dd><dt>Files</dt><dd>${FE.files}</dd></dl>
   <div><h3>Stack</h3><ul class="feops">${Object.entries(FE.stack).map(([k,v])=>`<li><span class="mono">${esc(k)}</span> <span class="muted">${esc(v)}</span></li>`).join("")}</ul></div>
   <p class="hint">Built from the code on every refresh, like the rest of the Atlas.</p>`;
}
function feCopy(btn){
  const t=btn.dataset.copy, done=()=>{ const o=btn.textContent; btn.textContent="Copied ✓"; setTimeout(()=>btn.textContent=o,1500); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done,()=>{});
  else { const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); done(); }catch(e){} ta.remove(); }
}
function feWire(){
  const q=document.getElementById("feq");
  if(q){ q.oninput=()=>{ state.feq=q.value; const pos=q.selectionStart; document.getElementById("scroller").innerHTML=feHTML(); feWire(); const n=document.getElementById("feq"); n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} }; }
}
