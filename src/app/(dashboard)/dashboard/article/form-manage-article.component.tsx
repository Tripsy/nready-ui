'use client';

import { useState } from 'react';
import { FormPickerArticle } from '@/app/(dashboard)/dashboard/article/form-picker-article.component';
import {
	FormComponentCalendar,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import { formatEnumLabel, toKebabCase } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import {
	type ArticleFeaturedStatus,
	ArticleFeaturedStatusEnum,
	type ArticleLayout,
	ArticleLayoutEnum,
	type ArticleVisibility,
	ArticleVisibilityEnum,
} from '@/models/article.model';
import {
	type CategoryModel,
	displayCategoryLabel,
} from '@/models/category.model';
import { displayTermValue, type TermModel } from '@/models/term.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { type Language, LanguageEnum } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

/**
 * `content` is markdown — that is what the backend stores and what the public site will render.
 * The preview below is the only place it becomes HTML inside the dashboard.
 */
export type ArticleContentFormType = {
	language: Language;
	slug: string | null;
	title: string | null;
	brief: string | null;
	content: string | null;
	meta: PageMeta;
};

/**
 * Category and tag links ride as `{ id }` records because `FormValuesType` admits arrays of
 * records but not a bare `number[]`; `prepareParamsFromFormValues` flattens them back to the
 * id arrays the API takes.
 */
export type ArticleFormValuesType = {
	layout: ArticleLayout;
	featured_status: ArticleFeaturedStatus | null;
	visibility: ArticleVisibility;
	publish_at: string | null;
	archive_at: string | null;
	/** Only sent while `visibility` is restricted; the backend clears it on the way back out. */
	public_at: string | null;
	/*
	 * The visibility rule and the source attribution are edited as flat fields, not as nested
	 * objects, because `FormValuesType` admits scalars and arrays-of-records but not an object
	 * of mixed shapes. `buildVisibilityRule` / `buildSource` assemble them on the way out and
	 * `getFormState` takes them apart on the way in — each pair changes together.
	 *
	 * The two list fields are comma-separated here and split at the boundary.
	 */
	rule_requires_auth: boolean;
	rule_is_listed: boolean;
	rule_requires_subscription: string | null;
	rule_allowed_countries: string | null;
	rule_password: string | null;
	source_label: string | null;
	source_url: string | null;
	source_disclaimer: string | null;
	source_about: string | null;
	categories: { id: number }[];
	tags: { id: number }[];
	contents: ArticleContentFormType[];
};

const languages = Object.values(LanguageEnum);

const layouts = toOptionsFromEnum(ArticleLayoutEnum, {
	formatter: formatEnumLabel,
});

const featuredStatuses = toOptionsFromEnum(ArticleFeaturedStatusEnum, {
	formatter: formatEnumLabel,
});

const visibilities = toOptionsFromEnum(ArticleVisibilityEnum, {
	formatter: formatEnumLabel,
});

export function FormManageArticle() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ArticleFormValuesType>();

	const elementIds = useElementIds([
		'layout',
		'featuredStatus',
		'visibility',
		'publishAt',
		'archiveAt',
		'publicAt',
		'ruleRequiresAuth',
		'ruleIsListed',
		'ruleSubscription',
		'ruleCountries',
		'rulePassword',
		'source',
		'contents',
	] as const);

	const isRestricted =
		formValues.visibility === ArticleVisibilityEnum.RESTRICTED;

	const [contentsMap, setContentsMap] = useState<
		Partial<Record<Language, ArticleContentFormType>>
	>(
		() =>
			Object.fromEntries(
				(formValues.contents ?? []).map((content) => [
					content.language,
					content,
				]),
			) as Partial<Record<Language, ArticleContentFormType>>,
	);

	/** Languages whose markdown is currently shown rendered rather than editable. */
	const [previewed, setPreviewed] = useState<
		Partial<Record<Language, boolean>>
	>({});

	/*
	 * Languages whose slug the editor owns — either typed here or loaded with the article.
	 * Deriving from the title has to stop at that point, and it cannot be decided from the
	 * slug simply being non-empty: the derivation fills it in on the first keystroke, which
	 * would then block every keystroke after it and leave the slug one character long.
	 */
	const [slugTouched, setSlugTouched] = useState<
		Partial<Record<Language, boolean>>
	>(
		() =>
			Object.fromEntries(
				(formValues.contents ?? [])
					.filter((content) => !!content.slug)
					.map((content) => [content.language, true]),
			) as Partial<Record<Language, boolean>>,
	);

	const syncContents = (
		updated: Partial<Record<Language, ArticleContentFormType>>,
	) => {
		setContentsMap(updated);

		handleChange(
			'contents',
			Object.values(updated).filter(
				(content): content is ArticleContentFormType => !!content,
			),
		);
	};

	const handleContentChange = (
		language: Language,
		field: keyof Omit<ArticleContentFormType, 'language' | 'meta'>,
		value: string,
	) => {
		const current = contentsMap[language];

		const next: ArticleContentFormType = {
			meta: { title: null },
			slug: null,
			title: null,
			brief: null,
			content: null,
			...current,
			language,
			[field]: value,
		};

		// The slug is what the public URL is built from, so it stays editable — it is only
		// derived while the editor has not written one, which covers the ordinary case of
		// typing a title into a fresh translation.
		if (field === 'slug') {
			setSlugTouched((touched) => ({ ...touched, [language]: true }));
		} else if (field === 'title' && !slugTouched[language]) {
			next.slug = toKebabCase(value) || null;
		}

		syncContents({ ...contentsMap, [language]: next });
	};

	const handleMetaChange = (
		language: Language,
		field: keyof PageMeta,
		value: string,
	) => {
		syncContents({
			...contentsMap,
			[language]: {
				slug: null,
				title: null,
				brief: null,
				content: null,
				...contentsMap[language],
				language,
				meta: {
					title: null,
					...contentsMap[language]?.meta,
					[field]: value,
				},
			},
		});
	};

	const categoryIds = (formValues.categories ?? []).map(
		(category) => category.id,
	);
	const tagIds = (formValues.tags ?? []).map((tag) => tag.id);

	/*
	 * `FormErrorsType` types an array field's errors per item, but "at least one translation"
	 * is raised on the array itself and `accumulateZodErrors` stores that as a plain message
	 * list under the key. The cast reflects what is actually there at runtime.
	 */
	const contentsError = errors.contents as unknown as string[] | undefined;

	return (
		<>
			<div className="form-section flex-row flex-wrap gap-4">
				<FormComponentSelect<ArticleFormValuesType>
					labelText="Layout"
					id={elementIds.layout}
					fieldName="layout"
					fieldValue={formValues.layout}
					options={layouts}
					disabled={pending}
					onChange={(value) =>
						handleChange('layout', value as ArticleLayout)
					}
					error={errors.layout}
				/>

				<FormComponentSelect<ArticleFormValuesType>
					labelText="Featured"
					id={elementIds.featuredStatus}
					fieldName="featured_status"
					fieldValue={formValues.featured_status}
					options={featuredStatuses}
					placeholderText="-none-"
					disabled={pending}
					onChange={(value) =>
						handleChange(
							'featured_status',
							(value as ArticleFeaturedStatus) || null,
						)
					}
					error={errors.featured_status}
				/>

				{/*
				 * The position within a featured group is not edited here — it is a property of
				 * the group's running order, which the order page owns.
				 */}
				<FormComponentSelect<ArticleFormValuesType>
					labelText="Visibility"
					id={elementIds.visibility}
					fieldName="visibility"
					fieldValue={formValues.visibility}
					options={visibilities}
					disabled={pending}
					onChange={(value) =>
						handleChange('visibility', value as ArticleVisibility)
					}
					error={errors.visibility}
				/>
			</div>

			<div className="form-section flex-row flex-wrap gap-4">
				<FormComponentCalendar<ArticleFormValuesType>
					labelText="Publish At"
					id={elementIds.publishAt}
					fieldName="publish_at"
					fieldValue={formValues.publish_at ?? ''}
					placeholderText="-select-"
					disabled={pending}
					onSelect={(value) =>
						handleChange('publish_at', value === '' ? null : value)
					}
					error={errors.publish_at}
				/>

				<FormComponentCalendar<ArticleFormValuesType>
					labelText="Archive At"
					id={elementIds.archiveAt}
					fieldName="archive_at"
					fieldValue={formValues.archive_at ?? ''}
					placeholderText="-select-"
					disabled={pending}
					onSelect={(value) =>
						handleChange('archive_at', value === '' ? null : value)
					}
					error={errors.archive_at}
				/>

				{/*
				 * `public_at` schedules the end of a restriction, so it only means anything
				 * while one is in force. Switching back to public drops the date and the rule
				 * row server-side, which is why nothing here has to clear them.
				 */}
				{isRestricted && (
					<FormComponentCalendar<ArticleFormValuesType>
						labelText="Public At"
						id={elementIds.publicAt}
						fieldName="public_at"
						fieldValue={formValues.public_at ?? ''}
						placeholderText="-select-"
						disabled={pending}
						onSelect={(value) =>
							handleChange(
								'public_at',
								value === '' ? null : value,
							)
						}
						error={errors.public_at}
					/>
				)}
			</div>

			{isRestricted && (
				<div className="form-section">
					<h3 className="font-bold border-b border-line pb-2">
						Visibility rule
					</h3>

					<div className="flex flex-row flex-wrap gap-6">
						<FormComponentCheckbox
							id={elementIds.ruleRequiresAuth}
							fieldName="rule_requires_auth"
							checked={formValues.rule_requires_auth}
							disabled={pending}
							onCheckedChange={(value) =>
								handleChange('rule_requires_auth', value)
							}
						>
							Requires sign-in
						</FormComponentCheckbox>

						<FormComponentCheckbox
							id={elementIds.ruleIsListed}
							fieldName="rule_is_listed"
							checked={formValues.rule_is_listed}
							disabled={pending}
							onCheckedChange={(value) =>
								handleChange('rule_is_listed', value)
							}
						>
							Listed in indexes and feeds
						</FormComponentCheckbox>
					</div>

					<FormComponentInput<ArticleFormValuesType>
						id={elementIds.ruleSubscription}
						labelText="Required subscriptions"
						fieldName="rule_requires_subscription"
						fieldValue={formValues.rule_requires_subscription ?? ''}
						placeholderText="eg: premium, archive"
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'rule_requires_subscription',
								e.target.value,
							)
						}
						error={errors.rule_requires_subscription}
					/>

					<FormComponentInput<ArticleFormValuesType>
						id={elementIds.ruleCountries}
						labelText="Allowed countries"
						fieldName="rule_allowed_countries"
						fieldValue={formValues.rule_allowed_countries ?? ''}
						placeholderText="eg: RO, GB"
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'rule_allowed_countries',
								e.target.value,
							)
						}
						error={errors.rule_allowed_countries}
					/>

					{/*
					 * Always blank on an update — the API returns the hash to nobody. Left empty
					 * it is omitted from the payload, so an unrelated save cannot wipe the
					 * stored password.
					 */}
					<FormComponentInput<ArticleFormValuesType>
						id={elementIds.rulePassword}
						labelText="Access password"
						fieldName="rule_password"
						fieldValue={formValues.rule_password ?? ''}
						placeholderText="leave empty to keep the current one"
						disabled={pending}
						onChange={(e) =>
							handleChange('rule_password', e.target.value)
						}
						error={errors.rule_password}
					/>
				</div>
			)}

			<div className="form-section">
				<h3 className="font-bold border-b border-line pb-2">
					Source attribution
				</h3>

				<div className="grid gap-4 sm:grid-cols-2">
					<FormComponentInput<ArticleFormValuesType>
						id={`${elementIds.source}-label`}
						labelText="Label"
						fieldName="source_label"
						fieldValue={formValues.source_label ?? ''}
						disabled={pending}
						onChange={(e) =>
							handleChange('source_label', e.target.value)
						}
						error={errors.source_label}
					/>

					<FormComponentInput<ArticleFormValuesType>
						id={`${elementIds.source}-url`}
						labelText="URL"
						fieldName="source_url"
						fieldValue={formValues.source_url ?? ''}
						placeholderText="https://…"
						disabled={pending}
						onChange={(e) =>
							handleChange('source_url', e.target.value)
						}
						error={errors.source_url}
					/>
				</div>

				<FormComponentInput<ArticleFormValuesType>
					id={`${elementIds.source}-disclaimer`}
					labelText="Disclaimer"
					fieldName="source_disclaimer"
					fieldValue={formValues.source_disclaimer ?? ''}
					disabled={pending}
					onChange={(e) =>
						handleChange('source_disclaimer', e.target.value)
					}
					error={errors.source_disclaimer}
				/>

				<FormComponentTextarea<ArticleFormValuesType>
					id={`${elementIds.source}-about`}
					labelText="About the source"
					fieldName="source_about"
					fieldValue={formValues.source_about ?? ''}
					rows={2}
					disabled={pending}
					onChange={(e) =>
						handleChange('source_about', e.target.value)
					}
					error={errors.source_about}
				/>
			</div>

			<div className="form-section grid gap-4 sm:grid-cols-2">
				<FormPickerArticle<CategoryModel>
					labelText="Categories"
					fieldName="category_id"
					dataSource="category"
					// The backend defaults the category listing to `article` already; stating it
					// keeps the picker off the product tree if that default ever moves.
					filter={{ type: 'article' }}
					getOptionLabel={(entry) =>
						displayCategoryLabel(entry, getLanguageClient(), false)
					}
					value={categoryIds}
					onChange={(ids) =>
						handleChange(
							'categories',
							ids.map((id) => ({ id })),
						)
					}
					emptyText="No categories linked."
					disabled={pending}
				/>

				<FormPickerArticle<TermModel>
					labelText="Tags"
					fieldName="tag_id"
					dataSource="term"
					filter={{ type: 'tag' }}
					getOptionLabel={(entry) => displayTermValue(entry)}
					value={tagIds}
					onChange={(ids) =>
						handleChange(
							'tags',
							ids.map((id) => ({ id })),
						)
					}
					emptyText="No tags linked."
					disabled={pending}
				/>
			</div>

			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(formValues.contents ?? [])}
			/>

			<Tabs
				defaultSelectedKey={Configuration.defaultLanguage()}
				className="w-full"
			>
				<div className="flex items-center border-b border-line pb-2 gap-2">
					<h3 className="font-bold whitespace-nowrap">
						Language specific
					</h3>
					<TabsList>
						{languages.map((language) => (
							<TabsTrigger key={language} id={language}>
								{language.toUpperCase()}
							</TabsTrigger>
						))}
					</TabsList>
				</div>

				{contentsError?.length ? (
					<p className="pt-2 text-sm text-danger">
						{contentsError.join(' ')}
					</p>
				) : null}

				{languages.map((language) => {
					const contentIndex = (formValues.contents ?? []).findIndex(
						(content) => content.language === language,
					);

					const contentErrors =
						contentIndex >= 0
							? errors.contents?.[contentIndex]
							: undefined;

					const isPreviewed = previewed[language] ?? false;

					return (
						<TabsContent key={`form-${language}`} id={language}>
							<div className="form-section">
								<FormComponentInput<ArticleContentFormType>
									id={`${elementIds.contents}-${language}-title`}
									labelText="Title"
									fieldName="title"
									fieldValue={
										contentsMap[language]?.title ?? ''
									}
									isRequired={true}
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'title',
											e.target.value,
										)
									}
									error={contentErrors?.title}
								/>

								<FormComponentInput<ArticleContentFormType>
									id={`${elementIds.contents}-${language}-slug`}
									labelText="Slug"
									fieldName="slug"
									fieldValue={
										contentsMap[language]?.slug ?? ''
									}
									isRequired={true}
									placeholderText="eg: how-to-brew-coffee"
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'slug',
											e.target.value,
										)
									}
									error={contentErrors?.slug}
								/>

								<FormComponentTextarea<ArticleContentFormType>
									id={`${elementIds.contents}-${language}-brief`}
									labelText="Brief"
									fieldName="brief"
									fieldValue={
										contentsMap[language]?.brief ?? ''
									}
									rows={3}
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'brief',
											e.target.value,
										)
									}
									error={contentErrors?.brief}
								/>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">
											Content (markdown)
										</span>
										<button
											type="button"
											className="text-sm underline opacity-70 hover:opacity-100"
											onClick={() =>
												setPreviewed((current) => ({
													...current,
													[language]: !isPreviewed,
												}))
											}
										>
											{isPreviewed ? 'Edit' : 'Preview'}
										</button>
									</div>

									{isPreviewed ? (
										// Sanitized by `renderMarkdown`; see the helper for why the
										// two steps stay together.
										<div
											className="markdown-body rounded-md border border-line p-3"
											// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdown`
											dangerouslySetInnerHTML={{
												__html: renderMarkdown(
													contentsMap[language]
														?.content,
												),
											}}
										/>
									) : (
										<FormComponentTextarea<ArticleContentFormType>
											id={`${elementIds.contents}-${language}-content`}
											labelText=""
											fieldName="content"
											fieldValue={
												contentsMap[language]
													?.content ?? ''
											}
											rows={14}
											isRequired={true}
											placeholderText="# Heading&#10;&#10;Write the article in markdown…"
											disabled={pending}
											onChange={(e) =>
												handleContentChange(
													language,
													'content',
													e.target.value,
												)
											}
											error={contentErrors?.content}
										/>
									)}
								</div>

								<FormComponentInput<PageMeta>
									id={`${elementIds.contents}-${language}-meta-title`}
									labelText="Meta Title"
									fieldName="title"
									fieldValue={
										contentsMap[language]?.meta?.title ?? ''
									}
									disabled={pending}
									onChange={(e) =>
										handleMetaChange(
											language,
											'title',
											e.target.value,
										)
									}
									error={contentErrors?.meta?.title}
								/>

								<FormComponentInput<PageMeta>
									id={`${elementIds.contents}-${language}-meta-description`}
									labelText="Meta Description"
									fieldName="description"
									fieldValue={
										contentsMap[language]?.meta
											?.description ?? ''
									}
									disabled={pending}
									onChange={(e) =>
										handleMetaChange(
											language,
											'description',
											e.target.value,
										)
									}
									error={contentErrors?.meta?.description}
								/>

								<FormComponentInput<PageMeta>
									id={`${elementIds.contents}-${language}-meta-keywords`}
									labelText="Meta Keywords"
									fieldName="keywords"
									fieldValue={
										contentsMap[language]?.meta?.keywords ??
										''
									}
									disabled={pending}
									onChange={(e) =>
										handleMetaChange(
											language,
											'keywords',
											e.target.value,
										)
									}
									error={contentErrors?.meta?.keywords}
								/>
							</div>
						</TabsContent>
					);
				})}
			</Tabs>
		</>
	);
}
