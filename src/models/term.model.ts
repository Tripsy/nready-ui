import { Configuration } from '@/config/settings.config';
import type { Language } from '@/types/common.type';

/**
 * Mirrors the backend's own `TermTypeEnum` - keep the two in sync when it gains a type.
 *
 * The type is what every picker filters on, which is the only thing keeping one list from
 * offering another's terms. `bundle_choice` exists for that reason rather than reusing `text`:
 * a bundle's choice prompts are a small curated set, and drawing them from the general-purpose
 * pool would make both lists too broad to pick from.
 */
export const TermTypeEnum = {
	TAG: 'tag',
	ATTRIBUTE_LABEL: 'attribute_label',
	ATTRIBUTE_VALUE: 'attribute_value',
	TEXT: 'text',
	BUNDLE_CHOICE: 'bundle_choice',
} as const;

export type TermType = (typeof TermTypeEnum)[keyof typeof TermTypeEnum];

/**
 * The types whose wording is stored as it was typed. Mirrors `CASE_PRESERVING_TYPES` in the
 * backend's `TermService` - keep the two in sync.
 */
const CASE_PRESERVING_TYPES: readonly TermType[] = [
	TermTypeEnum.ATTRIBUTE_LABEL,
	TermTypeEnum.TEXT,
	TermTypeEnum.BUNDLE_CHOICE,
];

/**
 * What a term's wording is stored as, which the backend applies again on the way in.
 *
 * Most types are folded: a term is a label reused across articles and products, and "Summer" and
 * "summer" rendering as two tags is the defect the rule exists for. `bundle_choice` is exempt
 * because it is not a label but the question a bundle asks the customer - folding "Choose your
 * fries" would put it on the storefront in lower case.
 *
 * Applied here as well as server-side so the editor sees the wording it will get back, rather than
 * typing one string and reading another after the next fetch.
 */
export function storedTermValue(type: TermType, value: string): string {
	return CASE_PRESERVING_TYPES.includes(type)
		? value.trim()
		: value.trim().toLowerCase();
}

export type TermContentType = {
	language: Language;
	value: string;
};

export type TermModel<D = Date | string> = {
	id: number;

	type: TermType;
	contents: TermContentType[];

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

/**
 * The wording carried by a row, falling back through the default language and then whatever
 * translation exists.
 *
 * The fallback chain matters because callers hand this two different shapes: `find` returns
 * only the filtered language, so the requested one is the sole content and the chain never
 * runs; `read` returns every translation, and there the chain is what keeps a term readable
 * under a language it was never translated into. A term carrying no content at all is the
 * one case that yields `fallback` - `-`, the same mark the shared value renderer uses for an
 * absent column, rather than a blank cell that reads like a failed load.
 */
export const displayTermValue = (
	entry: TermModel,
	language: Language,
	fallback: string = '-',
): string => {
	if (!entry.contents?.length) {
		return fallback;
	}

	const contentSelected = entry.contents.find(
		(content) => content.language === language,
	);

	if (contentSelected?.value) {
		return contentSelected.value;
	}

	const contentDefault = entry.contents.find(
		(content) => content.language === Configuration.defaultLanguage(),
	);

	if (contentDefault?.value) {
		return contentDefault.value;
	}

	return entry.contents[0].value || fallback;
};

/**
 * Window titles and confirmation lists. The type disambiguates two terms reading the same, and
 * every wording the entry carries is shown - one for a list row, all of them once `read` has
 * loaded the full set into a form.
 */
export const displayTermLabel = (
	entry: TermModel,
	defaultLanguage: Language,
) => {
	const values = [...(entry.contents ?? [])]
		.sort((first, second) => {
			if (first.language === second.language) {
				return 0;
			}

			if (first.language === defaultLanguage) {
				return -1;
			}

			if (second.language === defaultLanguage) {
				return 1;
			}

			return first.language.localeCompare(second.language);
		})
		.map((content) => content.value)
		.join(' / ');

	return `[${entry.type}] ${values}`;
};
