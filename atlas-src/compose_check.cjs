// node compose_check.cjs <dir of NAME.graphql> <apollo node_modules>: composes the schemas with the gateway's own library, as Apollo does at
// runtime, then again without each service, to see which absences break composition. Prints JSON. Reads only.
const fs = require('fs'), path = require('path');
const [dir, mods] = process.argv.slice(2);
const { composeServices } = require(path.join(mods, '@apollo/composition'));
const { parse, Kind } = require(path.join(mods, 'graphql'));
const doc = {}, parseErrors = {};
for (const f of fs.readdirSync(dir)) {
  const n = f.replace('.graphql', ''), seen = new Set();
  try {
    const d = parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    // each service's files are joined here, so a directive or scalar declared in two of them would count as a duplicate
    d.definitions = d.definitions.filter(x => {
      if (x.kind !== Kind.DIRECTIVE_DEFINITION && x.kind !== Kind.SCALAR_TYPE_DEFINITION) return true;
      const k = x.kind + x.name.value; if (seen.has(k)) return false; seen.add(k); return true;
    });
    doc[n] = d;
  } catch (e) { parseErrors[n] = e.message.slice(0, 160); }
}
const names = Object.keys(doc);
const run = l => composeServices(l.map(n => ({ name: n, url: 'http://x/' + n, typeDefs: doc[n] }))).errors || [];
const all = run(names), base = new Set(all.map(e => e.message)), blocks = {}, vanish = [];
for (const n of names) {
  const extra = run(names.filter(x => x !== n)).filter(e => !base.has(e.message));
  if (extra.length) blocks[n] = extra.map(e => (e.message.match(/Type "(\w+)"/) || [, e.extensions?.code])[1]);
  else vanish.push(n);
}
console.log(JSON.stringify({ ok: !all.length && !Object.keys(parseErrors).length, errors: all.slice(0, 20).map(e => ({ code: e.extensions?.code || '', msg: e.message.slice(0, 240) })), errorCount: all.length, parseErrors, blocks, vanish }));
