import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type ArticleFormValuesType,
	FormManageArticle,
} from '@/app/(dashboard)/dashboard/article/form-manage-article.component';
import { ViewArticle } from '@/app/(dashboard)/dashboard/article/view-article.component';
import Routes from '@/config/routes.setup';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsEnum,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestUpdateStatus,
	requestView,
} from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import {
	ARTICLE_DEFAULT_LAYOUT,
	ARTICLE_DEFAULT_VISIBILITY,
	type ArticleFeaturedStatus,
	ArticleFeaturedStatusEnum,
	ArticleLayoutEnum,
	type ArticleModel,
	type ArticleSourceMode,
	type ArticleStatus,
	ArticleStatusEnum,
	type ArticleVisibility,
	ArticleVisibilityEnum,
	displayArticleLabel,
	getArticleContentProp,
} from '@/models/article.model';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Language } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

/**
 * Comma-separated form input to the string array the API takes. Empty entries are dropped, so a
 * trailing comma or a stray space is not a value.
 */
function splitList(value: string | null | undefined): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_date',
	'invalid_language',
	'invalid_title',
	'invalid_slug',
	'invalid_brief',
	'invalid_content',
	'invalid_categories',
	'invalid_tags',
	'invalid_meta_title',
	'invalid_meta_description',
	'invalid_meta_keywords',
	'invalid_layout',
	'invalid_featured_status',
	'invalid_visibility',
	'invalid_visibility_rule',
	'invalid_boolean',
	'invalid_country_code',
	'invalid_source',
	'archive_before_publish',
] as const;

class ArticleValidator extends BaseValidator<typeof validatorMessages> {
	contentsSchema() {
		return z.object({
			language: this.validateLanguage(
				this.getMessage('invalid_language'),
			),
			slug: this.validateString(
				this.getMessage('invalid_slug'),
			).transform((value) => value.trim().toLowerCase()),
			title: this.validateString(this.getMessage('invalid_title')),
			brief: this.validateString(this.getMessage('invalid_brief'), {
				required: false,
			}),
			content: this.validateString(this.getMessage('invalid_content')),
			meta: this.validateMeta({
				invalid_meta_title: this.getMessage('invalid_meta_title'),
				invalid_meta_description: this.getMessage(
					'invalid_meta_description',
				),
				invalid_meta_keywords: this.getMessage('invalid_meta_keywords'),
			}),
		});
	}

	idListSchema(message: string) {
		return z
			.array(
				z.object({
					id: this.validateNumber(message, { onlyPositive: true }),
				}),
				{ message },
			)
			.default([]);
	}

