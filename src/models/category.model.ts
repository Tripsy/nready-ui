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

	// Hierarchy - `find` returns the parent as a stub (`id` + one content label);
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
/**
 * `fallback` is what an absent value reads as. It defaults to the dashboard's marker, which
 * flags a row an editor has to fix; a public surface passes an empty string, where a missing
 * optional field (a description, say) is not a fault to advertise.
 */
export function getCategoryContentProp(
	category: CategoryModel,
	language: Language,
	prop: keyof Pick<
		CategoryContentType,
		'label' | 'slug' | 'description'
	> = 'label',
	fallback: string = '[no content]',
): string {
	if (!category.contents?.length) {
		return fallback;
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

	return category.contents[0][prop] ?? fallback;
}

export type CategoryTreeNode = {
	entry: CategoryModel;
	children: CategoryTreeNode[];
	/**
	 * Its parent is missing from the set the tree was built from, so it is drawn as a root.
	 * Happens on any partial listing - an active-only fetch whose parent is inactive, or a
	 * page of results that stops short of it.
	 */
	isDetached: boolean;
};

/**
 * Nests a flat listing on the `parent.id` every category endpoint returns. Insertion order is
 * preserved, so a list the backend already ordered by `sort_order` comes out ordered within
 * each sibling group without a second sort.
 */
export function buildCategoryTree(
	entries: CategoryModel[],
): CategoryTreeNode[] {
	const nodes = new Map<number, CategoryTreeNode>(
		entries.map((entry) => [
			entry.id,
			{ entry, children: [], isDetached: false },
		]),
	);

	const roots: CategoryTreeNode[] = [];

	for (const entry of entries) {
		const node = nodes.get(entry.id);

		if (!node) {
			continue;
		}

		const parentNode = entry.parent
			? nodes.get(entry.parent.id)
			: undefined;

		if (parentNode) {
			parentNode.children.push(node);
		} else {
			node.isDetached = !!entry.parent;

			roots.push(node);
		}
	}

	return roots;
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
