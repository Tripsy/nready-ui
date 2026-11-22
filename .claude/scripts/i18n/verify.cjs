// Verify: every translation key the code references exists as a string in every language.
// Covers literal 'ns.a.b' keys, labels['x'] in a definition (under that definition's labels
// namespace), and enumTranslationKeys(prefix, Enum) x the enum's values.
// usage: node verify.cjs <file-or-dir...>
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.I18N_ROOT || process.cwd();
const work = (process.env.I18N_WORK || require('node:path').join(process.env.I18N_ROOT || process.cwd(), '.i18n-work'));
const ts = require(path.join(root, 'node_modules/typescript'));
const langs = fs.readdirSync(path.join(root, 'src/locales')).filter((d) => !d.includes('.'));
const nsNames = new Set(fs.readdirSync(path.join(root, 'src/locales/en')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
const cache = {};
const lookup = (lang, key) => {
	const ns = key.split('.')[0];
	const f = path.join(root, 'src/locales', lang, `${ns}.json`);
	cache[f] ??= fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
	return key.split('.').slice(1).reduce((o, k) => o?.[k], cache[f]);
};
function walk(t, files = []) { const a = path.resolve(root, t); if (fs.statSync(a).isDirectory()) for (const e of fs.readdirSync(a)) walk(path.join(a, e), files); else if (/\.tsx?$/.test(a)) files.push(a); return files; }
function enumValues(sf, enumName) {
	const imp = sf.statements.find((s) => ts.isImportDeclaration(s) && s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings) && s.importClause.namedBindings.elements.some((e) => e.name.text === enumName));
	let file = sf.fileName;
	if (imp) { const spec = imp.moduleSpecifier.text.replace(/^@\//, `${root}/src/`); file = [`${spec}.ts`, `${spec}.tsx`, spec].find((f) => fs.existsSync(f) && fs.statSync(f).isFile()); }
	if (!file) return null;
	const msf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
	let values = null;
	const v = (n) => { if (ts.isVariableDeclaration(n) && n.name.getText(msf) === enumName) { let i = n.initializer; while (i && (ts.isAsExpression(i) || ts.isSatisfiesExpression(i))) i = i.expression; if (i && ts.isObjectLiteralExpression(i)) values = i.properties.map((p) => p.initializer?.text); if (i && ts.isArrayLiteralExpression(i)) values = i.elements.map((e) => e.text); } ts.forEachChild(n, v); };
	v(msf);
	return values;
}
const problems = [];
let checked = 0;
for (const file of process.argv.slice(2).flatMap((t) => walk(t))) {
	const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const rel = path.relative(root, file);
	const keys = new Set();
	// labels namespace in a definition: translateBatch([...], '<ns>') whose result is `labels`
	let labelsNs = null;
	const visit = (n) => {
		// entries of translateBatch([...], 'prefix') resolve under the prefix
		if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ts.isArrayLiteralExpression(n.parent)) {
			let arr = n.parent;
			if (ts.isAsExpression(arr.parent)) arr = arr.parent;
			const call = arr.parent;
			if (ts.isCallExpression(call) && call.expression.getText(sf) === 'translateBatch' && call.arguments[0] === arr && call.arguments[1] && ts.isStringLiteral(call.arguments[1])) {
				const prefix = call.arguments[1].text;
				if (nsNames.has(prefix.split('.')[0]) && !prefix.endsWith('.validation')) keys.add(`${prefix}.${n.text}`);
				ts.forEachChild(n, visit);
				return;
			}
		}
		if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /^[a-z-]+(\.[a-z0-9_-]+)+$/.test(n.text) && nsNames.has(n.text.split('.')[0])) {
			const p = n.parent;
			// settings keys look like translation keys
			if (ts.isCallExpression(n.parent) && /^Configuration\./.test(n.parent.expression.getText(sf))) { ts.forEachChild(n, visit); return; }
			// an index into a translations map: the key it names is checked where the list declares it
			if (ts.isElementAccessExpression(n.parent) && n.parent.argumentExpression === n) { ts.forEachChild(n, visit); return; }
			const isPrefixArg = ts.isCallExpression(p) && p.arguments.indexOf(n) === 1 && /translateBatch|enumTranslationKeys|translateEnumLabel/.test(p.expression.getText(sf));
			const isEnumPrefix = ts.isCallExpression(p) && /enumTranslationKeys|translateEnumLabel/.test(p.expression.getText(sf));
			if (!isPrefixArg && !isEnumPrefix) keys.add(n.text);
		}
		if (ts.isCallExpression(n) && n.expression.getText(sf) === 'enumTranslationKeys') {
			const prefix = n.arguments[0]?.text; const vals = enumValues(sf, n.arguments[1]?.getText(sf));
			if (!vals) problems.push(`${rel}\tcannot read enum ${n.arguments[1]?.getText(sf)}`); else for (const v of vals) keys.add(nsNames.has(prefix.split('.')[0]) ? `${prefix}.${v}` : `\u0000${prefix}.${v}`);
		}
		if (ts.isElementAccessExpression(n) && n.expression.getText(sf) === 'labels' && ts.isStringLiteral(n.argumentExpression)) keys.add(`\u0000${n.argumentExpression.text}`);
		ts.forEachChild(n, visit);
	};
	visit(sf);
	const m = /\[translations, labels[^\]]*\] = await Promise\.all\(\[[\s\S]*?translateBatch\([\s\S]*?\),\s*translateBatch\(\s*\[[\s\S]*?\] as const,\s*'([\w-]+)'/.exec(sf.text);
	if (m) labelsNs = m[1];
	for (let k of keys) {
		if (k.startsWith('\u0000')) { if (!labelsNs) { problems.push(`${rel}\tlabels['${k.slice(1)}'] without a recognized labels batch`); continue; } k = `${labelsNs}.${k.slice(1)}`; }
		checked++;
		for (const lang of langs) if (typeof lookup(lang, k) !== 'string') problems.push(`${rel}\t${lang}\tMISSING ${k}`);
	}
}
for (const p of problems) console.log(p);
console.log(`${checked} key references checked, ${problems.length} problems`);
process.exitCode = problems.length ? 1 : 0;
