import { z } from 'zod';
import { FormManageProductCategoryAttribute } from '@/app/(dashboard)/dashboard/product-category-attribute/form-manage-product-category-attribute.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsEnum,
	getFormDataAsJsonList,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import {
	displayAttributeLabel,
	type MeasureUnit,
	MeasureUnitEnum,
	PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_SCOPE,
	PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_TYPE,
	PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_VALUE_TYPE,
	type ProductCategoryAttributeModel,
	type ProductCategoryAttributeScope,
	ProductCategoryAttributeScopeEnum,
	type ProductCategoryAttributeType,
	ProductCategoryAttributeTypeEnum,
	type ProductCategoryAttributeValueType,
	ProductCategoryAttributeValueTypeEnum,
	VALUE_TYPES_BY_TYPE,
} from '@/models/product-category-attribute.model';
import { displayTermValue } from '@/models/term.model';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

/** How far apart consecutive rows are placed, so one can be slipped between two later. */
const SORT_ORDER_STEP = 10;

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_category_id',
	'invalid_attribute_label_id',
	'invalid_scope',
	'invalid_value_type',
	'invalid_capture_type',
	'invalid_measure_unit',
	'invalid_affix',
	'invalid_bound',
	'invalid_sort_order',
	'type_value_type_mismatch',
	'unit_requires_number',
	'unit_excludes_suffix',
	'bounds_require_number',
	'max_below_min',
	'options_require_term',
	'options_required',
	'option_duplicate',
] as const;

/**
 * One admissible value as the form holds it. `term_id` is the whole of what the API takes; the
 * wording is carried alongside so a chip can name what it points at, and so it survives a failed
 * submit — `processForm` rebuilds the values from `FormData`, and an id on its own would come
 * back nameless.
 */
export type ProductCategoryAttributeOptionFormType = {
	term_id: number;
	// display-only fields, not part of validation
	label: string;
};

export type ProductCategoryAttributeFormValuesType = {
	category_id: number | null;
	/*
	 * The categories the window may attach this definition to. Empty when it was opened from a
	 * category, which fixes the answer; the product form passes the product's own categories,
	 * since a definition belongs to exactly one and only the editor knows which of them should
	 * carry it — attaching to Electronics gives it to everything beneath, attaching to Laptops
	 * does not.
	 *
	 * display-only fields, not part of validation
	 */
	category_options: { id: number; label: string }[];
	attribute_label_id: number | null;

	scope: ProductCategoryAttributeScope;
	type: ProductCategoryAttributeType;
	value_type: ProductCategoryAttributeValueType;

	unit: MeasureUnit | null;
	prefix: string | null;
	suffix: string | null;
	/*
	 * Text, not numbers, for every figure the user types. A controlled input whose value is
	 * `String(Number(raw))` cannot hold a half-typed decimal: "0." parses to 0 and renders back
	 * as "0", so the point is swallowed and the next keystroke lands in the units column. The
	 * string is the truth until the validator coerces it.
	 */
	min_value: string | null;
	max_value: string | null;

	is_required: boolean;
	is_filterable: boolean;
	inherit: boolean;
	sort_order: string;

	options: ProductCategoryAttributeOptionFormType[];

	/*
	 * A sentinel leaf field for the rules that describe the option *set* rather than one entry.
	 * `accumulateZodErrors` keys a list's errors by index, so a message about the whole list has
	 * nowhere to land unless it is given a plain field of its own.
	 */
	options_rule: string | null;

	// display-only fields, not part of validation
	attribute_label: string | null;
};

class ProductCategoryAttributeValidator extends BaseValidator<
	typeof validatorMessages
