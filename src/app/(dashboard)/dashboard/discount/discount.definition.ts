import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type DiscountFormValuesType,
	FormManageDiscount,
} from '@/app/(dashboard)/dashboard/discount/form-manage-discount.component';
import { UsageGuideDiscount } from '@/app/(dashboard)/dashboard/discount/usage-guide-discount.component';
import { ViewDiscount } from '@/app/(dashboard)/dashboard/discount/view-discount.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
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
} from '@/helpers/services.helper';
import { toCalendarValue } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	type DiscountConditions,
	type DiscountModel,
	type DiscountReason,
	DiscountReasonEnum,
	type DiscountScope,
	DiscountScopeEnum,
	type DiscountType,
	DiscountTypeEnum,
	displayDiscountLabel,
	displayDiscountValue,
} from '@/models/discount.model';
import { requestUpdateDiscountTargets } from '@/services/discount.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_label',
	'invalid_scope',
	'invalid_reason',
	'invalid_reference',
	'invalid_type',
	'invalid_value',
	'invalid_min_order_value',
	'invalid_countries',
	'invalid_hour',
	'invalid_day',
	'range_needs_both_ends',
	'targets_required',
	'invalid_start_at',
	'invalid_end_at',
	'end_at_must_be_after_start_at',
	'percent_must_be_between_0_and_100',
	'invalid_notes',
] as const;

class DiscountValidator extends BaseValidator<typeof validatorMessages> {
	/** Two-letter ISO codes, comma separated. Empty means "no country condition". */
	readonly countries = z
		.string()
		.trim()
		.optional()
		.nullable()
		.superRefine((value, ctx) => {
			if (!value) {
				return;
			}

			const invalid = value
				.split(',')
				.map((code) => code.trim())
				.filter((code) => code.length > 0)
				.filter((code) => !/^[A-Za-z]{2}$/.test(code));

			if (invalid.length > 0) {
				ctx.addIssue({
					message: `${this.getMessage('invalid_countries')} (${invalid.join(', ')})`,
					code: 'custom',
				});
			}
		});

	private boundedInt(min: number, max: number, message: string) {
		return this.validateNumber(
			{ invalid: message },
			{ required: false, onlyPositive: true },
		).refine(
			(value) =>
				value === null ||
				value === undefined ||
				(Number.isInteger(value) && value >= min && value <= max),
			{ message },
		);
	}

