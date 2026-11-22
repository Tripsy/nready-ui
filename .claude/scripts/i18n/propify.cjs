// Propify: turns sub-components that call useTranslation(TRANSLATION_KEYS) into components that
// take the parent's `translations` as a typed prop. Adds
//   type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;
// after TRANSLATION_KEYS, removes the sub-component's hook, adds `translations` to its props
// (inline type literal or a named props type in the same file) and passes
// `translations={translations}` at every JSX use in the file.
// usage: node propify.cjs <file> <SubComponent...>
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.env.I18N_ROOT || process.cwd(), 'node_modules/typescript'));

const [file, ...names] = process.argv.slice(2);
let source = fs.readFileSync(file, 'utf8');
const problems = [];

function parse() { return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

function findComponent(sf, name) {
	let found = null;
	const v = (n) => {
		if (found) return;
		if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n;
		else if (ts.isVariableDeclaration(n) && n.name.getText(sf) === name && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) found = n.initializer;
		ts.forEachChild(n, v);
	};
	v(sf);
	return found;
}

for (const name of names) {
	let sf = parse();
	const fn = findComponent(sf, name);
	if (!fn) { problems.push(`${name}: not found`); continue; }
	const edits = [];
	// 1. drop the hook statement
	const hookStmt = ts.isBlock(fn.body) && fn.body.statements.find((s) => /const \{ translations \} = useTranslation\(TRANSLATION_KEYS\);/.test(s.getText(sf)));
	if (hookStmt) {
		const lineStart = source.lastIndexOf('\n', hookStmt.getStart(sf));
		let end = hookStmt.end;
		if (source.slice(end, end + 2) === '\n\n') end += 1;
		edits.push({ start: lineStart, end, text: '' });
	}
	// 2. props
	const param = fn.parameters[0];
	if (!param) {
		edits.push({ start: fn.parameters.pos, end: fn.parameters.end, text: '{ translations }: { translations: TranslationsType }' });
	} else if (ts.isObjectBindingPattern(param.name)) {
		const open = param.name.getStart(sf) + 1;
		edits.push({ start: open, end: open, text: '\n\ttranslations,' });
		const type = param.type;
		if (type && ts.isTypeLiteralNode(type)) {
			const o = type.getStart(sf) + 1;
			edits.push({ start: o, end: o, text: '\n\ttranslations: TranslationsType;' });
		} else if (type && ts.isTypeReferenceNode(type)) {
			const typeName = type.typeName.getText(sf);
			let decl = null;
			const v = (n) => { if (!decl && ts.isTypeAliasDeclaration(n) && n.name.text === typeName) decl = n; ts.forEachChild(n, v); };
			v(sf);
			if (decl && ts.isTypeLiteralNode(decl.type)) {
				const o = decl.type.getStart(sf) + 1;
				edits.push({ start: o, end: o, text: '\n\ttranslations: TranslationsType;' });
			} else if (decl) {
				edits.push({ start: decl.type.getStart(sf), end: decl.type.getStart(sf), text: '{ translations: TranslationsType } & ' });
			} else problems.push(`${name}: props type ${typeName} not declared in this file - add translations by hand`);
		} else problems.push(`${name}: props have no type annotation - add translations by hand`);
	} else problems.push(`${name}: props parameter is not destructured - add translations by hand`);
	// 3. call sites
	const v = (n) => {
		if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === name) {
			const at = n.tagName.end + (n.typeArguments ? source.slice(n.tagName.end).indexOf('>') + 1 : 0);
			edits.push({ start: at, end: at, text: ' translations={translations}' });
		}
		ts.forEachChild(n, v);
	};
	v(sf);
	edits.sort((a, b) => b.start - a.start);
	for (const e of edits) source = source.slice(0, e.start) + e.text + source.slice(e.end);
}

if (!/type TranslationsType = /.test(source)) {
	source = source.replace(/(const TRANSLATION_KEYS = \[[\s\S]*?\] as const;\n)/, '$1\ntype TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;\n');
}
fs.writeFileSync(file, source);
for (const p of problems) console.log(`LEFT\t${p}`);
console.log(`propified ${names.join(', ')}`);
