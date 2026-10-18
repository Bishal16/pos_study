/* hand-written facts (atlas-src/facts.json) */
const __F = {"DOMAINS": {"id": {"name": "Identity & tenancy", "cls": "d-id"}, "md": {"name": "Master data", "cls": "d-md"}, "pr": {"name": "Procure → stock", "cls": "d-pr"}, "sell": {"name": "Sell", "cls": "d-sell"}, "fin": {"name": "Finance", "cls": "d-fin"}, "sup": {"name": "Support", "cls": "d-sup"}}, "SERVICES": [{"id": "authentication", "port": 10503, "dom": "id", "db": "auth", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "authentication-service", "jwt": "own", "tables": ["users", "user_business_areas", "refresh_tokens / user_tokens", "user_failed_logins", "employees (HRMS mirror)"], "find": ["Access token 7 days, refresh 15 days (code comment says 30 s)", "Token has userId, merchantId, businessAreaIds; no roles, no isSuperAdmin", "HRMS sync schedulers are commented out", "getKongSecret calls a dead ngrok URL"], "erd": "authentication-service.pdf", "notes": "02-identity-tenancy.md"}, {"id": "authorization", "port": 10509, "dom": "id", "db": "authorization_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "authorization-service", "jwt": true, "tables": ["menus (tree, en/bn)", "permissions", "permission_groups", "roles", "user_roles / user_permissions", "merchant_permissions"], "find": ["Permissions only build the frontend menu; no API checks a permission", "No Kafka listener in current code (old authz-group lag of 9)"], "erd": "authorization-service.pdf", "notes": "02-identity-tenancy.md"}, {"id": "configuration", "port": 10507, "dom": "id", "db": "configuration_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "configuration-service", "jwt": true, "tables": ["merchants (7 seeded, ODCL d1c36831…)", "merchant_bins", "business_area_types", "business_areas (tree)", "sales_hub_details", "system_parameters"], "find": ["merchantScope returns any requested merchant id: cross-tenant reads possible", "Checks isSuperAdmin claim the token never carries", "ERD v2 renames sales_hub_* → business_area_*; code not yet", "No ODCL business areas seeded"], "erd": "configuration-service-v2.pdf", "notes": "02-identity-tenancy.md"}, {"id": "product", "port": 10501, "dom": "md", "db": "product_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "product-service", "tables": ["product_types → categories → lines → models → skus → batches", "product_prices (+history, grade A–E)", "product_declared_prices (Mushak 4.3)", "business / stock controllers", "consumable items & suppliers"], "find": ["Settings attach to any level, but lookups are exact (no inheritance)", "No recipe/BOM and no unit conversion", "EBS ids on SKU and prices (Walton-specific)"], "erd": "product-service-v2.pdf", "notes": "03-master-data.md"}, {"id": "customer", "port": 10504, "dom": "md", "db": "customer", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "customer-service", "tables": ["persons (no merchant_id)", "business_organizations", "party_addresses / phones / emails", "customer_accounts, associates", "interaction_logs, surveys"], "find": ["Persons are shared across companies (only initiator_sales_hub_id)", "Dealer onboarding goes through approval", "sales-service also uses group customer-service-group"], "erd": "customer-service-v5.1.pdf", "notes": "03-master-data.md"}, {"id": "purchase", "port": 10508, "dom": "pr", "db": "purchase_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "purchase-service", "jwt": true, "tables": ["purchase_requests (+items, history)", "request_for_quotations, rfq_response", "proforma_invoices", "purchase_orders (+items)", "delivery_orders → do_product_controllers → delivery_order_items (1 per barcode)", "supplier group → legal entity → operating unit"], "find": ["approval.url uses port 10505; approval runs on 10519", "Outbox aggregateId is a hard-coded UUID", "Receive by start barcode + qty generates sequential barcodes"], "erd": "purchase-service -v3.pdf", "notes": "04-procure-to-stock.md"}, {"id": "approval", "port": 10519, "dom": "pr", "db": "approval_db", "host": "192.168.200.52 (dev DB, profile db-pos-dev)", "app": "approval_service", "tables": ["approval_workflows", "workflow_approval_path_mappings + path_routing_conditions", "approval_paths → stages → stage_roles", "approval_requests → request_stages → stage_actors", "approval_action_history, delegations"], "find": ["Approvers = users with the stage role, assigned to the requester's area ancestry", "Old step-based tables still present; April ERD shows only those", "No profile env on dev → falls back to local + db-pos-dev"], "erd": "approval-service.pdf", "notes": "04-procure-to-stock.md"}, {"id": "inventory", "port": 10513, "dom": "pr", "db": "inventory_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "inventory-service", "tables": ["product_stock_summary (hub, SKU, grade)", "product_instances (1 row per unit)", "item_ledgers (moving average)", "store house → zone → line → rack → grid → floor → container", "consumeable_stocks + ledgers", "goods_receive_notes"], "find": ["Selling needs a serial per unit (no quantity selling)", "Sale ledger OUT uses MRP, not cost", "Outbox poller commented out; consumable issue classes are stubs"], "erd": "inventory-service-v1.pdf (stale)", "notes": "04-procure-to-stock.md"}, {"id": "sales", "port": 10514, "dom": "sell", "db": "sales_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "sales-service", "ip": "172.20.0.23", "tables": ["sales_types (engine per type)", "sales_invoices → sales_lines → sales_serial_numbers", "retail / EMI / hire extensions", "sales_returns", "transaction_prefix_configurations", "targets, offers, incentives"], "find": ["Prices, discounts and VAT rate come from the browser", "Calls 7 services in a row; no rollback across them", "Payment hard-coded: cash, terminal 0, full amount", "order.url points to 10508 (purchase); order runs on 10515", "Returns only record; no stock-back or refund"], "erd": "sales-service-v2.pdf", "notes": "05-sell.md"}, {"id": "policy", "port": 10511, "dom": "sell", "db": "policy_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "policy-service", "tables": ["policy_engines", "engine_policy_maps", "sales_policies → condition groups → conditions", "outcomes, actions, targets", "sales_policy_history", "sales_type_engines"], "find": ["SpEL rule engine (evaluateForSalesType) is not called by sales or the frontend"], "erd": "policy-service-v2.pdf", "notes": "05-sell.md"}, {"id": "promotion", "port": 10506, "dom": "sell", "db": "promotion_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "promotion-service", "tables": ["discount_rules", "product_offerings", "promotional_code_offers", "loyalty programs / tiers / points / ledger", "rewards", "registered_products"], "find": ["Kafka address typo 172.10.10.108: consumer never joins", "Its purchase-events listener is commented out", "Not called during a sale"], "erd": "promotion-service.pdf", "notes": "05-sell.md"}, {"id": "payment", "port": 10516, "dom": "sell", "db": "payments_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "payment-service", "tables": ["payments → payment_details (per method) → payment_allocations", "refunds", "bank_deposits", "status / audit logs"], "find": ["Model supports split payment; sales always sends one cash payment", "Cash sessions and gift cards exist only in the ERD", "Kafka address typo 172.10.10.108"], "erd": "payment-service.pdf", "notes": "05-sell.md"}, {"id": "order", "port": 10515, "dom": "sell", "db": "?", "host": "not checked", "app": "order-service", "tables": ["orders, ordered_items", "order_payments, shipments", "order_tax, order_discount", "order_status_history, order_types"], "find": ["Only the compiled .war is in hand; source needed (Q41)", "Kong service 'orders' points here", "Sales calls it on the wrong port"], "erd": "—", "notes": "11-infra-sources.md"}, {"id": "accounts", "port": 10512, "dom": "fin", "db": "accounts_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "account-service", "jwt": true, "tables": ["chart_of_accounts (no merchant_id)", "general_ledger_headers / details", "voucher types / headers / details", "accounting_periods", "customer_accounts, receivables, payables", "banks, mobile_wallets, expenses, fixed assets"], "find": ["Sales GL = Dr Cash / Cr Sales only: no VAT payable, no COGS", "Purchase GL is correct (inventory, VAT, AIT vs payable)", "Posting picks accounts by COA keyword"], "erd": "accounts-service-v3.1.pdf", "notes": "06-finance.md"}, {"id": "vat", "port": 10517, "dom": "fin", "db": "vat_db", "host": "192.168.20.196 (demo DB, profile db-unipos)", "app": "vat-service", "ip": "172.20.0.26", "tables": ["tax_codes, product_vat_settings", "sales_invoice_vats (Mushak 6.3)", "purchase_invoice_vats", "vat_register_books", "credit / debit notes, transfers (6.5)", "vat_return_submission_form (9.1)"], "find": ["VAT extracted from VAT-inclusive MRP", "Register book assumes bought item = sold item"], "erd": "vat-service-v2.2.pdf", "notes": "06-finance.md"}, {"id": "report", "port": 10518, "dom": "fin", "db": "reports_db", "host": "192.168.200.52 (dev DB, profile db-pos-dev)", "app": "report-service", "tables": ["invoice_report_snapshots (+items)", "mushak_sales_summary_*", "item_ledger_entry snapshots", "gl_transactions, voucher snapshots, COA snapshot", "Jasper: invoice, Mushak 6.3, cash book, ledger, trial balance, income statement"], "find": ["Read model fed only by Kafka", "Runs on the dev DB while sales writes to the demo DB"], "erd": "report-service-v1.3.pdf", "notes": "06-finance.md"}, {"id": "compliance", "port": 10502, "dom": "sup", "db": "?", "host": "not checked", "app": "compliance-service", "tables": ["assessment templates / sections / items", "assessments, responses, evidence (MinIO)", "assessment approvals", "audit trail, system error / event logs"], "find": ["Branch audit checklists; probably not needed for one branch", "Evidence links point to 192.168.20.191:9001", "Kafka address typo 172.10.10.108 (consumer never joins)"], "erd": "—", "notes": "09-wrap-up.md", "jwt": true}, {"id": "notification", "port": 10510, "dom": "sup", "db": "?", "host": "not checked", "app": "notification-service", "tables": ["notification_templates (email / SMS / in-app)", "notification_queue", "delivery logs", "user preferences"], "find": ["No Kafka listener: approval's notification-events go nowhere", "Mail via Gmail SMTP", "Kafka address typo 172.10.10.108 (consumer never joins)"], "erd": "—", "notes": "09-wrap-up.md"}], "CALLS": {"accounts": ["configuration", "customer", "vat"], "approval": ["authentication", "authorization", "configuration", "customer", "purchase"], "authentication": ["configuration"], "authorization": ["configuration", "product"], "configuration": ["accounts"], "customer": ["accounts", "approval", "authentication", "configuration", "product"], "inventory": ["configuration", "product", "purchase", "vat"], "payment": ["accounts", "configuration"], "policy": ["configuration", "sales"], "product": ["configuration", "purchase"], "promotion": ["product"], "purchase": ["approval", "authentication", "configuration", "product", "vat"], "report": ["authorization"], "sales": ["accounts", "configuration", "customer", "inventory", "order", "payment", "product", "vat"], "vat": ["accounts", "configuration", "customer", "product", "purchase"], "compliance": ["configuration"], "notification": ["authentication"]}, "BADCALLS": {"purchase>approval": "configured port 10505, approval runs on 10519", "sales>order": "configured port 10508 (purchase), order runs on 10515"}, "TOPICS": [{"id": "approval-request-create-events", "p": ["purchase", "customer"], "c": [["approval", "approval-service-group"]], "st": "ok", "note": "Please start an approval workflow for this PR / PO / organisation."}, {"id": "approval-events", "p": ["approval"], "c": [["purchase", "purchase-service-group"], ["customer", "customer-service-group"]], "st": "warn", "note": "Links the new approval request id back to the document. sales-service also uses group customer-service-group, so it competes for these messages."}, {"id": "approvalRequest-events", "p": ["approval"], "c": [["purchase", "purchase-service-group"], ["customer", "customer-service-group"]], "st": "ok", "note": "Final status: APPROVED / REJECTED / RETURNED."}, {"id": "purchase-order-events", "p": ["approval"], "c": [["purchase", "purchase-service-group"]], "st": "ok", "note": "PO approval step actions."}, {"id": "purchase-events", "p": ["purchase", "approval"], "c": [["inventory", "inventory-service-group"], ["purchase", "purchase-service-group"]], "st": "ok", "note": "Delivery order received → inventory stock-in. The approval and promotion listeners are commented out in the code."}, {"id": "account-events", "p": ["purchase"], "c": [["accounts", "account-service-group"]], "st": "ok", "note": "DO receive → purchase journal (inventory, VAT, AIT vs payable)."}, {"id": "customer-events", "p": ["customer"], "c": [], "st": "unused", "note": "Survey customer created. Listeners in approval and customer are commented out."}, {"id": "chart-of-account", "p": ["accounts"], "c": [["report", "report"]], "st": "ok", "note": "COA snapshot for reports."}, {"id": "gl-entry", "p": ["accounts"], "c": [["report", "report"]], "st": "ok", "note": "GL lines snapshot."}, {"id": "voucher-snapshot", "p": ["accounts"], "c": [["report", "report"]], "st": "ok", "note": "Voucher snapshot."}, {"id": "item-ledger-entry", "p": ["inventory"], "c": [["report", "report"]], "st": "ok", "note": "Stock ledger snapshot for the item ledger report."}, {"id": "inventory-events", "p": ["inventory"], "c": [], "st": "unused", "note": "Nobody consumes it."}, {"id": "invoice-report-snapshot", "p": ["sales"], "c": [["report", "report"]], "st": "ok", "note": "Invoice print data."}, {"id": "mushak-sales-summary-report", "p": ["sales"], "c": [["report", "report"]], "st": "ok", "note": "VAT Mushak sales summary."}, {"id": "sales-invoice-created", "p": ["sales"], "c": [["promotion", "promotion-service-group", true]], "st": "dead", "note": "Only the unused old sales path publishes it, and promotion's Kafka IP is wrong."}, {"id": "account-events-sales", "p": ["sales"], "c": [], "st": "dead", "note": "Configured in sales, never used."}, {"id": "bank-deposit-events", "p": ["payment"], "c": [], "st": "unused", "note": "Nobody consumes it."}, {"id": "policy-events", "p": ["policy"], "c": [["policy", "policy"]], "st": "ok", "note": "Internal to policy-service."}, {"id": "user-roles-topic", "p": ["authentication"], "c": [], "st": "unused", "note": "authorization has no listener in current code (old group shows lag 9)."}, {"id": "user-areas-topic", "p": ["authentication"], "c": [], "st": "unused", "note": "As above."}, {"id": "user-deleted-topic", "p": ["authentication"], "c": [], "st": "unused", "note": "As above."}, {"id": "notification-events", "p": ["approval"], "c": [], "st": "unused", "note": "notification-service has no Kafka listener."}], "INFRA": {"browser": {"name": "Users' browsers", "kind": "client", "rows": [["Who", "Back-office staff and cashiers"], ["Uses", "Next.js pages, plus direct client-side GraphQL calls"]], "find": ["202 of 204 client fetch files send no Authorization header"]}, "frontend": {"name": "Next.js frontend", "kind": "web app", "rows": [["Host", "192.168.20.192"], ["Runtime", "Next.js 16, React 19, PM2 app UniPosDev"], ["Auth", "NextAuth v5 credentials → login mutation; session 4 h"], ["Merchant", "env TEMP_MERCHANT_ID (not from the user)"], ["Pages", "237 admin screens"]], "find": ["Build needs the live gateway (graphql-codegen)", "Refresh token is never used", "Local copy is on branch sadat; reference is dev"], "notes": "07-frontend.md"}, "kong": {"name": "Kong gateway 3.9", "kind": "edge proxy", "rows": [["Ports", ":8000 / :8443, admin :8001, GUI :8002"], ["Config DB", "kong_db @ 192.168.200.52"], ["Routes", "/graphql → apollo-server:4000; service orders → :10515"], ["Terraform", "/mnt/workspace/api-gateway"]], "find": ["No plugins: no JWT check, no rate limit", "/graphql route was created by hand (not in Terraform)", "Designed tenant-auth / workspace-guard plugins are 12-line stubs", "Admin API :8001 open on the LAN"], "notes": "11-infra-sources.md"}, "gateway": {"name": "Apollo Federation gateway", "kind": "API gateway", "rows": [["Port", ":4000 (container apollo-server)"], ["Stack", "Node 22, Apollo Gateway 2, Apollo Server 5, Express 5"], ["Discovery", "Consul catalog + health?passing, every 30 s (also k8s / static)"], ["Forwards", "authorization, merchant-id, user-id, x-tenant-id, x-correlation-id, traceparent"], ["Extras", "/health, /ready, file upload route, OTel"]], "find": ["Does not verify the JWT", "A subgraph that fails to compose is silently dropped", "Restarted after every service deploy"], "notes": "11-infra-sources.md"}, "consul": {"name": "Consul", "kind": "service registry", "rows": [["Port", ":8500 with UI"], ["Mode", "single server, bootstrap-expect=1"], ["Terraform", "/mnt/workspace/service-registry"]], "find": ["Services register with TTL heartbeats", "Only the gateway uses it for discovery; services call each other by fixed Docker names"]}, "kafka": {"name": "Kafka 7.5 (KRaft)", "kind": "message broker", "rows": [["IP", "172.20.10.108"], ["Ports", "internal kafka:29092, external 192.168.20.190:9092"], ["Extras", "kafka-rest, kafka-ui v0.7.1"], ["Topics", "22 (auto-create on)"], ["Terraform", "/mnt/workspace/message-broker"]], "find": ["Single node, no replication", "payment and promotion point at 172.10.10.108 (typo)"], "notes": "01-infrastructure.md"}, "minio": {"name": "MinIO", "kind": "object storage", "rows": [["Ports", ":9000 API, :9001 console"], ["Used by", "product images, customer documents, compliance evidence"], ["Terraform", "/mnt/workspace/object-storage"]], "find": ["compliance links point to 192.168.20.191:9001"]}, "redis": {"name": "Redis 7", "kind": "cache (not running)", "idle": true, "rows": [["IP", "172.20.10.102 :6379"], ["Extras", "redis-commander"], ["Terraform", "/mnt/workspace/caching-service"]], "find": ["Defined but not running on dev"]}, "pulsehub": {"name": "pulsehub (observability)", "kind": "monitoring", "rows": [["Parts", "OTel collector-contrib, Jaeger, Prometheus, Grafana"], ["Ports", "OTLP :4317 / :4318, metrics :8889"], ["Started by", "docker-compose in /mnt/workspace/pulsehub"]], "find": ["Traces and logs go only to the debug exporter: Jaeger stays empty", "Prometheus scrapes the collector and sales only", "Grafana has nothing provisioned; containers restart=no", "No log rotation; no Elasticsearch"], "notes": "08-servers.md"}, "pg196": {"name": "PostgreSQL 192.168.20.196", "kind": "database server", "rows": [["Role", "demo DB (profile db-unipos)"], ["Used by", "13 services on the dev server"], ["Layout", "one database per service"]], "find": ["Dev app server writes to the demo DB (Q19)", "Schema by ddl-auto=update, no migrations"]}, "pg52": {"name": "PostgreSQL 192.168.200.52", "kind": "database server", "rows": [["Role", "dev DB (profile db-pos-dev)"], ["Used by", "report-service, approval-service, Kong (kong_db)"]], "find": ["Reports read a different server than sales writes to"]}, "demo": {"name": "Demo app server 192.168.20.197", "kind": "host", "rows": [["Layout", "Same containers as the dev server (per user)"]], "find": ["Not inspected separately"]}, "host190": {"name": "Dev app server 192.168.20.190", "kind": "host", "rows": [["Hostname", "sposappmaster1"], ["Disks", "/ 56 GB, /mnt/workspace 270 GB (Docker data-root)"], ["Network", "walton-pos-cloud-network 172.20.0.0/16"], ["Deploy", "deploy-script: mvn package → scp war → terraform destroy + apply → restart apollo-server"]], "find": ["Images on :latest; no CI", "Healthchecks fail with 401/403 (Spring Security), Consul still sees them healthy"], "notes": "08-servers.md"}, "host192": {"name": "Frontend host 192.168.20.192", "kind": "host", "rows": [["Runs", "Next.js under PM2 (UniPosDev)"]], "find": []}}, "FLOWS": {"login": {"name": "Login", "cap": "How a user logs in and how the token travels afterwards. Only 4 services check it.", "lanes": [["browser", "Browser"], ["frontend", "Next.js (NextAuth)"], ["gateway", "Kong → gateway"], ["authentication", "authentication"], ["svc", "any service"]], "steps": [["browser", "frontend", "submit email + password"], ["frontend", "gateway", "mutation login(email, password)"], ["gateway", "authentication", "forward"], ["authentication", "authentication", "lockout check, then BCrypt match", "self"], ["authentication", "authentication", "sign RS256: access 7 d, refresh 15 d", "self"], ["authentication", "frontend", "accessToken, refreshToken, user", "ret"], ["frontend", "browser", "NextAuth session cookie (4 h)", "ret"], ["browser", "frontend", "open a page"], ["frontend", "gateway", "query + Bearer + merchant-id (TEMP_MERCHANT_ID)"], ["gateway", "svc", "forward headers, no check"], ["svc", "svc", "verified only in accounts, authorization, configuration, purchase", "self", "w"]]}, "sale": {"name": "Retail sale", "cap": "Scan, then the 9 steps of RetailSaleEngine.execute. All calls are synchronous; a failure late in the chain leaves records behind in other services.", "lanes": [["browser", "POS screen"], ["inventory", "inventory"], ["product", "product"], ["vat", "vat"], ["sales", "sales"], ["customer", "customer"], ["accounts", "accounts"], ["payment", "payment"], ["kafka", "Kafka → report"]], "steps": [["browser", "inventory", "scanProductToCart(barcode)"], ["inventory", "inventory", "reserve unit: AVAILABLE → RESERVED", "self"], ["inventory", "product", "RETAIL price for SKU + grade"], ["inventory", "vat", "output VAT %"], ["inventory", "browser", "price = MRP, cost, VAT %, serial", "ret"], ["browser", "browser", "cashier types discount (computed in browser)", "self", "w"], ["browser", "sales", "addSales: barcodes + prices from the browser", "sync", "w"], ["sales", "customer", "1 · find person by phone / NID, else create"], ["sales", "accounts", "2 · open a customer account (every sale)"], ["sales", "sales", "3 · build invoice, save", "self"], ["sales", "accounts", "4 · receivable"], ["sales", "payment", "5 · payment: cash, full amount", "sync", "w"], ["sales", "accounts", "6 · GL: Dr Cash / Cr Sales (no VAT, no COGS)", "sync", "w"], ["sales", "inventory", "7 · commitInvoiceStock → SOLD, ledger OUT"], ["sales", "vat", "8 · Mushak 6.3 + register book"], ["sales", "kafka", "9 · invoice + Mushak snapshots", "ev"], ["sales", "browser", "invoice", "ret"]]}, "procure": {"name": "Procure → stock", "cap": "Purchase request to goods on the shelf. Approval and stock-in travel over Kafka; VAT is a direct call.", "lanes": [["browser", "Hub user"], ["purchase", "purchase"], ["kafka", "Kafka"], ["approval", "approval"], ["inventory", "inventory"], ["accounts", "accounts"], ["vat", "vat"]], "steps": [["browser", "purchase", "create Purchase Request"], ["purchase", "kafka", "approval-request-create-events", "ev"], ["kafka", "approval", "start workflow", "ev"], ["approval", "kafka", "approval-events (approvalId)", "ev"], ["kafka", "purchase", "store approvalId", "ev"], ["approval", "approval", "approvers act stage by stage", "self"], ["approval", "kafka", "approvalRequest-events: APPROVED", "ev"], ["kafka", "purchase", "PR approved → PO (same approval loop)", "ev"], ["browser", "purchase", "DO arrives: scan barcodes (doReceive)"], ["purchase", "kafka", "purchase-events (received items)", "ev"], ["kafka", "inventory", "units AVAILABLE + ledger IN", "ev"], ["purchase", "kafka", "account-events", "ev"], ["kafka", "accounts", "Dr Inventory · VAT · AIT / Cr Payable", "ev"], ["purchase", "vat", "createPurchaseInvoiceVat (direct call)"]]}, "approval": {"name": "Approval round trip", "cap": "How approval-service picks a path and finds the approvers by walking the business-area tree.", "lanes": [["purchase", "requester (purchase / customer)"], ["kafka", "Kafka"], ["approval", "approval"], ["configuration", "configuration"], ["authorization", "authorization"], ["authentication", "authentication"]], "steps": [["purchase", "kafka", "approval-request-create-events {type, id, amount}", "ev"], ["kafka", "approval", "create approval request", "ev"], ["approval", "approval", "choose path by routing conditions (amount > X …)", "self"], ["approval", "configuration", "walk the business-area tree upward"], ["approval", "authorization", "users holding the stage roles"], ["approval", "authentication", "users assigned to those areas"], ["approval", "approval", "actors = role ∩ area · ANY / ALL / MAJORITY", "self"], ["approval", "kafka", "approval-events: approvalId", "ev"], ["kafka", "purchase", "save approvalId", "ev"], ["approval", "kafka", "approvalRequest-events: final status", "ev"], ["kafka", "purchase", "update document status", "ev"], ["purchase", "approval", "direct GraphQL call fails: port 10505", "sync", "b"]]}}, "LEVELS": [{"n": 0, "name": "At a glance", "cap": "<b>Front door → gateway → 18 services → shared infrastructure.<\/b> Kong and the Apollo gateway pass everything through; each service owns its PostgreSQL database and talks to the others over GraphQL and Kafka."}, {"n": 1, "name": "Hosts & network", "cap": "<b>Where each container runs.<\/b> One dev app server holds everything on a single Docker network; the frontend and both database servers are separate machines. Note the 13 services writing to the demo DB."}, {"n": 2, "name": "Request path & security", "cap": "<b>One GraphQL call, hop by hop.<\/b> Nothing before the service checks the token, and only 4 of 18 services check it at all."}, {"n": 3, "name": "Service calls", "cap": "<b>Direct GraphQL calls between services (WebClient, fixed Docker names).<\/b> Click a service to light up what it calls (teal) and what calls it (orange). Red dashed = wrong port in config."}, {"n": 4, "name": "Kafka events", "cap": "<b>Who publishes and who listens.<\/b> 22 topics. Dotted grey topics have no working consumer; red dashed links never deliver."}, {"n": 5, "name": "Key flows", "cap": ""}]};
const {DOMAINS,SERVICES,CALLS,BADCALLS,TOPICS,INFRA,FLOWS,LEVELS} = __F;