	manage = z
		.object({
			label: this.validateString(this.getMessage('invalid_label')),
			scope: this.validateEnum(
				DiscountScopeEnum,
				this.getMessage('invalid_scope'),
			),
			reason: this.validateEnum(
				DiscountReasonEnum,
				this.getMessage('invalid_reason'),
			),
			reference: this.validateString(
				this.getMessage('invalid_reference'),
			),
			type: this.validateEnum(
				DiscountTypeEnum,
				this.getMessage('invalid_type'),
			),
			value: this.validateNumber(
				{
					invalid: this.getMessage('invalid_value'),
					only_positive: this.getMessage('only_positive'),
				},
				{
					required: true,
					onlyPositive: true,
					allowDecimals: 2,
				},
			),
			condition_min_order_value: this.validateNumber(
				{
					invalid: this.getMessage('invalid_min_order_value'),
					only_positive: this.getMessage('only_positive'),
				},
				{ required: false, onlyPositive: true, allowDecimals: 2 },
			),
			condition_countries: this.countries,
			condition_hour_from: this.boundedInt(
				0,
				23,
				this.getMessage('invalid_hour'),
			),
			condition_hour_to: this.boundedInt(
				0,
				23,
				this.getMessage('invalid_hour'),
			),
			condition_day_from: this.boundedInt(
				1,
				7,
				this.getMessage('invalid_day'),
			),
			condition_day_to: this.boundedInt(
				1,
				7,
				this.getMessage('invalid_day'),
			),
			start_at: this.validateDate(
				{
					invalid_date: this.getMessage('invalid_start_at'),
					invalid_date_format: this.getMessage('invalid_start_at'),
					invalid_past_date: this.getMessage('invalid_start_at'),
					invalid_future_date: this.getMessage('invalid_start_at'),
				},
				{ required: false },
			),
			end_at: this.validateDate(
				{
					invalid_date: this.getMessage('invalid_end_at'),
					invalid_date_format: this.getMessage('invalid_end_at'),
					invalid_past_date: this.getMessage('invalid_end_at'),
					invalid_future_date: this.getMessage('invalid_end_at'),
				},
				{ required: false },
			),
			notes: this.validateString(this.getMessage('invalid_notes'), {
				required: false,
			}),
			/*
			 * Carried through validation rather than stripped: zod drops unknown keys, and
			 * `processForm` assigns the parsed output back over the form values — so a targets
			 * list left out of the schema would vanish from the picker on every submit.
			 * It is not part of the discount payload; `prepareParamsFromFormValues` removes it.
			 */
			targets: z.array(z.object({ id: z.number() })).default([]),
		})
		.superRefine((data, ctx) => {
			/*
			 * Every scope except `order` resolves through the target link table, so a discount
			 * without targets can never match a basket line — it is saved, looks fine in the
			 * list, and silently applies to nothing. The backend cannot enforce this: targets
			 * are written by a second call that needs the discount's id, so the row legitimately
			 * exists without them for an instant.
			 */
			if (
				data.scope !== DiscountScopeEnum.ORDER &&
				(data.targets ?? []).length === 0
			) {
				ctx.addIssue({
					path: ['targets'],
					message: this.getMessage('targets_required'),
					code: 'custom',
				});
			}

			/*
			 * A half-set range is almost certainly a mistake, and there is no safe default:
			 * guessing 0 or 23 for the missing bound would silently widen or narrow the window
			 * the user meant. Both ends or neither.
			 */
			for (const [from, to, path] of [
				[data.condition_hour_from, data.condition_hour_to, 'hour'],
				[data.condition_day_from, data.condition_day_to, 'day'],
			] as const) {
				const hasFrom = from !== null && from !== undefined;
				const hasTo = to !== null && to !== undefined;

				if (hasFrom !== hasTo) {
					ctx.addIssue({
						path: [
							hasFrom
								? `condition_${path}_to`
								: `condition_${path}_from`,
						],
						message: this.getMessage('range_needs_both_ends'),
						code: 'custom',
					});
				}
			}

			if (data.start_at && data.end_at && data.end_at <= data.start_at) {
				ctx.addIssue({
					path: ['end_at'],
					message: this.getMessage('end_at_must_be_after_start_at'),
					code: 'custom',
				});
			}

			if (
				data.type === DiscountTypeEnum.PERCENT &&
				data.value !== undefined &&
				data.value !== null &&
				(data.value < 0 || data.value > 100)
			) {
				ctx.addIssue({
					path: ['value'],
					message: this.getMessage(
						'percent_must_be_between_0_and_100',
					),
					code: 'custom',
				});
			}
		});
}

async function validateForm(values: DiscountFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'discount',
	);

	const validator = new DiscountValidator(translations);

	return validator.manage.safeParse(values);
}

function getFormValues(formData: FormData): DiscountFormValuesType {
	return {
		label: getFormDataAsString(formData, 'label'),
		scope:
			getFormDataAsEnum(formData, 'scope', DiscountScopeEnum) ||
			DiscountScopeEnum.ORDER,
		reason:
			getFormDataAsEnum(formData, 'reason', DiscountReasonEnum) ||
			DiscountReasonEnum.SPECIAL_DISCOUNT,
		reference: getFormDataAsString(formData, 'reference'),
		type:
			getFormDataAsEnum(formData, 'type', DiscountTypeEnum) ||
			DiscountTypeEnum.PERCENT,
		value: getFormDataAsNumber(formData, 'value'),
		condition_min_order_value: getFormDataAsNumber(
			formData,
			'condition_min_order_value',
		),
		condition_countries: getFormDataAsString(
			formData,
			'condition_countries',
		),
		condition_hour_from: getFormDataAsNumber(
			formData,
			'condition_hour_from',
		),
		condition_hour_to: getFormDataAsNumber(formData, 'condition_hour_to'),
		condition_day_from: getFormDataAsNumber(formData, 'condition_day_from'),
		condition_day_to: getFormDataAsNumber(formData, 'condition_day_to'),
		start_at: getFormDataAsString(formData, 'start_at'),
		end_at: getFormDataAsString(formData, 'end_at'),
		notes: getFormDataAsString(formData, 'notes'),
		// The picker renders one hidden input per selected id, which is what puts them in
		// `FormData` — `processForm` rebuilds its values from there on every submit.
		targets: formData
			.getAll('target_id')
			.map((id) => ({ id: Number(id) }))
			.filter((target) => Number.isFinite(target.id)),
	};
}

