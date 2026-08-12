import { Configuration } from '@/config/settings.config';
import { capitalizeFirstLetter } from '@/helpers/string.helper';
import type { Language } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

export const CategoryStatusEnum = {
	ACTIVE: 'active',
	PENDING: 'pending',
	INACTIVE: 'inactive',
} as const;

export type CategoryStatus =
	(typeof CategoryStatusEnum)[keyof typeof CategoryStatusEnum];

export const CategoryTypeEnum = {
	ARTICLE: 'article',
	PRODUCT: 'product',
} as const;

export type CategoryType =
	(typeof CategoryTypeEnum)[keyof typeof CategoryTypeEnum];

/**
 * Mirrors the backend `find` default (`category.validator.ts`): an unfiltered list is the
 * article tree. The UI states it explicitly so the type filter never shows blank while the
 * rows are already scoped.
 */
export const CATEGORY_DEFAULT_TYPE = CategoryTypeEnum.ARTICLE;

export type CategoryContentType = {
	language: Language;
	label: string;
	slug: string;
	description: string | null;
	meta: PageMeta;
};

export type CategoryModel<D = Date | string> = {
	id: number;
	type: CategoryType;
	status: CategoryStatus;
	sort_order?: number;
	details?: Record<string, string | number | boolean> | null;

	// Hierarchy — `find` returns the parent as a stub (`id` + one content label);
	// `read` returns the full row, plus `ancestors`/`children` when asked for them.
	parent?: CategoryModel<D> | null;
	ancestors?: CategoryModel<D>[];
	children?: CategoryModel<D>[];

	// Timestamps
	created_at: D;
	updated_at: D;
	deleted_at: D;

	// Content translations
	contents?: CategoryContentType[];
};

// Helpers
export function getCategoryContentProp(
	category: CategoryModel,
	language: Language,
	prop: keyof Pick<
		CategoryContentType,
		'label' | 'slug' | 'description'
	> = 'label',
): string {
	if (!category.contents?.length) {
		return '[no content]';
	}

	const contentSelected = category.contents.find(
		(c) => c.language === language,
	);

	if (contentSelected?.[prop]) {
		return contentSelected[prop];
	}

	const contentDefault = category.contents.find(
		(c) => c.language === Configuration.defaultLanguage(),
	);

	if (contentDefault?.[prop]) {
		return contentDefault[prop];
	}

	return category.contents[0][prop] ?? '[no content]';
}

export const displayCategoryLabel = (
	m: CategoryModel,
	language: Language,
	withType: boolean = true,
) => {
	const label = getCategoryContentProp(m, language, 'label');

	if (!withType) {
		return label;
	}

	return `${capitalizeFirstLetter(m.type)} / ${label}`;
};