> {
	/** Blank means "not set"; anything else has to be a real number. */
	private readonly optionalAmountSchema = (message: string) =>
		z
			.string({ message })
			.nullable()
			.refine(
				(value) =>
					value === null ||
					value.trim() === '' ||
					Number.isFinite(Number(value)),
				{ message },
			)
			.transform((value) =>
				value === null || value.trim() === '' ? null : Number(value),
			);

	private readonly optionSchema = z.object({
		term_id: z
			.number({ message: this.getMessage('invalid_attribute_label_id') })
			.positive({
				message: this.getMessage('invalid_attribute_label_id'),
			}),
		label: z.string(),
	});

	manage = z
		.object({
			category_id: this.validateId(
				this.getMessage('invalid_category_id'),
			),
			attribute_label_id: this.validateId(
				this.getMessage('invalid_attribute_label_id'),
			),
			scope: this.validateEnum(
				ProductCategoryAttributeScopeEnum,
				this.getMessage('invalid_scope'),
			),
			type: this.validateEnum(
				ProductCategoryAttributeTypeEnum,
				this.getMessage('invalid_capture_type'),
			),
			value_type: this.validateEnum(
				ProductCategoryAttributeValueTypeEnum,
				this.getMessage('invalid_value_type'),
			),
			unit: this.validateEnum(
				MeasureUnitEnum,
				this.getMessage('invalid_measure_unit'),
				{ required: false },
			),
			prefix: this.validateString(this.getMessage('invalid_affix'), {
				required: false,
				maxChars: 16,
			}),
			suffix: this.validateString(this.getMessage('invalid_affix'), {
				required: false,
				maxChars: 16,
			}),
			min_value: this.optionalAmountSchema(
				this.getMessage('invalid_bound'),
			),
			max_value: this.optionalAmountSchema(
				this.getMessage('invalid_bound'),
			),
			is_required: z.boolean(),
			is_filterable: z.boolean(),
			inherit: z.boolean(),
			sort_order: z
				.string({ message: this.getMessage('invalid_sort_order') })
				.refine(
					(value) =>
						value.trim() !== '' && Number.isInteger(Number(value)),
					{ message: this.getMessage('invalid_sort_order') },
				)
				.transform(Number),
			options: this.optionSchema.array(),
			options_rule: z.string().nullable(),
			category_options: z
				.array(z.object({ id: z.number(), label: z.string() }))
				.default([]),
			attribute_label: z.string().nullable(),
		})
		/*
		 * Everything the table's three `@Check` constraints say, plus the one they cannot: a
		 * list-backed definition has to carry admissible values, which live in another table.
		 * A constraint violation reaches the client as a masked 500, so these are checked here
		 * rather than left to the database — see `product-category-attribute.entity.ts`.
		 */
		.superRefine((data, ctx) => {
			const isNumber =
				data.value_type ===
				ProductCategoryAttributeValueTypeEnum.NUMBER;
			const isTerm =
				data.value_type === ProductCategoryAttributeValueTypeEnum.TERM;

			if (!VALUE_TYPES_BY_TYPE[data.type].includes(data.value_type)) {
				ctx.addIssue({
					code: 'custom',
					path: ['value_type'],
					message: this.getMessage('type_value_type_mismatch'),
				});
			}

			if (data.unit && !isNumber) {
				ctx.addIssue({
					code: 'custom',
					path: ['unit'],
					message: this.getMessage('unit_requires_number'),
				});
			}

			// A measurement renders its unit; an affix is decoration a measure does not cover.
			// Both would leave two answers to what follows the number.
			if (data.unit && data.suffix) {
				ctx.addIssue({
					code: 'custom',
					path: ['suffix'],
					message: this.getMessage('unit_excludes_suffix'),
				});
			}

			if (
				(data.min_value !== null || data.max_value !== null) &&
				!isNumber
			) {
				ctx.addIssue({
					code: 'custom',
					path: ['min_value'],
					message: this.getMessage('bounds_require_number'),
				});
			}

			if (
				data.min_value !== null &&
				data.max_value !== null &&
				data.min_value > data.max_value
			) {
				ctx.addIssue({
					code: 'custom',
					path: ['max_value'],
					message: this.getMessage('max_below_min'),
				});
			}

			if (isTerm && data.options.length === 0) {
				ctx.addIssue({
					code: 'custom',
					path: ['options_rule'],
					message: this.getMessage('options_required'),
				});
			}

			/*
			 * A numeric attribute is bounded by a range, not by a list: a dropdown of allowed
			 * numbers would put the value back in a term and forfeit range filtering entirely.
			 */
			if (!isTerm && data.options.length > 0) {
				ctx.addIssue({
					code: 'custom',
					path: ['options_rule'],
					message: this.getMessage('options_require_term'),
				});
			}

			/*
			 * `syncOptions` keys on `term_id`, and the table's unique index would refuse the
			 * second row anyway — as a masked conflict rather than a message against the field.
			 */
			const termIds = data.options.map((option) => option.term_id);

			if (new Set(termIds).size !== termIds.length) {
				ctx.addIssue({
					code: 'custom',
					path: ['options_rule'],
					message: this.getMessage('option_duplicate'),
				});
			}
		});
}

