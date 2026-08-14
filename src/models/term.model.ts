import type { Language } from '@/types/common.type';

export const TermTypeEnum = {
	TAG: 'tag',
	ATTRIBUTE_LABEL: 'attribute_label',
	ATTRIBUTE_VALUE: 'attribute_value',
	TEXT: 'text',
} as const;

export type TermType = (typeof TermTypeEnum)[keyof typeof TermTypeEnum];

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
 * The wording carried by a list row. `find` returns the single content for the filtered
 * language, so a term with no translation there arrives with none at all — rendered as the
 * same `-` the shared value renderer uses for an absent column, rather than a blank cell that
 * reads like a failed load.
 */
export const displayTermValue = (entry: TermModel): string => {
	return entry.contents?.[0]?.value || '-';
};

/**
 * Window titles and confirmation lists. The type disambiguates two terms reading the same, and
 * every wording the entry carries is shown — one for a list row, all of them once `read` has
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
