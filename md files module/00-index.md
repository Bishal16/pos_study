# UniPOS study — index & progress

Goal: understand UniPOS end to end before ODCL/Expotech runs its own copy from **January 2027**.
Plan: `/home/mahathir/.claude/plans/hi-take-look-at-enumerated-hammock.md`

Scope: **Hire sale is out of scope** for ODCL. ERDs: `/home/mahathir/Downloads/Project Related Files/ERD/` (latest version per service, compare with code).

| # | Area | Notes file | Status |
|---|---|---|---|
| 1 | Infrastructure & runtime | `01-infrastructure.md` | ✅ code + dev server done (open questions remain) |
| 2 | Identity & tenancy (auth, authorization, configuration) | `02-identity-tenancy.md` | 🟡 written, awaiting your review |
| 3 | Master data (product, customer) | `03-master-data.md` | 🟡 written, awaiting your review |
| 4 | Procure → stock (purchase, approval, inventory) | `04-procure-to-stock.md` | 🟡 written, awaiting your review |
| 5 | Sell (sales, policy, promotion, payment) — no Hire | `05-sell.md` | 🟡 written, awaiting your review |
| 6 | Finance & compliance (accounts, vat, report) | `06-finance.md` | 🟡 written, awaiting your review |
| 7 | Frontend (smartpos-web) | `07-frontend.md` | 🟡 written, awaiting your review |
| 8 | Server walkthrough (dev/demo, read-only) | `08-servers.md` | ✅ dev done (demo is identical per user — skipped) |
| 4b | compliance + notification (received 2026-10-17, code on `origin/dev`) | fold into sessions 5/6 | ⚪ |
| E | Expotech current system — PaiPai POS (Grails 3.3 + Oracle) | `10-expotech-current.md` | 🟡 written, awaiting your review |
| 11 | Infra sources from server (gateway, Kong, Terraform, order .war) | `11-infra-sources.md` | ✅ read |
| 9 | Wrap-up: full diagrams, Walton-coupling list | `09-wrap-up.md` | 🟡 v2 (after E) |

Open questions: `questions-for-you.md`