export type ProductCategoryAttributeManageOutput = ValidatorOutput<
	ProductCategoryAttributeValidator,
	'manage'
>;

async function validateForm(values: ProductCategoryAttributeFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'product-category-attribute',
	);

	const validator = new ProductCategoryAttributeValidator(translations);

	return validator.manage.safeParse(values);
}

function getFormValues(
	formData: FormData,
): ProductCategoryAttributeFormValuesType {
	return {
		category_id: getFormDataAsNumber(formData, 'category_id'),
		attribute_label_id: getFormDataAsNumber(formData, 'attribute_label_id'),
		scope:
			getFormDataAsEnum(
				formData,
				'scope',
				ProductCategoryAttributeScopeEnum,
			) ?? PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_SCOPE,
		type:
			getFormDataAsEnum(
				formData,
				'type',
				ProductCategoryAttributeTypeEnum,
			) ?? PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_TYPE,
		value_type:
			getFormDataAsEnum(
				formData,
				'value_type',
				ProductCategoryAttributeValueTypeEnum,
			) ?? PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_VALUE_TYPE,
		unit: getFormDataAsEnum(formData, 'unit', MeasureUnitEnum),
		prefix: getFormDataAsString(formData, 'prefix'),
		suffix: getFormDataAsString(formData, 'suffix'),
		min_value: getFormDataAsString(formData, 'min_value'),
		max_value: getFormDataAsString(formData, 'max_value'),
		is_required: getFormDataAsBoolean(formData, 'is_required'),
		is_filterable: getFormDataAsBoolean(formData, 'is_filterable'),
		inherit: getFormDataAsBoolean(formData, 'inherit'),
		sort_order: getFormDataAsString(formData, 'sort_order') ?? '0',
		options: getFormDataAsJsonList<ProductCategoryAttributeOptionFormType>(
			formData,
			'options',
		),
		options_rule: null,
		category_options: getFormDataAsJsonList<{ id: number; label: string }>(
			formData,
			'category_options',
		),
		attribute_label: getFormDataAsString(formData, 'attribute_label'),
	};
}

/**
 * Seeds both windows: create from the prefill the manager passes (the category being edited,
 * and where the new row lands in its order), update from the entry `reloadEntry` returned.
 *
 * The options arrive with their term joined, so the chips render from the stored wording rather
 * than from a second lookup — an option whose term has since been deleted keeps its id and says
 * so, instead of vanishing from the list on the next save.
 */
function getFormState(
	data?: ProductCategoryAttributeModel,
): FormStateType<ProductCategoryAttributeFormValuesType> {
	const language = getLanguageClient();

	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			category_id: data?.category_id ?? null,
			attribute_label_id: data?.attribute_label_id ?? null,
			scope: data?.scope ?? PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_SCOPE,
			type: data?.type ?? PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_TYPE,
			value_type:
				data?.value_type ??
				PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_VALUE_TYPE,
			unit: data?.unit ?? null,
			prefix: data?.prefix ?? null,
			suffix: data?.suffix ?? null,
			min_value:
				data?.min_value === null || data?.min_value === undefined
					? ''
					: String(data.min_value),
			max_value:
				data?.max_value === null || data?.max_value === undefined
					? ''
					: String(data.max_value),
			is_required: data?.is_required ?? false,
			is_filterable: data?.is_filterable ?? false,
			inherit: data?.inherit ?? true,
			sort_order: String(data?.sort_order ?? SORT_ORDER_STEP),
			options: (data?.options ?? []).map((option) => ({
				term_id: option.term_id,
				label: option.term
					? displayTermValue(
							option.term,
							language,
							`#${option.term_id}`,
						)
					: `#${option.term_id}`,
			})),
			category_options: data?.category_options ?? [],
			options_rule: null,
			/*
			 * Keyed on the id rather than on `data` being present: create is seeded with a
			 * prefill entry too — the category and the position the manager assigns — and an
			 * entry that carries no label at all would render as the fallback `#undefined`.
			 */
			attribute_label: data?.attribute_label_id
				? displayAttributeLabel(data, language)
				: null,
		},
	};
}

