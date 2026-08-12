import type { Metadata } from 'next';
import type { JSX } from 'react';
import { Icons } from '@/components/icon.component';
import { Configuration } from '@/config/settings.config';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import {
	buildCategoryTree,
	type CategoryTreeNode,
	CategoryTypeEnum,
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

const TRANSLATION_KEYS = [
	'categories.text.heading',
	'categories.text.subheading',
	'categories.text.no_entries',
	'categories.text.unavailable',
	'categories.text.subcategories',
] as const;

export async function generateMetadata(): Promise<Metadata> {
	const [title, description] = await Promise.all([
		translate('categories.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
		translate('categories.meta.description'),
	]);

	return { title, description };
}

/**
 * `null` means the backend could not be reached — told apart from an empty catalogue, which is
 * a legitimate answer and reads very differently to a visitor.
 */
async function getCategoryTree(
	language: Language,
): Promise<CategoryTreeNode[] | null> {
	try {
		const response = await requestPublicCategories({
			type: CategoryTypeEnum.PRODUCT,
			language,
			limit: CATEGORY_LIMIT,
			revalidate: REVALIDATE_SECONDS,
		});

		if (!response?.success) {
			return null;
		}

		return buildCategoryTree(getResponseData(response)?.entries ?? []);
	} catch (error) {
		logger.error('Failed to load the public category list', error);

		return null;
	}
}

function CategoryBranch({
	node,
	language,
}: {
	node: CategoryTreeNode;
	language: Language;
}): JSX.Element {
	const label = getCategoryContentProp(node.entry, language, 'label');

	return (
		<li>
			<span className="flex items-start gap-2">
				<Icons.Direction.ArrowCurvedBottom className="mt-1 shrink-0 opacity-40" />
				<span>{label}</span>
			</span>

			{node.children.length > 0 && (
				<ul className="mt-1 ml-5 space-y-1">
					{node.children.map((child) => (
						<CategoryBranch
							key={child.entry.id}
							node={child}
							language={language}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

export default async function Page() {
	const language = await getLanguage();

	const [translations, tree] = await Promise.all([
		translateBatch(TRANSLATION_KEYS),
		getCategoryTree(language),
	]);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<h1 className="text-2xl md:text-3xl font-semibold">
					{translations['categories.text.heading']}
				</h1>
				<p className="mt-2 text-muted">
					{translations['categories.text.subheading']}
				</p>

				{tree === null && (
					<p className="mt-10 text-muted">
						{translations['categories.text.unavailable']}
					</p>
				)}

				{tree?.length === 0 && (
					<p className="mt-10 text-muted">
						{translations['categories.text.no_entries']}
					</p>
				)}

				{tree && tree.length > 0 && (
					<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{tree.map((node) => {
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
										{getCategoryContentProp(
											node.entry,
											language,
											'label',
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
														'categories.text.subcategories'
													]
												}
											</h3>
											<ul className="mt-2 space-y-1 text-sm">
												{node.children.map((child) => (
													<CategoryBranch
														key={child.entry.id}
														node={child}
														language={language}
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
