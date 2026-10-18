# Questions for you

Answer inline (write under each question) whenever convenient. ✅ = answered.

## Infrastructure (from 01-infrastructure.md)
- ✅ *(server: OTel Collector + Jaeger/Prometheus/Grafana — still: who maintains Grafana dashboards?)* **Q1.** What is `pulsehub` (the OTel endpoint `pulsehub:4318`)? SigNoz, Grafana stack, Elastic APM, something in-house? Where is its UI?
- ✅ *(dev: no Elasticsearch; only `docker logs`. Still ask: does anyone use Grafana/Jaeger today?)* **Q2.** Where do you see logs today — `docker logs`, Kibana/Elasticsearch, Grafana? Which server hosts Elasticsearch?
- ✅ *(Terraform per component in /mnt/workspace; pulsehub via compose)* **Q3.** How were the infra containers (Kafka, Consul, Postgres, apollo-server, pulsehub) created on the servers — docker-compose file, manual `docker run`, other Terraform? Is there a repo for that?
- ✅ **Q4.** Servers: `.190` = dev, `.197` = demo, `.196` = UniPOS DB, `.200.52` = pos-dev DB, `172.20.10.108` = Kafka. Is this right? Is there a production server yet?
  - ✅ **A:** No production server yet. (.190 dev app, .197 demo app; DBs see Q12.)