/* ===================== v2 additions to v1 data ===================== */
const CODE = JSON.parse(document.getElementById("code").textContent);
const STATUS = (()=>{ try{ return JSON.parse(document.getElementById("status").textContent)||{}; }catch(e){ return {}; } })();
/* code is the source of truth for these facts: ports, JWT verification, wrong-port URLs, Kafka address typos */
(function codeFacts(){
  SERVICES.forEach(sv=>{ const c=CODE[sv.id]; if(!c) return;
    if(c.port) sv.port=+c.port;
    if(c.jwt) sv.jwt=true; else if(sv.jwt===true) sv.jwt=false;
    const boot=Object.values(c.boot||{}).join(" ");
    if(boot.includes("172.10.10.108") && !sv.find.some(f=>f.includes("172.10.10.108"))) sv.find.push("Kafka address typo 172.10.10.108 (from code)"); });
  const ports=Object.fromEntries(Object.entries(CODE).filter(([k,v])=>v.port).map(([k,v])=>[k,+v.port]));
  const alias={account:"accounts",orders:"order"}, bad={};
  Object.entries(CODE).forEach(([s,c])=>Object.values(c.urls||{}).forEach(u=>{ const m=/https?:\/\/([a-z]+)-service:(\d+)/.exec(u); if(!m) return; const t=alias[m[1]]||m[1];
    if(t!==s && ports[t] && ports[t]!==+m[2]) bad[s+">"+t]="configured port "+m[2]+", "+t+" runs on "+ports[t]; }));
  if(Object.keys(CODE).some(k=>CODE[k].urls)){ Object.keys(BADCALLS).forEach(k=>delete BADCALLS[k]); Object.assign(BADCALLS,bad); }
})();
const JWT_SVCS = SERVICES.filter(s=>s.jwt===true).map(s=>s.id);
const S = Object.fromEntries(SERVICES.map(s=>[s.id,s]));
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
LEVELS[5].cap = "";
LEVELS.push({n:6,name:"Inside a service",cap:""});
LEVELS.push({n:7,name:"Sync",cap:""});
LEVELS[2].cap = "<b>One GraphQL call, hop by hop.</b> Nothing before the service checks the token, and only "+SERVICES.filter(s=>s.jwt===true).length+" of "+SERVICES.length+" services check it at all (from code).";
LEVELS[3].cap = "<b>Direct GraphQL calls between services.</b> Click a service: its outgoing calls light up teal with the <b>operation names</b> they use, incoming calls orange. Hover any arrow for its full list. Red dashed = wrong port in config.";
/* operation names per flow step (6th element) */
const STEPOPS = {
 login:{1:"login",4:"login (JwtUtil.generateToken)"},
 sale:{0:"scanProductToCart",2:"getApplicablePrice",3:"getProductVatSetting",6:"addSales",7:"getCustomerInfoByContact / addSurveyCustomer",8:"createSalesCustomerAccount",10:"addReceivable",11:"createPayment",12:"createSalesGeneralLedger",13:"commitInvoiceStock",14:"createSalesInvoiceVat",15:"invoice-report-snapshot · mushak-sales-summary-report"},
 procure:{1:"approval-request-create-events",3:"approval-events",6:"approvalRequest-events",8:"doReceive",9:"purchase-events",11:"account-events",13:"createPurchaseInvoiceVat"},
 approval:{0:"approval-request-create-events",3:"SearchBusinessArea / SearchBusinessAreaType",4:"getUserIdsByRoleIds",5:"getUserBusinessAreas",7:"approval-events",9:"approvalRequest-events",11:"searchApprovalRequestById (port 10505)"}
};
/* merged call graph: v1 matrix ∪ calls found in *GraphQLClient code */
const CALLOPS = {};
Object.entries(CALLS).forEach(([a,tos])=>tos.forEach(b=>{ (CALLOPS[a]=CALLOPS[a]||{})[b]=[]; }));
Object.entries(CODE).forEach(([a,d])=>Object.entries(d.calls||{}).forEach(([b,ops])=>{ if(!S[b]||a===b) return; (CALLOPS[a]=CALLOPS[a]||{})[b]=ops; }));
const EDGES = []; Object.entries(CALLOPS).forEach(([a,m])=>Object.keys(m).forEach(b=>EDGES.push([a,b])));
/* lenses */
const SEV = {sales:2,configuration:2,accounts:2,kong:2,gateway:2,frontend:2,compliance:0,minio:0,demo:0,consul:0,browser:0,host192:0,host190:1};
const VERDICT = {
 authentication:["change","Keep login/JWT; new RSA keys; drop HRMS sync + Kong/ngrok code; put merchant + admin flag in the token"],
 authorization:["keep","Roles, permissions, menus as is; create ODCL roles; hide Walton menus"],
 configuration:["change","Create Expotech business-area tree; fix merchant scope"],
 product:["build","Keep catalogue + prices; build recipe/BOM, unit conversion, item kinds (serial / quantity / made-to-order)"],
 customer:["keep","Person + phone; allow walk-in customers"],
 purchase:["change","Keep PR → PO → DO + approval; receive by quantity + expiry; fix approval URL"],
 approval:["keep","One-stage path for Expotech's manager"],
 inventory:["build","Quantity-based stock, BOM ingredient deduction, daily count, wastage, expiry FIFO"],
 sales:["build","Server-side price, quantity lines, walk-in, split payment, returns, hold/recall, table/KOT"],
 policy:["change","Wire evaluateForSalesType into the sale; configure Expotech's own policy"],
 promotion:["change","Fix Kafka config; wire loyalty / discount rules"],
 payment:["build","Split payments, cash sessions (till open/close), Z-report"],
 accounts:["change","Fix sales GL (VAT payable, COGS, per method); seed ODCL COA"],
 vat:["change","Configure restaurant VAT rate; check registers for BOM business"],
 report:["change","Keep Jasper; add daily sales, item-wise, Z-report, recipe cost"],
 compliance:["decide","Branch audit checklists; probably not needed for one branch"],
 notification:["decide","Useful later (low-stock, approval alerts); add a Kafka listener"],
 order:["decide","Source pending; could base online + table orders"],
 frontend:["build","Reuse back-office; new touch POS, receipt + KOT printing, token on every call"],
 kong:["decide","Finish JWT plugin, or drop Kong and verify in the gateway"],
 gateway:["change","Add JWT verification; static or Consul discovery"],
 consul:["keep","Works; optional for one site"], kafka:["keep","Single node is fine for one branch"],
 minio:["keep","New credentials"], redis:["remove","Not used"], pulsehub:["change","Send traces to Jaeger, add log rotation"],
 pg196:["change","Replaced by ODCL's own PostgreSQL"], pg52:["change","Replaced by ODCL's own PostgreSQL"],
 demo:["remove","Walton's server"], browser:["keep",""], host190:["change","ODCL's own host"], host192:["change","ODCL's own host"]
};
const VNAME = {keep:"keep",change:"change",build:"build new",decide:"decide",remove:"remove / hide"};

