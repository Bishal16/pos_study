/* ===================== Level 8: Apollo gateway (apollo-server) =====================
   Data: apollo.json from extract_apollo.py (origin/dev + service properties and schemas, plus a best-effort live Consul check).
   Hand-written text: facts.json APOLLO. Loaded before v2.js; only functions here. */
const AP = (()=>{ try{ return JSON.parse(document.getElementById("apollo").textContent)||null; }catch(e){ return null; } })();
const APH = __F.APOLLO || {};
const AP_TABS = [["what","What it is"],["reg","How services register"],["build","How the supergraph is built"],["req","How a request runs"]];

function apCap(){
  if(!AP) return "<b>Apollo gateway.</b> No data yet: run sync/refresh.sh (it runs atlas-src/extract_apollo.py).";
  return {
    what:`<b>The one address every GraphQL call goes through (apollo-server, origin/dev ${esc(AP.head.commit)} · ${esc(AP.head.date)}).</b> It holds no business data. It knows which service owns which field and passes each call on.`,
    reg:`<b>How a service joins.</b> A service never contacts the gateway. It registers in Consul, and the gateway finds it there.`,
    build:`<b>How ${AP.services.length} schemas become one.</b> The same six steps run at startup and every ${apPoll()} s. Click a step for what it does and what happens when it fails.`,
    req:`<b>One call through the gateway.</b> Which file does what, and which headers reach the services.`
  }[state.aptab]||"";
}
function apPoll(){ return Math.round((+AP.dev.INTROSPECTION_POLL_INTERVAL||30000)/1000); }
function apHTML(){
  if(!AP) return `<p class="hint">No gateway data. Run <span class="mono">sync/refresh.sh</span>.</p>`;
  return ({what:apWhat, reg:apReg, build:apBuild, req:apReq}[state.aptab]||apWhat)();
}
function apLive(){ return AP.live&&AP.live.services?AP.live:null; }
function apWhen(){ const l=apLive(); return l?l.at.replace("T"," "):""; }
function apOutside(){ const l=apLive(); return l?Object.entries(l.services).filter(([,v])=>v.outside.length):[]; }

