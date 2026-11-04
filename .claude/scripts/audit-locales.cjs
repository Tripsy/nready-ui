/*
 * Locale audit: finds unused keys in src/locales/<lang>/*.json and checks key parity
 * between languages. Runs on the host (no container needed) with the repo's own
 * `typescript` package, which parses every source file under src/.
 *
 * usage: node .claude/scripts/audit-locales.cjs [--json <file>] [--list]
 *   --json <file>  write the full per-key classification (how each key was matched)
 *   --list         print every unused key, not only the per-namespace counts
 * Exit code is 1 when there is an unused key or a parity issue, so it can gate a check.
 *
 * A key in the reference language (en) counts as used when any of these holds:
 *   direct    - the full key appears as a string literal
 *   suffix    - a literal prefix plus a literal remainder, e.g. translateBatch(['x'], 'ns.text')
 *   dynamic   - a template literal matches it, e.g. `${dataSource}.status.${status}`
 *   dynprefix - a template literal matches the prefix and the remainder is a literal,
 *               e.g. translateBatch(['invalid_x'], `${entity}.validation`)
 * The matching errs towards "used": a dynamic pattern such as `${entity}.help.${x}` keeps
 * every *.help.* key alive, so the unused count is a lower bound. Grep each reported key
 * before deleting it.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const listAll = args.includes('--list');

const localesDir = path.join(root, 'src/locales');
const REFERENCE_LANGUAGE = 'en';
const langs = fs
	.readdirSync(localesDir)
	.filter((d) => fs.statSync(path.join(localesDir, d)).isDirectory());

function flatten(obj, prefix, out) {
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === 'object') flatten(v, key, out);
		else out[key] = v;
	}
	return out;
}

// The namespace is the file name - index.ts registers each file under it ('cash-flow': cash_flow).
const keysByLang = {};
for (const lang of langs) {
	keysByLang[lang] = {};
	for (const f of fs
		.readdirSync(path.join(localesDir, lang))
		.filter((f) => f.endsWith('.json'))) {
		const ns = f.replace(/\.json$/, '');
		keysByLang[lang][ns] = flatten(
			JSON.parse(fs.readFileSync(path.join(localesDir, lang, f), 'utf8')),
			ns,
			{},
		);
	}
}

// --- scan sources
const literals = new Set();
const patterns = []; // { re, src, file }

function walk(dir, files = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) {
			if (p === localesDir || e.name === 'node_modules') continue;
			walk(p, files);
		} else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) files.push(p);
	}
	return files;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A pattern can only stand for a key if its fixed text has a dot and a letter; `${key}s` or
// `${a}-${b}` would otherwise match half the locale files.
const isKeyPattern = (source) =>
	/\\\./.test(source) && /[a-z]/i.test(source.replace(/\.\+/g, ''));

for (const file of walk(path.join(root, 'src'))) {
	const sf = ts.createSourceFile(
		file,
		fs.readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
	);
	const visit = (n) => {
		if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
			literals.add(n.text);
		} else if (ts.isTemplateExpression(n)) {
			const parts = [esc(n.head.text)];
			for (const span of n.templateSpans) parts.push('.+', esc(span.literal.text));
			const source = parts.join('');
			if (isKeyPattern(source)) {
				patterns.push({
					re: new RegExp(`^${source}$`),
					src: n.getText(),
					file: path.relative(root, file),
				});
			}
		}
		ts.forEachChild(n, visit);
	};
	visit(sf);
}

// --- classify the reference language
function classify(key) {
	if (literals.has(key)) return 'direct';

	const segs = key.split('.');

	for (let i = 1; i < segs.length; i++) {
		const prefix = segs.slice(0, i).join('.');
		const suffix = segs.slice(i).join('.');
		if (literals.has(suffix) && literals.has(prefix)) return `suffix(${prefix} + ${suffix})`;
	}

	const pattern = patterns.find((p) => p.re.test(key));
	if (pattern) return `dynamic(${pattern.src} @ ${pattern.file})`;

	for (let i = 1; i < segs.length; i++) {
		const prefix = segs.slice(0, i).join('.');
		const suffix = segs.slice(i).join('.');
		if (!literals.has(suffix)) continue;
		const p = patterns.find((p) => p.re.test(prefix));
		if (p) return `dynprefix(${p.src} + ${suffix})`;
	}

	return 'UNUSED';
}

const ref = keysByLang[REFERENCE_LANGUAGE];
const detail = {};
for (const [ns, keys] of Object.entries(ref)) {
	detail[ns] = Object.keys(keys).map((key) => ({ key, how: classify(key) }));
}

// --- parity against the reference language
const parity = [];
for (const lang of langs) {
	if (lang === REFERENCE_LANGUAGE) continue;
	for (const ns of Object.keys(ref)) if (!keysByLang[lang][ns]) parity.push(`${lang}: missing file ${ns}`);
	for (const ns of Object.keys(keysByLang[lang])) if (!ref[ns]) parity.push(`${lang}: extra file ${ns}`);
	for (const [ns, keys] of Object.entries(ref)) {
		const other = keysByLang[lang][ns] ?? {};
		for (const k of Object.keys(keys)) {
			if (!(k in other)) parity.push(`${lang}: missing ${k}`);
			else if (typeof other[k] !== 'string') parity.push(`${lang}: not a string ${k}`);
		}
		for (const k of Object.keys(other)) if (!(k in keys)) parity.push(`${lang}: extra ${k}`);
	}
}

// --- report
const unused = [];
for (const [ns, rows] of Object.entries(detail)) {
	const nsUnused = rows.filter((r) => r.how === 'UNUSED').map((r) => r.key);
	unused.push(...nsUnused);
	if (nsUnused.length) {
		const whole = nsUnused.length === rows.length ? '\tWHOLE FILE' : '';
		console.log(`${ns}\t${nsUnused.length}/${rows.length}${whole}`);
	}
}

if (listAll) for (const k of unused) console.log(`  ${k}`);

console.log(`\nunused keys: ${unused.length}; parity issues: ${parity.length}`);
for (const p of parity) console.log(`  ${p}`);

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ unused, parity, detail }, null, 1));

process.exitCode = unused.length || parity.length ? 1 : 0;