/* ===================== state ===================== */
const state = {level:0, flow:"sale", sel:"gateway", lens:"asis", inside:"sales", table:null, ctab:"tables", cfilter:"", step:-1, expand:{}, playing:null};
try{ const v=JSON.parse(localStorage.getItem("unipos-atlas")||"{}"); ["level","flow","lens","inside"].forEach(k=>{ if(v[k]!=null) state[k]=v[k]; }); if(!(state.level>=0&&state.level<=7)) state.level=0; if(!CODE[state.inside]) state.inside="sales"; }catch(e){}
const save=()=>{ try{ localStorage.setItem("unipos-atlas",JSON.stringify({level:state.level,flow:state.flow,lens:state.lens,inside:state.inside})); }catch(e){} };
const POS0 = {};

/* ===================== helpers ===================== */
const MK = ["ink","ok","bad","ev","warn","idle","out","in","hot"];
const defs = () => `<defs>${MK.map(m=>`<marker id="m-${m}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk-${m}"/></marker>`).join("")}</defs>`;
const mkFor = cls => cls.includes("bad")?"bad":cls.includes("ev")?"ev":cls.includes("warn")?"warn":cls.includes("idle")?"idle":cls.includes("ok")?"ok":"ink";
function nodeClass(id){
  const s=S[id], i=INFRA[id]; let c="node";
  if(s && s.jwt===true) c+=" jwt";
  if(i && i.idle) c+=" idle";
  c+=" sev"+(SEV[id]!=null?SEV[id]:((s&&s.find.length)||(i&&i.find.length)?1:0));
  if(VERDICT[id]) c+=" v-"+VERDICT[id][0];
  return c;
}
function domDot(id){ const s=S[id]; return s? DOMAINS[s.dom].cls : "d-inf"; }
function node(id,x,y,w,h,t1,t2,extra=""){
  POS0.__cur && (POS0.__cur[id]=[x+w/2,y+h/2,w,h]);
  const cy = t2? y+h/2-3 : y+h/2+4;
  return `<g class="${nodeClass(id)} ${extra}" data-id="${id}" tabindex="0" role="button" aria-label="${esc(t1)}"><rect class="b" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/><circle class="dot ${domDot(id)}" cx="${x+12}" cy="${cy-4}" r="4"/><text class="t1" x="${x+22}" y="${cy}">${esc(t1)}</text>${t2?`<text class="t2" x="${x+22}" y="${cy+15}">${esc(t2)}</text>`:""}</g>`;
}
function line(x1,y1,x2,y2,cls="",label="",lx,ly,lcls=""){
  let s=`<path class="e ${cls}" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#m-${mkFor(cls)})"/>`;
  if(label) s+=`<text class="lbl ${lcls}" x="${lx??(x1+x2)/2}" y="${ly??(y1+y2)/2-6}" text-anchor="middle">${esc(label)}</text>`;
  return s;
}
const pathA = (d,cls="",arrow=true)=>`<path class="e ${cls}" d="${d}" ${arrow?`marker-end="url(#m-${mkFor(cls)})"`:""}/>`;
const svgWrap = (w,h,body,label,cls="main")=>`<svg class="${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${defs()}${body}</svg>`;
const shorten = (arr,n=2)=>arr.length? arr.slice(0,n).join(", ")+(arr.length>n?` +${arr.length-n}`:"") : "(URL configured)";