	manage = () =>
		z
			.object({
				layout: this.validateEnum(
					ArticleLayoutEnum,
					this.getMessage('invalid_layout'),
				),
				featured_status: this.validateEnum(
					ArticleFeaturedStatusEnum,
					this.getMessage('invalid_featured_status'),
					{ required: false },
				),
				visibility: this.validateEnum(
					ArticleVisibilityEnum,
					this.getMessage('invalid_visibility'),
				),
				publish_at: this.validateDate(this.getMessage('invalid_date'), {
					required: false,
				}),
				archive_at: this.validateDate(this.getMessage('invalid_date'), {
					required: false,
				}),
				public_at: this.validateDate(this.getMessage('invalid_date'), {
					required: false,
				}),
				rule_requires_auth: this.validateBoolean(
					this.getMessage('invalid_boolean'),
					{ required: false },
				),
				rule_is_listed: this.validateBoolean(
					this.getMessage('invalid_boolean'),
					{ required: false },
				),
				rule_requires_subscription: this.validateString(
					this.getMessage('invalid_visibility_rule'),
					{ required: false },
				),
				rule_allowed_countries: this.validateString(
					this.getMessage('invalid_country_code'),
					{ required: false },
				),
				rule_password: this.validateString(
					this.getMessage('invalid_visibility_rule'),
					{ required: false },
				),
				source_label: this.validateString(
					this.getMessage('invalid_source'),
					{ required: false },
				),
				source_url: this.validateString(
					this.getMessage('invalid_source'),
					{ required: false },
				),
				source_disclaimer: this.validateString(
					this.getMessage('invalid_source'),
					{ required: false },
				),
				source_about: this.validateString(
					this.getMessage('invalid_source'),
					{ required: false },
				),
				categories: this.idListSchema(
					this.getMessage('invalid_categories'),
				),
				tags: this.idListSchema(this.getMessage('invalid_tags')),
				contents: this.contentsSchema()
					.array()
					.min(1, this.getMessage('invalid_contents'))
					.refine(
						(contents) => {
							const languages = contents.map(
								(content) => content.language,
							);

							return new Set(languages).size === languages.length;
						},
						{ message: this.getMessage('duplicate_contents') },
					),
			})
			.superRefine((data, ctx) => {
				// An article archived before it is published is never displayed at all. The
				// backend enforces the same rule on the merged row, which is what catches a
				// partial update this form cannot see.
				if (
					data.publish_at &&
					data.archive_at &&
					data.archive_at <= data.publish_at
				) {
					ctx.addIssue({
						code: 'custom',
						path: ['archive_at'],
						message: this.getMessage('archive_before_publish'),
					});
				}

				// The column is `varchar(2)[]`, and the backend rejects the whole array on the
				// first bad entry — naming the field here beats a generic list error.
				const invalidCountry = splitList(
					data.rule_allowed_countries,
				).find((code) => code.length !== 2);

				if (invalidCountry) {
					ctx.addIssue({
						code: 'custom',
						path: ['rule_allowed_countries'],
						message: this.getMessage('invalid_country_code'),
					});
				}
			});
}

type ArticleManageOutput = ValidatorOutput<ArticleValidator, 'manage'>;

async function validateForm(values: ArticleFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'article',
	);

	const validator = new ArticleValidator(translations);

	return validator.manage().safeParse(values);
}

/**
 * The translations ride in one hidden JSON field rather than as per-language inputs: the tab
 * strip renders every language at once and `FormData` would flatten them into indistinguishable
 * repeats of `title`, `slug`, `content`.
 */
function parseContents(formData: FormData): ArticleFormValuesType['contents'] {
	const raw = formData.get('contents');

	if (typeof raw !== 'string' || raw.length === 0) {
		return [];
	}

	try {
		return JSON.parse(raw) as ArticleFormValuesType['contents'];
	} catch {
		return [];
	}
}

function parseIdList(formData: FormData, key: string): { id: number }[] {
	return formData
		.getAll(key)
		.map((id) => ({ id: Number(id) }))
		.filter((entry) => Number.isFinite(entry.id));
}

function getFormValues(formData: FormData): ArticleFormValuesType {
	return {
		layout:
			getFormDataAsEnum(formData, 'layout', ArticleLayoutEnum) ||
			ARTICLE_DEFAULT_LAYOUT,
		featured_status: getFormDataAsEnum(
			formData,
			'featured_status',
			ArticleFeaturedStatusEnum,
		),
		visibility:
			getFormDataAsEnum(formData, 'visibility', ArticleVisibilityEnum) ||
			ARTICLE_DEFAULT_VISIBILITY,
		publish_at: getFormDataAsString(formData, 'publish_at'),
		archive_at: getFormDataAsString(formData, 'archive_at'),
		public_at: getFormDataAsString(formData, 'public_at'),
		rule_requires_auth: getFormDataAsBoolean(
			formData,
			'rule_requires_auth',
		),
		rule_is_listed: getFormDataAsBoolean(formData, 'rule_is_listed'),
		rule_requires_subscription: getFormDataAsString(
			formData,
			'rule_requires_subscription',
		),
		rule_allowed_countries: getFormDataAsString(
			formData,
			'rule_allowed_countries',
		),
		rule_password: getFormDataAsString(formData, 'rule_password'),
		source_label: getFormDataAsString(formData, 'source_label'),
		source_url: getFormDataAsString(formData, 'source_url'),
		source_disclaimer: getFormDataAsString(formData, 'source_disclaimer'),
		source_about: getFormDataAsString(formData, 'source_about'),
		// The pickers render one hidden input per selected id, which is what puts them in
		// `FormData` — `processForm` rebuilds its values from there on every submit.
		categories: parseIdList(formData, 'category_id'),
		tags: parseIdList(formData, 'tag_id'),
		contents: parseContents(formData),
	};
}

