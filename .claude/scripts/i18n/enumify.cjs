// Enum converter: moves module-level `const X = toOptionsFromEnum(Enum, { formatter: formatEnumLabel })`
// into each component that uses it, as a useMemo with translateEnumLabel, and adds
// enumTranslationKeys(prefix, Enum) to TRANSLATION_KEYS. Writes English values (exactly as
// formatEnumLabel prints them) to keys/<ns>.en.json. Reports formatEnumLabel(expr) and
// `capitalize: true` columns as LEFT.
// usage: node enumify.cjs <namespace> <file-or-dir...> [--prefix Enum=ns.enum.x ...]
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.I18N_ROOT || process.cwd();
const work = (process.env.I18N_WORK || require('node:path').join(process.env.I18N_ROOT || process.cwd(), '.i18n-work'));
const ts = require(path.join(root, 'node_modules/typescript'));
const { insertAfterImports, addImport } = require('./lib.cjs');

const argv = process.argv.slice(2);
const overrides = {};
const rest = [];
for (let i = 0; i < argv.length; i++) {
	if (argv[i] === '--prefix') {
		const [e, p] = argv[++i].split('=');
		overrides[e] = p;
	} else rest.push(argv[i]);
}
const [ns, ...targets] = rest;

const keysFile = path.join(work, 'keys', `${ns}.en.json`);
fs.mkdirSync(path.dirname(keysFile), { recursive: true });
const keys = fs.existsSync(keysFile) ? JSON.parse(fs.readFileSync(keysFile, 'utf8')) : {};
const report = [];

const formatEnumLabel = (v) => v.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const camelNs = ns.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');

const localeHas = (key) => {
	const f = path.join(root, 'src/locales/en', `${ns}.json`);
	if (!fs.existsSync(f)) return false;
	return key.split('.').slice(1).reduce((o, k) => o?.[k], JSON.parse(fs.readFileSync(f, 'utf8'))) !== undefined;
};

function prefixFor(enumName) {
	if (overrides[enumName]) return overrides[enumName];
	const base = enumName.replace(/Enum$/, '');
	if (base === `${camelNs}Status` && localeHas(`${ns}.status`)) return `${ns}.status`;
	const local = base.startsWith(camelNs) && base !== camelNs ? base.slice(camelNs.length) : base;
	return `${ns}.enum.${snake(local)}`;
}

// enum values, read from the module the enum is imported from
function enumValues(sf, enumName) {
	const imp = sf.statements.find((s) => ts.isImportDeclaration(s) && s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings) && s.importClause.namedBindings.elements.some((e) => e.name.text === enumName));
	if (!imp) return null;
	const spec = imp.moduleSpecifier.text.replace(/^@\//, `${root}/src/`);
	const file = [spec, `${spec}.ts`, `${spec}.tsx`].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
	if (!file) return null;
	const msf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
	let values = null;
	const visit = (n) => {
		if (ts.isVariableDeclaration(n) && n.name.getText(msf) === enumName) {
			let init = n.initializer;
			while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
			if (init && ts.isObjectLiteralExpression(init)) values = init.properties.map((p) => (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer) ? p.initializer.text : null));
		}
		ts.forEachChild(n, visit);
	};
	visit(msf);
	return values?.includes(null) ? null : values;
}

function walk(target, files = []) {
	const abs = path.resolve(root, target);
	if (fs.statSync(abs).isDirectory()) for (const e of fs.readdirSync(abs)) walk(path.join(abs, e), files);
	else if (/\.tsx?$/.test(abs)) files.push(abs);
	return files;
}

