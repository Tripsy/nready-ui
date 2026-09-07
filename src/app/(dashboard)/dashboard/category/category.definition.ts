import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type CategoryFormValuesType,
	FormManageCategory,
} from '@/app/(dashboard)/dashboard/category/form-manage-category.component';
import { ManagerAttributesCategory } from '@/app/(dashboard)/dashboard/category/manager-attributes-category.component';
import { UsageGuideCategory } from '@/app/(dashboard)/dashboard/category/usage-guide-category.component';
import { ViewCategory } from '@/app/(dashboard)/dashboard/category/view-category.component';
import { Icons } from '@/components/icon.component';
import Routes from '@/config/routes.setup';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestUpdateStatus,
	requestView,
} from '@/helpers/services.helper';
import { toKebabCase } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	CATEGORY_DEFAULT_TYPE,
	type CategoryContentType,
	type CategoryModel,
	type CategoryStatus,
	CategoryStatusEnum,
	type CategoryType,
	CategoryTypeEnum,
	displayCategoryLabel,
	getCategoryContentProp,
} from '@/models/category.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Language } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_type',
	'invalid_parent',
	'invalid_parent_id',
	'invalid_language',
	'invalid_label',
	'invalid_slug',
	'invalid_description',
	'invalid_meta_title',
	'invalid_meta_description',
	'invalid_meta_keywords',
] as const;

class CategoryValidator extends BaseValidator<typeof validatorMessages> {
	contentsSchema() {
		return z.object({
			language: this.validateLanguage(
				this.getMessage('invalid_language'),
			),
			label: this.validateString(this.getMessage('invalid_label')),
			// Required by the backend, which derives nothing: `getFormValues` fills it from
			// the label when the field is left empty.
			slug: this.validateString(this.getMessage('invalid_slug')),
			description: this.validateString(
				this.getMessage('invalid_description'),
			),
			meta: this.validateMeta({
				invalid_meta_title: this.getMessage('invalid_meta_title'),
				invalid_meta_description: this.getMessage(
					'invalid_meta_description',
				),
				invalid_meta_keywords: this.getMessage('invalid_meta_keywords'),
			}),
		});
	}