/** The calendar and the date validator both work on `YYYY-MM-DD`; a stored timestamp is trimmed to it. */
function toCalendarValue(value: ArticleModel['publish_at']): string | null {
	if (!value) {
		return null;
	}

	return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function getFormState(
	data?: ArticleModel,
): FormStateType<ArticleFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			layout: data?.layout ?? ARTICLE_DEFAULT_LAYOUT,
			featured_status: data?.featured_status ?? null,
			visibility: data?.visibility ?? ARTICLE_DEFAULT_VISIBILITY,
			publish_at: toCalendarValue(data?.publish_at ?? null),
			archive_at: toCalendarValue(data?.archive_at ?? null),
			public_at: toCalendarValue(data?.public_at ?? null),
			// Mirror of `buildVisibilityRule`, which puts these back together.
			rule_requires_auth: data?.visibility_rule?.requires_auth ?? false,
			// The backend defaults a new rule to listed, so a fresh form has to agree.
			rule_is_listed: data?.visibility_rule?.is_listed ?? true,
			rule_requires_subscription:
				data?.visibility_rule?.requires_subscription?.join(', ') ??
				null,
			rule_allowed_countries:
				data?.visibility_rule?.allowed_countries?.join(', ') ?? null,
			// Never seeded: the API returns the bcrypt hash to nobody.
			rule_password: null,
			source_label: data?.source?.label ?? null,
			source_url: data?.source?.url ?? null,
			source_disclaimer: data?.source?.disclaimer ?? null,
			source_about: data?.source?.about ?? null,
			// `read` returns the link rows, which carry the foreign key rather than the entity.
			categories: (data?.categories ?? []).map((link) => ({
				id: link.category_id,
			})),
			tags: (data?.tags ?? []).map((link) => ({ id: link.tag_id })),
			contents: (data?.contents ?? []).map((content) => ({
				language: content.language,
				slug: content.slug,
				title: content.title,
				brief: content.brief,
				content: content.content ?? null,
				meta: content.meta ?? { title: null },
			})),
		},
	};
}

/**
 * The rule only travels with a restricted article. Absent means "leave alone" to the backend,
 * which is exactly right for a public one — it drops the row itself once visibility says public.
 *
 * `password` is omitted while the field is empty rather than sent as `''`. An empty string
 * clears the stored hash, and the field is always empty on an update because the hash is never
 * returned — sending it would wipe the password on every unrelated save. The cost is that the
 * password cannot be cleared from this form; changing it works, and removing it means switching
 * the article to public and back.
 */
function buildVisibilityRule(data: ArticleManageOutput) {
	if (data.visibility !== ArticleVisibilityEnum.RESTRICTED) {
		return undefined;
	}

	return {
		requires_auth: data.rule_requires_auth ?? false,
		is_listed: data.rule_is_listed ?? true,
		requires_subscription: splitList(data.rule_requires_subscription),
		allowed_countries: splitList(data.rule_allowed_countries),
		...(data.rule_password ? { password: data.rule_password } : {}),
	};
}

/** `null` clears the stored attribution; an object with nothing in it would not. */
function buildSource(data: ArticleManageOutput) {
	const source = {
		label: data.source_label,
		url: data.source_url,
		disclaimer: data.source_disclaimer,
		about: data.source_about,
	};

	const hasValue = Object.values(source).some((value) => !!value);

	return hasValue ? source : null;
}

