const path = require('node:path');
const ts = require(path.join(process.env.I18N_ROOT || process.cwd(), 'node_modules/typescript'));

function insertAfterImports(source, block) {
	const sf = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const imports = sf.statements.filter((s) => ts.isImportDeclaration(s));
	const at = imports.length ? imports.at(-1).end : 0;
	return `${source.slice(0, at)}\n\n${block.trim()}${source.slice(at)}`;
}

function addImport(source, name, from) {
	const sf = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const imports = sf.statements.filter((s) => ts.isImportDeclaration(s));
	const existing = imports.find((i) => i.moduleSpecifier.text === from);
	if (existing) {
		const clause = existing.importClause;
		const named = clause?.namedBindings;
		if (named && ts.isNamedImports(named)) {
			if (named.elements.some((e) => e.name.text === name)) return source;
			// a value added to `import type { ... }` turns the others into inline `type` specifiers
			const existingNames = named.elements.map((e) => (clause.isTypeOnly ? `type ${e.getText()}` : e.getText()));
			const names = [...existingNames, name].sort((a, b) => a.replace(/^type /, '').localeCompare(b.replace(/^type /, ''), 'en', { sensitivity: 'base' }));
			const isTypeOnly = false;
			const text = `import ${isTypeOnly ? 'type ' : ''}{ ${names.join(', ')} } from '${from}';`;
			const lines = text.length > 80 ? `import ${isTypeOnly ? 'type ' : ''}{\n${names.map((n) => `\t${n},`).join('\n')}\n} from '${from}';` : text;
			return source.slice(0, existing.getStart(sf)) + lines + source.slice(existing.end);
		}
		return source;
	}
	const line = `import { ${name} } from '${from}';`;
	const after = imports.find((i) => i.moduleSpecifier.text.startsWith('@/') && i.moduleSpecifier.text > from);
	if (after) return source.slice(0, after.getStart(sf)) + line + '\n' + source.slice(after.getStart(sf));
	const at = imports.length ? imports.at(-1).end : 0;
	return source.slice(0, at) + '\n' + line + source.slice(at);
}


module.exports = { insertAfterImports, addImport };