## Session log
- **2026-10-17** — First scan of all repos, frontend and ERD folder. Session 1 (infrastructure) notes written from code. Key finds: Consul is only used for registering services, not for finding them; services don't check the JWT on `/graphql`; config typos in Kafka IP and consumer groups; schema managed by `ddl-auto=update`; monitoring backend `pulsehub` not identified yet.
- **2026-10-17 (later)** — Dev server inventory read. Real front door = **Kong 3.9 → new TypeScript Apollo gateway (Consul discovery) → 21 services**. pulsehub = OTel Collector + Jaeger + Prometheus + Grafana. No Elasticsearch. 3 services (compliance, notification, order) + the real gateway source are missing locally. Wrote `server-followup.sh`.
- **2026-10-17 (follow-up)** — Server infra = Terraform per component + pulsehub compose. Kong has no plugins → no server-side JWT check. OTel traces go only to stdout (Jaeger empty). Healthchecks fail with 401/403. Kafka: promotion never consumes; authz consumer stopped (lag 9). Script outputs in `script output/`.
- **2026-10-17** — User confirms dev (.190) and demo (.197) are identical → demo inventory skipped.
- **2026-10-17** — Session 2 (identity & tenancy). 4 services verify JWT (accounts, authz, config, purchase), ~10 don't. Permissions only drive the menu. ODCL merchant + 4 BINs seeded but no Expotech business areas. merchantScope lets any user pass another merchant's id. Token lacks isSuperAdmin claim.
- **2026-10-17** — User answered Q4,8,9,11,12,15,16,17 (+compliance & notification repos received; gateway/Kong/order pending from manager). Expotech: one Bogura branch, own policy, mostly retail, no EMI for now, own HRMS, **BOM needed (new)**. DB mapping: .196 demo, .200.52 dev → dev app uses demo DB (Q19).
- **2026-10-17** — Expotech runs **restaurant items** → BOM = recipes (ingredients consumed per sale). Expotech policy lives in their existing **Oracle DB** (access offered).
- **2026-10-17** — Expotech's current system = **Groovy/Grails** app on Oracle; user can share the codebase → plan a "current Expotech system" study (session E).
- **2026-10-17** — Session 3 (product, customer). Product = CAT→PL→MOD→SKU→BAT tree + settings attachable at any level (exact match, no inheritance). Price reaches the till via inventory scan (per-serial unit, grade A–E). **No BOM/recipe, no unit conversion; selling assumes a serial per unit** → main gaps for Expotech restaurants. Customer = party model (persons without merchant_id, organisations with approval), CRM extras, Hire tables in ERD not built.
- **2026-10-17** — Session 4 (purchase, approval, inventory). PR→PO→DO→receive (barcodes) → purchase-events → inventory instances + moving-average ledger; VAT purchase register via GraphQL. Approval = generic engine walking the business-area tree (new stage model; ERD outdated). Bugs: purchase approval.url port 10505 (should be 10519); sale ledger OUT uses MRP not cost; consumable issue = stubs. **Expotech gap: quantity-based (non-serial) selling + BOM ingredient deduction.**
- **2026-10-17** — Session 5 (sell). addSales → engine by sales type; Retail = 9 synchronous steps (customer, account, invoice, receivable, payment, GL, stock, VAT, report events). Server trusts browser prices; no remote rollback; cash-only hard-coded; policy & promotion engines exist but are **not called** by sales; returns record-only; cash sessions only in ERD. Expotech needs walk-in customer, quantity lines, split payment, till close, KOT/table orders.
- **2026-10-17** — Session 6 (accounts, vat, report). Purchase GL correct (inventory/VAT/AIT vs payable); **sales GL = Dr Cash / Cr Sales only — no VAT payable, no COGS**, all methods to cash. COA has no merchant_id; posting by COA keyword. VAT service covers Mushak 6.3, registers, credit/debit notes, 9.1 return. Report = Kafka-fed snapshots + Jasper. Restaurant VAT needs confirming.
- **2026-10-17** — Session 7 (frontend). Next 16 / React 19 / NextAuth v5, 237 CRUD pages, PM2 on .192. **Merchant comes from env `TEMP_MERCHANT_ID`, not the user** (one merchant per deployment). 202/204 fetch files send no token. Build needs live backend (codegen). Session 4 h, refresh unused. No receipt printing. Local copy on branch `sadat`. Expotech needs a new touch POS screen + thermal printing.
- **2026-10-17** — Session 9 (wrap-up v1): whole-system diagram, Kafka health map, top 15 findings, keep/change/remove/build per service, Walton-specific list, ODCL infra, phased plan, open decisions. Also skimmed compliance (branch audit checklists) and notification (templates, no Kafka listener). Remaining: session E (Expotech Grails code).
- **2026-10-17** — Session E: PaiPai POS (`paipaierp`, Grails 3.3 monolith on Oracle, 208 domains, 453 Jasper reports, one developer). Has recipes/BOM + nested + auto-production on sale, set menus, lots/expiry, full sales GL, table assign, online-order API, Mushak 4.3–9.1. Multi-industry flags (coffee, restaurant, convention, eyewear, eye-care, dental, pharma). 13 configs with DB passwords in git. Wrap-up v2: port PaiPai rules into UniPOS; migrate from PaiPai Oracle.
- **2026-10-17** — User confirms ODCL's UniPOS will run on **PostgreSQL** → cut-over = Oracle (PaiPai) → Postgres migration; planning notes added to `10-expotech-current.md` §8, Q40.
- **2026-10-18** — Q35: all Expotech lines live (F&B, convention, optical, eye-care, dental, pharmacy) → scope much wider; decision (a/b/c) added to 09 §10. Q37: Debobrato joins ODCL. Manager on leave 1 week: locate missing repos on server read-only, copy nothing without approval.
- **2026-10-18** — Collected infra sources from dev server → `walton-infra-copy/` (private; a few secret files slipped through exclusions). Gateway source confirmed (no JWT verify, Consul/k8s/static discovery). Kong repo = unfinished design (JWT/tenant plugins stubs; live /graphql route made by hand, no plugins). Infra Terraform complete. order-service only as .war (generic order CRUD) → Q41.
- **2026-10-18** — Setup guide deferred until ODCL infra work starts (~Jan 2027); outline agreed.
- **2026-10-24** — Refresh published (15 commits since 18 Oct). Walton rolled JWT verification (`@Authenticated`, purchase pattern) out to **customer, vat, report** → 8 services verify now (02 §3). report: balance sheet report added. vat/customer: big folder restructures, no table changes. Re-checked findings for authorization (Role now resolves its merchant via federation; still no API permission checks), sales/vat (follow configuration's businessArea→salesHub field rename), customer/vat (restructure only): all existing findings still hold. Sync now counts changes since the last publish and runs every 30 min 09:00–17:30 with `--auto`.
- **2026-10-25** — Refresh published (2 commits). **sales** now verifies the JWT (29 of 33 resolver classes) → 9 of 18; but its outgoing calls send no token yet ("step1"), so calls into customer/vat/configuration/accounts may now be rejected. authorization: 6 merchant-permission operations added; `hasPermission()` still unused. Timer re-installed (`*/30 9-17 * * *` with `--auto`).