function processFile(file) {
	let source = fs.readFileSync(file, 'utf8');
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const rel = path.relative(root, file);
	const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

	// report the patterns this script does not rewrite
	const scan = (n) => {
		const inHandledList = lists.some((l) => l.mapVar && n.pos >= l.stmt.pos && n.end <= l.stmt.end);
		if (!inHandledList && ts.isCallExpression(n) && n.expression.getText(sf) === 'formatEnumLabel' && n.arguments.length) report.push(`LEFT\t${rel}:${line(n)}\tformatEnumLabel(${n.arguments[0].getText(sf)})`);
		if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'capitalize' && n.initializer.getText(sf) === 'true') report.push(`LEFT\t${rel}:${line(n)}\tcapitalize: true column - turn into customValue with translateEnumLabel`);
		ts.forEachChild(n, scan);
	};

	const lists = [];
	for (const st of sf.statements) {
		if (!ts.isVariableStatement(st)) continue;
		for (const d of st.declarationList.declarations) {
			const init = d.initializer;
			// Object.values(Enum).map((v) => ({ label: formatEnumLabel(v), value: v }))
			const mapForm = init && /^Object\.values\((\w+)\)\.map\(\((\w+)\) => \(\{\s*label: formatEnumLabel\(\2\),\s*value: \2,?\s*\}\)\)$/.exec(init.getText(sf));
			if (mapForm) {
				const values = enumValues(sf, mapForm[1]);
				if (!values) { report.push(`LEFT\t${rel}:${line(st)}\tcannot read values of ${mapForm[1]}`); continue; }
				lists.push({ stmt: st, name: d.name.getText(sf), enumName: mapForm[1], prefix: prefixFor(mapForm[1]), values, mapVar: mapForm[2] });
				continue;
			}
			if (!init || !ts.isCallExpression(init) || init.expression.getText(sf) !== 'toOptionsFromEnum') continue;
			const enumName = init.arguments[0].getText(sf);
			// currency codes and language codes are not copy - a language shows its own name
			if (/^(Currency|Language)Enum$/.test(enumName)) { report.push(`NOTE\t${rel}:${line(st)}\t${enumName} left as is (not copy)`); continue; }
			const opts = init.arguments[1]?.getText(sf) ?? '';
			if (opts && !/formatter:\s*formatEnumLabel/.test(opts)) { report.push(`LEFT\t${rel}:${line(st)}\ttoOptionsFromEnum with a custom formatter`); continue; }
			const values = enumValues(sf, enumName);
			if (!values) { report.push(`LEFT\t${rel}:${line(st)}\tcannot read values of ${enumName}`); continue; }
			lists.push({ stmt: st, name: d.name.getText(sf), enumName, prefix: prefixFor(enumName), values });
		}
	}
	scan(sf);
	if (!lists.length) return;

	// hosts: components referencing each list
	const hostsOf = (name) => {
		const hosts = new Set();
		const visit = (n) => {
			if (ts.isIdentifier(n) && n.text === name && !ts.isVariableDeclaration(n.parent)) {
				for (let p = n.parent; p; p = p.parent) {
					const isFn = ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p);
					const fnName = ts.isFunctionDeclaration(p) ? p.name?.text : ts.isVariableDeclaration(p.parent) ? p.parent.name.getText(sf) : '';
					if (isFn && /^([A-Z]|use[A-Z])/.test(fnName ?? '')) { hosts.add(p); break; }
				}
			}
			ts.forEachChild(n, visit);
		};
		visit(sf);
		return [...hosts];
	};

	const edits = [];
	const keyLines = [];
	for (const list of lists) {
		for (const v of list.values) {
			const k = `${list.prefix}.${v}`;
			if (!localeHas(k)) keys[k] = keys[k] ?? formatEnumLabel(v);
		}
		keyLines.push(`\t...enumTranslationKeys('${list.prefix}', ${list.enumName}),`);
		const hosts = hostsOf(list.name);
		if (!hosts.length) { report.push(`LEFT\t${rel}\t${list.name} not used inside a component`); continue; }
		// remove the module-level statement with its leading blank line
		edits.push({ start: list.stmt.getFullStart(), end: list.stmt.end, text: '' });
		for (const host of hosts) {
			if (!ts.isBlock(host.body)) { report.push(`LEFT\t${rel}:${line(host)}\texpression-bodied component uses ${list.name}`); continue; }
			const hook = host.body.statements.find((s) => /useTranslation\(/.test(s.getText(sf)));
			const indent = '\t';
			const memo = list.mapVar
				? `\n\n${indent}const ${list.name} = useMemo(\n${indent}\t() =>\n${indent}\t\tObject.values(${list.enumName}).map((${list.mapVar}) => ({\n${indent}\t\t\tlabel: translateEnumLabel(translations, '${list.prefix}', ${list.mapVar}),\n${indent}\t\t\tvalue: ${list.mapVar},\n${indent}\t\t})),\n${indent}\t[translations],\n${indent});`
				: `\n\n${indent}const ${list.name} = useMemo(\n${indent}\t() =>\n${indent}\t\ttoOptionsFromEnum(${list.enumName}, {\n${indent}\t\t\tformatter: (value) =>\n${indent}\t\t\t\ttranslateEnumLabel(translations, '${list.prefix}', value),\n${indent}\t\t}),\n${indent}\t[translations],\n${indent});`;
			if (hook) edits.push({ start: hook.end, end: hook.end, text: memo });
			else edits.push({ start: host.body.getStart(sf) + 1, end: host.body.getStart(sf) + 1, text: `\n${indent}const { translations } = useTranslation(TRANSLATION_KEYS);${memo}\n` });
		}
	}

	edits.sort((a, b) => b.start - a.start);
	for (const e of edits) source = source.slice(0, e.start) + e.text + source.slice(e.end);

	if (/const TRANSLATION_KEYS = \[/.test(source)) {
		source = source.replace(/(const TRANSLATION_KEYS = \[\n[\s\S]*?)(\] as const;)/, (_, a, b) => `${a}${keyLines.join('\n')}\n${b}`);
	} else {
		source = insertAfterImports(source, `const TRANSLATION_KEYS = [\n${keyLines.join('\n')}\n] as const;\n`);
		source = addImport(source, 'useTranslation', '@/hooks/use-translation.hook');
	}
	if (/useTranslation\(\w+\)/.test(source) && !/useTranslation\(TRANSLATION_KEYS\)/.test(source)) report.push(`LEFT\t${rel}\texisting hook uses another key list - merge it into TRANSLATION_KEYS`);
	source = addImport(source, 'enumTranslationKeys', '@/helpers/string.helper');
	source = addImport(source, 'translateEnumLabel', '@/helpers/string.helper');
	source = addImport(source, 'useMemo', 'react');
	// formatEnumLabel import no longer used?
	if (!/formatEnumLabel\(|formatter: formatEnumLabel/.test(source.replace(/import[\s\S]*?from '[^']+';/g, ''))) {
		source = source.replace(/(\{[^}]*?)\bformatEnumLabel,\s*/, '$1').replace(/,\s*formatEnumLabel(\s*\})/, '$1').replace(/import \{\s*formatEnumLabel\s*\} from '@\/helpers\/string\.helper';\n/, '');
	}
	fs.writeFileSync(file, source);
	console.log(`enumified ${rel}: ${lists.map((l) => `${l.name} -> ${l.prefix}`).join(', ')}`);
}

for (const t of targets) for (const f of walk(t)) processFile(f);
fs.writeFileSync(keysFile, `${JSON.stringify(keys, null, '\t')}\n`);
for (const r of report) console.log(r);
