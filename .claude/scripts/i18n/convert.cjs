// Converter: rewrites recognizable hard-coded copy in a dashboard folder into locale keys.
// usage: node convert.cjs <namespace> <file-or-dir...> [--dry]
// Writes English keys to keys/<namespace>.en.json (merged with what is there), prints
// LEFT (not handled) and CONFLICT (one key, two texts) for manual work.
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.I18N_ROOT || process.cwd();
const work = (process.env.I18N_WORK || require('node:path').join(process.env.I18N_ROOT || process.cwd(), '.i18n-work'));
const ts = require(path.join(root, 'node_modules/typescript'));
const { insertAfterImports, addImport } = require('./lib.cjs');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const [ns, ...targets] = args.filter((a) => a !== '--dry');

function walk(target, files = []) {
	const abs = path.resolve(root, target);
	if (fs.statSync(abs).isDirectory()) for (const e of fs.readdirSync(abs)) walk(path.join(abs, e), files);
	else if (/\.tsx?$/.test(abs)) files.push(abs);
	return files;
}

const keysFile = path.join(work, 'keys', `${ns}.en.json`);
fs.mkdirSync(path.dirname(keysFile), { recursive: true });
const keys = fs.existsSync(keysFile) ? JSON.parse(fs.readFileSync(keysFile, 'utf8')) : {};
const existingLocale = (() => {
	const f = path.join(root, 'src/locales/en', `${ns}.json`);
	const flat = {};
	const flatten = (o, p) => { for (const [k, v] of Object.entries(o)) typeof v === 'object' ? flatten(v, `${p}.${k}`) : (flat[`${p}.${k}`] = v); };
	if (fs.existsSync(f)) flatten(JSON.parse(fs.readFileSync(f, 'utf8')), ns);
	return flat;
})();

const report = { LEFT: [], CONFLICT: [], NOTE: [] };

function slug(text) {
	return text
		.toLowerCase()
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/&apos;|'/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.split('_').slice(0, 6).join('_');
}

function addKey(key, text, where) {
	if (key.startsWith('text.')) {
		const same = Object.entries({ ...existingLocale, ...keys }).find(([k, v]) => k.startsWith(`${ns}.field.`) && v === text);
		if (same) return same[0];
		if (text === 'ID') key = 'field.id';
	}
	const fullKey = `${ns}.${key}`;
	const prev = keys[fullKey] ?? existingLocale[fullKey];
	if (prev !== undefined && prev !== text) {
		report.CONFLICT.push(`${where}\t${fullKey}\t"${prev}" vs "${text}"`);
		return fullKey;
	}
	keys[fullKey] = text;
	return fullKey;
}

const ATTRS = new Set(['labelText', 'label', 'title', 'placeholderText', 'placeholder', 'emptyText', 'errorText', 'aria-label', 'description', 'confirmText', 'cancelText', 'buttonText', 'submitText', 'helpText', 'tooltip']);
// components and hooks can both call useTranslation
const isComponentName = (name) => /^([A-Z]|use[A-Z])/.test(name ?? '');

function readsLikeCopy(t) {
	t = t.trim();
	if (!/[A-Za-z]/.test(t)) return false;
	if (/^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/.test(t)) return false;
	if (/^[a-z][a-zA-Z0-9_-]*$/.test(t)) return false;
	return true;
}