- ✅ *(server runs a different TS gateway; source in /mnt/workspace/apollo-server — **is it in GitLab? I need that repo**)* **Q5.** Is the gateway in `gateway-service/` (only 4 subgraphs enabled) the one deployed, or does the server have its own version? Is there a gateway git repo?
- ✅ *(No — Kong has no plugins; gateway only forwards the token. Is JWT verification planned? `api-gateway/security/jwt` exists but isn't applied)* **Q6.** Is authentication (JWT check) enforced anywhere besides the frontend — e.g. a Kong/nginx in front of the gateway?
- ✅ *(notification, compliance, order run on server — **are their repos available to you?** what is compliance-service?)* **Q7.** Is there a `notification-service` and a `price-service` somewhere (ports 10510/10502 referenced in old config)?
- ✅ **Q8.** Who runs deployments — every developer with `./deploy`, or one person? Any CI (GitLab CI) planned?
  - ✅ **A:** Every developer deploys with `./deploy`. No CI/CD yet, planned.

## Business
- ✅ **Q9.** Does Expotech follow the same "Walton Plaza evaluation & benefit distribution policy (v6)" or its own? Which sale types does Expotech use: Retail, Dealer, EMI, Corporate? (Hire = no ✅)
  - ✅ **A:** Expotech has **its own policy** (not Walton Plaza v6). Mostly **Retail**. Probably **no EMI** for now. Hire = no. → Need Expotech's policy document later.

## From the dev server inventory
- **Q10.** Can you get the source repos for: the TypeScript **apollo-server** gateway, **api-gateway** (Kong setup?), **compliance-service**, **notification-service**, **order-service**?
  - 🟡 **A:** compliance + notification received (code is on `origin/dev`; local `main` of notification is empty). **apollo-server gateway, Kong/api-gateway and order-service: manager will share later** — pending.
- ✅ **Q11.** Where does the frontend run (dev & demo)? It's not on 192.168.20.190.
  - ✅ **A:** Frontend runs on **192.168.20.192**.
- ✅ **Q12.** What is `192.168.200.52` vs `192.168.20.196`? report-service and approval-service on dev talk to `.200.52` while the rest use `.196` — intended?
  - ✅ **A:** `.196` = **demo DB**, `.200.52` = **dev DB**. ⚠ Follow-up Q19: this means the dev app server (.190) mostly talks to the *demo* DB.
- *(update: current authorization code has no Kafka listener — so the question is: should role/area events be consumed by anyone?)* **Q13.** authorization-service's Kafka consumer (`authz-group`) is not running and has 9 unread messages on `user-roles-topic` / `user-areas-topic`. Known to the team? (role/area changes may not propagate)
- **Q14.** Is the `api-gateway/` folder (Kong config with JWT/ACL, CI files) and `apollo-server/` in GitLab? Those two plus Terraform folders `message-broker`, `object-storage`, `service-registry`, `docker-network`, `pulsehub`, `caching-service` are the infrastructure ODCL would need to rebuild.
  - 🟡 **A:** same as Q10 — Kong/apollo-server/Terraform infra folders with the manager, to be shared later.

## Identity & tenancy (from 02)
- ✅ **Q15.** How is Expotech organised? (one shop or several? branches in Bogura? any regions/areas?) → needed to design ODCL's business-area tree. Does Expotech have an EBS customer id like Walton Plazas?
  - ✅ **A:** **One branch in Bogura.** No EBS customer id of its own. Mostly retail. **Bill of Materials (BOM) is very useful** (no BOM feature exists in UniPOS today → new requirement). Probably no EMI.
- ✅ **Q16.** How does someone become super admin today? The token has no `isSuperAdmin` claim but configuration-service checks it. Is this mid-development?
  - ✅ **A:** Super admin is **under development**.
- ✅ **Q17.** ODCL staff: are they in Walton HRMS? (users are linked to HRMS employees today)
  - ✅ **A:** Expotech has **its own HRMS**; users will be created separately (Walton HRMS sync not needed).
- **Q18.** Should permissions also be enforced on the backend, or is "hide the menu" the intended design?

## New (after your answers, 2026-10-17)
- **Q19.** You said `.196` = demo DB and `.200.52` = dev DB. But on the **dev** app server (.190) 13 services run with profile `db-unipos` = `.196`, and only report + approval use `.200.52`. So dev mostly writes into the demo DB. Is that intended (shared DB), or are the profile names misleading? Worth checking with the team.
- ✅ **Q20.** BOM: what does Expotech use it for — assembling products from parts (manufacturing/kitting), selling bundles/packages, or both? Any example?
  - ✅ **A:** Mostly **restaurant products** — food/drinks (coffee, tea…) made from raw materials. = recipe-style BOM: selling 1 item must consume ingredient stock.
- 🟡 **Q21.** Can you get Expotech's own sales policy document (like the Walton Plaza v6 PDF)?
  - 🟡 **A:** No document available. Rules live in Expotech's current system on an **Oracle DB**; user can provide access → plan read-only schema exploration (creds never in chat/notes).
  - Update: Expotech's codebase (**Groovy/Grails**) is also available → preferred source: domain classes = data model, services = policy rules. DB only as read-only, schema-only backup.
- **Pending from manager:** apollo-server gateway, Kong/api-gateway, order-service, infra Terraform folders.
- **Pending from user:** Expotech Groovy/Grails codebase (suggested location `/home/mahathir/Downloads/projects/expotech-legacy/`).

## Master data (from 03)
- ✅ **Q22.** BOM for Expotech: do recipes change by size (S/M/L)? Do you need modifiers (extra shot, no sugar)? Should ingredients be deducted **at the moment of sale**, or by a daily/periodic stock count? Track wastage?
  - ✅ **A:** Recipes are **fixed BOMs** (one fixed ingredient list per menu item; no modifiers mentioned). Deduction timing / wastage: not answered → assume deduct on sale.
- ✅ **Q23.** Rough size: how many menu items and raw materials does Expotech have? Do any items have their own barcode (bottled water, packaged snacks) mixed with made-to-order items?
  - ✅ **A:** Sizes not sure. **Packaged items exist** → Expotech needs both: barcode/packaged items (normal stock) and made-to-order items (BOM).

## Procure → stock (from 04)
- ✅ **Q24.** Who supplies Expotech today, local vendors? Is a purchase request + approval needed, or does the manager just order (PO only)?
  - ✅ **A:** Many suppliers, no fixed one like Walton. **Approval is needed** → keep PR/PO + approval engine (simple one-stage path).
- ✅ **Q25.** Do packaged items need expiry-date tracking (FIFO by expiry)? Is stock counted daily in the restaurant?
  - ✅ **A:** Yes, **expiry tracking** (FIFO by expiry) and **daily stock count** are both needed → need a stock-count/adjustment feature (ADJUST ledger) and expiry-based picking.

## Sell (from 05)
- 🟡 **Q26.** Restaurant flow at Expotech: counter sale only (pay first), or table service (order → kitchen ticket → bill later)? Hold/recall bills?
  - 🟡 **A:** Pay-first, maybe both — **to clarify with Expotech**.
- ✅ **Q27.** Payment methods used: cash, card, bKash/Nagad? Split payments? Do cashiers close a shift/till each day?
  - ✅ **A:** **All** — cash, card, bKash/Nagad, split payments, daily till/shift close.
- 🟡 **Q28.** Is a customer phone number required on every bill, or are most sales anonymous walk-ins? Any loyalty/points programme?
  - 🟡 **A:** Phone probably not required — **to ask**. Loyalty: to ask.
- 🟡 **Q29.** order-service (on the server, port 10515): do you know what it does? Is it for online/table orders? (repo pending from your manager)
  - 🟡 **A:** Unknown — **ask manager** (with the repo).

## 📋 To ask others (collected)
**Expotech:** Q35 business lines · Q36 website owner · Q38 live branch · Q32 hardware · Q33 offline · Q30 VAT category/rate/forms · Q26 counter vs table service · Q28 phone required? loyalty? · Q21 policy document (or Grails code) · Q22 wastage tracking, deduction timing · Q23 menu sizes.
**Your manager:** Q41 order-service source (everything else collected) · Q29 what order-service does.
**Walton team:** Q19 dev app using demo DB · Q13 role/area events · Q18 backend permission enforcement.

## Finance (from 06)
- 🟡 **Q30.** Expotech's VAT: which restaurant category / VAT rate do they charge on bills? Do they claim input VAT? Which Mushak forms do they file today? (ask Expotech's accounts person or see the Grails code)
  - 🟡 **A:** To ask Expotech.
