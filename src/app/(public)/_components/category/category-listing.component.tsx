import Link from 'next/link';
import type { JSX } from 'react';
import { Icons } from '@/components/icon.component';
import { getLanguage, translateBatch } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import {
	buildCategoryTree,
	type CategoryTreeNode,
	type CategoryType,
	getCategoryContentProp,
} from '@/models/category.model';
import { requestPublicCategories } from '@/services/category.service';
import type { Language } from '@/types/common.type';

/**
 * The catalogue is a handful of groups, not a feed, so the page shows the whole tree rather
 * than paginating it. The cap is a guard against a catalogue that outgrows that assumption:
 * past it the listing is still correct, only incomplete, which the nesting makes visible
 * (a child whose parent did not fit is drawn as a root).
 */
const CATEGORY_LIMIT = 200;

// Categories change rarely and the page is anonymous, so it is served from Next's data cache
// and refreshed hourly rather than hitting the backend per visitor.
const REVALIDATE_SECONDS = 3600;

/**
 * Builds the href for one category, from its slug. A surface with no page per category
 * omits it and every name renders as plain text — a link to a 404 is worse than none.
 */
export type BuildCategoryHref = (slug: string) => string;

/**
 * Keys are resolved under the caller's `translationPrefix`, so each surface keeps its own
 * wording ("Product categories" vs. "Article categories") while sharing this markup.
 */
export const CATEGORY_LISTING_TRANSLATION_KEYS = [
	'text.heading',
	'text.subheading',
	'text.no_entries',
	'text.unavailable',
	'text.subcategories',
] as const;

/**
 * `null` means the backend could not be reached — told apart from an empty catalogue, which is
 * a legitimate answer and reads very differently to a visitor.
 */
async function getCategoryTree(
	type: CategoryType,
	language: Language,
): Promise<CategoryTreeNode[] | null> {
	try {
		const response = await requestPublicCategories({
			type,
			language,
			limit: CATEGORY_LIMIT,
			revalidate: REVALIDATE_SECONDS,
		});

		if (!response?.success) {
			return null;
		}

		return buildCategoryTree(getResponseData(response)?.entries ?? []);
	} catch (error) {
		logger.error('Failed to load the public category list', error, {
			type,
		});

		return null;
	}
}

/**
 * Where a category's name points, or `null` when this surface has no page to point at (or
 * the category carries no slug in this language, which is not an address).
 */
function resolveCategoryHref(
	node: CategoryTreeNode,
	language: Language,
	buildCategoryHref?: BuildCategoryHref,
): string | null {
	if (!buildCategoryHref) {
		return null;
	}

	const slug = getCategoryContentProp(node.entry, language, 'slug', '');

	return slug ? buildCategoryHref(slug) : null;
}

function CategoryBranch({
	node,
	language,
	buildCategoryHref,
}: {
	node: CategoryTreeNode;
	language: Language;
	buildCategoryHref?: BuildCategoryHref;
}): JSX.Element {
	const label = getCategoryContentProp(node.entry, language, 'label');
	const href = resolveCategoryHref(node, language, buildCategoryHref);

	return (
		<li>
			<span className="flex items-start gap-2">
				<Icons.Direction.ArrowCurvedBottom className="mt-1 shrink-0 opacity-40" />
				{href ? (
					<Link href={href} className="hover:underline">
						{label}
					</Link>
				) : (
					<span>{label}</span>
				)}
			</span>

			{node.children.length > 0 && (
				<ul className="mt-1 ml-5 space-y-1">
					{node.children.map((child) => (
						<CategoryBranch
							key={child.entry.id}
							node={child}
							language={language}
							buildCategoryHref={buildCategoryHref}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

/**
 * The public category tree for one category type. Both `/products/categories` and
 * `/articles/categories` are this component plus their own translation namespace.
 */
export async function CategoryListing({
	type,
	translationPrefix,
	buildCategoryHref,
}: {
	type: CategoryType;
	translationPrefix: string;
	/** Applies to every category in the tree, at any depth. */
	buildCategoryHref?: BuildCategoryHref;
}) {
	const language = await getLanguage();

	const [translations, tree] = await Promise.all([
		translateBatch(CATEGORY_LISTING_TRANSLATION_KEYS, translationPrefix),
		getCategoryTree(type, language),
	]);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<h1 className="text-2xl md:text-3xl font-semibold">
					{translations['text.heading']}
				</h1>
				<p className="mt-2 text-muted">
					{translations['text.subheading']}
				</p>

				{tree === null && (
					<p className="mt-10 text-muted">
						{translations['text.unavailable']}
					</p>
				)}

				{tree?.length === 0 && (
					<p className="mt-10 text-muted">
						{translations['text.no_entries']}
					</p>
				)}

				{tree && tree.length > 0 && (
					<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{tree.map((node) => {
							const label = getCategoryContentProp(
								node.entry,
								language,
								'label',
							);
							const href = resolveCategoryHref(
								node,
								language,
								buildCategoryHref,
							);
							const description = getCategoryContentProp(
								node.entry,
								language,
								'description',
								'',
							);

							return (
								<section
									key={node.entry.id}
									className="rounded-2xl border border-border bg-surface p-6"
								>
									<h2 className="flex items-center gap-2 text-lg font-semibold">
										<Icons.Category className="opacity-40" />
										{href ? (
											<Link
												href={href}
												className="hover:underline"
											>
												{label}
											</Link>
										) : (
											label
										)}
									</h2>

									{description && (
										<p className="mt-2 text-sm text-muted">
											{description}
										</p>
									)}

									{node.children.length > 0 && (
										<>
											<h3 className="mt-4 text-xs uppercase tracking-wide text-muted">
												{
													translations[
														'text.subcategories'
													]
												}
											</h3>
											<ul className="mt-2 space-y-1 text-sm">
												{node.children.map((child) => (
													<CategoryBranch
														key={child.entry.id}
														node={child}
														language={language}
														buildCategoryHref={
															buildCategoryHref
														}
													/>
												))}
											</ul>
										</>
									)}
								</section>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