/* ===================== Level 0 (also the mini map) ===================== */
function L0(hi){
  POS0.__cur = POS0.l0 = {};
  let b="";
  const row=[["browser",30,130,"Users' browsers","back-office + POS"],["frontend",245,180,"Next.js frontend",".192 · PM2"],["kong",510,150,"Kong 3.9",":8000 · no plugins"],["gateway",745,180,"Apollo gateway",":4000 · federation"],["consul",1010,140,"Consul",":8500 · registry"]];
  b+=`<text class="tag" x="30" y="18">Front door</text>`;
  row.forEach(r=>b+=node(r[0],r[1],28,r[2],62,r[3],r[4]));
  b+=line(160,59,243,59,"","pages",201,52)+line(425,59,508,59,"","POST /graphql",466,52)+line(660,59,743,59,"",":4000",701,52)+line(925,59,1008,59,"","every 30 s",966,52);
  b+=pathA("M95,90 C95,136 585,136 585,93","warn")+`<text class="lbl warn" x="300" y="128" text-anchor="middle">client fetch · mostly no token</text>`;
  const groups=[["id",["authentication","authorization","configuration"]],["md",["product","customer"]],["pr",["purchase","approval","inventory"]],["sell",["sales","policy","promotion","payment","order"]],["fin",["accounts","vat","report"]],["sup",["compliance","notification"]]];
  b+=`<text class="tag" x="30" y="166">Services (GraphQL subgraphs, Spring Boot)</text>`;
  groups.forEach((g,i)=>{ const x=30+i*189,y=175;
    b+=line(835,92,x+86,y-2,"");
    b+=`<rect class="grp" x="${x}" y="${y}" width="172" height="222" rx="6"/><circle class="dot ${DOMAINS[g[0]].cls}" cx="${x+12}" cy="${y+18}" r="4"/><text class="tag" x="${x+22}" y="${y+22}">${esc(DOMAINS[g[0]].name)}</text>`;
    g[1].forEach((id,k)=>b+=node(id,x+8,y+36+k*36,156,30,id,":"+S[id].port));
  });
  b+=`<path class="e bus" d="M116,430 H1065"/>`;
  [0,1,2,3,4,5].forEach(i=>b+=`<path class="e bus" d="M${116+i*189},397 V430"/>`);
  const inf=[["kafka","Kafka 7.5","22 topics · 1 node"],["pg196","PostgreSQL .196","demo DB · 13 svcs"],["pg52","PostgreSQL .200.52","dev DB · report, approval"],["minio","MinIO",":9000 files"],["redis","Redis 7","not running"],["pulsehub","pulsehub","OTel · Jaeger · Grafana"]];
  inf.forEach((r,i)=>{ const x=30+i*190; b+=line(x+85,430,x+85,468,""); b+=node(r[0],x,470,170,62,r[1],r[2]); });
  b+=`<text class="lbl" x="1172" y="452" text-anchor="end">own DB · Kafka events · OTel traces</text>`;
  POS0.__cur=null;
  if(hi){ // mini-map highlight of one flow step
    const P=POS0.l0, alias={svc:"sales"}; const a=P[alias[hi[0]]||hi[0]], c=P[alias[hi[1]]||hi[1]];
    if(a&&c&&a!==c){ b+=`<path class="e hotpath" d="M${a[0]},${a[1]} L${c[0]},${c[1]}" marker-end="url(#m-hot)"/>`; }
    [a,c].forEach(p=>{ if(p) b+=`<rect class="hotbox" x="${p[0]-p[2]/2-4}" y="${p[1]-p[3]/2-4}" width="${p[2]+8}" height="${p[3]+8}" rx="7"/>`; });
    return svgWrap(1180,548,b,"Where this step happens","mini");
  }
  return svgWrap(1180,548,b,"UniPOS at a glance: browser, frontend, Kong, Apollo gateway, 18 services in 6 domains, shared infrastructure");
}

/* ===================== Level 1 ===================== */
function L1(){
  let b="";
  b+=node("browser",20,40,170,56,"Users' browsers","https");
  b+=`<g class="${nodeClass("host192")}" data-id="host192" tabindex="0" role="button" aria-label="Frontend host"><rect class="host" x="20" y="140" width="170" height="120" rx="6"/><text class="t1" x="32" y="162">192.168.20.192</text></g>`;
  b+=node("frontend",32,180,146,62,"Next.js","PM2 UniPosDev")+line(105,96,105,178,"");
  b+=`<g class="${nodeClass("host190")}" data-id="host190" tabindex="0" role="button" aria-label="Dev app server"><rect class="host" x="230" y="20" width="700" height="720" rx="8"/><text class="t1" x="246" y="42">192.168.20.190 · dev app server (sposappmaster1)</text></g>`;
  b+=`<rect class="net" x="246" y="56" width="668" height="670" rx="6"/><text class="lbl ev" x="262" y="76">docker network walton-pos-cloud-network · 172.20.0.0/16</text>`;
  b+=node("kong",262,90,200,56,"kong-gateway 3.9",":8000 · admin :8001")+node("gateway",478,90,200,56,"apollo-server",":4000 · Node 22")+node("consul",694,90,200,56,"consul",":8500 · 1 server");
  b+=line(462,118,476,118,"")+line(678,118,692,118,"");
  b+=node("kafka",262,166,200,56,"kafka 7.5 + rest + ui","172.20.10.108 · 29092")+node("minio",478,166,200,56,"minio",":9000 · console :9001")+node("redis",694,166,200,56,"redis 7 (stopped)","172.20.10.102 · 6379");
  b+=node("pulsehub",262,242,632,56,"pulsehub: otel-collector · jaeger · prometheus · grafana","OTLP :4317/:4318 → debug only · metrics :8889");
  const order=["authentication","product","sales","authorization","customer","inventory","configuration","purchase","approval","accounts","policy","report","vat","promotion","payment","compliance","notification","order"];
  b+=`<text class="tag" x="262" y="318">18 service containers (war on Tomcat)</text>`;
  const pos={};
  order.forEach((id,i)=>{ const col=i%3,r=Math.floor(i/3),x=262+col*216,y=328+r*60; pos[id]=[x,y]; const s=S[id]; b+=node(id,x,y,200,48,id,":"+s.port+(s.ip?" · "+s.ip:"")); });
  b+=`<text class="lbl" x="262" y="712">each: /mnt/workspace/&lt;svc&gt;-service/IaC · deploy = terraform destroy + apply</text>`;
  b+=node("pg196",980,40,240,90,"PostgreSQL .196","demo DB · db-unipos")+`<text class="t3" x="1002" y="112">used by 13 services on dev</text>`;
  b+=node("pg52",980,170,240,90,"PostgreSQL .200.52","dev DB · db-pos-dev")+`<text class="t3" x="1002" y="242">report · approval · kong_db</text>`;
  b+=node("demo",980,320,240,70,"192.168.20.197","demo server · same layout");
  b+=pathA("M178,211 C220,211 220,118 260,118","")+`<text class="lbl" x="198" y="280" text-anchor="middle">:8000/graphql</text>`;
  b+=pathA("M894,352 H940 V85 H978","");
  [pos.approval,pos.report].forEach(p=>b+=pathA(`M${p[0]+200},${p[1]+24} H958 V215 H978`,"warn"));
  b+=pathA("M362,90 V50 H958 V215","warn",false)+`<text class="lbl warn" x="700" y="47" text-anchor="middle">kong_db</text>`;
  return svgWrap(1240,750,b,"Hosts and network");
}

/* ===================== Level 2 ===================== */
function L2(){
  let b="";
  const hops=[["browser","Browser","cookie session"],["frontend","Next.js server","proxy.ts"],["kong","Kong",":8000"],["gateway","Apollo gateway",":4000"],["svc","Service","/graphql/"]];
  const notes={browser:["NextAuth cookie, 4 h","holds accessToken","refresh token unused"],frontend:["redirects if not logged in","server fetch adds Bearer","merchant = TEMP_MERCHANT_ID","client fetch: 202/204 no token"],kong:["route /graphql (manual)","plugins: none","no JWT, no rate limit","config in kong_db"],gateway:["forwards authorization,","merchant-id, user-id,","x-correlation-id, traceparent","no token check"],svc:[JWT_SVCS.length+" verify RS256 signature",(SERVICES.length-JWT_SVCS.length)+" accept anonymous calls","merchantScope trusts the","requested merchant id"]};
  const warnLine={frontend:3,kong:1,gateway:3,svc:1};
  hops.forEach((h,i)=>{ const x=20+i*240;
    b+= h[0]==="svc" ? `<g><rect class="b" x="${x}" y="40" width="190" height="64" rx="5" style="fill:var(--surface);stroke:var(--line)"/><text class="t1" x="${x+16}" y="68">${h[1]}</text><text class="t2" x="${x+16}" y="84">${h[2]}</text></g>` : node(h[0],x,40,190,64,h[1],h[2]);
    b+=`<rect class="notebox" x="${x}" y="124" width="190" height="${18+notes[h[0]].length*20}" rx="5"/>`;
    notes[h[0]].forEach((t,k)=>b+=`<text class="t3 ${warnLine[h[0]]===k?"warn":""}" x="${x+12}" y="${146+k*20}">${esc(t)}</text>`);
    if(i<4) b+=line(x+190,72,x+238,72,"",["request","/graphql",":4000","subgraph"][i],x+214,64);
  });
  b+=`<text class="tag" x="20" y="262">Where the token comes from</text>`;
  b+=`<g class="${nodeClass("authentication")}" data-id="authentication" tabindex="0" role="button" aria-label="authentication"><rect class="b" x="20" y="274" width="330" height="128" rx="5"/><circle class="dot d-id" cx="32" cy="292" r="4"/><text class="t1" x="42" y="296">authentication-service</text><text class="t3" x="42" y="320">signs JWT RS256 with private_key.pem</text><text class="t3" x="42" y="340">access 7 days · refresh 15 days</text><text class="t3" x="42" y="360">claims: sub, userId, merchantId,</text><text class="t3" x="42" y="380">businessAreaIds (no roles, no admin)</text></g>`;
  b+=`<text class="tag" x="400" y="262">Checks the token with public_key.pem</text>`;
  JWT_SVCS.forEach((id,i)=>b+=node(id,400+i*(JWT_SVCS.length>4?160:200),274,JWT_SVCS.length>4?150:184,40,id,":"+S[id].port));
  b+=`<text class="tag" x="400" y="346">Accept calls without checking</text>`;
  SERVICES.filter(s=>s.jwt!==true).forEach((s,i)=>{ const c=i%7,r=Math.floor(i/7); b+=node(s.id,400+c*114,356+r*46,108,38,s.id,""); });
  b+=pathA("M350,330 H396","ok")+`<text class="lbl ok" x="373" y="322" text-anchor="middle">key</text>`;
  return svgWrap(1220,460,b,"Request path and security");
}

/* ===================== Level 3 ===================== */
const RING=["authentication","authorization","configuration","product","customer","purchase","approval","inventory","sales","policy","promotion","payment","order","accounts","vat","report","compliance","notification"];
function edgeTrim(cx,cy,ux,uy,w,h){ const ax=Math.abs(ux)<1e-6?1e9:(w/2)/Math.abs(ux), ay=Math.abs(uy)<1e-6?1e9:(h/2)/Math.abs(uy); const d=Math.min(ax,ay)+4; return [cx+ux*d, cy+uy*d]; }
function L3(){
  let b="",labels=""; const W=1000,H=800,CX=500,CY=400,R=320,NW=136,NH=42,P={};
  RING.forEach((id,i)=>{ const a=-Math.PI/2+i*2*Math.PI/RING.length; P[id]=[CX+R*Math.cos(a),CY+R*Math.sin(a)]; });
  EDGES.forEach(([from,to])=>{
    const [x1,y1]=P[from],[x2,y2]=P[to]; const mx=(x1+x2)/2,my=(y1+y2)/2; const c=[mx+(CX-mx)*.5,my+(CY-my)*.5];
    let u=[c[0]-x1,c[1]-y1],L=Math.hypot(...u); const s=edgeTrim(x1,y1,u[0]/L,u[1]/L,NW,NH);
    let v=[c[0]-x2,c[1]-y2]; L=Math.hypot(...v); const e=edgeTrim(x2,y2,v[0]/L,v[1]/L,NW,NH);
    const bad=BADCALLS[from+">"+to]; const ops=CALLOPS[from][to]; let cls=bad?"bad":"";
    const selS=S[state.sel]?state.sel:null;
    if(selS){ if(from===selS) cls+=" hot-out"; else if(to===selS) cls+=" hot-in"; else cls+=" dim"; }
    const m = cls.includes("hot-out")&&!bad?"out":cls.includes("hot-in")&&!bad?"in":mkFor(cls);
    b+=`<path class="e ${cls}" d="M${s[0].toFixed(1)},${s[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${e[0].toFixed(1)},${e[1].toFixed(1)}" marker-end="url(#m-${m})"><title>${from} → ${to}: ${esc(ops.length?ops.join(", "):"URL configured, no client class found")}${bad?" · "+bad:""}</title></path>`;
    if(selS && from===selS){ const qx=.25*s[0]+.5*c[0]+.25*e[0], qy=.25*s[1]+.5*c[1]+.25*e[1];
      labels+=`<text class="oplbl ${bad?"bad":""}" x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" text-anchor="middle">${esc(shorten(ops))}</text>`; }
  });
  RING.forEach(id=>{ const [x,y]=P[id]; b+=node(id,x-NW/2,y-NH/2,NW,NH,id,":"+S[id].port); });
  b+=labels;
  b+=`<text class="lbl" x="${CX}" y="${CY-6}" text-anchor="middle">${EDGES.length} direct calls</text><text class="lbl" x="${CX}" y="${CY+10}" text-anchor="middle">http://&lt;svc&gt;-service:&lt;port&gt;/graphql/</text>`;
  return svgWrap(W,H,b,"Service call map");
}