- ✅ **Q31.** Does Expotech's accounts team need full accounting in the POS (GL, trial balance, income statement), or do they use separate accounting software (e.g. Tally) and only need sales/VAT reports from the POS?
  - ✅ **A:** **No other accounting software — all accounting happens in this system.** → accounts-service is essential; the sales-journal fixes (VAT payable, COGS, per-method) are must-haves.

## Frontend (from 07)
- 🟡 **Q32.** Expotech's hardware: touch screen? thermal receipt printer (80 mm)? kitchen printer? barcode scanner? cash drawer?
  - 🟡 **A:** Probably all of them — to verify with Expotech.
- 🟡 **Q33.** Is offline selling needed if the internet/server goes down (one Bogura branch talking to which server)?
  - 🟡 **A:** "No, maybe" — not a priority; confirm later.
- ✅ **Q34.** Your local frontend is on branch `sadat`. Is that your colleague's working branch? For study I'll treat `dev` as the reference — OK?
  - ✅ **A:** `sadat` = the senior frontend developer's branch. Reference = `dev`.

## Expotech / PaiPai (from 10)
- ✅ **Q35.** Which Expotech business lines are live today: coffee, restaurant, convention hall, eyewear/optical, eye-care, dental, pharmacy? Does ODCL's new system need to cover all of them, or only food & beverage + packaged retail?
  - ✅ **A:** **All of them are operating**: coffee, restaurant, convention, eyewear/optical, eye-care, dental, pharmacy. → ODCL system must cover all, not just F&B.
- **Q36.** The Expotech website/app sends online orders and customers to PaiPai (`/api/expotech/onlineOrder/save`, `/customer/save`). Who owns the website? It must be pointed at the new system.
- ✅ **Q37.** Is Debobrato Biswas (PaiPai developer) part of the ODCL team going forward? He is the main source of knowledge on PaiPai.
  - ✅ **A:** **Yes**, Debobrato will work with ODCL.
- **Q38.** Which branch is live at Expotech: `paipai-production` (= `main`, Jul 13) or is `Debobrato_Dev` (Oct 13) deployed somewhere?
- ✅ **Q39.** Plan: keep PaiPai running until UniPOS-ODCL is ready, then migrate data from PaiPai's Oracle DB? (This replaces the earlier "clean start vs migrate Walton rows" question.)
  - ✅ **A (partial):** Target DB will be **PostgreSQL** (not Oracle) → Oracle → Postgres migration. Still to confirm: PaiPai keeps running until cut-over?
- **Q30 (partial answer from code):** PaiPai supports VAT policy SDF-6.1/6.2 and TRADING/MANUFACTURING nature, with Mushak 4.3 using BOM. Expotech's actual setting is stored in the Oracle data.
- **Q40.** Migration scope: only masters + opening stock/balances at cut-over, with old history kept read-only in PaiPai? Or full history (invoices, Mushak registers) converted? (needs ODCL management + VAT consultant)
- Note 2026-10-18: manager on leave for 1 week → repos (gateway, Kong, order-service, Terraform) delayed; user has server access. Agreed approach: only *locate* them read-only on the server (paths, git remotes, sizes), copy nothing until the manager/authorised person approves.

## Infra sources (from 11)
- ✅ Q10/Q14 mostly solved: gateway, Kong and Terraform folders collected from the server (2026-10-18) → `walton-infra-copy/`. None of them were git repos.
- **Q41.** order-service: the server only has the compiled `.war`. Ask your manager for the source (GitLab `pos/order-service`?), or plan to rewrite it (it's small: orders, items, payment, shipment, tax, discount).