function getFormState(
	data?: DiscountModel,
): FormStateType<DiscountFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			label: data?.label ?? null,
			scope: data?.scope ?? DiscountScopeEnum.ORDER,
			reason: data?.reason ?? DiscountReasonEnum.SPECIAL_DISCOUNT,
			reference: data?.reference ?? null,
			type: data?.type ?? DiscountTypeEnum.PERCENT,
			value: data?.value ?? null,
			// Mirror of `prepareParamsFromFormValues`, which puts these back together.
			condition_min_order_value:
				data?.conditions?.min_order_value ?? null,
			condition_countries:
				data?.conditions?.applicable_countries?.join(', ') ?? null,
			condition_hour_from: data?.conditions?.hour_range?.[0] ?? null,
			condition_hour_to: data?.conditions?.hour_range?.[1] ?? null,
			condition_day_from: data?.conditions?.day_range?.[0] ?? null,
			condition_day_to: data?.conditions?.day_range?.[1] ?? null,
			start_at: toCalendarValue(data?.start_at ?? null),
			end_at: toCalendarValue(data?.end_at ?? null),
			notes: data?.notes ?? null,
			// Seeded by the form itself once `GET /discounts/:id/targets` returns.
			targets: [],
		},
	};
}

type DiscountManageOutput = ValidatorOutput<DiscountValidator, 'manage'>;

/**
 * Turns the validated `rules` text into the `jsonb` object the backend expects. The parse
 * cannot throw here — the validator has already rejected anything `JSON.parse` would choke
 * on. `undefined` (rather than `null`) for an empty box, because the backend's update path
 * copies a key only when it is present, so omitting it leaves the stored rules alone.
 */
/**
 * Rebuilds the `conditions` object from the flat form fields — the inverse of what
 * `getFormState` pulls apart.
 *
 * An absent condition is omitted rather than sent as null: the backend's schema is `.strict()`
 * over a closed key set, and "no minimum" is the absence of the key, not a null value under it.
 * When nothing is set at all the whole object is `undefined`, which is how the column reads
 * "unconditional".
 */
function buildConditions(
	data: DiscountManageOutput,
): DiscountConditions | undefined {
	const conditions: DiscountConditions = {};

	if (
		data.condition_min_order_value !== null &&
		data.condition_min_order_value !== undefined
	) {
		conditions.min_order_value = data.condition_min_order_value;
	}

	const countries = (data.condition_countries ?? '')
		.split(',')
		.map((code) => code.trim().toUpperCase())
		.filter((code) => code.length > 0);

	if (countries.length > 0) {
		conditions.applicable_countries = countries;
	}

	// The validator has already rejected a half-set range, so one end implies the other.
	if (
		data.condition_hour_from !== null &&
		data.condition_hour_from !== undefined &&
		data.condition_hour_to !== null &&
		data.condition_hour_to !== undefined
	) {
		conditions.hour_range = [
			data.condition_hour_from,
			data.condition_hour_to,
		];
	}

	if (
		data.condition_day_from !== null &&
		data.condition_day_from !== undefined &&
		data.condition_day_to !== null &&
		data.condition_day_to !== undefined
	) {
		conditions.day_range = [data.condition_day_from, data.condition_day_to];
	}

	return Object.keys(conditions).length > 0 ? conditions : undefined;
}

