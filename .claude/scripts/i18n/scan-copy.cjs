// Copy scanner: lists JSX text, string literals and template literals that read like
// user-facing copy. Output: file:line\tkind\ttext
// usage: node scan-copy.cjs <path...>   (files or directories, relative to the repo root)
// Misses acronym-only labels ("VAT", "ID") and lowercase copy by design - grep those.
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.I18N_ROOT || process.cwd();
const work = (process.env.I18N_WORK || require('node:path').join(process.env.I18N_ROOT || process.cwd(), '.i18n-work'));
const ts = require(path.join(root, 'node_modules/typescript'));

const SKIP_ATTRS = new Set([
	'className', 'key', 'id', 'fieldName', 'dataSource', 'dataKey', 'name', 'htmlFor',
	'type', 'variant', 'size', 'hover', 'href', 'src', 'role', 'mode', 'selectionMode',
	'entity', 'feature', 'page', 'icon', 'position', 'align', 'side', 'format', 'inputMode',
	'autoComplete', 'target', 'rel', 'method', 'action', 'as', 'fieldId', 'elementId',
]);
const SKIP_CALLEES = /^(logger\.\w+|logRejection|cn|clsx|translate|translateBatch|translateLoaded|useTranslation|enumTranslationKeys|translateEnumLabel|hasPermission|requestFind|requestDeleteMultiple|Routes\.\w+|Configuration\.\w+|console\.\w+|formatDate|useDataTable|require|import|\w+\.(startsWith|endsWith|includes|split|replace|join|padStart|toLocaleString))$/;
const SKIP_PROPS = new Set(['className', 'key', 'id', 'field', 'fieldName', 'dataSource', 'matchMode', 'windowType', 'buttonPosition', 'entriesSelection', 'variant', 'hover', 'size', 'sortField', 'queryKey', 'mode', 'position', 'type', 'labelKey', 'feature', 'permission']);

function readsLikeCopy(text) {
	const t = text.trim();
	if (!/[A-Za-z]/.test(t)) return false;
	if (/^(use client|use server)$/.test(t)) return false;
	if (/^[a-z0-9_-]+(\.[a-z0-9_${}-]+)+$/.test(t)) return false; // a translation key
	if (/^(https?:|\/|#|\.\/|@\/)/.test(t)) return false; // url / path
	if (/^[\w-]+(:[\w-[\]/.%]+)*$/.test(t) && !/^[A-Z]/.test(t)) return false; // identifier
	if (/^([a-z0-9[\]:./%!-]+\s+)+[a-z0-9[\]:./%!-]+$/.test(t) && /-/.test(t)) return false; // class list
	if (/^[A-Z0-9_]+$/.test(t) && t.length > 4) return false; // CONSTANT
	if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false; // camel/lower identifier
	if (/^[\d\s.,:/-]+[a-z]{0,3}$/i.test(t) && !/\s[a-z]{3,}/i.test(t)) return false; // numbers, dates
	return /^[A-Z]/.test(t) || /\s/.test(t) || /[.!?]$/.test(t);
}

function calleeName(expr) {
	if (ts.isIdentifier(expr)) return expr.text;
	if (ts.isPropertyAccessExpression(expr)) return `${calleeName(expr.expression)}.${expr.name.text}`;
	return '';
}

function skipByContext(node) {
	for (let p = node.parent, child = node; p; child = p, p = p.parent) {
		if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p)) return true;
		if (ts.isTypeNode(p) && !ts.isTypeQueryNode(p)) return true;
		if (ts.isJsxAttribute(p)) return SKIP_ATTRS.has(p.name.getText());
		if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return true;
		if (ts.isCallExpression(p) && SKIP_CALLEES.test(calleeName(p.expression))) return true;
		if (ts.isPropertyAssignment(p)) {
			if (p.name === child) return true; // the key itself
			if (SKIP_PROPS.has(p.name.getText().replace(/['"]/g, ''))) return true;
			return false;
		}
		if (ts.isElementAccessExpression(p) && p.argumentExpression === child) return true; // translations['x']
		if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText())) return true;
		if (ts.isCaseClause(p) && p.expression === child) return true;
		if (ts.isStatement(p) || ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return false;
	}
	return false;
}

function walk(target, files = []) {
	const abs = path.resolve(root, target);
	if (fs.statSync(abs).isDirectory()) {
		for (const e of fs.readdirSync(abs)) walk(path.join(abs, e), files);
	} else if (/\.tsx?$/.test(abs)) files.push(abs);
	return files;
}

const files = process.argv.slice(2).flatMap((t) => walk(t));
for (const file of files) {
	const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const rel = path.relative(root, file);
	const emit = (node, kind, text) => {
		const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
		console.log(`${rel}:${line}\t${kind}\t${text.replace(/\s+/g, ' ').trim()}`);
	};
	const visit = (node) => {
		if (ts.isJsxText(node)) {
			if (readsLikeCopy(node.text) || /[A-Za-z]{2,}/.test(node.text.trim())) emit(node, 'jsx', node.text);
		} else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			if (readsLikeCopy(node.text) && !skipByContext(node)) emit(node, 'string', node.text);
		} else if (ts.isTemplateExpression(node)) {
			const fixed = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
			// a fixed word of 3+ letters next to a slot or a space reads as copy ("{{n}} second(s)"),
			// unless the fixed text is a class list or a key/id pattern
			const isClassOrKey = /^[\s\w[\]:./%!#-]*$/.test(fixed) && !/\s[a-z]{3,}[^-\w:]|\s[a-z]{3,}$/.test(fixed.replace(/\s+/g, ' '));
			const hasWords = readsLikeCopy(fixed) || /(^|\s)[A-Za-z]{3,}(\(s\))?([\s.,!?:)]|$)/.test(fixed);
			if (hasWords && !isClassOrKey && !skipByContext(node)) emit(node, 'template', node.getText());
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
}