/* ===================== Level 4 ===================== */
function spread(items,minGap,top,bottom){
  items.sort((a,b)=>a.y-b.y);
  for(let i=1;i<items.length;i++) if(items[i].y-items[i-1].y<minGap) items[i].y=items[i-1].y+minGap;
  const over=items.length? items[items.length-1].y-bottom:0; if(over>0) items.forEach(it=>it.y-=over);
  for(let i=1;i<items.length;i++) if(items[i].y-items[i-1].y<minGap) items[i].y=items[i-1].y+minGap;
  return items;
}
function L4(){
  let b=""; const TX=460,TW=280,TH=24,top=72,step=32,ty={};
  TOPICS.forEach((t,i)=>ty[t.id]=top+i*step);
  const bottom=top+(TOPICS.length-1)*step, prods={}, cons={};
  TOPICS.forEach(t=>{ t.p.forEach(p=>(prods[p]=prods[p]||[]).push(ty[t.id])); (t.c.length?t.c:[["none"]]).forEach(c=>(cons[c[0]]=cons[c[0]]||[]).push(ty[t.id])); });
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const PL=spread(Object.keys(prods).map(id=>({id,y:avg(prods[id])})),46,top,bottom), CL=spread(Object.keys(cons).map(id=>({id,y:avg(cons[id])})),46,top,bottom);
  const py=Object.fromEntries(PL.map(p=>[p.id,p.y])), cy=Object.fromEntries(CL.map(c=>[c.id,c.y]));
  b+=`<text class="tag" x="40" y="40">Producer</text><text class="tag" x="${TX}" y="40">Topic</text><text class="tag" x="990" y="40">Consumer</text>`;
  TOPICS.forEach(t=>{ const y=ty[t.id];
    t.p.forEach(p=>b+=pathA(`M210,${py[p]} C335,${py[p]} 335,${y} ${TX-2},${y}`,t.st==="ok"||t.st==="warn"?"ev":"idle"));
    if(t.c.length) t.c.forEach(c=>b+=pathA(`M${TX+TW},${y} C865,${y} 865,${cy[c[0]]} 988,${cy[c[0]]}`,c[2]?"bad":(t.st==="dead"?"idle":"ev")));
    else b+=pathA(`M${TX+TW},${y} C865,${y} 865,${cy.none} 988,${cy.none}`,"idle");
  });
  TOPICS.forEach(t=>{ const y=ty[t.id]; b+=`<g class="node topic ${t.st}" data-id="topic:${t.id}" tabindex="0" role="button" aria-label="${t.id}"><rect class="b" x="${TX}" y="${y-TH/2}" width="${TW}" height="${TH}" rx="4"/><text class="t2" x="${TX+10}" y="${y+4}">${t.id}</text></g>`; });
  PL.forEach(p=>b+=node(p.id,40,p.y-17,170,34,p.id,""));
  CL.forEach(c=>{ b+= c.id==="none" ? `<g class="node idle sev1" data-id="none" tabindex="0" role="button" aria-label="no consumer"><rect class="b" x="990" y="${c.y-17}" width="170" height="34" rx="5"/><text class="t1" x="1004" y="${c.y+5}">no consumer</text></g>` : node(c.id,990,c.y-17,170,34,c.id,""); });
  return svgWrap(1200,bottom+40,b,"Kafka event map");
}

/* ===================== Level 5: sequence + player ===================== */
function L5(){
  const f=FLOWS[state.flow], LW=170, LM=60, lanes=f.lanes, W=LM+lanes.length*LW+40, H=110+f.steps.length*40, X={};
  lanes.forEach((l,i)=>X[l[0]]=LM+LW/2+i*LW);
  let b="";
  lanes.forEach(l=>{ const x=X[l[0]];
    b+=`<path class="life" d="M${x},66 V${H-10}"/>`;
    b+= (S[l[0]]||INFRA[l[0]]) ? node(l[0],x-LW/2+8,20,LW-16,42,l[1],"") : `<g><rect class="b" x="${x-LW/2+8}" y="20" width="${LW-16}" height="42" rx="5" style="fill:var(--tint);stroke:var(--line)"/><text class="t1" x="${x-LW/2+20}" y="46">${esc(l[1])}</text></g>`;
  });
  f.steps.forEach((s,k)=>{ const y=100+k*40, [a,c,label,kind="sync",flag]=s, xa=X[a], xc=X[c];
    let cls=kind==="ev"?"ev":kind==="ret"?"ret":""; if(flag==="w") cls+=" warn"; if(flag==="b") cls+=" bad";
    const lc=flag==="w"?"warn":flag==="b"?"bad":kind==="ev"?"ev":"";
    const rc = state.step<0?"":(k===state.step?"act":"dimrow");
    b+=`<g class="row ${rc}" data-step="${k}"><rect class="rowhit" x="0" y="${y-18}" width="${W}" height="36"/><circle class="stepn" cx="24" cy="${y}" r="10"/><text class="stepn-t" x="24" y="${y+3.5}" text-anchor="middle">${k+1}</text>`;
    if(a===c){ b+=pathA(`M${xa},${y-7} h28 v14 h-26`,cls)+`<text class="lbl ${lc}" x="${xa+34}" y="${y+4}">${esc(label)}</text>`; }
    else { const dir=xc>xa?1:-1, span=Math.abs(xc-xa), tw=label.length*6.4;
      b+=pathA(`M${xa},${y} L${xc-dir*3},${y}`,cls);
      b+= tw<span-16 ? `<text class="lbl ${lc}" x="${(xa+xc)/2}" y="${y-6}" text-anchor="middle">${esc(label)}</text>` : `<text class="lbl ${lc}" x="${Math.min(xa,xc)+8}" y="${y-6}">${esc(label)}</text>`; }
    b+=`</g>`;
  });
  return svgWrap(W,H,b,f.name+" sequence");
}
function playerHTML(){
  const n=FLOWS[state.flow].steps.length;
  return `<div class="player"><button id="pBack" aria-label="Previous step">‹ Back</button><button id="pPlay">${state.playing?"Pause":"Play"}</button><button id="pNext" aria-label="Next step">Next ›</button>
   <input id="pRange" type="range" min="0" max="${n-1}" value="${Math.max(0,state.step)}" aria-label="Step"><span class="pnum mono">${state.step<0?"all "+n+" steps":"step "+(state.step+1)+" / "+n}</span><button id="pAll">Show all</button></div>`;
}

/* ===================== Level 6: inside a service (mini ERD) ===================== */
function erdLayout(svc){
  const ents=CODE[svc].entities, by={}; ents.forEach(e=>by[e.cls]=e);
  const adj={}; ents.forEach(e=>adj[e.cls]=new Set());
  ents.forEach(e=>e.rels.forEach(r=>{ if(by[r.to]&&r.to!==e.cls){ adj[e.cls].add(r.to); adj[r.to].add(e.cls); } }));
  const seen=new Set(), order=[];
  const roots=[...ents].sort((a,b)=>adj[b.cls].size-adj[a.cls].size||a.table.localeCompare(b.table));
  roots.forEach(r=>{ if(seen.has(r.cls)) return; const q=[r.cls]; seen.add(r.cls);
    while(q.length){ const c=q.shift(); order.push(c); [...adj[c]].sort().forEach(n=>{ if(!seen.has(n)){ seen.add(n); q.push(n); } }); } });
  return {by,order};
}
function fieldsShown(e){
  const key=e.fields.filter(f=>f.pk||f.rel||f.soft), rest=e.fields.filter(f=>!(f.pk||f.rel||f.soft));
  const all=[...key,...rest]; const lim=state.expand[e.cls]?all.length:Math.max(8,key.length);
  return {list:all.slice(0,lim), more:all.length-Math.min(lim,all.length)};
}
function L6(){
  const svc=state.inside, d=CODE[svc];
  if(!d.entities.length){
    return svgWrap(900,200,`<rect class="notebox" x="20" y="20" width="860" height="160" rx="8"/><text class="t1" x="44" y="62">${esc(svc)}-service: no entity source in hand</text><text class="t3" x="44" y="92">${d.warOnly?"Only the compiled order-0.0.1.war was collected; its GraphQL schema ("+d.ops.length+" operations) is listed in the card.":"No @Entity classes found."}</text><text class="t3" x="44" y="118">Tables from the war's class names: ${esc(S[svc].tables.join(" · "))}</text>`,"no entities");
  }
  const {by,order}=erdLayout(svc), cols=order.length>28?5:order.length>14?4:3, BW=250, GX=60, RH=16, HH=34;
  const pos={}; let y=20, rowMax=0;
  order.forEach((cls,i)=>{ const col=i%cols; if(col===0&&i>0){ y+=rowMax+44; rowMax=0; }
    const e=by[cls], fs=fieldsShown(e), h=HH+fs.list.length*RH+(fs.more?RH:0)+(e.ext?RH:0)+8;
    pos[cls]={x:20+col*(BW+GX),y,h,fs}; rowMax=Math.max(rowMax,h); });
  const W=20+cols*(BW+GX), H=y+rowMax+30;
  let edges="", boxes="";
  order.forEach(cls=>{ const e=by[cls], p=pos[cls];
    e.rels.forEach(r=>{ if(!by[r.to]||r.to===cls) return;
      if(r.k==="OneToMany" && by[r.to].rels.some(x=>x.to===cls&&x.k==="ManyToOne")) return;
      const t=pos[r.to], fi=p.fs.list.findIndex(f=>f.n===r.f), sy= fi>=0 ? p.y+HH+fi*RH+RH/2-4 : p.y+HH/2;
      const ty=t.y+HH/2, right=t.x>p.x, same=t.x===p.x;
      const sx= same||right? p.x+BW : p.x, tx= same? t.x+BW : (right? t.x : t.x+BW);
      const bend= same? 40 : 0, c1=sx+(same||right?40:-40), c2=tx+(same?40:(right?-40:40));
      const hot=(state.table&&(state.table===cls||state.table===r.to))?" hot-out":"";
      edges+=`<path class="e rel${hot}" d="M${sx},${sy} C${c1},${sy} ${c2},${ty} ${tx},${ty}" marker-end="url(#m-${hot?"out":"ink"})"><title>${esc(e.table)}.${esc(r.f)} ${r.k} → ${esc(by[r.to].table)}</title></path>`;
      const many=r.k==="ManyToOne"||r.k==="ManyToMany", lx=sx+(same||right?6:-6), anchor=same||right?"start":"end";
      edges+=`<text class="card-n" x="${lx}" y="${sy-3}" text-anchor="${anchor}">${many?"*":"1"}</text>`;
    });
  });
  order.forEach(cls=>{ const e=by[cls], p=pos[cls], sel=state.table===cls;
    boxes+=`<g class="node ent${sel?" sel":""}" data-ent="${cls}" tabindex="0" role="button" aria-label="${esc(e.table)}"><rect class="b" x="${p.x}" y="${p.y}" width="${BW}" height="${p.h}" rx="5"/><rect class="enthead" x="${p.x}" y="${p.y}" width="${BW}" height="${HH-6}" rx="5"/>
      <text class="t1" x="${p.x+10}" y="${p.y+19}">${esc(e.table)}</text><text class="t2" x="${p.x+BW-8}" y="${p.y+19}" text-anchor="end">${esc(e.cls)}</text>`;
    p.fs.list.forEach((f,k)=>{ const fy=p.y+HH+k*RH+8; const tag=f.pk?"PK":f.rel?(f.rel==="ManyToOne"?"FK":f.rel==="OneToMany"?"1:n":f.rel==="OneToOne"?"1:1":"n:n"):"";
      boxes+=`<text class="fl" x="${p.x+10}" y="${fy}"><tspan class="ftag">${tag}</tspan>${tag?" ":""}${esc(f.c)}</text>`;
      if(f.soft) boxes+=`<g class="jump" data-jump="${f.soft[0]}"><text class="soft" x="${p.x+BW-8}" y="${fy}" text-anchor="end">→ ${esc(f.soft[0])}</text><title>${esc(f.soft[1])} lives in ${esc(f.soft[0])}-service (no foreign key)</title></g>`;
      else if(f.rel) boxes+=`<text class="ftype rel" x="${p.x+BW-8}" y="${fy}" text-anchor="end">${esc(f.to)}</text>`;
      else boxes+=`<text class="ftype" x="${p.x+BW-8}" y="${fy}" text-anchor="end">${esc(f.t.replace(/^java\.\w+\./,"").slice(0,18))}</text>`; });
    let ey=p.y+HH+p.fs.list.length*RH+8;
    if(p.fs.more){ boxes+=`<g class="more" data-more="${cls}"><text class="morelbl" x="${p.x+10}" y="${ey}">+ ${p.fs.more} more columns</text></g>`; ey+=RH; }
    else if(state.expand[cls]&&e.fields.length>8){ boxes+=`<g class="more" data-more="${cls}"><text class="morelbl" x="${p.x+10}" y="${ey}">− show fewer</text></g>`; ey+=RH; }
    if(e.ext) boxes+=`<text class="t2" x="${p.x+10}" y="${ey}">extends ${esc(e.ext)}</text>`;
    boxes+=`</g>`;
  });
  return svgWrap(W,H,edges+boxes,svc+" tables and relations");
}