	manage = (isSubmit: boolean = true) =>
		z
			.object({
				type: this.validateEnum(
					CategoryTypeEnum,
					this.getMessage('invalid_type'),
				),
				parent_id: this.validateId(
					this.getMessage('invalid_parent_id'),
					{ required: false },
				),
				parent: this.validateString(this.getMessage('invalid_parent'), {
					required: false,
				}),
				contents: this.contentsSchema().array(),
			})
			.superRefine((data, ctx) => {
				// A typed-but-unpicked parent means the autocomplete never resolved an id;
				// submitting would silently create a root category instead.
				if (isSubmit && data.parent && !data.parent_id) {
					ctx.addIssue({
						path: ['parent'],
						message: this.getMessage('invalid_parent_id'),
						code: 'custom',
					});
				}
			})
			.superRefine((data, ctx) => {
				if (data.contents.length === 0) {
					ctx.addIssue({
						path: ['contents', 0, 'label'],
						message: this.getMessage('invalid_contents'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: CategoryFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'category',
	);

	const validator = new CategoryValidator(translations);

	const normalizedValues = {
		...values,
		contents: Object.values(values.contents).filter(
			(c): c is CategoryContentType => !!c,
		),
	};

	return validator.manage(isSubmit).safeParse(normalizedValues);
}

function getFormValues(formData: FormData): CategoryFormValuesType {
	const contentsRaw = formData.get('contents');

	let contents: CategoryContentType[] = [];

	if (typeof contentsRaw === 'string' && contentsRaw.length > 0) {
		try {
			contents = JSON.parse(contentsRaw) as CategoryContentType[];
		} catch {
			contents = [];
		}
	}

	return {
		type:
			getFormDataAsEnum(formData, 'type', CategoryTypeEnum) ||
			CATEGORY_DEFAULT_TYPE,
		parent_id: getFormDataAsNumber(formData, 'parent_id'),
		parent: getFormDataAsString(formData, 'parent'),
		contents: contents.map((content) => ({
			...content,
			// `toKebabCase` strips anything outside the latin alphabet, so a wholly
			// non-latin label leaves the slug empty and the field reports itself as
			// required - better than persisting a meaningless slug into a unique index.
			slug: content.slug?.trim() || toKebabCase(content.label ?? ''),
		})),
	};
}

function getFormState(
	data?: CategoryModel,
): FormStateType<CategoryFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			type: data?.type ?? CATEGORY_DEFAULT_TYPE,
			parent_id: data?.parent?.id ?? null,
			parent: data?.parent
				? getCategoryContentProp(
						data.parent,
						getLanguageClient(),
						'label',
					)
				: null,
			contents: data?.contents ?? [],
		},
	};
}

/**
 * `parent` holds the autocomplete's display text and never belongs in a request - only the
 * resolved `parent_id` does.
 */
function prepareCreateParams({
	parent: _parent,
	...params
}: CategoryFormValuesType) {
	return params;
}

/**
 * The backend's `update` schema accepts `parent_id` and `contents` only - `type` is fixed once
 * the row exists. `parent_id` is always sent, including as `null`: the backend reads the key's
 * presence as the intent to re-parent and its emptiness as a promotion to root, and the form
 * prefills it from the entry, so an unchanged value is a no-op there.
 */
function prepareUpdateParams({
	parent: _parent,
	type: _type,
	...params
}: CategoryFormValuesType) {
	return params;
}

export type CategoryDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	type: { value: CategoryType | null; matchMode: 'equals' };
	status: { value: CategoryStatus | null; matchMode: 'equals' };
	language: { value: Language | null; matchMode: 'equals' };
	// Scopes a listing to one sibling group. Only the order page renders a control for it;
	// the main list leaves it at its default and shows the whole type.
	parent_id: { value: number | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CategoryModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'enable.title',
			'disable.title',
			'order.title',
			'tree.title',
			'attributes.title',
			'guide.title',
		] as const,
		'category.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<CategoryModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'category', 'read') ? 'view' : undefined,
			dataSource: 'category',
		};
	}

	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<CategoryModel>['displayButton'] {
		return {
			action: (entry: CategoryModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'category', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'category', 'update')) {
					return undefined;
				}

				return entry.status === CategoryStatusEnum.ACTIVE
					? 'disable'
					: 'enable';
			},
			dataSource: 'category',
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					type: {
						value: CATEGORY_DEFAULT_TYPE,
						matchMode: 'equals',
					},
					status: { value: null, matchMode: 'equals' },
					language: { value: null, matchMode: 'equals' },
					parent_id: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies CategoryDataTableFiltersType,
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
					field: 'type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					// Not sortable: the backend's `order_by=label` resolves against the
					// category alias, which has no `label` column, and 500s.
					field: 'label',
					header: 'Label',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							customValue: getCategoryContentProp(
								entry,
								getLanguageClient(),
								'label',
							),
						}),
				},
				{
					field: 'parent',
					header: 'Parent',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.parent
								? getCategoryContentProp(
										entry.parent,
										getLanguageClient(),
										'label',
									)
								: '-',
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'category',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
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
				requestFind<CategoryModel>('category', params),
		},
		displayEntryLabel: (entry: CategoryModel) => {
			return displayCategoryLabel(entry, getLanguageClient());
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCategory,
				permission: ['category', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: CategoryFormValuesType) =>
					requestCreate<
						CategoryModel,
						ReturnType<typeof prepareCreateParams>
					>('category', prepareCreateParams(params)),
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
				windowComponent: FormManageCategory,
				permission: ['category', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CategoryModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: CategoryFormValuesType,
					id: number,
				) =>
					requestUpdate<
						CategoryModel,
						ReturnType<typeof prepareUpdateParams>
					>('category', prepareUpdateParams(params), id),
				reloadEntry: (id: number) =>
					requestView<CategoryModel>('category', id),
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
				permission: ['category', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CategoryModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: CategoryModel) =>
					requestDelete('category', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['category', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CategoryModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: CategoryModel) =>
					requestRestore('category', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['category', 'update'],
				entriesSelection: 'single',
				// `pending` is a valid source state too, so this is not the mirror of
				// `disable` - anything not already active can be activated.
				customEntryCheck: (entry: CategoryModel) =>
					!entry.deleted_at &&
					entry.status !== CategoryStatusEnum.ACTIVE,
				operationFunction: (entry: CategoryModel) =>
					requestUpdateStatus('category', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['category', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CategoryModel) =>
					!entry.deleted_at &&
					entry.status !== CategoryStatusEnum.INACTIVE,
				operationFunction: (entry: CategoryModel) =>
					requestUpdateStatus('category', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCategory,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['category', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				reloadEntry: (id: number) =>
					requestView<CategoryModel>('category', id),
			},
			order: {
				windowType: 'link',
				windowTitle: translations['order.title'],
				windowTarget: Routes.get('category-order'),
				permission: ['category', 'update'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'warning',
				},
			},
			tree: {
				windowType: 'link',
				windowTitle: translations['tree.title'],
				windowTarget: Routes.get('category-tree'),
				permission: ['category', 'read'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'warning',
				},
			},
			/*
			 * Only a product category declares attributes: the definitions describe what a
			 * product in it must say about itself, and the article tree holds none. Gated on
			 * `product` rather than `category`, matching the backend policy - the schema of a
			 * catalog belongs to whoever may edit the catalog.
			 */
			attributes: {
				windowType: 'other',
				windowTitle: translations['attributes.title'],
				windowComponent: ManagerAttributesCategory,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['product', 'read'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CategoryModel) =>
					entry.type === CategoryTypeEnum.PRODUCT,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'info',
				},
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideCategory,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['category', 'read'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Info,
				},
			},
		},
	};
}