function prepareParamsFromFormValues(data: ArticleManageOutput) {
	const {
		rule_requires_auth: _requiresAuth,
		rule_is_listed: _isListed,
		rule_requires_subscription: _requiresSubscription,
		rule_allowed_countries: _allowedCountries,
		rule_password: _password,
		source_label: _sourceLabel,
		source_url: _sourceUrl,
		source_disclaimer: _sourceDisclaimer,
		source_about: _sourceAbout,
		...article
	} = data;

	return {
		...article,
		// The API takes plain id arrays; the form holds `{ id }` records because
		// `FormValuesType` has no place for a bare `number[]`.
		categories: data.categories.map((category) => category.id),
		tags: data.tags.map((tag) => tag.id),
		visibility_rule: buildVisibilityRule(data),
		source: buildSource(data),
	};
}

export type ArticleDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: ArticleStatus | null; matchMode: 'equals' };
	visibility: { value: ArticleVisibility | null; matchMode: 'equals' };
	featured_status: {
		value: ArticleFeaturedStatus | null;
		matchMode: 'equals';
	};
	source_mode: { value: ArticleSourceMode | null; matchMode: 'equals' };
	language: { value: Language | null; matchMode: 'equals' };
	is_published: { value: boolean; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };

	// Autocomplete pairs: the `*_id` half is the filter the backend accepts, the other holds
	// the picked label so the input can render it. The label is dropped by the backend.
	author: { value: string | null; matchMode: 'equals' };
	author_id: { value: number | null; matchMode: 'equals' };
	category: { value: string | null; matchMode: 'equals' };
	category_id: { value: number | null; matchMode: 'equals' };
	tag: { value: string | null; matchMode: 'equals' };
	tag_id: { value: number | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ArticleModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'submit.title',
			'schedule.title',
			'publish.title',
			'reject.title',
			'revert.title',
			'archive.title',
			'order.title',
		] as const,
		'article.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ArticleModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'article', 'read') ? 'view' : undefined,
			dataSource: 'article',
		};
	}

	/**
	 * The row button offers the single next step of the editorial workflow. `pending` has three
	 * onward transitions, so it offers none of them — that decision belongs in the action bar
	 * where the choice is visible.
	 */
	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ArticleModel>['displayButton'] {
		return {
			action: (entry: ArticleModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'article', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'article', 'update')) {
					return undefined;
				}

				switch (entry.status) {
					case ArticleStatusEnum.DRAFT:
						return 'submit';
					case ArticleStatusEnum.REJECTED:
						return 'revert';
					case ArticleStatusEnum.SCHEDULED:
						return 'publish';
					case ArticleStatusEnum.PUBLISHED:
						return 'archive';
					default:
						return undefined;
				}
			},
			dataSource: 'article',
		};
	}

	/** Not deleted, and currently in one of the statuses the transition starts from. */
	const canTransitionFrom =
		(...statuses: ArticleStatus[]) =>
		(entry: ArticleModel): boolean =>
			!entry.deleted_at && arrayHasValue(entry.status, statuses);

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					status: { value: null, matchMode: 'equals' },
					visibility: { value: null, matchMode: 'equals' },
					featured_status: { value: null, matchMode: 'equals' },
					source_mode: { value: null, matchMode: 'equals' },
					language: { value: null, matchMode: 'equals' },
					is_published: { value: false, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
					author: { value: null, matchMode: 'equals' },
					author_id: { value: null, matchMode: 'equals' },
					category: { value: null, matchMode: 'equals' },
					category_id: { value: null, matchMode: 'equals' },
					tag: { value: null, matchMode: 'equals' },
					tag_id: { value: null, matchMode: 'equals' },
				} satisfies ArticleDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					// Not sortable: the backend orders on the article row, and the title lives
					// in the joined translation (`OrderByEnum`).
					field: 'title',
					header: 'Title',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: getArticleContentProp(
								entry,
								getLanguageClient(),
							),
							markDeleted: true,
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'article',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'publish_at',
					header: 'Publish At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
				{
					field: 'created_at',
					header: 'Created At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<ArticleModel>('article', params),
		},
		displayEntryLabel: (entry: ArticleModel) =>
			displayArticleLabel(entry, getLanguageClient()),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageArticle,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['article', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: ArticleManageOutput) => {
					const params = prepareParamsFromFormValues(values);

					return requestCreate<ArticleModel, typeof params>(
						'article',
						params,
					);
				},
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageArticle,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ArticleModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					values: ArticleManageOutput,
					id: number,
				) => {
					const params = prepareParamsFromFormValues(values);

					return requestUpdate<ArticleModel, typeof params>(
						'article',
						params,
						id,
					);
				},
				// A list row carries neither the markdown nor the link rows — only `read` does.
				reloadEntry: (id: number) =>
					requestView<ArticleModel>('article', id),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['article', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ArticleModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: ArticleModel) =>
					requestDelete('article', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['article', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ArticleModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: ArticleModel) =>
					requestRestore('article', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			/*
			 * One action per edge of the backend's `STATUS_TRANSITIONS` table. A transition it
			 * does not list is rejected with a 409, so `customEntryCheck` mirrors that table
			 * rather than offering every status from every state.
			 */
			submit: {
				windowType: 'action',
				windowTitle: translations['submit.title'],
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: canTransitionFrom(ArticleStatusEnum.DRAFT),
				operationFunction: (entry: ArticleModel) =>
					requestUpdateStatus(
						'article',
						entry,
						ArticleStatusEnum.PENDING,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			schedule: {
				windowType: 'action',
				windowTitle: translations['schedule.title'],
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: canTransitionFrom(ArticleStatusEnum.PENDING),
				operationFunction: (entry: ArticleModel) =>
					requestUpdateStatus(
						'article',
						entry,
						ArticleStatusEnum.SCHEDULED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			publish: {
				windowType: 'action',
				windowTitle: translations['publish.title'],
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: canTransitionFrom(
					ArticleStatusEnum.PENDING,
					ArticleStatusEnum.SCHEDULED,
				),
				operationFunction: (entry: ArticleModel) =>
					requestUpdateStatus(
						'article',
						entry,
						ArticleStatusEnum.PUBLISHED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
			},
			reject: {
				windowType: 'action',
				windowTitle: translations['reject.title'],
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: canTransitionFrom(ArticleStatusEnum.PENDING),
				operationFunction: (entry: ArticleModel) =>
					requestUpdateStatus(
						'article',
						entry,
						ArticleStatusEnum.REJECTED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			revert: {
				windowType: 'action',
				windowTitle: translations['revert.title'],
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: canTransitionFrom(
					ArticleStatusEnum.REJECTED,
					ArticleStatusEnum.SCHEDULED,
				),
				operationFunction: (entry: ArticleModel) =>
					requestUpdateStatus(
						'article',
						entry,
						ArticleStatusEnum.DRAFT,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			archive: {
				windowType: 'action',
				windowTitle: translations['archive.title'],
				permission: ['article', 'update'],
				entriesSelection: 'single',
				customEntryCheck: canTransitionFrom(
					ArticleStatusEnum.PUBLISHED,
				),
				operationFunction: (entry: ArticleModel) =>
					requestUpdateStatus(
						'article',
						entry,
						ArticleStatusEnum.ARCHIVED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			order: {
				windowType: 'link',
				windowTitle: translations['order.title'],
				windowTarget: Routes.get('article-order'),
				permission: ['article', 'update'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewArticle,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['article', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				// The list row has no markdown; the view needs it.
				reloadEntry: (id: number) =>
					requestView<ArticleModel>('article', id),
			},
		},
	};
}