function prepareParamsFromFormValues(data: DiscountManageOutput) {
	// `targets` goes to its own endpoint, and the flat condition fields are folded into one
	// `conditions` object — neither belongs in the discount payload as the form holds them.
	const {
		targets: _targets,
		condition_min_order_value: _minOrderValue,
		condition_countries: _countries,
		condition_hour_from: _hourFrom,
		condition_hour_to: _hourTo,
		condition_day_from: _dayFrom,
		condition_day_to: _dayTo,
		...discount
	} = data;

	return {
		...discount,
		conditions: buildConditions(data),
	};
}

/**
 * Sends the picker's selection to `PUT /discounts/:id/targets` after the discount itself is
 * saved, as a second call in the same `operationFunction` — the pipeline supports multi-step
 * submits there, and it is the only place that knows the new id after a create.
 *
 * Only the selected scope is sent, so switching a discount from `category` to `brand` clears the
 * category links (empty array) and leaves the untouched scopes alone. `order` has no targets at
 * all, so it clears nothing and sends nothing.
 */
async function saveTargets(
	discountId: number,
	values: DiscountManageOutput,
): Promise<void> {
	if (values.scope === DiscountScopeEnum.ORDER) {
		return;
	}

	await requestUpdateDiscountTargets(discountId, {
		[values.scope]: (values.targets ?? []).map((target) => target.id),
	});
}

export type DiscountDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	scope: { value: DiscountScope | null; matchMode: 'equals' };
	reason: { value: DiscountReason | null; matchMode: 'equals' };
	type: { value: DiscountType | null; matchMode: 'equals' };
	start_at_start: { value: string | null; matchMode: 'equals' };
	start_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<DiscountModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'guide.title',
		] as const,
		'discount.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<DiscountModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'discount', 'read') ? 'view' : undefined,
			dataSource: 'discount',
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
					scope: { value: null, matchMode: 'equals' },
					reason: { value: null, matchMode: 'equals' },
					type: { value: null, matchMode: 'equals' },
					start_at_start: { value: null, matchMode: 'equals' },
					start_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies DiscountDataTableFiltersType,
			},
			// Only `id`, `label`, `start_at`, `end_at`, `created_at` and `updated_at` are
			// sortable — they are the columns the backend's `OrderByEnum` accepts.
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
					field: 'label',
					header: 'Label',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							markDeleted: true,
						}),
				},
				{
					field: 'scope',
					header: 'Scope',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.scope),
						}),
				},
				{
					field: 'reason',
					header: 'Reason',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.reason),
						}),
				},
				{
					field: 'value',
					header: 'Value',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayDiscountValue(entry),
						}),
				},
				{
					field: 'reference',
					header: 'Reference',
				},
				{
					field: 'start_at',
					header: 'Start At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
				{
					field: 'end_at',
					header: 'End At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<DiscountModel>('discount', params),
		},
		displayEntryLabel: (entry: DiscountModel) =>
			displayDiscountLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageDiscount,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['discount', 'create'],
				entriesSelection: 'free',
				operationFunction: async (values: DiscountManageOutput) => {
					const params = prepareParamsFromFormValues(values);

					const response = await requestCreate<
						DiscountModel,
						typeof params
					>('discount', params);

					if (response?.data?.id) {
						await saveTargets(response.data.id, values);
					}

					return response;
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
				windowComponent: FormManageDiscount,
				permission: ['discount', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: DiscountModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: async (
					values: DiscountManageOutput,
					id: number,
				) => {
					const params = prepareParamsFromFormValues(values);

					const response = await requestUpdate<
						DiscountModel,
						typeof params
					>('discount', params, id);

					await saveTargets(id, values);

					return response;
				},
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
				permission: ['discount', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: DiscountModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: DiscountModel) =>
					requestDelete('discount', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['discount', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: DiscountModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: DiscountModel) =>
					requestRestore('discount', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewDiscount,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['discount', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideDiscount,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['discount', 'read'],
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