/**
 * The columns the definition row owns.
 *
 * `options` carries only ids — the labels are the picker's chips and mean nothing to the API —
 * and their `sort_order` is the position in the list, so the order they were arranged in is the
 * order a product form offers them.
 */
function prepareParams(data: ProductCategoryAttributeManageOutput) {
	return {
		scope: data.scope,
		type: data.type,
		value_type: data.value_type,
		unit: data.unit ?? null,
		prefix: data.prefix ?? null,
		suffix: data.suffix ?? null,
		min_value: data.min_value,
		max_value: data.max_value,
		is_required: data.is_required,
		is_filterable: data.is_filterable,
		inherit: data.inherit,
		sort_order: data.sort_order,
		options: data.options.map((option, position) => ({
			term_id: option.term_id,
			sort_order: (position + 1) * SORT_ORDER_STEP,
		})),
	};
}

function prepareCreateParams(data: ProductCategoryAttributeManageOutput) {
	return {
		category_id: data.category_id,
		attribute_label_id: data.attribute_label_id,
		...prepareParams(data),
	};
}

/**
 * The backend's `update` schema takes the definition's own columns and its options only — the
 * category and the label it was created against are fixed, and a definition that could move
 * between them would be a different definition wearing the same id.
 */
function prepareUpdateParams(data: ProductCategoryAttributeManageOutput) {
	return prepareParams(data);
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ProductCategoryAttributeModel>
> {
	const translations = await translateBatch(
		['create.title', 'update.title', 'delete.title'] as const,
		'product-category-attribute.action',
	);

	return {
		/*
		 * No `dataTable`: this data source has no page of its own. A definition is only ever
		 * read in the context of the category that declares it, which `ManagerAttributesCategory`
		 * lists directly — the registry is here for the create/update windows the manager opens.
		 */
		displayEntryLabel: (entry: ProductCategoryAttributeModel) =>
			displayAttributeLabel(entry, getLanguageClient()),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageProductCategoryAttribute,
				windowConfigProps: {
					size: 'xl',
				},
				// Gated on `product`, like the backend policy: a definition declares what a
				// product in a category must say about itself, so whoever may edit the catalog
				// may edit its schema.
				permission: ['product', 'create'],
				entriesSelection: 'free',
				operationFunction: (
					values: ProductCategoryAttributeManageOutput,
				) => {
					const params = prepareCreateParams(values);

					return requestCreate<
						ProductCategoryAttributeModel,
						typeof params
					>('product-category-attribute', params);
				},
				/*
				 * The rules only the server can settle — the `(category, label)` conflict, and
				 * every pairing check re-run against the merged row — come back as 409/422 with
				 * the reason in the message. `processForm` passes a backend message through
				 * verbatim only for a 409, so without this a 422 says nothing but "form error".
				 */
				mapApiError: async (error) =>
					error.status === 422 ? { message: error.message } : {},
				buttonPosition: 'hidden',
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageProductCategoryAttribute,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['product', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductCategoryAttributeModel) =>
					!entry.deleted_at,
				operationFunction: (
					values: ProductCategoryAttributeManageOutput,
					id: number,
				) => {
					const params = prepareUpdateParams(values);

					return requestUpdate<
						ProductCategoryAttributeModel,
						typeof params
					>('product-category-attribute', params, id);
				},
				/*
				 * The listing carries no options at all — only `GET /:id` joins them — so
				 * without this the form would open with an empty list and wipe them on save.
				 */
				reloadEntry: (id: number) =>
					requestView<ProductCategoryAttributeModel>(
						'product-category-attribute',
						id,
					),
				mapApiError: async (error) =>
					error.status === 422 ? { message: error.message } : {},
				buttonPosition: 'hidden',
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['product', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductCategoryAttributeModel) =>
					!entry.deleted_at,
				operationFunction: (entry: ProductCategoryAttributeModel) =>
					requestDelete('product-category-attribute', entry),
				buttonPosition: 'hidden',
			},
		},
	};
}