/* ===================== pan / zoom ===================== */
const PZS = {};
function pzKey(){ return state.level+"|"+(state.level===6?state.inside:state.level===5?state.flow:""); }
function attachPZ(){
  const svgEl=document.querySelector("#scroller svg.main"); if(!svgEl) return;
  const b=svgEl.viewBox.baseVal, base={x:b.x,y:b.y,w:b.width,h:b.height}, key=pzKey();
  const v=PZS[key]?{...PZS[key]}:{...base};
  const apply=()=>{ svgEl.setAttribute("viewBox",`${v.x} ${v.y} ${v.w} ${v.h}`); PZS[key]={...v}; };
  apply();
  const toSvg=(cx,cy)=>{ const r=svgEl.getBoundingClientRect(); return [v.x+(cx-r.left)/r.width*v.w, v.y+(cy-r.top)/r.height*v.h]; };
  const zoom=(f,cx,cy)=>{ const [px,py]= cx==null?[v.x+v.w/2,v.y+v.h/2]:toSvg(cx,cy);
    const nw=Math.min(base.w*1.6,Math.max(base.w/10,v.w*f)), k=nw/v.w; v.x=px-(px-v.x)*k; v.y=py-(py-v.y)*k; v.w=nw; v.h=v.h*k; apply(); };
  svgEl.addEventListener("wheel",e=>{ if(!(e.ctrlKey||e.metaKey)) return; e.preventDefault(); zoom(e.deltaY>0?1.12:1/1.12,e.clientX,e.clientY); },{passive:false});
  const pts=new Map(); let last=null, pinch=null;
  svgEl.addEventListener("pointerdown",e=>{ if(e.target.closest(".node,.jump,.more,.row")&&e.pointerType==="mouse") return; pts.set(e.pointerId,[e.clientX,e.clientY]); svgEl.setPointerCapture(e.pointerId); last=[e.clientX,e.clientY]; if(pts.size===2){ const [a,c]=[...pts.values()]; pinch=Math.hypot(a[0]-c[0],a[1]-c[1]); } });
  svgEl.addEventListener("pointermove",e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,[e.clientX,e.clientY]);
    const r=svgEl.getBoundingClientRect();
    if(pts.size===2){ const [a,c]=[...pts.values()], d=Math.hypot(a[0]-c[0],a[1]-c[1]); if(pinch){ zoom(pinch/d,(a[0]+c[0])/2,(a[1]+c[1])/2); } pinch=d; return; }
    if(last){ v.x-=(e.clientX-last[0])/r.width*v.w; v.y-=(e.clientY-last[1])/r.height*v.h; last=[e.clientX,e.clientY]; apply(); } });
  const up=e=>{ pts.delete(e.pointerId); if(pts.size<2) pinch=null; if(!pts.size) last=null; };
  svgEl.addEventListener("pointerup",up); svgEl.addEventListener("pointercancel",up);
  svgEl.addEventListener("dblclick",e=>{ const n=e.target.closest(".node"); if(!n) return;
    if(S[n.dataset.id]){ openInside(n.dataset.id); return; }
    const bb=n.getBBox(); const pad=Math.max(bb.width,bb.height)*1.6; v.w=bb.width+pad*2; v.h=v.w*base.h/base.w; v.x=bb.x+bb.width/2-v.w/2; v.y=bb.y+bb.height/2-v.h/2; apply(); });
  document.getElementById("zIn").onclick=()=>zoom(1/1.25); document.getElementById("zOut").onclick=()=>zoom(1.25);
  document.getElementById("zFit").onclick=()=>{ Object.assign(v,base); apply(); };
}

/* ===================== search ===================== */
const INDEX=[];
(function build(){
  SERVICES.forEach(s=>{ INDEX.push({t:"service",l:s.id+"-service",k:s.id+" "+s.app,go:{svc:s.id}}); INDEX.push({t:"port",l:":"+s.port+" "+s.id,k:String(s.port),go:{svc:s.id}}); });
  Object.entries(INFRA).forEach(([id,i])=>INDEX.push({t:"infra",l:i.name,k:id+" "+i.name,go:{infra:id}}));
  TOPICS.forEach(t=>INDEX.push({t:"topic",l:t.id,k:t.id,go:{topic:t.id}}));
  Object.entries(CODE).forEach(([svc,d])=>{
    d.entities.forEach(e=>{ INDEX.push({t:"table",l:e.table,s:svc,k:e.table+" "+e.cls,go:{svc,table:e.cls}});
      e.fields.forEach(f=>INDEX.push({t:"column",l:e.table+"."+f.c,s:svc,k:e.table+"."+f.c+" "+f.n,go:{svc,table:e.cls}})); });
    d.ops.forEach(o=>INDEX.push({t:o.k==="Q"?"query":"mutation",l:o.n,s:svc,k:o.n,go:{svc,op:o.n}}));
  });
  INDEX.forEach(x=>x.kl=x.k.toLowerCase());
})();
function searchFor(q){
  q=q.trim().toLowerCase(); if(q.length<2) return [];
  const pri={service:0,infra:0,topic:1,port:1,table:2,query:3,mutation:3,column:4};
  return INDEX.filter(x=>x.kl.includes(q)).map(x=>({x,r:(x.kl.startsWith(q)||x.l.toLowerCase().startsWith(q)?0:1)*10+pri[x.t]})).sort((a,b)=>a.r-b.r||a.x.l.length-b.x.l.length).slice(0,14).map(o=>o.x);
}
function go(g){
  stopPlay();
  if(g.topic){ state.level=4; state.sel="topic:"+g.topic; }
  else if(g.infra){ state.level=["browser","frontend","kong","gateway","consul","kafka","pg196","pg52","minio","redis","pulsehub"].includes(g.infra)&&state.level===0?0:1; state.sel=g.infra; }
  else if(g.table||g.op){ state.level=6; state.inside=g.svc; state.table=g.table||null; state.ctab=g.op?"graphql":"tables"; state.cfilter=g.op||""; if(g.table) state.expand[g.table]=true; delete PZS[pzKey()]; }
  else if(g.svc){ if(state.level>4) state.level=0; state.sel=g.svc; }
  save(); render();
}
function openInside(svc){ stopPlay(); state.level=6; state.inside=svc; state.table=null; state.ctab="tables"; state.cfilter=""; save(); render(); }

