import type { ImageMime } from '@/types/image.type';

export function capitalizeFirstLetter(str: string): string {
	return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

export function formatEnumLabel(value: string): string {
	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

/**
 * Latin letters that carry no combining mark to strip, so `NFD` leaves them intact and the
 * alphanumeric filter would drop them entirely. Spelled out rather than reached for a
 * transliteration library: this is the set that realistically turns up in European company
 * and place names, and a dependency for twenty characters is a poor trade.
 *
 * Multi-letter expansions of a capital are title-cased (`Æ` → `Ae`, not `AE`): the
 * capital-run split in `toKebabCase` would read `AE` as an acronym ending a word and cut
 * `Ærø` into `a-ero`.
 */
const NON_DECOMPOSING_LETTERS: Record<string, string> = {
	ß: 'ss',
	æ: 'ae',
	œ: 'oe',
	ø: 'o',
	đ: 'd',
	ð: 'd',
	ł: 'l',
	þ: 'th',
	ħ: 'h',
	ı: 'i',
	ẞ: 'Ss',
	Æ: 'Ae',
	Œ: 'Oe',
	Þ: 'Th',
	Ø: 'O',
	Đ: 'D',
	Ð: 'D',
	Ł: 'L',
	Ħ: 'H',
};

/**
 * Derived from the map so the two cannot disagree: a letter added above is matched here
 * automatically. Every key is a single character with no meaning inside a character class,
 * so joining them is safe.
 */
const NON_DECOMPOSING_PATTERN = new RegExp(
	`[${Object.keys(NON_DECOMPOSING_LETTERS).join('')}]`,
	'g',
);

/**
 * Folds accented letters onto their ASCII base: `Brăila` → `Braila`.
 *
 * `NFD` splits a precomposed letter into base + combining mark, so stripping the marks
 * leaves the base behind for the alphanumeric filter in `toKebabCase` to keep. Slugs are
 * generated from user-entered names in a Romanian-first app, so this is the difference
 * between `braila` and a mangled `brila`.
 *
 * Both Romanian encodings fold the same way — comma-below (`ș`, U+0219) and cedilla (`ş`,
 * U+015F) — which they need to, since real data mixes them.
 *
 * Call it before the camelCase split so an accented capital still reads as a word boundary.
 */
function foldDiacritics(str: string): string {
	return str
		.replace(
			NON_DECOMPOSING_PATTERN,
			(letter) => NON_DECOMPOSING_LETTERS[letter] ?? letter,
		)
		.normalize('NFD')
		.replace(/\p{M}/gu, '');
}

/**
 * Convert a string to kebab-case
 *
 * toKebabCase("hello world")           // "hello-world"
 * toKebabCase("HelloWorld")             // "hello-world"
 * toKebabCase("helloWorld")             // "hello-world"
 * toKebabCase("hello_world")            // "hello_world"
 * toKebabCase("hello__world")           // "hello__world"
 * toKebabCase("Hello World!")           // "hello-world"
 * toKebabCase("myVariableName")         // "my-variable-name"
 * toKebabCase("This is a test")         // "this-is-a-test"
 * toKebabCase("  leading trailing  ")   // "leading-trailing"
 * toKebabCase("Ursus Brăila")           // "ursus-braila" (accents folded, not dropped)
 * toKebabCase("Groß Straße")            // "gross-strasse"
 *
 * toKebabCase("hello_world", { preserveUnderscores: false })   // "hello-world"
 * toKebabCase("hello__world", { preserveUnderscores: false })  // "hello-world"
 * toKebabCase("hello_world test", { preserveUnderscores: false }) // "hello-world-test"
 *
 * toKebabCase("HelloWorld", { preserveCase: true })     // "Hello-World" (keeps case)
 * toKebabCase("myXMLParser", { preserveCase: true })    // "my-XML-Parser"
 * toKebabCase("HelloWorld", { preserveCase: true, preserveUnderscores: false }) // "Hello-World"
 */
export function toKebabCase(
	str: string,
	options: {
		preserveCase?: boolean;
		preserveUnderscores?: boolean;
	} = {},
): string {
	const { preserveCase = false, preserveUnderscores = true } = options;

	/*
	 * Split camelCase/PascalCase *before* the lowercase below, which destroys the case
	 * boundary the split reads.
	 *
	 * Two patterns rather than one: the first breaks a lower→upper transition
	 * (`myVariable` → `my-Variable`), the second breaks a run of capitals off the word it
	 * starts (`XMLParser` → `XML-Parser`), which a single pattern cannot do.
	 */
	let result = foldDiacritics(str)
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2');

	// Convert to lowercase unless preserveCase is true
	if (!preserveCase) {
		result = result.toLowerCase();
	}

	// Replace spaces and (optionally) underscores with hyphens
	if (preserveUnderscores) {
		result = result.replace(/\s+/g, '-');
	} else {
		result = result.replace(/[\s_]+/g, '-');
	}

	// Remove special characters but keep hyphens and alphanumeric — and underscores when
	// they are being preserved, otherwise this strip would undo the branch above.
	result = result.replace(
		preserveUnderscores ? /[^a-zA-Z0-9\-_]/g : /[^a-zA-Z0-9-]/g,
		'',
	);

	// Clean up multiple hyphens
	result = result.replace(/-+/g, '-');

	// Remove leading/trailing hyphens
	result = result.replace(/^-+|-+$/g, '');

	return result;
}

/**
 * Convert a string to title case
 * Ex: 'cash-flow' → 'Cash Flow'
 */
export function toTitleCase(str: string): string {
	return str
		.replace(/[_-]/g, ' ')
		.split(' ')
		.map((word) => {
			if (!word) {
				return '';
			}

			// Capitalize the first letter, lowercase the rest
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Convert a string to camelCase (or PascalCase if capitalizeFirst is true)
 * Ex: 'cash-flow' → 'cashFlow'
 * Ex: 'cash-flow' with capitalizeFirst: true → 'CashFlow'
 */
export function toCamelCase(
	str: string,
	options: { capitalizeFirst?: boolean } = {},
): string {
	const { capitalizeFirst = false } = options;

	return str
		.replace(/[_-]/g, ' ')
		.split(' ')
		.map((word, index) => {
			if (!word) return '';

			// If capitalizeFirst is true, capitalize even the first word
			if (capitalizeFirst) {
				return (
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				);
			}

			// Default behavior: first word lowercase, rest capitalized
			return index === 0
				? word.toLowerCase()
				: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join('');
}

/**
 * Replace variables in a string
 * Ex variables: {{key}}, {{Key}}, {{sub_key}}, {{key1}}
 *
 * @param {string} content - The string to replace template variables in
 * @param {Record<string, string | number>} vars - The template variables to replace
 * @returns {string} - The string with template variables replaced
 */
export function replaceVars(
	content: string,
	vars: Record<string, string | number> = {},
): string {
	// Numbers are accepted because most interpolated values are numeric config
	// (character minimums, counts) — stringifying at every call site was noise.
	return content.replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
		Object.hasOwn(vars, key) ? String(vars[key]) : `{{${key}}}`,
	);
}

export function parseJson(val: unknown) {
	if (typeof val === 'string') {
		if (val.trim() === '') {
			return {};
		}

		try {
			return JSON.parse(val);
		} catch {
			return {};
		}
	}

	return val;
}

/**
 * Decimal places an amount is meaningful to.
 *
 * Mirrors `AMOUNT_DECIMALS` in the backend's `cash-flow.entity.ts`. Amounts are not stored
 * with a separator there: `cash-flow.service.ts` persists `Math.round(abs(amount) * 10 ** 4)`
 * as an integer and divides by the same factor on read, so 80.6452 is stored as 806452.
 * Anything past the fourth decimal is discarded by that round-trip regardless — rounding here
 * means the value the app shows and the value the database holds are the same number.
 *
 * Keep in sync with the backend if its precision ever changes.
 */
const AMOUNT_DECIMALS = 4;

/**
 * Rounds to the precision the backend stores.
 *
 * `toFixed` rather than `Math.round(value * 10 ** AMOUNT_DECIMALS) / 10 ** AMOUNT_DECIMALS`:
 * it rounds the decimal representation, so it does not inherit the error of a binary
 * multiply. All three VAT helpers go through it, so a value is the same number whichever
 * one produced it.
 */
function roundAmount(value: number): number {
	return parseFloat(value.toFixed(AMOUNT_DECIMALS));
}

/**
 * Add VAT to a net amount
 *
 * @param {number} netAmount - Amount excluding VAT
 * @param {number} vatRate - VAT rate in percentage (e.g., 20 for 20%)
 * @returns {number} Total amount including VAT
 */
export function calcGrossAmount(netAmount: number, vatRate: number): number {
	if (vatRate < 0) {
		throw new Error('VAT rate must be greater or equal to 0');
	}

	return roundAmount(netAmount * (1 + vatRate / 100));
}

/**
 * Remove VAT from a gross amount to get net amount (excl. tax)
 *
 * @param {number} grossAmount - Amount including VAT
 * @param {number} vatRate - VAT rate in percentage (e.g., 20 for 20%)
 * @returns {number} Net amount excluding VAT
 */
export function calcNetAmount(grossAmount: number, vatRate: number): number {
	if (vatRate < 0) {
		throw new Error('VAT rate must be greater or equal to 0');
	}

	return roundAmount(grossAmount / (1 + vatRate / 100));
}

/**
 * Extract VAT amount from a gross amount
 *
 * @param {number} grossAmount - Amount including VAT
 * @param {number} vatRate - VAT rate in percentage (e.g., 20 for 20%)
 * @returns {number} VAT amount only
 */
export function extractVAT(grossAmount: number, vatRate: number): number {
	if (vatRate < 0) {
		throw new Error('VAT rate must be greater or equal to 0');
	}

	return roundAmount(grossAmount - grossAmount / (1 + vatRate / 100));
}

export function normalizePhoneNumber(
	number: string,
	defaultCountryCode: string = '40',
): string {
	let digits = number.replace(/\D/g, '');

	// Already in international format
	if (number.trimStart().startsWith('+')) {
		return digits;
	}

	// International prefix (00...)
	if (digits.startsWith('00')) {
		return digits.substring(2);
	}

	// Has enough digits to already include a country code
	if (digits.length > 10) {
		return digits;
	}

	// Local number — strip trunk prefix (leading 0) and add country code
	if (digits.startsWith('0')) {
		digits = digits.substring(1);
	}

	return defaultCountryCode + digits;
}

/**
 * Formats bytes
 *
 * @param bytes
 */
export function formatBytes(bytes?: number): string {
	if (bytes == null) {
		return '—';
	}

	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats MIME type (eg: 'image/jpeg' → 'JPEG')
 *
 * @param mime
 */
export function formatMime(mime?: ImageMime): string {
	if (!mime) {
		return '—';
	}

	return mime.replace('image/', '').toUpperCase();
}

/**
 * Formats a number with a sign
 *
 * @param num
 */
export function numberWithSign(num: number) {
	return num > 0 ? `+${num}` : `${num}`;
}