/* ---------- What it is ---------- */
function apWhat(){
  const files=AP.files, dead=files.filter(f=>!f.used), l=apLive(), lines=files.reduce((a,f)=>a+f.lines,0);
  const b=node("kong",20,70,140,58,"Kong",":8000")+node("gateway",220,70,190,58,"Apollo gateway",`:${AP.dev.PORT} · supergraph`)+node("consul",220,190,190,58,"Consul",":8500 · who is alive")+
    `<g class="node"><rect class="b" x="490" y="48" width="200" height="102" rx="5"/><text class="t1" x="506" y="76">${AP.services.length} services</text><text class="t2" x="506" y="98">one GraphQL schema each</text><text class="t2" x="506" y="116">/graphql/</text><text class="t2" x="506" y="134">_service returns the schema</text></g>`+
    line(160,99,218,99,"ok","")+line(410,88,488,88,"ok","calls")+pathA("M490,128 L412,128","warn")+`<text class="lbl warn" x="450" y="146" text-anchor="middle">schemas</text>`+
    line(290,188,290,130,"warn","")+`<text class="lbl warn" x="352" y="164" text-anchor="middle">every ${apPoll()} s</text>`+pathA("M590,150 C590,219 500,219 412,219","")+`<text class="lbl" x="530" y="232" text-anchor="middle">each service registers itself</text>`;
  const groups={}; files.forEach(f=>{ const k=f.f.includes("/")?f.f.split("/")[0]:f.f; (groups[k]=groups[k]||[]).push(f); });
  let h=`<div class="stats"><span><b>${files.length}</b> source files</span><span><b>${lines.toLocaleString()}</b> lines of TypeScript</span><span><b>${AP.services.length}</b> services</span><span>refreshes every <b>${apPoll()} s</b></span>${l?`<span><b>${l.rootFields.toLocaleString()}</b> operations live</span>`:""}</div>`;
  h+=`<div class="frame">${svgWrap(710,250,b,"Kong sends calls to the Apollo gateway, which calls the services; the gateway learns about services from Consul")}</div>`;
  h+=`<div class="fecols"><section><h3 class="synch">In plain words</h3><ul class="cl">
    <li>The frontend sees one GraphQL API, but ${AP.services.length} services answer it.</li>
    <li>That one API is the <b>supergraph</b>: every service's schema merged, with a note of who owns each field.</li>
    <li>The gateway builds it by itself while running. No file lists the services.</li>
    <li>It doesn't check logins or hold data. Each service checks the token itself.</li></ul></section>
    <section><h3 class="synch">Addresses</h3><div class="tablewrap"><table class="synct apwrap"><tbody>
    <tr><td class="mono">POST /graphql</td><td>All GraphQL calls, including multipart uploads</td></tr>
    <tr><td class="mono">GET /graphql</td><td>Query explorer page on dev</td></tr>
    <tr><td class="mono">GET /health · /ready</td><td>Always answer OK while the process runs</td></tr>
    <tr><td class="mono">POST /api/upload/:service/:purpose</td><td>CSV upload route (see findings)</td></tr></tbody></table></div></section></div>`;
  h+=`<h3 class="synch">What to fix or watch (${apFindings().length})</h3><ul class="cl apfind">${apFindings().map(f=>`<li class="${f[0]}"><b>${f[1]}</b> ${f[2]}</li>`).join("")}</ul>`;
  h+=`<h3 class="synch">Inside the repo</h3><div class="tablewrap"><table class="synct apwrap"><thead><tr><th>folder</th><th>job</th><th>files</th></tr></thead><tbody>${Object.entries(groups).map(([k,fs])=>`<tr><td class="mono">${esc(k)}</td><td>${esc((APH.roles||{})[k]||"")}</td><td>${fs.map(f=>`<span class="mono apf ${f.used?"":"off"}" title="${f.used?f.lines+" lines":"not used by the running gateway"}">${esc(f.f.split("/").pop().replace(".ts",""))}</span>`).join(" ")}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">Crossed out: ${dead.length} files the running gateway never loads, worked out by following imports from Server.ts.</p>`;
  return h;
}
function apFindings(){
  const out=apOutside(), un=(AP.live&&AP.live.services)||{}, many=Object.entries(un).filter(([,v])=>v.usable>1&&!v.outside.length), f=AP.filter, l=apWhen(), c=AP.compose;
  const r=[];
  r.push(["bad","A developer's PC can receive real traffic.",`The docker and dev labels are fixed in application.properties, so a service run with the local profile (which points at the dev Consul) looks just like a deployed one, and the gateway takes the first match.${out.length?` On ${esc(l)} it saw ${out.map(([n,v])=>`<span class="mono">${esc(n)}</span> at <span class="mono">${esc(v.outside.join(", "))}</span>`).join(", ")} as usable. It wasn't listed first then, but nothing guarantees that.`:""}`]);
  if(c&&!c.ok) r.push(["bad",`origin/dev does not compose (${c.errorCount} errors).`,`When this code is deployed, the gateway will stop accepting schema updates. First error: ${esc((c.errors[0]||{}).msg||Object.values(c.parseErrors)[0]||"")}`]);
  r.push(["bad","One bad schema stops every update.","A composition error keeps the old supergraph and shows up only in the gateway's log. The API looks healthy while new operations never appear."]);
  r.push(["warn","The dependency check misses UniPOS's style.",`It looks for <span class="mono">extend type</span>, but these schemas use <span class="mono">type X @extends</span>. So it almost never removes anything${c&&Object.keys(c.blocks).length?`, and when ${Object.keys(c.blocks).length} services (${esc(Object.keys(c.blocks).join(", "))}) are down, composition fails instead`:""}.`]);
  r.push(["warn",`The filter is fixed to environment=${esc(f.environment||"dev")}.`,`That value is written in the gateway's code and in every service's properties, and the Terraform for qa, uat and prod uses the same image. ODCL should make it a setting.`]);
  r.push(["warn","The restart after each deploy looks unneeded.",`The deploy script restarts the gateway, which drops every in-flight call, though the ${apPoll()} s refresh already picks up the new schema. Check with your manager before removing it.`]);
  if(many.length) r.push(["warn","Old registrations pile up.",`${many.map(([n,v])=>`<span class="mono">${esc(n)}</span> has ${v.usable} passing entries`).join(", ")} on ${esc(l)}. It uses an HTTP check, and a redeployed container answers on the same address, so old entries keep passing. They're harmless while the address stays the same.`]);
  r.push(["warn","The dev Terraform doesn't match what runs.",`<span class="mono">terraform.tfvars</span> line 11 has an unclosed quote on PORT, and <span class="mono">container.tf</span> maps to internal port 4042 while PORT says ${esc(AP.dev.PORT)}. The running gateway answers on :${esc(AP.dev.PORT)}, so it wasn't built from this exact state.`]);
  r.push(["warn","The CORS allow-list has no effect.",`Server.ts calls <span class="mono">cors()</span> with no options first, which already allows every origin, before the configured list runs.`]);
  r.push(["warn","Correlation ids aren't created.",`The data source reads <span class="mono">context.correlationId</span>, but Server.ts only sets it inside <span class="mono">requestContext</span>. An id reaches the services only if the caller sent one.`]);
  r.push(["info","/api/upload looks unused on dev.",`It reads <span class="mono">*_SERVICE_URL</span> variables that the dev Terraform doesn't pass, and the frontend on origin/dev doesn't call it. GraphQL uploads use the multipart path instead.`]);
  r.push(["info","No JWT check here.","The gateway forwards the token and each service verifies it. ODCL's plan is to add the check here or in Kong."]);
  return r;
}

/* ---------- How services register ---------- */
function apReg(){
  const l=apLive(), f=AP.filter, out=apOutside();
  const b=`<g class="node"><rect class="b" x="20" y="70" width="210" height="96" rx="5"/><text class="t1" x="36" y="98">Spring Boot service</text><text class="t2" x="36" y="120">name, IP, port</text><text class="t2" x="36" y="138">deployment=${esc(f.deployment||"docker")}</text><text class="t2" x="36" y="156">environment=${esc(f.environment||"dev")}</text></g>`+
    node("consul",350,84,140,68,"Consul",":8500")+node("gateway",640,84,190,68,"Apollo gateway",`every ${apPoll()} s`)+
    line(230,100,348,100,"ok","1 · register",289,92)+line(230,134,348,134,"","2 · heartbeat",289,152)+
    line(638,118,492,118,"warn","3 · who is passing?",565,110)+
    pathA("M735,152 C735,232 125,232 125,168","ok")+`<text class="lbl" x="430" y="222" text-anchor="middle">4 · POST /graphql/ { _service { sdl } }: give me your schema</text>`;
  let h=`<div class="frame">${svgWrap(850,245,b,"A service registers in Consul and sends heartbeats. The gateway asks Consul who is passing, then asks each service for its schema")}</div>`;
  h+=`<div class="fecols"><section><h3 class="synch">Step by step</h3><ol class="festeps">${(APH.register||[]).map((s,i)=>`<li class="festep"><span class="fsn">${i+1}</span><div><p class="fst">${esc(s[0])}</p><p class="fsf mono">${esc(s[2])}</p><p class="fsx">${esc(s[1])}</p></div></li>`).join("")}</ol></section>
    <section><h3 class="synch">The gateway accepts an instance only if</h3><ul class="cl"><li>Consul says its checks are <b>passing</b></li><li>its label says <span class="mono">deployment=${esc(f.deployment)}</span></li><li>its label says <span class="mono">environment=${esc(f.environment)}</span></li><li>it has an address and port</li></ul>
    <p class="hint">If several match, it takes the first, so there's no load balancing.</p>
    <h3 class="synch">Adding a new service</h3><ol class="cl">${(APH.newsvc||[]).map(t=>`<li>${esc(t)}</li>`).join("")}</ol></section></div>`;
  if(out.length) h+=`<div class="syncbanner bad"><b>Not a server address in Consul: ${out.map(([n,v])=>esc(n)+" at "+esc(v.outside.join(", "))).join("; ")}</b><span>Seen ${esc(apWhen())}. Probably someone running the service on their own PC.</span></div>`;
  h+=`<h3 class="synch">Every service, from its code${l?` · live Consul ${esc(apWhen())}`:""}</h3><div class="tablewrap"><table class="synct fetable"><thead><tr><th>service</th><th>name in Consul</th><th>labels</th><th>alive check</th><th>default profile</th>${l?`<th>usable / registered</th><th>address used</th>`:""}</tr></thead><tbody>${AP.services.map(r=>{
    if(r.missing) return `<tr><td>${feSvc(r.id)}</td><td colspan="6" class="muted">no repo</td></tr>`;
    const v=l&&l.services[r.consul], bad=r.deployment!==f.deployment||r.environment!==f.environment;
    return `<tr><td>${feSvc(r.id)}</td><td class="mono">${esc(r.consul)}</td><td class="mono ${bad?"bad":""}">${esc(r.deployment)}/${esc(r.environment)}</td><td>${r.heartbeat?"heartbeat":"HTTP "+esc(r.health)}</td><td class="mono">${r.profile==="local"?`<span class="fewarn">local</span>`:esc(r.profile)}</td>${l?(v?`<td class="${v.usable?"":"bad"}">${v.usable} / ${v.total}</td><td class="mono">${esc(v.first)}${v.outside.length?` <span class="fewarn">+${esc(v.outside.join(", "))}</span>`:""}</td>`:`<td class="bad" colspan="2">not in Consul</td>`):""}</tr>`;
  }).join("")}</tbody></table></div><p class="hint">Registered counts include old entries that have stopped passing, which the gateway ignores.</p>`;
  return h;
}

/* ---------- How the supergraph is built ---------- */
function apBuild(){
  const steps=APH.steps||[], k=Math.min(state.apstep,steps.length-1), s=steps[k];
  let h=`<div class="apflow" role="group" aria-label="Supergraph build steps">${steps.map((x,i)=>`<button class="apstep ${i===k?"on":""}" data-apstep="${i}" aria-pressed="${i===k}"><span class="fsn">${i+1}</span><b>${esc(x[0])}</b><small>${esc(x[1])}</small></button>`).join("")}</div>`;
  h+=`<div class="apdetail"><p class="fsf mono">app/src/${esc(s[3])}</p><p>${esc(s[2])}</p><p class="apfail"><b>If it fails or finds a problem:</b> ${esc(s[4])}</p></div>`;
  h+=`<h3 class="synch">What the result looks like</h3><pre class="apcode"># cache/supergraph.graphql (shape; generated by Apollo, never edited by hand)
enum join__Graph {
  SALES_SERVICE @join__graph(name: "sales-service", url: "http://address:10514/graphql/")
  ...one line per service: this is how the gateway knows where to call
}
type Query {
  someOperation: Result @join__field(graph: SALES_SERVICE)   # who owns this operation
}</pre>`;
  h+=`<h3 class="synch">What happens when…</h3><div class="tablewrap"><table class="synct apwrap"><tbody>${(APH.scenarios||[]).map(x=>`<tr><td><b>${esc(x[0])}</b></td><td>${esc(x[1])}</td></tr>`).join("")}</tbody></table></div>`;
  const c=AP.compose;
  if(c){
    const bl=Object.entries(c.blocks), when=c.at.replace("T"," ");
    h+=`<h3 class="synch">Tested on the real schemas (origin/dev, ${esc(when)})</h3><div class="syncbanner ${c.ok?"ok":"bad"}"><b>${c.ok?`All ${AP.services.length} services compose`:`origin/dev does not compose: ${c.errorCount} error(s)`}</b><span>${c.ok?"Composed on this PC with the gateway's own library, on every refresh.":esc((c.errors[0]||{}).msg||"")}</span></div>
    <div class="fecols"><section><h3 class="synch">If it's down, updates stop for everyone (${bl.length})</h3><ul class="feops">${bl.map(([n,t])=>`<li>${feSvc(n)} <span class="muted mono">${esc([...new Set(t)].join(", "))}</span></li>`).join("")}</ul><p class="hint">The types listed would be left with one service extending them and nothing defining them.</p></section>
    <section><h3 class="synch">If it's down, only its own operations vanish (${c.vanish.length})</h3><p class="apchips">${c.vanish.map(n=>feSvc(n)).join(" ")}</p>${c.vanish.includes("authentication")?`<p class="hint">That includes authentication, so login disappears from the API too.</p>`:""}</section></div>`;
  }
  h+=`<h3 class="synch">Types shared across services: ${AP.shared.length}</h3><p class="hint">Federation joins services through these. In these schemas a type marked @extends needs at least one other service that has the same type.</p>
  <div class="tablewrap"><table class="synct apwrap"><thead><tr><th>type</th><th>defined by</th><th>extended by</th></tr></thead><tbody>${AP.shared.map(t=>`<tr><td class="mono">${esc(t.t)}</td><td>${t.owner.length?t.owner.map(o=>feSvc(o)).join(" "):`<span class="muted">only extensions</span>`}</td><td>${t.ext.map(o=>feSvc(o)).join(" ")}</td></tr>`).join("")}</tbody></table></div>`;
  return h;
}

/* ---------- How a request runs ---------- */
function apReq(){
  return `<ol class="festeps">${(APH.request||[]).map((s,i)=>`<li class="festep"><span class="fsn">${i+1}</span><div><p class="fst">${esc(s[0])}</p><p class="fsf mono">${esc(s[2])}</p><p class="fsx">${esc(s[1])}</p></div></li>`).join("")}</ol>
  <h3 class="synch">Headers copied to the services (${AP.forwarded.length})</h3><p class="apchips">${AP.forwarded.map(x=>`<span class="chip mono">${esc(x)}</span>`).join(" ")}</p>
  <p class="hint">Any other header stops at the gateway. A service that needs a new header won't get it until it's added to <span class="mono">FORWARDED_HEADERS</span>.</p>`;
}

/* ---------- Right-hand card ---------- */
function apCard(){
  if(!AP) return `<p class="hint">No gateway data.</p>`;
  if(state.sel&&INFRA[state.sel]) return null;   // normal infra card
  if(state.sel&&S[state.sel]) return null;
  const h=AP.head;
  return `<p class="kind">API gateway</p><h2>apollo-server</h2>
   <dl class="rows"><dt>Branch</dt><dd class="mono">origin/dev</dd><dt>Commit</dt><dd class="mono">${esc(h.commit)} · ${esc(h.date)}</dd><dt>Last author</dt><dd>${esc(h.author)}</dd><dt>Container</dt><dd class="mono">${esc(AP.dev.container_name)} :${esc(AP.dev.PORT)}</dd><dt>Node</dt><dd class="mono">${esc(AP.node)}</dd></dl>
   <div><h3>Stack</h3><ul class="feops">${Object.entries(AP.stack).map(([k,v])=>`<li><span class="mono">${esc(k)}</span> <span class="muted">${esc(v)}</span></li>`).join("")}</ul></div>
   <details><summary>Settings it reads (${AP.env.length} names)</summary><ul class="feops">${AP.env.map(e=>`<li class="mono">${esc(e)}</li>`).join("")}</ul></details>
   <p class="hint">Built from the code on every refresh. Live figures are from the dev Consul and gateway${apLive()?`, last read ${esc(apWhen())}`:""}.</p>`;
}