/* ===================== cards ===================== */
function li(arr,cls=""){ return `<ul>${arr.map(x=>`<li class="${cls}">${esc(x)}</li>`).join("")}</ul>`; }
const verdictChip = id => VERDICT[id]&&VERDICT[id][1] ? `<span class="chip v v-${VERDICT[id][0]}">ODCL: ${VNAME[VERDICT[id][0]]}</span>` : "";
function callsIn(id){ return EDGES.filter(e=>e[1]===id).map(e=>[e[0],CALLOPS[e[0]][id]]); }
function svcCard(id){
  const s=S[id], out=Object.entries(CALLOPS[id]||{}), inn=callsIn(id);
  const prod=TOPICS.filter(t=>t.p.includes(id)).map(t=>t.id), cons=TOPICS.filter(t=>t.c.some(c=>c[0]===id)).map(t=>t.id+(t.c.find(c=>c[0]===id)[2]?" (broken)":""));
  const jwt=s.jwt===true?`<span class="chip ok">verifies JWT</span>`:s.jwt==="own"?`<span class="chip">issues JWT</span>`:`<span class="chip idle">no JWT check</span>`;
  const d=CODE[id];
  return `<p class="kind">${esc(DOMAINS[s.dom].name)} · microservice</p><h2>${esc(id)}-service</h2>
   <div class="chips"><span class="chip">:${s.port}</span>${jwt}${s.ip?`<span class="chip">${s.ip}</span>`:""}${verdictChip(id)}</div>
   <button class="cta" data-open="${id}">Open inside view: ${d.entities.length} tables · ${d.ops.length} operations ›</button>
   <dl class="rows"><dt>App name</dt><dd class="mono">${esc(s.app)}</dd><dt>Database</dt><dd><span class="mono">${esc(s.db)}</span> @ ${esc(s.host)}</dd></dl>
   <div><h3>Calls out (operation used)</h3>${out.length?`<ul>${out.map(([t,ops])=>`<li class="${BADCALLS[id+">"+t]?"bad":""}"><b>${t}</b> · <span class="mono">${esc(ops.length?ops.join(", "):"URL configured")}</span></li>`).join("")}</ul>`:"<p class='hint'>None.</p>"}</div>
   <div><h3>Called by</h3>${inn.length?`<ul>${inn.map(([f,ops])=>`<li><b>${f}</b> · <span class="mono">${esc(ops.length?ops.join(", "):"URL configured")}</span></li>`).join("")}</ul>`:"<p class='hint'>Nobody.</p>"}</div>
   <div><h3>Kafka</h3><dl class="rows"><dt>publishes</dt><dd class="mono">${prod.join(", ")||"—"}</dd><dt>consumes</dt><dd class="mono">${cons.join(", ")||"—"}</dd></dl></div>
   <div><h3>Findings</h3>${li(s.find,"warn")}</div>
   ${VERDICT[id]?`<div><h3>ODCL plan</h3><p class="hint">${esc(VERDICT[id][1])}</p></div>`:""}
   <div><h3>Read more</h3><p class="hint"><span class="mono">_unipos-study/${esc(s.notes)}</span> · ERD <span class="mono">${esc(s.erd)}</span></p></div>`;
}
function insideCard(){
  const id=state.inside, s=S[id], d=CODE[id], f=state.cfilter.toLowerCase();
  const tabs=[["tables","Tables "+d.entities.length],["graphql","GraphQL "+d.ops.length],["kafka","Kafka"],["calls","Calls"],["findings","Findings"]];
  let h=`<p class="kind">Inside · ${esc(DOMAINS[s.dom].name)}</p><h2>${esc(id)}-service</h2><div class="chips"><span class="chip">:${s.port}</span><span class="chip mono">${esc(s.db)}</span>${verdictChip(id)}</div>
   <div class="ctabs" role="tablist">${tabs.map(t=>`<button role="tab" data-tab="${t[0]}" aria-selected="${state.ctab===t[0]}">${t[1]}</button>`).join("")}</div>`;
  if(state.ctab==="tables"){
    if(state.table){ const e=d.entities.find(x=>x.cls===state.table);
      if(e) h+=`<div class="tdetail"><h3>Table <span class="mono">${esc(e.table)}</span> (${esc(e.cls)}${e.ext?" extends "+esc(e.ext):""})</h3><table class="cols"><tbody>${e.fields.map(fl=>`<tr><td class="mono">${fl.pk?"<b>PK</b> ":""}${esc(fl.c)}</td><td class="mono muted">${esc(fl.rel?fl.rel+" → "+fl.to:fl.t)}</td><td>${fl.soft?`<button class="lnk" data-jump="${fl.soft[0]}">→ ${esc(fl.soft[0])}</button>`:""}</td></tr>`).join("")}</tbody></table></div>`; }
    h+=`<input class="cfilter" id="cfilter" type="search" placeholder="Filter tables…" value="${esc(state.cfilter)}" aria-label="Filter tables">`;
    h+=`<ul class="tlist">${d.entities.filter(e=>!f||e.table.toLowerCase().includes(f)||e.cls.toLowerCase().includes(f)).map(e=>`<li><button class="lnk${state.table===e.cls?" on":""}" data-table="${e.cls}">${esc(e.table)}</button> <span class="muted">${e.fields.length} cols${e.rels.length?" · "+e.rels.length+" rel":""}</span></li>`).join("")||"<li class='muted'>No match.</li>"}</ul>`;
  } else if(state.ctab==="graphql"){
    h+=`<input class="cfilter" id="cfilter" type="search" placeholder="Filter operations…" value="${esc(state.cfilter)}" aria-label="Filter operations">`;
    ["Q","M"].forEach(k=>{ const ops=d.ops.filter(o=>o.k===k&&(!f||o.n.toLowerCase().includes(f)));
      h+=`<div><h3>${k==="Q"?"Queries":"Mutations"} (${ops.length})</h3><ul class="oplist">${ops.slice(0,150).map(o=>`<li><span class="mono">${esc(o.n)}</span>${o.a?`<span class="muted mono">(${esc(o.a)})</span>`:""}<span class="muted mono"> : ${esc(o.r)}</span></li>`).join("")}${ops.length>150?`<li class="muted">+${ops.length-150} more, filter to narrow</li>`:""}</ul></div>`; });
  } else if(state.ctab==="kafka"){
    const prod=TOPICS.filter(t=>t.p.includes(id)).map(t=>t.id);
    h+=`<div><h3>Listeners found in code</h3>${d.listen.length?`<ul>${d.listen.map(l=>`<li class="mono">${esc(l.t)} <span class="muted">(${esc(l.g||"default group")})</span></li>`).join("")}</ul>`:"<p class='hint'>None.</p>"}</div>
      <div><h3>Publishes</h3>${(prod.length||d.produce.length)?`<ul>${[...new Set([...prod,...d.produce])].map(t=>`<li class="mono"><button class="lnk" data-topic="${esc(t)}">${esc(t)}</button></li>`).join("")}</ul>`:"<p class='hint'>Nothing.</p>"}</div>`;
  } else if(state.ctab==="calls"){
    const out=Object.entries(CALLOPS[id]||{}), inn=callsIn(id);
    h+=`<div><h3>Calls out</h3>${out.length?`<ul>${out.map(([t,ops])=>`<li class="${BADCALLS[id+">"+t]?"bad":""}"><button class="lnk" data-open="${t}">${t}</button> · <span class="mono">${esc(ops.join(", ")||"URL configured")}</span></li>`).join("")}</ul>`:"<p class='hint'>None.</p>"}</div>
      <div><h3>Called by</h3>${inn.length?`<ul>${inn.map(([fr,ops])=>`<li><button class="lnk" data-open="${fr}">${fr}</button> · <span class="mono">${esc(ops.join(", ")||"URL configured")}</span></li>`).join("")}</ul>`:"<p class='hint'>Nobody.</p>"}</div>`;
  } else {
    h+=`<div><h3>Findings</h3>${li(s.find,"warn")}</div>${VERDICT[id]?`<div><h3>ODCL plan</h3><p class="hint">${esc(VERDICT[id][1])}</p></div>`:""}<div><h3>Read more</h3><p class="hint"><span class="mono">_unipos-study/${esc(s.notes)}</span> · ERD <span class="mono">${esc(s.erd)}</span></p></div>`;
  }
  return h;
}
function stepCard(){
  const f=FLOWS[state.flow];
  if(state.step<0) return `<p class="kind">Flow</p><h2>${esc(f.name)}</h2><p style="margin:0;font-size:.9rem">${esc(f.cap)}</p><p class="hint">${f.steps.length} steps. Press <b>Play</b> or <b>Next</b>, or click a row in the sequence.</p>`;
  const s=f.steps[state.step], [a,c,label,kind="sync",flag]=s, op=(STEPOPS[state.flow]||{})[state.step];
  const kinds={sync:"synchronous GraphQL call",ret:"response",ev:"Kafka event",self:"internal step"};
  const lane=id=>(f.lanes.find(l=>l[0]===id)||[id,id])[1];
  return `<p class="kind">${esc(f.name)} · step ${state.step+1} of ${f.steps.length}</p><h2>${esc(label)}</h2>
   <div class="chips"><span class="chip ${kind==="ev"?"ok":""}">${kinds[kind]}</span>${flag==="w"?`<span class="chip warn">problem</span>`:""}${flag==="b"?`<span class="chip bad">broken</span>`:""}</div>
   <dl class="rows"><dt>From</dt><dd>${esc(lane(a))}</dd><dt>To</dt><dd>${esc(lane(c))}</dd>${op?`<dt>Operation</dt><dd class="mono">${esc(op)}</dd>`:""}</dl>
   ${S[c]&&c!==a?`<button class="cta" data-open="${c}">Open ${esc(c)} inside view ›</button>`:""}`;
}
function card(){
  const el=document.getElementById("card");
  if(state.level===7){ el.innerHTML=syncCard(); return; }
  if(state.level===6){ el.innerHTML=insideCard(); return; }
  if(state.level===5){ el.innerHTML=stepCard(); return; }
  const id=state.sel;
  if(!id){ el.innerHTML=`<p class="hint">Click any box in the diagram to see its details.</p>`; return; }
  if(id.startsWith("topic:")){ const t=TOPICS.find(x=>"topic:"+x.id===id);
    const st={ok:["working","ok"],warn:["working, with a problem","warn"],unused:["no consumer","idle"],dead:["dead","bad"]}[t.st];
    el.innerHTML=`<p class="kind">Kafka topic</p><h2 class="mono">${esc(t.id)}</h2><div class="chips"><span class="chip ${st[1]}">${st[0]}</span></div><p style="margin:0;font-size:.9rem">${esc(t.note)}</p>
     <div><h3>Published by</h3><ul>${t.p.map(p=>`<li><button class="lnk" data-open="${p}">${p}</button></li>`).join("")}</ul></div>
     <div><h3>Consumed by (group)</h3>${t.c.length?`<ul>${t.c.map(c=>`<li class="${c[2]?"bad":""}"><button class="lnk" data-open="${c[0]}">${esc(c[0])}</button> <span class="mono">(${esc(c[1])})</span>${c[2]?" · never delivered":""}</li>`).join("")}</ul>`:"<p class='hint'>Nobody.</p>"}</div>`; return; }
  if(id==="none"){ el.innerHTML=`<p class="kind">Kafka</p><h2>No consumer</h2><p class="hint">Published but read by nobody: ${TOPICS.filter(t=>!t.c.length).map(t=>t.id).join(", ")}.</p>`; return; }
  if(S[id]){ el.innerHTML=svcCard(id); return; }
  const i=INFRA[id];
  if(i){ el.innerHTML=`<p class="kind">${esc(i.kind)}</p><h2>${esc(i.name)}</h2><div class="chips">${verdictChip(id)}</div><dl class="rows">${i.rows.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>${i.find.length?`<div><h3>Findings</h3>${li(i.find,"warn")}</div>`:""}${VERDICT[id]&&VERDICT[id][1]?`<div><h3>ODCL plan</h3><p class="hint">${esc(VERDICT[id][1])}</p></div>`:""}${i.notes?`<div><h3>Read more</h3><p class="hint"><span class="mono">_unipos-study/${esc(i.notes)}</span></p></div>`:""}`; return; }
  el.innerHTML=`<p class="hint">No details for this box.</p>`;
}

/* ===================== breadcrumb, legend, render ===================== */
function crumbs(){
  const svc = state.level===6? state.inside : (S[state.sel]? state.sel : null);
  const parts=[`<button data-crumb="sys">System</button>`];
  if(svc){ parts.push(`<button data-crumb="dom">${esc(DOMAINS[S[svc].dom].name)}</button>`); parts.push(`<button data-crumb="svc" data-svc="${svc}">${esc(svc)}-service</button>`); }
  if(state.level===6&&state.table){ const e=CODE[svc].entities.find(x=>x.cls===state.table); if(e) parts.push(`<button data-crumb="tbl">${esc(e.table)}</button>`); }
  document.getElementById("crumbs").innerHTML=parts.join(`<span aria-hidden="true">›</span>`);
}
function legend(){
  const sw=(cls)=>`<svg viewBox="0 0 30 14" aria-hidden="true"><path class="e ${cls}" d="M1,7 H29"/></svg>`;
  const box=(cls,fill)=>`<svg viewBox="0 0 30 14" aria-hidden="true"><g class="node ${cls}"><rect class="b" x="2" y="2" width="26" height="10" rx="2" ${fill?`style="fill:var(${fill})"`:""}/></g></svg>`;
  let h="";
  if(state.lens==="odcl") h=["keep","change","build","decide","remove"].map(v=>`<span>${box("",`--v-${v}`)}${VNAME[v]}</span>`).join("");
  else if(state.lens==="problems") h=`<span>${box("sev2")}serious</span><span>${box("sev1")}has issues</span><span>${sw("bad")}broken link</span><span>${sw("warn")}works, with a problem</span>`;
  else h=`<span>${box("jwt")}verifies JWT</span><span>${box("idle")}not running / no consumer</span><span>${sw("")}sync GraphQL call</span><span>${sw("ev")}Kafka event</span><span>${sw("bad")}broken / wrong config</span>`;
  h+=`<span>${["id","md","pr","sell","fin","sup"].map(d=>`<svg viewBox="0 0 10 14" style="width:10px" aria-hidden="true"><circle class="dot ${DOMAINS[d].cls}" cx="5" cy="7" r="4"/></svg>${DOMAINS[d].name}`).join(" ")}</span>`;
  document.getElementById("legend").innerHTML=h;
}
/* ===================== Level 7: sync status ===================== */
function syncState(){
  const st=STATUS; if(!st.generatedAt) return {cls:"idle",title:"No refresh has run yet",text:"Run sync/refresh.sh to build this page from origin/dev."};
  const review=(st.drift||[]).filter(d=>d.kind!=="review").length, rv=(st.drift||[]).length;
  if(st.fetchSkipped) return {cls:"warn",title:"Built without fetching from GitLab",text:"Showing code as of each repo's last fetch (see the dates below). Run a refresh on the office network to be current."};
  if(!st.fetchOk) return {cls:"warn",title:"Could not reach GitLab at the last refresh",text:"Showing code as of each repo's last successful fetch (see the dates below)."};
  if(review) return {cls:"bad",title:review+" Atlas fact(s) disagree with the code",text:"Listed under “To review”. They are corrected when the refresh is published."};
  if(rv) return {cls:"warn",title:"New commits to re-check",text:"The code changed in "+st.counts.repos+" repo(s); findings for those services should be re-read."};
  return {cls:"ok",title:"In sync with origin/dev",text:"Every repo was fetched and the Atlas facts match the code."};
}
function syncCap(){ const st=STATUS; return st.generatedAt? `<b>This page was built ${esc(st.generatedAt.replace("T"," "))} from origin/dev of every repo.</b> Refreshes run on the dev machine; each one compares the code with the previous run and with the Atlas's hand-written facts.` : "<b>Sync status.</b>"; }
function syncHTML(){
  const st=STATUS, ss=syncState(), ch=st.changes||{}, repos=st.repos||{}, fetch=st.fetch||{};
  const tableCls=(svc,t)=>{ const e=(CODE[svc]?.entities||[]).find(x=>x.table===t); return e?e.cls:null; };
  let h=`<div class="syncbanner ${ss.cls}"><b>${esc(ss.title)}</b><span>${esc(ss.text)}</span></div>`;
  if(!st.generatedAt) return h;
  const c=st.counts||{};
  h+=`<div class="stats"><span><b>${c.commits||0}</b> new commits</span><span><b>${c.repos||0}</b> repos changed</span><span><b>${c.schema||0}</b> schema</span><span><b>${c.ops||0}</b> operations</span><span><b>${c.calls||0}</b> calls</span><span><b>${c.kafka||0}</b> Kafka</span><span><b>${c.drift||0}</b> to review</span></div>`;
  if(ch.baseline) h+=`<p class="hint">First refresh: this is the baseline. Changes are listed from the next refresh on.</p>`;
  h+=`<h3 class="synch">Repos (origin/dev)</h3><div class="tablewrap"><table class="synct"><thead><tr><th>repo</th><th>commit</th><th>date</th><th>last author</th><th>new</th><th>fetch</th></tr></thead><tbody>${Object.entries(repos).map(([n,r])=>{ const f=fetch[n]||{};
    return `<tr><td>${S[n]?`<button class="lnk" data-sgo='${esc(JSON.stringify({svc:n}))}'>${esc(n)}</button>`:esc(n)}</td><td class="mono">${esc(r.commit||"")}</td><td>${esc(r.date||"")}</td><td>${esc(r.author||"")}</td><td class="num">${r.new||0}</td><td>${f.ok===false?`<span class="chip bad" title="${esc(f.msg)}">failed</span>`:f.ok===null?`<span class="chip">skipped</span>`:`<span class="chip ok">ok</span>`}</td></tr>`; }).join("")}</tbody></table></div>`;
  const commits=Object.entries(repos).filter(([n,r])=>r.commits&&r.commits.length);
  if(commits.length) h+=`<h3 class="synch">New commits</h3>`+commits.map(([n,r])=>`<details><summary><b>${esc(n)}</b> · ${r.new} commit(s)</summary><ul class="cl">${r.commits.map(x=>`<li><span class="mono">${esc(x.c)}</span> ${esc(x.d)} ${esc(x.a)}: ${esc(x.s)}</li>`).join("")}</ul></details>`).join("");
  const sec=(title,rows,fmt)=>rows&&rows.length?`<h3 class="synch">${title} (${rows.length})</h3><ul class="cl">${rows.map(fmt).join("")}</ul>`:"";
  h+=sec("Schema changes",ch.schema,r=>{ const cls=tableCls(r[0],r[1]); return `<li>${cls&&!r[3].includes("removed")?`<button class="lnk" data-sgo='${esc(JSON.stringify({svc:r[0],table:cls}))}'>${esc(r[0])}.${esc(r[1])}${r[2]?"."+esc(r[2]):""}</button>`:`<span class="mono">${esc(r[0])}.${esc(r[1])}${r[2]?"."+esc(r[2]):""}</span>`} <span class="muted">${esc(r[3])}</span></li>`; });
  h+=sec("GraphQL operations",ch.ops,r=>`<li>${r[2]==="operation added"?`<button class="lnk" data-sgo='${esc(JSON.stringify({svc:r[0],op:r[1]}))}'>${esc(r[0])} · ${esc(r[1])}</button>`:`<span class="mono">${esc(r[0])} · ${esc(r[1])}</span>`} <span class="muted">${esc(r[2])}</span></li>`);
  h+=sec("Service calls",ch.calls,r=>`<li>${esc(r[0])} → ${esc(r[1])} <span class="muted">${esc(r[2])}</span></li>`);
  h+=sec("Kafka",ch.kafka,r=>`<li>${esc(r[1])} ${esc(r[0])} <span class="mono">${esc(r[2])}</span>${r[3]?` <span class="muted">(${esc(r[3])})</span>`:""} <span class="muted">${esc(r[4])}</span></li>`);
  h+=`<h3 class="synch">To review: Atlas facts vs code (${(st.drift||[]).length})</h3>`+((st.drift||[]).length?`<ul class="cl">${st.drift.map(d=>`<li class="${d.kind==="review"?"":"warn"}">${d.svc?`<b>${esc(d.svc)}</b> `:""}${esc(d.msg)} <span class="chip">${esc(d.kind)}</span></li>`).join("")}</ul>`:`<p class="hint">Nothing: the Atlas matches the code.</p>`);
  h+=`<h3 class="synch">Refresh history</h3><div class="tablewrap"><table class="synct"><thead><tr><th>when</th><th>fetch</th><th>commits</th><th>schema</th><th>ops</th><th>calls</th><th>Kafka</th><th>review</th></tr></thead><tbody>${(st.history||[]).map(x=>`<tr><td>${esc(x.at.replace("T"," "))}</td><td>${x.fetchOk?"ok":x.fetchSkipped?"skipped":"failed"}</td><td class="num">${x.commits}</td><td class="num">${x.schema}</td><td class="num">${x.ops}</td><td class="num">${x.calls}</td><td class="num">${x.kafka}</td><td class="num">${x.drift}</td></tr>`).join("")}</tbody></table></div>`;
  return h;
}
function syncCard(){ const st=STATUS, ss=syncState(), p=st.published||{};
  return `<p class="kind">Sync</p><h2>How to read this</h2>
   <ul><li><b>In sync</b> means: every repo was fetched from GitLab, this page was built from those commits, and the Atlas's hand-written facts match the code.</li>
   <li>A refresh runs on the dev machine (<span class="mono">_unipos-study/sync/refresh.sh</span>), on a timer or by hand. It writes a report to <span class="mono">sync/reports/&lt;date&gt;.md</span>.</li>
   <li>To update this link, ask Claude to “publish the refresh”. Claude reviews the items under <b>To review</b>, fixes the Atlas facts, and republishes this page and the Living ERD.</li></ul>
   <dl class="rows"><dt>Built</dt><dd>${esc((st.generatedAt||"—").replace("T"," "))}</dd><dt>Status</dt><dd>${esc(ss.title)}</dd><dt>Last publish</dt><dd>${esc((p.at||"—").replace("T"," "))}</dd></dl>`; }
