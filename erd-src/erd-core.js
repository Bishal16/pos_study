/* UniPOS Living ERD — shared core: SQL type mapping and DBML / PostgreSQL / Mermaid generators.
   Used by build.py (through node) and by the page itself. */
(function (root) {
  function sqlType(c) {
    if (c.enum) return "varchar(" + (c.len || 50) + ")";
    const t = (c.t || "").replace(/^java\.\w+\./, "");
    if (/\[\]$|^(List|Set)</.test(t)) {
      const inner = t.replace(/\[\]$/, "").replace(/^(List|Set)<(.+)>$/, "$2");
      return sqlType({ t: inner }) + "[]";
    }
    switch (t) {
      case "String": return c.len ? "varchar(" + c.len + ")" : "varchar(255)";
      case "UUID": return "uuid";
      case "Integer": case "int": case "Short": case "short": return "integer";
      case "Long": case "long": return "bigint";
      case "BigDecimal": return c.prec ? "numeric(" + c.prec + ")" : "numeric";
      case "Double": case "double": return "double precision";
      case "Float": case "float": return "real";
      case "Boolean": case "boolean": return "boolean";
      case "LocalDate": case "Date": return "date";
      case "LocalDateTime": case "Timestamp": return "timestamp";
      case "Instant": case "OffsetDateTime": case "ZonedDateTime": return "timestamptz";
      case "LocalTime": return "time";
      case "byte[]": return "bytea";
      case "Map<String,Object>": case "JsonNode": return "jsonb";
      default: return c.rel ? "bigint" : "varchar(255)";
    }
  }
  const q = n => /^[a-z_][a-z0-9_]*$/.test(n) ? n : '"' + String(n).replace(/"/g, '""') + '"';
  const dq = s => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " ") + "'";

  /* merge code layer + design layer for one service:
     d = per-service data, notes = {key: {text,status}}, props = [proposal docs] */
  function view(d, notes, props) {
    notes = notes || {}; props = (props || []).filter(p => p.svc === d.svc && p.state !== "done");
    const tables = d.tables.map(t => ({ ...t, cols: t.cols.filter(c => !c.virt).map(c => ({ ...c })) }));
    const byName = Object.fromEntries(tables.map(t => [t.t, t]));
    props.filter(p => p.kind === "table").forEach(p => {
      if (!byName[p.table]) { const t = { t: p.table, cls: "", proposed: true, note: p.note || "", cols: [{ c: "id", t: "UUID", pk: 1 }] }; tables.push(t); byName[p.table] = t; }
    });
    props.filter(p => p.kind === "column").forEach(p => {
      const t = byName[p.table]; if (t && !t.cols.some(c => c.c === p.col)) t.cols.push({ c: p.col, t: p.type || "String", proposed: true, pnote: p.note || "" });
    });
    tables.forEach(t => {
      const tn = notes[d.svc + "~" + t.t]; if (tn) { t.dnote = tn.text || ""; t.status = tn.status || ""; }
      t.cols.forEach(c => { const cn = notes[d.svc + "~" + t.t + "~" + c.c]; if (cn) { c.dnote = cn.text || ""; c.status = cn.status || ""; } });
    });
    const refs = d.refs.map(r => ({ ...r }));
    props.filter(p => p.kind === "ref").forEach(p => refs.push({ ft: p.table, fc: p.col, ts: p.to.svc, tt: p.to.table, tc: p.to.col || "id", kind: p.to.svc === d.svc ? "soft" : "xs", proposed: true, pnote: p.note || "" }));
    return { svc: d.svc, head: d.head, tables, refs };
  }

  function colNote(c, refs, t) {
    const parts = [];
    if (c.inh) parts.push("inherited from " + c.inh);
    const r = refs.find(r => r.ft === t.t && r.fc === c.c);
    if (r && r.kind === "xs") parts.push("→ " + r.ts + "." + r.tt + "." + r.tc + " (other service, no FK)");
    if (r && r.kind === "poly") parts.push("polymorphic → " + r.poly.map(p => p.join(".")).join(" | "));
    if (r && r.inferred) parts.push("reference inferred from the column name");
    if (c.proposed) parts.push("PROPOSED" + (c.pnote ? ": " + c.pnote : ""));
    if (c.status) parts.push("status: " + c.status);
    if (c.dnote) parts.push(c.dnote);
    return parts.join(" · ");
  }

  function dbml(v, opts) {
    opts = opts || {};
    const L = [];
    if (opts.header !== false) L.push("// UniPOS · " + v.svc + "-service · generated from @Entity code (" + (v.head ? v.head.branch + " " + v.head.commit : "") + ")", "");
    v.tables.forEach(t => {
      const tnote = [t.proposed ? "PROPOSED" : "", t.cls ? "entity " + t.cls : "", t.status ? "status: " + t.status : "", t.dnote || t.note || ""].filter(Boolean).join(" · ");
      L.push("Table " + q(v.svc) + "." + q(t.t) + (tnote ? " [note: " + dq(tnote) + "]" : "") + " {");
      t.cols.forEach(c => {
        const s = [];
        if (c.pk) s.push("pk");
        if (c.nn && !c.pk) s.push("not null");
        if (c.uq) s.push("unique");
        const n = colNote(c, v.refs, t); if (n) s.push("note: " + dq(n));
        const ty = sqlType(c); L.push("  " + q(c.c) + " " + (/^[A-Za-z_]\w*(\(\d+(,\d+)?\))?(\[\])?$/.test(ty) ? ty : '"' + ty + '"') + (s.length ? " [" + s.join(", ") + "]" : ""));
      });
      L.push("}", "");
    });
    const known = new Set(v.tables.map(t => v.svc + "." + t.t));
    v.refs.forEach(r => {
      if (r.kind === "poly") return;
      const target = r.ts + "." + r.tt;
      if (!opts.all && r.ts !== v.svc) return;                 // cross-service refs live in column notes per file
      if (opts.all && opts.known && !opts.known.has(target)) return;
      if (!opts.all && !known.has(target)) return;
      const sym = r.rel === "OneToOne" ? "-" : ">";
      const tag = r.kind === "fk" ? "" : " // " + (r.kind === "xs" ? "cross-service id, no FK" : "id only, no FK") + (r.proposed ? ", PROPOSED" : "");
      L.push("Ref: " + q(v.svc) + "." + q(r.ft) + "." + q(r.fc) + " " + sym + " " + q(r.ts) + "." + q(r.tt) + "." + q(r.tc) + tag);
    });
    return L.join("\n") + "\n";
  }

  function sql(v) {
    const L = ["-- UniPOS · " + v.svc + "-service · PostgreSQL DDL generated from @Entity code", "CREATE SCHEMA IF NOT EXISTS " + q(v.svc) + ";", ""];
    v.tables.forEach(t => {
      L.push("CREATE TABLE " + q(v.svc) + "." + q(t.t) + " (");
      const lines = t.cols.map(c => "  " + q(c.c) + " " + sqlType(c) + (c.pk ? " PRIMARY KEY" : "") + (c.nn && !c.pk ? " NOT NULL" : "") + (c.uq ? " UNIQUE" : ""));
      L.push(lines.join(",\n"), ");");
      const tn = [t.proposed ? "PROPOSED" : "", t.dnote].filter(Boolean).join(" · "); if (tn) L.push("COMMENT ON TABLE " + q(v.svc) + "." + q(t.t) + " IS " + dq(tn).replace(/\\'/g, "''") + ";");
      t.cols.forEach(c => { const n = colNote(c, v.refs, t); if (n) L.push("COMMENT ON COLUMN " + q(v.svc) + "." + q(t.t) + "." + q(c.c) + " IS " + dq(n).replace(/\\'/g, "''") + ";"); });
      L.push("");
    });
    v.refs.filter(r => r.kind === "fk" && r.ts === v.svc).forEach(r =>
      L.push("ALTER TABLE " + q(v.svc) + "." + q(r.ft) + " ADD FOREIGN KEY (" + q(r.fc) + ") REFERENCES " + q(r.ts) + "." + q(r.tt) + " (" + q(r.tc) + ");"));
    return L.join("\n") + "\n";
  }

  function mermaid(v) {
    const id = n => (v.svc + "_" + n).replace(/[^A-Za-z0-9_]/g, "_");
    const L = ["```mermaid", "erDiagram"];
    v.tables.forEach(t => {
      L.push("  " + id(t.t) + " {");
      t.cols.forEach(c => {
        const k = c.pk ? " PK" : v.refs.some(r => r.ft === t.t && r.fc === c.c) ? " FK" : "";
        L.push("    " + sqlType(c).replace(/[^A-Za-z0-9_]/g, "_") + " " + c.c.replace(/[^A-Za-z0-9_]/g, "_") + k);
      });
      L.push("  }");
    });
    v.refs.filter(r => r.ts === v.svc && r.kind !== "poly").forEach(r => {
      const rel = r.rel === "OneToOne" ? "||--||" : "}o--||";
      L.push("  " + id(r.ft) + " " + rel + " " + id(r.tt) + ' : "' + r.fc + (r.kind === "fk" ? "" : " (no FK)") + '"');
    });
    L.push("```");
    return L.join("\n") + "\n";
  }

  const api = { sqlType, view, dbml, sql, mermaid };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ErdCore = api;
})(typeof window !== "undefined" ? window : globalThis);