function jsxElementOf(attr) {
	// JsxAttribute -> JsxAttributes -> JsxOpeningElement | JsxSelfClosingElement
	return attr.parent.parent;
}
function attrValue(el, name) {
	const attrs = (el.attributes ?? el.openingElement?.attributes)?.properties ?? [];
	for (const a of attrs) {
		if (!ts.isJsxAttribute(a) || a.name.getText() !== name || !a.initializer) continue;
		if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
		if (ts.isJsxExpression(a.initializer) && a.initializer.expression) return a.initializer.expression.getText();
	}
	return null;
}
function tagName(el) {
	return (el.tagName ?? el.openingElement?.tagName)?.getText() ?? '';
}
function entryProp(exprText) {
	const m = /\b(?:entry|data|values|formValues|item|row)((?:\??\.[a-z_][a-z0-9_]*)+)/.exec(exprText ?? '');
	return m ? m[1].split(/\??\./).pop() : null;
}
function fieldNameOf(el) {
	const raw = attrValue(el, 'fieldName');
	if (!raw) return null;
	const m = /^['"]?([a-z_][a-z0-9_]*)['"]?$/.exec(raw);
	return m ? m[1] : null;
}

// Template literal with simple slots -> { english, vars }
function templateToSlots(node) {
	let english = node.head.text;
	const vars = [];
	for (const span of node.templateSpans) {
		const exprText = span.expression.getText();
		if (!/^[\w.?]+$/.test(exprText)) return null;
		const last = exprText.split(/\??\./).pop();
		const name = /^[A-Z0-9_]+$/.test(last) ? (/MAX/.test(last) ? 'max' : /MIN/.test(last) ? 'min' : slug(last.split('_').pop())) : slug(last.replace(/([a-z])([A-Z])/g, '$1_$2')) || 'value';
		vars.push([name, exprText]);
		english += `{{${name}}}${span.literal.text}`;
	}
	return { english, vars };
}

function keyForAttr(attrName, el, text) {
	const tag = tagName(el);
	const field = fieldNameOf(el);
	switch (attrName) {
		case 'labelText':
			if (/FiltersSearch/.test(tag)) return !field || field === 'global' ? 'field.search' : `field.${field}`;
			// fields of the per-language page meta block (`<FormComponentInput<PageMeta>`)
			if (field && /Meta/.test(el.typeArguments?.map((t) => t.getText()).join(',') ?? '')) return `field.meta_${field}`;
			return field ? `field.${field}` : `field.${slug(text)}`;
		case 'placeholderText':
		case 'placeholder':
			return `text.placeholder_${field ?? slug(text)}`;
		case 'title':
			return /Section|Card|Tab|Panel|Group|Fieldset/i.test(tag) ? `section.${slug(text)}` : `text.${slug(text)}`;
		case 'label': {
			if (/ViewField|Field$/.test(tag)) {
				const prop = entryProp(attrValue(el, 'value'));
				return `field.${prop ?? slug(text)}`;
			}
			if (/Tab/.test(tag)) return `section.${slug(text)}`;
			return field ? `field.${field}` : `text.${slug(text)}`;
		}
		case 'aria-label':
			return `text.label_${slug(text)}`;
		default:
			return `text.${slug(text)}`;
	}
}

function processFile(file) {
	const source = fs.readFileSync(file, 'utf8');
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
	const rel = path.relative(root, file);
	const isDefinition = file.endsWith('.definition.ts');
	const edits = []; // { start, end, text }
	const hostKeys = new Map(); // host node -> Set(keys)
	const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
	const left = (n, why) => report.LEFT.push(`${rel}:${line(n)}\t${why}\t${n.getText().replace(/\s+/g, ' ').slice(0, 100)}`);

	function hostOf(node) {
		for (let p = node.parent; p; p = p.parent) {
			if (ts.isFunctionDeclaration(p) && isComponentName(p.name?.text)) return p;
			if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && isComponentName(p.parent.name.getText())) return p;
			// forwardRef / memo wrappers
			if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isCallExpression(p.parent) && /forwardRef|memo/.test(p.parent.expression.getText())) {
				const decl = p.parent.parent;
				if (ts.isVariableDeclaration(decl) && isComponentName(decl.name.getText())) return p;
			}
		}
		return null;
	}

	const useKey = (node, key) => {
		const host = hostOf(node);
		if (!host) return false;
		if (!hostKeys.has(host)) hostKeys.set(host, new Set());
		hostKeys.get(host).add(key);
		return true;
	};

	// --- definition: column headers and titles go to a `labels` batch
	const defLabels = new Set();
	function visitDefinition(node) {
		if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
			const prop = node.name.getText();
			const text = node.initializer.text;
			if (prop === 'header' && readsLikeCopy(text) || prop === 'header' && /^[A-Z]{2,4}$/.test(text)) {
				const obj = node.parent;
				const fieldProp = obj.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'field');
				const field = fieldProp && ts.isStringLiteral(fieldProp.initializer) ? fieldProp.initializer.text : slug(text);
				const k = addKey(`field.${field}`, text, `${rel}:${line(node)}`).slice(ns.length + 1);
				defLabels.add(k);
				edits.push({ start: node.initializer.getStart(sf), end: node.initializer.end, text: `labels['${k}']` });
			} else if (['title', 'label', 'emptyText', 'description'].includes(prop) && readsLikeCopy(text) && /[A-Z ]/.test(text)) {
				const k = addKey(`text.${slug(text)}`, text, `${rel}:${line(node)}`).slice(ns.length + 1);
				defLabels.add(k);
				edits.push({ start: node.initializer.getStart(sf), end: node.initializer.end, text: `labels['${k}']` });
			}
		}
		ts.forEachChild(node, visitDefinition);
	}

	function visit(node) {
		// JSX attributes with a literal
		if (ts.isJsxAttribute(node) && node.initializer && ATTRS.has(node.name.getText())) {
			const attrName = node.name.getText();
			const el = jsxElementOf(node);
			let init = node.initializer;
			let text = null;
			let tpl = null;
			if (ts.isStringLiteral(init)) text = init.text;
			else if (ts.isJsxExpression(init) && init.expression) {
				const e = init.expression;
				if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) text = e.text;
				else if (ts.isTemplateExpression(e)) {
					tpl = templateToSlots(e);
					if (!tpl) { left(node, 'template with complex slots'); return; }
					text = tpl.english;
				}
			}
			if (text !== null && readsLikeCopy(text.replace(/{{\w+}}/g, ''))) {
				// a label carrying a slot is a hint around the field label, not the label itself
				let attrKey = keyForAttr(attrName, el, text.replace(/{{\w+}}/g, ' '));
				if (tpl && attrKey.startsWith('field.')) attrKey = `text.label_${attrKey.slice(6)}`;
				const key = addKey(attrKey, text, `${rel}:${line(node)}`);
				if (!useKey(node, key)) { left(node, 'no component host'); return; }
				const lookup = `translations['${key}']`;
				const expr = tpl ? `replaceVars(${lookup}, { ${tpl.vars.map(([n, e]) => (n === e ? n : `${n}: ${e}`)).join(', ')} })` : lookup;
				edits.push({ start: init.getStart(sf), end: init.end, text: `{${expr}}`, needsReplaceVars: !!tpl });
				return;
			}
		}
		// Whole JSX text children
		if (ts.isJsxText(node) && readsLikeCopy(node.text)) {
			const parentEl = node.parent;
			const siblings = (parentEl.children ?? []).filter((c) => !(ts.isJsxText(c) && c.text.trim() === ''));
			const text = node.text.replace(/\s+/g, ' ').trim();
			// siblings that carry no words of their own (an icon element) do not make it a sentence
			const wordless = (c) => (ts.isJsxSelfClosingElement(c) || ts.isJsxElement(c)) && !/[A-Za-z]{2,}/.test(c.getText(sf).replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, ''));
			if (siblings.filter((c) => c !== node).every(wordless)) {
				const field = ts.isJsxElement(parentEl) ? fieldNameOf(parentEl.openingElement) : null;
				const tag = ts.isJsxElement(parentEl) ? tagName(parentEl) : '';
				let key;
				if (field) key = `field.${field}`;
				else if (/^(h[1-6]|CardTitle|legend)$/.test(tag)) key = `section.${slug(text)}`;
				else if (/^(label|th|Label)$/.test(tag)) key = `field.${slug(text)}`;
				else key = `text.${slug(text)}`;
				const fullKey = addKey(key, text.replace(/&apos;/g, "'").replace(/&quot;/g, '"'), `${rel}:${line(node)}`);
				if (!useKey(node, fullKey)) { left(node, 'no component host'); return; }
				const start = node.pos + node.text.indexOf(node.text.trim());
				edits.push({ start, end: start + node.text.trim().length, text: `{translations['${fullKey}']}` });
			} else {
				left(node, 'JSX text mixed with elements (sentence?)');
			}
			return;
		}
		// Anything else that reads like copy: report
		if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /^[A-Z].*[a-z]|\s[a-z]{3,}/.test(node.text) && !ts.isImportDeclaration(node.parent) && !ts.isLiteralTypeNode(node.parent) && !(ts.isExpressionStatement(node.parent) && /^use (client|server)$/.test(node.text))) {
			const p = node.parent;
			// any enclosing cn()/logger/Error call up to the statement makes it non-copy
			let inNonCopyCall = false;
			for (let q = node.parent; q && !ts.isStatement(q); q = q.parent) {
				if ((ts.isCallExpression(q) || ts.isNewExpression(q)) && /^(logger\.\w+|logRejection|cn|clsx|cva|translate\w*|useTranslation|\w*Error|assert\w*)$/.test(q.expression.getText())) { inNonCopyCall = true; break; }
				if (ts.isJsxAttribute(q) && /^(className|key|id|fieldName)$/.test(q.name.getText())) { inNonCopyCall = true; break; }
			}
			const skip = inNonCopyCall || (ts.isCallExpression(p) && /logger|logRejection|cn|clsx|translate|useTranslation|Error/.test(p.expression.getText())) || ts.isNewExpression(p) || (ts.isJsxAttribute(p) && /className|key|id|fieldName/.test(p.name.getText())) || (ts.isPropertyAssignment(p) && p.name === node) || ts.isElementAccessExpression(p);
			if (!skip) left(node, 'string');
		}
		if (ts.isTemplateExpression(node) && /[A-Za-z]{3,}\s|\s[A-Za-z]{3,}/.test([node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(''))) {
			const p = node.parent;
			if (!(ts.isCallExpression(p) && /logger|Error|cn|translate/.test(p.expression.getText())) && !ts.isNewExpression(p)) left(node, 'template');
		}
		ts.forEachChild(node, visit);
	}

	if (isDefinition) visitDefinition(sf);
	else visit(sf);

	if (!edits.length) return;

	// --- definition: wrap the action batch in Promise.all with a labels batch
	if (isDefinition && defLabels.size) {
		// the `translations = await translateBatch([...], '<x>.action')` statement, found on the AST
		let target = null;
		const find = (n) => {
			if (target) return;
			if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'translations' && n.initializer && ts.isAwaitExpression(n.initializer)) {
				const call = n.initializer.expression;
				const prefixArg = ts.isCallExpression(call) && call.arguments[1];
				if (prefixArg && ts.isStringLiteral(prefixArg) && prefixArg.text.endsWith('.action')) target = { decl: n, call, prefixArg };
			}
			ts.forEachChild(n, find);
		};
		find(sf);
		if (!target) {
			report.LEFT.push(`${rel}\tdefinition action batch not found - add the labels batch by hand: ${[...defLabels].join(', ')}`);
		} else {
			const stmt = target.decl.parent.parent;
			const lineStart = source.lastIndexOf('\n', stmt.getStart(sf)) + 1;
			const indent = /^\t*/.exec(source.slice(lineStart))[0];
			const reindent = (t) => t.replace(/\n/g, '\n\t');
			const list = [...defLabels].sort().map((k) => `${indent}\t\t\t'${k}',`).join('\n');
			const replaced = `const [translations, labels] = await Promise.all([\n${indent}\ttranslateBatch(\n${indent}\t\t${reindent(target.call.arguments[0].getText(sf))},\n${indent}\t\t'${target.prefixArg.text}',\n${indent}\t),\n${indent}\ttranslateBatch(\n${indent}\t\t[\n${list}\n${indent}\t\t] as const,\n${indent}\t\t'${ns}',\n${indent}\t),\n${indent}]);`;
			edits.push({ start: stmt.getStart(sf), end: stmt.end, text: replaced });
		}
	}

	// --- components: TRANSLATION_KEYS + hook
	let out = source;
	const allKeys = new Set();
	for (const ks of hostKeys.values()) for (const k of ks) allKeys.add(k);
	const hosts = [...hostKeys.keys()];
	if (hosts.length > 1) report.NOTE.push(`${rel}\t${hosts.length} components use keys - pass translations as a prop to sub-components: ${hosts.map((h) => (h.name ?? h.parent.name).getText()).join(', ')}`);

	const existingConst = /const TRANSLATION_KEYS = \[\n([\s\S]*?)\] as const;/.exec(source);
	const localKeysVar = /const (translationsKeys|translationKeys) = \[/.test(source);
	if (localKeysVar && allKeys.size) report.LEFT.push(`${rel}\thas a local translationsKeys list - merge into TRANSLATION_KEYS by hand`);

	for (const host of hosts) {
		const body = host.body;
		if (!body || !ts.isBlock(body)) { report.LEFT.push(`${rel}:${line(host)}\tcomponent has an expression body - add the hook by hand`); continue; }
		if (/useTranslation\(/.test(body.getText())) continue; // existing hook: keys merged into its list below
		if (/\b(const|let) (\{ ?translations|translations)\b/.test(body.getText())) { report.LEFT.push(`${rel}:${line(host)}\t'translations' already declared`); continue; }
		const insertAt = body.getStart(sf) + 1;
		edits.push({ start: insertAt, end: insertAt, text: `\n${'\t'.repeat(indentOf(source, body.statements[0]))}const { translations } = useTranslation(TRANSLATION_KEYS);\n` });
	}

	edits.sort((a, b) => b.start - a.start);
	for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

	if (allKeys.size) {
		if (existingConst) {
			const present = new Set([...existingConst[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
			const add = [...allKeys].filter((k) => !present.has(k)).sort();
			out = out.replace(/(const TRANSLATION_KEYS = \[\n[\s\S]*?)(\] as const;)/, (_, a, b) => `${a}${add.map((k) => `\t'${k}',\n`).join('')}${b}`);
		} else {
			const block = `\nconst TRANSLATION_KEYS = [\n${[...allKeys].sort().map((k) => `\t'${k}',`).join('\n')}\n] as const;\n`;
			out = insertAfterImports(out, block);
		}
		out = addImport(out, 'useTranslation', '@/hooks/use-translation.hook');
		if (!/^'use client';/.test(out)) {
			if (/(view|form|data-table|manage|setup|status-transition)-/.test(path.basename(file))) {
				out = `'use client';\n\n${out}`;
				report.NOTE.push(`${rel}\tadded 'use client'`);
			} else report.LEFT.push(`${rel}\tuses the hook but has no 'use client' - check it is a client component`);
		}
	}
	if (edits.some((e) => e.needsReplaceVars)) out = addImport(out, 'replaceVars', '@/helpers/string.helper');

	if (!dry) fs.writeFileSync(file, out);
	console.log(`converted ${rel}: ${edits.length} edits`);
}

function indentOf(source, stmt) {
	if (!stmt) return 2;
	const lineStart = source.lastIndexOf('\n', stmt.getStart()) + 1;
	return /^\t*/.exec(source.slice(lineStart))[0].length || 1;
}

for (const t of targets) for (const f of walk(t)) {
	try { processFile(f); } catch (e) { report.LEFT.push(`${path.relative(root, f)}\tCONVERTER ERROR ${e.message}`); }
}
if (!dry) fs.writeFileSync(keysFile, JSON.stringify(keys, null, '\t') + '\n');
for (const [k, rows] of Object.entries(report)) for (const r of rows) console.log(`${k}\t${r}`);
