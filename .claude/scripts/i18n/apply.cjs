// Apply: merges keys/<ns>.<lang>.json into src/locales/<lang>/<ns>.json for every language.
// Refuses to overwrite a different existing text, skips identical ones, and fails (writing
// nothing) if any language is missing a key the English file has.
// usage: node apply.cjs <ns...>
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.I18N_ROOT || process.cwd();
const work = (process.env.I18N_WORK || require('node:path').join(process.env.I18N_ROOT || process.cwd(), '.i18n-work'));
const langs = fs.readdirSync(path.join(root, 'src/locales')).filter((d) => !d.includes('.'));
let failed = false;
for (const ns of process.argv.slice(2)) {
	const load = (lang) => { const f = path.join(work, 'keys', `${ns}.${lang}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };
	const en = load('en');
	const plans = [];
	for (const lang of langs) {
		const file = path.join(root, 'src/locales', lang, `${ns}.json`);
		const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
		const add = load(lang);
		let added = 0;
		for (const fullKey of Object.keys(en)) {
			const parts = fullKey.split('.').slice(1);
			const existing = parts.reduce((o, k) => o?.[k], locale);
			const text = add[fullKey];
			if (text === undefined) {
				if (typeof existing !== 'string') { console.log(`MISSING ${lang} ${fullKey}`); failed = true; }
				continue;
			}
			if (existing !== undefined) {
				if (existing !== text) { console.log(`REFUSE ${lang} ${fullKey}: locale has "${existing}", key file "${text}"`); failed = true; }
				continue;
			}
			let o = locale;
			for (const k of parts.slice(0, -1)) {
				if (typeof o[k] === 'string') { console.log(`REFUSE ${lang} ${fullKey}: ${k} is a string`); failed = true; break; }
				o = o[k] ??= {};
			}
			o[parts.at(-1)] = text;
			added++;
		}
		plans.push({ file, locale, added, lang });
	}
	if (failed) continue;
	for (const p of plans) {
		fs.writeFileSync(p.file, `${JSON.stringify(p.locale, null, '\t')}\n`);
		console.log(`${ns} ${p.lang}: +${p.added}`);
	}
}
process.exitCode = failed ? 1 : 0;