const RENDER=[()=>L0(),L1,L2,L3,L4,L5,L6,()=>""];
function render(){
  document.documentElement.dataset.lens=state.lens;
  document.querySelectorAll("#levels button").forEach(b=>b.setAttribute("aria-selected",String(+b.dataset.l===state.level)));
  document.querySelectorAll("#lens button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lens===state.lens)));
  const st=document.getElementById("subtabs"); st.hidden=state.level!==5;
  st.querySelectorAll("button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.f===state.flow)));
  const cap=document.getElementById("cap");
  if(state.level===5) cap.innerHTML=`<b>${esc(FLOWS[state.flow].name)}.</b> ${esc(FLOWS[state.flow].cap)}`;
  else if(state.level===6){ const d=CODE[state.inside]; cap.innerHTML=`<b>${esc(state.inside)}-service: ${d.entities.length} tables from its @Entity classes.</b> Solid arrows are JPA relations (* many, 1 one); <span style="color:var(--accent)">→ service</span> marks an id that lives in another service (no foreign key). Click a table for all its columns; click “+ more” to expand a box.`; }
  else if(state.level===7) cap.innerHTML=syncCap();
  else cap.innerHTML=LEVELS[state.level].cap;
  if(state.level===7){ document.getElementById("scroller").innerHTML=syncHTML(); legend(); crumbs(); card(); return; }
  let html=`<div class="zoombar"><span class="hint">Drag to pan · Ctrl/⌘ + scroll or pinch to zoom · double-click a service to go inside</span><button id="zOut" aria-label="Zoom out">−</button><button id="zIn" aria-label="Zoom in">+</button><button id="zFit">Fit</button></div>`;
  if(state.level===5) html=playerHTML()+html;
  if(state.level===6) html=`<div class="svcpick"><label for="svcsel">Service</label><select id="svcsel">${Object.keys(CODE).map(k=>`<option value="${k}" ${k===state.inside?"selected":""}>${k}-service (${CODE[k].entities.length} tables)</option>`).join("")}</select></div>`+html;
  html+=`<div class="frame">${RENDER[state.level]()}</div>`;
  if(state.level===5){ const s=FLOWS[state.flow].steps[state.step]; html+=`<div class="minicap tag-h">Where ${state.step<0?"the flow runs":"step "+(state.step+1)+" happens"} on the system map</div><div class="frame mini">${s?L0([s[0],s[1]]):L0(["browser","browser"])}</div>`; }
  document.getElementById("scroller").innerHTML=html;
  document.querySelectorAll("#scroller svg.main .node").forEach(n=>n.classList.toggle("sel",n.dataset.id===state.sel));
  attachPZ(); legend(); crumbs(); card();
  if(state.level===5){ wirePlayer(); const act=document.querySelector("#scroller .row.act"); }
  if(state.level===6){ document.getElementById("svcsel").onchange=e=>openInside(e.target.value); }
}
function select(id){ state.sel=id; if(state.level===3) render(); else { document.querySelectorAll("#scroller svg.main .node").forEach(n=>n.classList.toggle("sel",n.dataset.id===id)); crumbs(); card(); } }

/* ===================== player ===================== */
function stopPlay(){ if(state.playing){ clearInterval(state.playing); state.playing=null; } }
function setStep(k){ const n=FLOWS[state.flow].steps.length; state.step=Math.max(-1,Math.min(n-1,k)); render(); }
function wirePlayer(){
  const n=FLOWS[state.flow].steps.length;
  document.getElementById("pBack").onclick=()=>{ stopPlay(); setStep(state.step<=0?0:state.step-1); };
  document.getElementById("pNext").onclick=()=>{ stopPlay(); setStep(state.step+1); };
  document.getElementById("pAll").onclick=()=>{ stopPlay(); setStep(-1); };
  document.getElementById("pRange").oninput=e=>{ stopPlay(); setStep(+e.target.value); };
  document.getElementById("pPlay").onclick=()=>{ if(state.playing){ stopPlay(); render(); return; }
    if(state.step>=n-1) state.step=-1;
    state.playing=setInterval(()=>{ if(state.step>=n-1){ stopPlay(); render(); return; } setStep(state.step+1); },1700); setStep(state.step+1); };
}

/* ===================== wiring ===================== */
document.getElementById("levels").innerHTML=LEVELS.map(l=>`<button role="tab" data-l="${l.n}"><span class="n">${l.n}</span>${esc(l.name)}</button>`).join("");
document.getElementById("subtabs").innerHTML=Object.entries(FLOWS).map(([k,f])=>`<button role="tab" data-f="${k}">${esc(f.name)}</button>`).join("");
document.getElementById("levels").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; stopPlay(); state.level=+b.dataset.l; if(state.level===3&&!S[state.sel]) state.sel="sales"; save(); render(); });
document.getElementById("subtabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; stopPlay(); state.flow=b.dataset.f; state.step=-1; save(); render(); });
document.getElementById("lens").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; state.lens=b.dataset.lens; save(); render(); });
document.getElementById("crumbs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; const c=b.dataset.crumb; stopPlay();
  if(c==="sys"){ state.level=0; state.sel=null; } else if(c==="dom"){ state.level=0; } else if(c==="svc"){ openInside(b.dataset.svc); return; } else if(c==="tbl"){ state.ctab="tables"; }
  save(); render(); });
const sc=document.getElementById("scroller");
sc.addEventListener("click",e=>{
  const sg=e.target.closest("[data-sgo]"); if(sg){ try{ go(JSON.parse(sg.dataset.sgo)); }catch(_){} return; }
  const j=e.target.closest("[data-jump]"); if(j){ openInside(j.dataset.jump); return; }
  const m=e.target.closest("[data-more]"); if(m){ const k=m.dataset.more; state.expand[k]=!state.expand[k]; render(); return; }
  const en=e.target.closest("[data-ent]"); if(en){ state.table=en.dataset.ent; state.ctab="tables"; render(); return; }
  const r=e.target.closest(".row[data-step]"); if(r){ stopPlay(); setStep(+r.dataset.step); return; }
  const n=e.target.closest(".node"); if(n&&n.dataset.id&&n.closest("svg.main")) select(n.dataset.id);
});
sc.addEventListener("keydown",e=>{ if(e.key!=="Enter"&&e.key!==" ") return; const n=e.target.closest(".node"); if(!n) return; e.preventDefault();
  if(n.dataset.ent){ state.table=n.dataset.ent; state.ctab="tables"; render(); } else if(n.dataset.id) select(n.dataset.id); });
const cardEl=document.getElementById("card");
cardEl.addEventListener("click",e=>{
  const o=e.target.closest("[data-open]"); if(o){ openInside(o.dataset.open); return; }
  const t=e.target.closest("[data-tab]"); if(t){ state.ctab=t.dataset.tab; state.cfilter=""; card(); return; }
  const tb=e.target.closest("[data-table]"); if(tb){ state.table=tb.dataset.table; state.expand[tb.dataset.table]=true; render(); return; }
  const j=e.target.closest("[data-jump]"); if(j){ openInside(j.dataset.jump); return; }
  const tp=e.target.closest("[data-topic]"); if(tp&&TOPICS.find(x=>x.id===tp.dataset.topic)){ go({topic:tp.dataset.topic}); }
});
cardEl.addEventListener("input",e=>{ if(e.target.id!=="cfilter") return; state.cfilter=e.target.value; const pos=e.target.selectionStart; card(); const i=document.getElementById("cfilter"); i.focus(); try{ i.setSelectionRange(pos,pos); }catch(_){} });
/* search box */
const qi=document.getElementById("q"), qr=document.getElementById("qres"); let qsel=0, qlist=[];
function showResults(){ qlist=searchFor(qi.value); qsel=0;
  qr.hidden=!qlist.length;
  qr.innerHTML=qlist.map((x,i)=>`<li role="option" id="qo${i}" aria-selected="${i===qsel}" data-i="${i}"><span class="chip">${x.t}</span><span class="mono">${esc(x.l)}</span>${x.s?`<span class="muted">${esc(x.s)}</span>`:""}</li>`).join("");
  qi.setAttribute("aria-expanded",String(!!qlist.length)); }
qi.addEventListener("input",showResults);
qi.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); if(!qlist.length) return; qsel=(qsel+(e.key==="ArrowDown"?1:-1)+qlist.length)%qlist.length; [...qr.children].forEach((c,i)=>c.setAttribute("aria-selected",String(i===qsel))); qi.setAttribute("aria-activedescendant","qo"+qsel); }
  else if(e.key==="Enter"){ if(qlist[qsel]){ go(qlist[qsel].go); qr.hidden=true; qi.blur(); } }
  else if(e.key==="Escape"){ qr.hidden=true; } });
qr.addEventListener("mousedown",e=>{ const l=e.target.closest("li"); if(!l) return; e.preventDefault(); go(qlist[+l.dataset.i].go); qr.hidden=true; });
qi.addEventListener("blur",()=>setTimeout(()=>qr.hidden=true,150));
render();
