// Draft: pre-fills keys/<ns>.ro.json from English->Romanian pairs already in the locales
// (same key path in en and ro), then prints what it filled (for review) and what is missing.
// usage: node draft.cjs <ns> [lang=ro]
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.I18N_ROOT || process.cwd();
const work = (process.env.I18N_WORK || require('node:path').join(process.env.I18N_ROOT || process.cwd(), '.i18n-work'));
const [ns, lang = 'ro'] = process.argv.slice(2);
const flat = (o, p, out = {}) => { for (const [k, v] of Object.entries(o)) typeof v === 'object' ? flat(v, `${p}.${k}`, out) : (out[`${p}.${k}`] = v); return out; };
const dict = {};
const counts = {};
for (const f of fs.readdirSync(path.join(root, 'src/locales/en')).filter((f) => f.endsWith('.json'))) {
	const n = f.slice(0, -5);
	const en = flat(JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en', f), 'utf8')), n);
	const other = flat(JSON.parse(fs.readFileSync(path.join(root, 'src/locales', lang, f), 'utf8')), n);
	for (const [k, v] of Object.entries(en)) if (other[k] && v.length < 60) { const id = `${v}\u0000${other[k]}`; counts[id] = (counts[id] ?? 0) + 1; }
}
for (const [id, c] of Object.entries(counts)) { const [e, o] = id.split('\u0000'); if (!dict[e] || c > dict[e].c) dict[e] = { o, c }; }
// the hand-kept glossary wins over everything inferred
const glossaryFile = path.join(__dirname, `glossary.${lang}.json`);
const glossary = fs.existsSync(glossaryFile) ? JSON.parse(fs.readFileSync(glossaryFile, 'utf8')) : {};
for (const [e, o] of Object.entries(glossary)) dict[e] = { o, c: Infinity };
// earlier key files count as a dictionary too
fs.mkdirSync(path.join(work, 'keys'), { recursive: true });
for (const f of fs.readdirSync(path.join(work, 'keys')).filter((f) => f.endsWith(`.${lang}.json`))) {
	const o = JSON.parse(fs.readFileSync(path.join(work, 'keys', f), 'utf8'));
	const e = JSON.parse(fs.readFileSync(path.join(work, 'keys', f.replace(`.${lang}.`, '.en.')), 'utf8'));
	for (const [k, v] of Object.entries(o)) if (e[k] && !dict[e[k]]) dict[e[k]] = { o: v, c: 1 };
}
const en = JSON.parse(fs.readFileSync(path.join(work, 'keys', `${ns}.en.json`), 'utf8'));
const outFile = path.join(work, 'keys', `${ns}.${lang}.json`);
const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const missing = {};
for (const [k, v] of Object.entries(en)) {
	if (out[k] !== undefined) continue;
	if (dict[v]) { out[k] = dict[v].o; console.log(`FILLED\t${k}\t${v}\t=> ${dict[v].o}`); }
	else missing[k] = v;
}
fs.writeFileSync(outFile, `${JSON.stringify(out, null, '\t')}\n`);
console.log(`MISSING ${JSON.stringify(missing, null, 1)}`);
