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
import { cn } from '@/helpers/css.helper';
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
import {
	displayTermValue,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { type Language, LanguageEnum } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

/**
 * `content` is markdown — that is what the backend stores and what the public site will render.
 * The preview on the Content tab is the only place it becomes HTML inside the dashboard.
 *
 * The by-line is flattened into `author_*` rather than nested: `FormValuesType` types an array
 * field as `Record<string, FormValueType>[]`, and `PageMeta` is the only object admitted as a
 * value — an `ArticleAuthorType` in here would not type. `buildContents` reassembles it.
 */
export type ArticleContentFormType = {
	language: Language;
	slug: string | null;
	title: string | null;
	brief: string | null;
	content: string | null;
	author_name: string | null;
	author_email: string | null;
	author_avatar: string | null;
	author_description: string | null;
	meta: PageMeta;
};

/**
 * Category and tag links ride as `{ id }` records because `FormValuesType` admits arrays of
 * records but not a bare `number[]`; `prepareParamsFromFormValues` flattens them back to the
 * id arrays the API takes.
 */
/** The `{ id, label }` pairs a seeded form holds, as the id-keyed map the pickers take. */
function toLabelMap(links: { id: number; label?: string }[] | undefined) {
	const map: Record<number, string> = {};

	for (const link of links ?? []) {
		if (link.label) {
			map[link.id] = link.label;
		}
	}

	return map;
}

export type ArticleFormValuesType = {
	layout: ArticleLayout;
	featured_status: ArticleFeaturedStatus | null;
	featured_expire_at: string | null;
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
	 * `rule_allowed_countries` is comma-separated here and split at the boundary.
	 */
	rule_requires_auth: boolean;
	rule_requires_subscription: boolean;
	rule_allowed_countries: string | null;
	rule_password: string | null;
	/*
	 * The reader-participation switches. Flat booleans here for the same reason as the rule
	 * fields above — `buildSettings` assembles them into the `settings` object the API takes,
	 * which stores them inside `article.details`.
	 */
	allow_rating: boolean;
	allow_comments: boolean;
	allow_complaints: boolean;
	source_label: string | null;
	source_url: string | null;
	source_disclaimer: string | null;
	source_about: string | null;
	/*
	 * `label` rides along only so the pickers can show names for the ids an existing article
	 * starts with — `read` stores the wording nowhere else the form can reach. It is dropped
	 * by the validator and never submitted: `getFormValues` rebuilds these from the hidden
	 * inputs, which carry ids alone.
	 */
	categories: { id: number; label?: string }[];
	tags: { id: number; label?: string }[];
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

/*
 * The three Settings selects share one width instead of sizing to their current value. Their
 * option sets are fixed and short, and a select that resizes as you change it shifts whatever
 * sits beside it — here, the Public At picker on the visibility row. Sized for the longest
 * option across all three ("Restricted", ~120px with the chevron and padding) and rounded up to
 * the 4px scale.
 */
const SELECT_WIDTH = 'w-32';

const FORM_TABS = [
	{ id: 'settings', label: 'Settings' },
	{ id: 'content', label: 'Content' },
	{ id: 'seo', label: 'SEO' },
	{ id: 'attribution', label: 'Attribution' },
] as const;

type FormTabId = (typeof FORM_TABS)[number]['id'];

/** The article-level fields each tab owns, for the error counts on the tab strip. */
const TAB_FIELDS: Record<FormTabId, readonly (keyof ArticleFormValuesType)[]> =
	{
		settings: [
			'layout',
			'featured_status',
			'featured_expire_at',
			'visibility',
			'publish_at',
			'archive_at',
			'public_at',
			'rule_requires_auth',
			'rule_requires_subscription',
			'rule_allowed_countries',
			'rule_password',
			'allow_rating',
			'allow_comments',
			'allow_complaints',
		],
		content: ['categories', 'tags'],
		seo: [],
		attribution: [
			'source_label',
			'source_url',
			'source_disclaimer',
			'source_about',
		],
	};

/**
 * The per-language fields each tab owns. `meta` covers the whole nested SEO object, and `slug`
 * sits with it — the slug is the article's URL, which is an addressing concern rather than
 * something the writer composes.
 */
const TAB_CONTENT_FIELDS: Record<FormTabId, readonly string[]> = {
	settings: [],
	content: ['title', 'brief', 'content'],
	seo: ['slug', 'meta'],
	attribution: [
		'author_name',
		'author_email',
		'author_avatar',
		'author_description',
	],
};

/**
 * Messages held anywhere inside an error value.
 *
 * `FormErrorsType` nests differently per field — a plain `string[]`, a record of them, or an
 * array of records for a list field — and the count only has to be a total, so this walks
 * whatever shape it is handed rather than encoding each one.
 */
function countMessages(value: unknown): number {
	if (!value) {
		return 0;
	}

	if (Array.isArray(value)) {
		return value.reduce<number>(
			(total, entry) =>
				total + (typeof entry === 'string' ? 1 : countMessages(entry)),
			0,
		);
	}

	if (typeof value === 'object') {
		return Object.values(value).reduce<number>(
			(total, entry) => total + countMessages(entry),
			0,
		);
	}

	return 0;
}

export function FormManageArticle() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ArticleFormValuesType>();

	const elementIds = useElementIds([
		'layout',
		'featuredStatus',
		'featuredExpireAt',
		'visibility',
		'publishAt',
		'archiveAt',
		'publicAt',
		'ruleRequiresAuth',
		'ruleSubscription',
		'ruleCountries',
		'rulePassword',
		'allowRating',
		'allowComments',
		'allowComplaints',
		'source',
		'contents',
	] as const);

	const [tab, setTab] = useState<FormTabId>('settings');

	/*
	 * One language for the whole form: Content, SEO and the by-line on Attribution all edit the
	 * same translation, so moving between those tabs must not change which one is open.
	 */
	const [language, setLanguage] = useState<Language>(() =>
		Configuration.defaultLanguage(),
	);

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

	/** A translation with nothing in it yet, so a spread always has every key to overwrite. */
	const emptyContent = (value: Language): ArticleContentFormType => ({
		language: value,
		slug: null,
		title: null,
		brief: null,
		content: null,
		author_name: null,
		author_email: null,
		author_avatar: null,
		author_description: null,
		meta: { title: null },
	});

	const handleContentChange = (
		field: keyof Omit<ArticleContentFormType, 'language' | 'meta'>,
		value: string,
	) => {
		const current = contentsMap[language];

		const next: ArticleContentFormType = {
			...emptyContent(language),
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

	const handleMetaChange = (field: keyof PageMeta, value: string) => {
		syncContents({
			...contentsMap,
			[language]: {
				...emptyContent(language),
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

	// Seeded once from the values the window opened with; the pickers own their labels after.
	const [initialLinkLabels] = useState(() => ({
		categories: toLabelMap(formValues.categories),
		tags: toLabelMap(formValues.tags),
	}));

	const categoryIds = (formValues.categories ?? []).map(
		(category) => category.id,
	);
	const tagIds = (formValues.tags ?? []).map((tag) => tag.id);

	/*
	 * A link list is validated as a whole — "at least one category", "not a valid id" — never
	 * per entry, so `accumulateZodErrors` leaves the messages as a `string[]` at the leaf. The
	 * declared type still allows the per-item shape every array field could carry, which is
	 * what this narrows away; anything else reads as no error rather than as a rendered object.
	 */
	const linkError = (error: unknown): string[] | undefined =>
		Array.isArray(error) && typeof error[0] === 'string'
			? (error as string[])
			: undefined;

	/*
	 * `errors.contents` arrives in one of two shapes, and which one depends on where the issue
	 * was raised:
	 *
	 *  - a plain `string[]` when the message belongs to the array itself ("at least one
	 *    translation"), because `accumulateZodErrors` pushes messages into a list at the leaf;
	 *  - an object keyed by the index as a **string** (`{ '0': { title: [...] } }`) when the
	 *    issues belong to individual translations — the accumulator builds every intermediate
	 *    container with `{}`, so a numeric path segment never produces a real array.
	 *
	 * Indexing by number still reads the per-item entry (`obj[0]` is `obj['0']`), which is why
	 * the field-level lookups below work; anything iterating has to use `Object.values`.
	 */
	const contentsError = Array.isArray(errors.contents)
		? (errors.contents as unknown as string[])
		: undefined;

	const contentErrorEntries: unknown[] = Array.isArray(errors.contents)
		? []
		: Object.values(errors.contents ?? {});

	const contentIndex = (formValues.contents ?? []).findIndex(
		(content) => content.language === language,
	);

	const contentErrors =
		contentIndex >= 0 ? errors.contents?.[contentIndex] : undefined;

	const currentContent = contentsMap[language];

	/**
	 * Errors per tab, so one on a panel the editor cannot see still announces itself. Counted
	 * across every language rather than the open one — a missing Romanian title is the Content
	 * tab's problem whichever translation happens to be selected.
	 */
	const tabErrors = FORM_TABS.reduce<Record<FormTabId, number>>(
		(counts, { id }) => {
			const fieldErrors = TAB_FIELDS[id].reduce<number>(
				(total, field) => total + countMessages(errors[field]),
				0,
			);

			const perLanguage = contentErrorEntries.reduce<number>(
				(total, entry) => {
					if (!entry || typeof entry !== 'object') {
						return total;
					}

					return (
						total +
						TAB_CONTENT_FIELDS[id].reduce<number>(
							(sum, field) =>
								sum +
								countMessages(
									(entry as Record<string, unknown>)[field],
								),
							0,
						)
					);
				},
				0,
			);

			// The "at least one translation" message has no field of its own; it belongs to
			// Content, which is where an editor would go to fix it.
			const arrayLevel =
				id === 'content' ? (contentsError?.length ?? 0) : 0;

			counts[id] = fieldErrors + perLanguage + arrayLevel;

			return counts;
		},
		{} as Record<FormTabId, number>,
	);

	const isPreviewed = previewed[language] ?? false;

	return (
		<>
			{/*
			 * A group of toggle buttons rather than a second `Tabs`: this switches the language
			 * of two panels below without owning one of its own, which is not what a tablist
			 * describes.
			 */}
			<fieldset className="flex items-center gap-2">
				<legend className="sr-only">Content language</legend>
				<span className="text-sm font-medium" aria-hidden="true">
					Language
				</span>
				{languages.map((value) => (
					<button
						key={value}
						type="button"
						aria-pressed={value === language}
						disabled={pending}
						onClick={() => setLanguage(value)}
						className={cn(
							'rounded-md border px-3 py-1 text-sm transition-colors',
							value === language
								? 'border-focus bg-accent-soft font-medium'
								: 'border-border opacity-70 hover:opacity-100',
						)}
					>
						{value.toUpperCase()}
					</button>
				))}
			</fieldset>

			<Tabs
				selectedKey={tab}
				onSelectionChange={(key) => setTab(key as FormTabId)}
				className="w-full"
			>
				<TabsList>
					{FORM_TABS.map(({ id, label }) => (
						<TabsTrigger key={id} id={id}>
							{label}
							{tabErrors[id] > 0 && (
								<span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">
									{tabErrors[id]}
									<span className="sr-only">
										{' '}
										field(s) need attention
									</span>
								</span>
							)}
						</TabsTrigger>
					))}
				</TabsList>

				<TabsContent id="settings">
					<div className="space-y-6 pt-4">
						<div className="form-section">
							<div className="flex flex-row flex-wrap items-end gap-4">
								<FormComponentSelect<ArticleFormValuesType>
									labelText="Layout"
									id={elementIds.layout}
									fieldName="layout"
									fieldValue={formValues.layout}
									options={layouts}
									className={SELECT_WIDTH}
									disabled={pending}
									onChange={(value) =>
										handleChange(
											'layout',
											value as ArticleLayout,
										)
									}
									error={errors.layout}
								/>
							</div>

							<div className="space-y-2">
								<div className="flex flex-row flex-wrap items-end gap-4">
									<FormComponentCalendar<ArticleFormValuesType>
										labelText="Publish At"
										id={elementIds.publishAt}
										fieldName="publish_at"
										fieldValue={formValues.publish_at ?? ''}
										placeholderText="-select-"
										disabled={pending}
										onSelect={(value) =>
											handleChange(
												'publish_at',
												value === '' ? null : value,
											)
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
											handleChange(
												'archive_at',
												value === '' ? null : value,
											)
										}
										error={errors.archive_at}
									/>
								</div>

								{/*
								 * Spelled out on screen rather than only in a comment: both dates are
								 * day-granular and applied by a daily job, which is not something an
								 * editor can infer from a date picker.
								 */}
								<p className="text-xs text-muted">
									Publish At releases a scheduled article;
									Archive At retires a published one. Both
									take effect on the day given, not at a time
									of day, and the archive date must fall after
									the publish date. Leave empty to publish or
									keep the article indefinitely.
								</p>
							</div>

							<div className="space-y-2">
								<div className="flex flex-row flex-wrap items-end gap-4">
									<FormComponentSelect<ArticleFormValuesType>
										labelText="Featured"
										id={elementIds.featuredStatus}
										fieldName="featured_status"
										fieldValue={formValues.featured_status}
										options={featuredStatuses}
										placeholderText="-none-"
										className={SELECT_WIDTH}
										disabled={pending}
										onChange={(value) => {
											const featuredStatus =
												(value as ArticleFeaturedStatus) ||
												null;

											handleChange(
												'featured_status',
												featuredStatus,
											);

											/*
											 * The expiry belongs to the slot, and the API
											 * rejects a date without one. Dropping it with the
											 * slot keeps the form from carrying a value the
											 * disabled field no longer shows.
											 */
											if (!featuredStatus) {
												handleChange(
													'featured_expire_at',
													null,
												);
											}
										}}
										error={errors.featured_status}
									/>

									<FormComponentCalendar<ArticleFormValuesType>
										labelText="Featured Until"
										id={elementIds.featuredExpireAt}
										fieldName="featured_expire_at"
										fieldValue={
											formValues.featured_expire_at ?? ''
										}
										placeholderText="-select-"
										disabled={
											pending ||
											!formValues.featured_status
										}
										onSelect={(value) =>
											handleChange(
												'featured_expire_at',
												value === '' ? null : value,
											)
										}
										error={errors.featured_expire_at}
									/>
								</div>

								<p className="text-xs text-muted">
									Featured Until drops the article out of its
									featured group on the day given, applied by
									a daily job. Leave empty to keep it featured
									until removed by hand.
								</p>
							</div>

							<div className="space-y-2">
								<div className="flex flex-row flex-wrap items-end gap-4">
									<FormComponentSelect<ArticleFormValuesType>
										labelText="Visibility"
										id={elementIds.visibility}
										fieldName="visibility"
										fieldValue={formValues.visibility}
										options={visibilities}
										className={SELECT_WIDTH}
										disabled={pending}
										onChange={(value) =>
											handleChange(
												'visibility',
												value as ArticleVisibility,
											)
										}
										error={errors.visibility}
									/>

									{isRestricted && (
										<FormComponentCalendar<ArticleFormValuesType>
											labelText="Public At"
											id={elementIds.publicAt}
											fieldName="public_at"
											fieldValue={
												formValues.public_at ?? ''
											}
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
									<p className="text-xs text-muted">
										Public At is the day the restriction
										ends and the article becomes public. A
										daily job applies it, then clears the
										date and drops the rule below —
										releasing an article is final, so
										re-restricting it means stating the
										terms again. Leave empty to keep the
										restriction until it is lifted by hand.
									</p>
								)}
							</div>
						</div>

						<div className="form-section">
							<div className="text-sm font-semibold">
								Reader participation
							</div>

							<div className="flex flex-col md:flex-row flex-wrap gap-4">
								<FormComponentCheckbox
									id={elementIds.allowRating}
									fieldName="allow_rating"
									checked={formValues.allow_rating}
									disabled={pending}
									onCheckedChange={(value) =>
										handleChange('allow_rating', value)
									}
								>
									Allow ratings
								</FormComponentCheckbox>

								<FormComponentCheckbox
									id={elementIds.allowComments}
									fieldName="allow_comments"
									checked={formValues.allow_comments}
									disabled={pending}
									onCheckedChange={(value) =>
										handleChange('allow_comments', value)
									}
								>
									Allow comments
								</FormComponentCheckbox>

								<FormComponentCheckbox
									id={elementIds.allowComplaints}
									fieldName="allow_complaints"
									checked={formValues.allow_complaints}
									disabled={pending}
									onCheckedChange={(value) =>
										handleChange('allow_complaints', value)
									}
								>
									Allow reports
								</FormComponentCheckbox>
							</div>

							<p className="text-xs text-muted">
								What readers may add to this article. Unchecking
								one takes it off the page for everyone; anything
								already posted stays stored and reappears if it
								is turned back on.
							</p>
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
											handleChange(
												'rule_requires_auth',
												value,
											)
										}
									>
										Requires sign-in
									</FormComponentCheckbox>

									<FormComponentCheckbox
										id={elementIds.ruleSubscription}
										fieldName="rule_requires_subscription"
										checked={
											formValues.rule_requires_subscription
										}
										disabled={pending}
										onCheckedChange={(value) =>
											handleChange(
												'rule_requires_subscription',
												value,
											)
										}
									>
										Requires an active subscription
									</FormComponentCheckbox>
								</div>

								<FormComponentInput<ArticleFormValuesType>
									id={elementIds.ruleCountries}
									labelText="Allowed countries"
									fieldName="rule_allowed_countries"
									fieldValue={
										formValues.rule_allowed_countries ?? ''
									}
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
								 * Always blank on an update — the API returns the hash to nobody.
								 * Left empty it is omitted from the payload, so an unrelated save
								 * cannot wipe the stored password.
								 */}
								<FormComponentInput<ArticleFormValuesType>
									id={elementIds.rulePassword}
									labelText="Access password"
									fieldName="rule_password"
									fieldValue={formValues.rule_password ?? ''}
									placeholderText="leave empty to keep the current one"
									disabled={pending}
									onChange={(e) =>
										handleChange(
											'rule_password',
											e.target.value,
										)
									}
									error={errors.rule_password}
								/>
							</div>
						)}
					</div>
				</TabsContent>

				<TabsContent id="content">
					<div className="space-y-6 pt-4">
						<div className="form-section">
							{contentsError?.length ? (
								<p className="text-sm text-danger">
									{contentsError.join(' ')}
								</p>
							) : null}

							<FormComponentInput<ArticleContentFormType>
								id={`${elementIds.contents}-${language}-title`}
								labelText="Title"
								fieldName="title"
								fieldValue={currentContent?.title ?? ''}
								isRequired={true}
								disabled={pending}
								onChange={(e) =>
									handleContentChange('title', e.target.value)
								}
								error={contentErrors?.title}
							/>

							<FormComponentTextarea<ArticleContentFormType>
								id={`${elementIds.contents}-${language}-brief`}
								labelText="Brief"
								fieldName="brief"
								fieldValue={currentContent?.brief ?? ''}
								rows={3}
								disabled={pending}
								onChange={(e) =>
									handleContentChange('brief', e.target.value)
								}
								error={contentErrors?.brief}
							/>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									{/*
									 * The label is hand-rolled so the preview toggle can sit
									 * beside it, which is also why the field below carries no
									 * label of its own — and no `isRequired`, which would
									 * render a second, orphaned asterisk under an empty label.
									 */}
									<span className="text-sm font-medium">
										Content
										<span className="text-danger"> *</span>
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
									// Sanitized by `renderMarkdown`; see the helper for why the two
									// steps stay together.
									<div
										// `min-h-84` (21rem) matches the measured height of the
										// 16-row textarea it replaces, so toggling Preview on an
										// empty draft does not collapse the panel.
										className="markdown-body min-h-84 rounded-md border border-line p-3"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdown`
										dangerouslySetInnerHTML={{
											__html: renderMarkdown(
												currentContent?.content,
											),
										}}
									/>
								) : (
									<FormComponentTextarea<ArticleContentFormType>
										id={`${elementIds.contents}-${language}-content`}
										labelText=""
										fieldName="content"
										fieldValue={
											currentContent?.content ?? ''
										}
										rows={16}
										placeholderText="# Heading&#10;&#10;Write the article in markdown…"
										disabled={pending}
										onChange={(e) =>
											handleContentChange(
												'content',
												e.target.value,
											)
										}
										error={contentErrors?.content}
									/>
								)}
							</div>
						</div>

						{/*
						 * `items-start` because `.form-section .form-element` carries `h-full`:
						 * without it the taller column (the one with chips) stretches the other,
						 * and that column's empty-state line is pushed away from its input.
						 */}
						<div className="form-section grid items-start gap-4 sm:grid-cols-2">
							<FormPickerArticle<CategoryModel>
								labelText="Categories"
								fieldName="category_id"
								dataSource="category"
								// The backend defaults the category listing to `article` already;
								// stating it keeps the picker off the product tree if that default
								// ever moves.
								filter={{ type: 'article' }}
								getOptionLabel={(entry) =>
									displayCategoryLabel(
										entry,
										getLanguageClient(),
										false,
									)
								}
								initialLabels={initialLinkLabels.categories}
								value={categoryIds}
								onChange={(ids) =>
									handleChange(
										'categories',
										ids.map((id) => ({ id })),
									)
								}
								emptyText="No categories linked."
								disabled={pending}
								error={linkError(errors.categories)}
							/>

							<FormPickerArticle<TermModel>
								labelText="Tags"
								fieldName="tag_id"
								dataSource="term"
								filter={{ type: 'tag' }}
								getOptionLabel={(entry) =>
									displayTermValue(entry, getLanguageClient())
								}
								initialLabels={initialLinkLabels.tags}
								value={tagIds}
								onChange={(ids) =>
									handleChange(
										'tags',
										ids.map((id) => ({ id })),
									)
								}
								emptyText="No tags linked."
								disabled={pending}
								error={linkError(errors.tags)}
								// A tag is a term with one wording per language; the search box
								// fills the language being edited and the create window handles
								// the rest.
								buildPrefillEntry={(typedValue) => ({
									type: TermTypeEnum.TAG,
									contents: [
										{
											language: language,
											value: typedValue,
										},
									],
								})}
								createLabel={(typedValue) =>
									`Create tag "${typedValue}"`
								}
							/>
						</div>
					</div>
				</TabsContent>

				<TabsContent id="seo">
					<div className="space-y-6 pt-4">
						<div className="form-section">
							{/*
							 * The slug is the article's public URL, so it lives with the rest
							 * of the addressing. Derived from the title while the editor has
							 * not written one — see `handleContentChange`.
							 */}
							<FormComponentInput<ArticleContentFormType>
								id={`${elementIds.contents}-${language}-slug`}
								labelText="Slug"
								fieldName="slug"
								fieldValue={currentContent?.slug ?? ''}
								isRequired={true}
								placeholderText="eg: how-to-brew-coffee"
								disabled={pending}
								onChange={(e) =>
									handleContentChange('slug', e.target.value)
								}
								error={contentErrors?.slug}
							/>

							<FormComponentInput<PageMeta>
								id={`${elementIds.contents}-${language}-meta-title`}
								labelText="Meta Title"
								fieldName="title"
								fieldValue={currentContent?.meta?.title ?? ''}
								disabled={pending}
								onChange={(e) =>
									handleMetaChange('title', e.target.value)
								}
								error={contentErrors?.meta?.title}
							/>

							<FormComponentTextarea<PageMeta>
								id={`${elementIds.contents}-${language}-meta-description`}
								labelText="Meta Description"
								fieldName="description"
								fieldValue={
									currentContent?.meta?.description ?? ''
								}
								rows={3}
								disabled={pending}
								onChange={(e) =>
									handleMetaChange(
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
									currentContent?.meta?.keywords ?? ''
								}
								disabled={pending}
								onChange={(e) =>
									handleMetaChange('keywords', e.target.value)
								}
								error={contentErrors?.meta?.keywords}
							/>
						</div>
					</div>
				</TabsContent>

				<TabsContent id="attribution">
					<div className="space-y-6 pt-4">
						<div className="form-section">
							<h3 className="font-bold border-b border-line pb-2">
								Author
							</h3>

							{/*
							 * Per-language, and it overrides the filing account field by field —
							 * `author_id` is stamped from the session on create and records who
							 * filed the article, not how the credit should read.
							 */}
							<div className="grid gap-4 sm:grid-cols-2">
								<FormComponentInput<ArticleContentFormType>
									id={`${elementIds.contents}-${language}-author-name`}
									labelText="Name"
									fieldName="author_name"
									fieldValue={
										currentContent?.author_name ?? ''
									}
									placeholderText="leave empty to credit the filing account"
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											'author_name',
											e.target.value,
										)
									}
									error={contentErrors?.author_name}
								/>

								<FormComponentInput<ArticleContentFormType>
									id={`${elementIds.contents}-${language}-author-email`}
									labelText="Email"
									fieldName="author_email"
									fieldValue={
										currentContent?.author_email ?? ''
									}
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											'author_email',
											e.target.value,
										)
									}
									error={contentErrors?.author_email}
								/>
							</div>

							<FormComponentInput<ArticleContentFormType>
								id={`${elementIds.contents}-${language}-author-avatar`}
								labelText="Avatar URL"
								fieldName="author_avatar"
								fieldValue={currentContent?.author_avatar ?? ''}
								placeholderText="https://…"
								disabled={pending}
								onChange={(e) =>
									handleContentChange(
										'author_avatar',
										e.target.value,
									)
								}
								error={contentErrors?.author_avatar}
							/>

							<FormComponentTextarea<ArticleContentFormType>
								id={`${elementIds.contents}-${language}-author-description`}
								labelText="Bio"
								fieldName="author_description"
								fieldValue={
									currentContent?.author_description ?? ''
								}
								rows={3}
								disabled={pending}
								onChange={(e) =>
									handleContentChange(
										'author_description',
										e.target.value,
									)
								}
								error={contentErrors?.author_description}
							/>
						</div>

						<div className="form-section">
							<h3 className="font-bold border-b border-line pb-2">
								Source
							</h3>

							{/* Not per-language: provenance is a property of the article. */}
							<div className="grid gap-4 sm:grid-cols-2">
								<FormComponentInput<ArticleFormValuesType>
									id={`${elementIds.source}-label`}
									labelText="Label"
									fieldName="source_label"
									fieldValue={formValues.source_label ?? ''}
									disabled={pending}
									onChange={(e) =>
										handleChange(
											'source_label',
											e.target.value,
										)
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
										handleChange(
											'source_url',
											e.target.value,
										)
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
									handleChange(
										'source_disclaimer',
										e.target.value,
									)
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
					</div>
				</TabsContent>
			</Tabs>

			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(formValues.contents ?? [])}
			/>
		</>
	);
}
