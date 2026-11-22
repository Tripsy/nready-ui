import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageStockAdjustment,
	type StockAdjustmentFormValuesType,
} from '@/app/(dashboard)/dashboard/stock-adjustment/form-manage-stock-adjustment.component';
import { UsageGuideStockAdjustment } from '@/app/(dashboard)/dashboard/stock-adjustment/usage-guide-stock-adjustment.component';
import { ViewStockAdjustment } from '@/app/(dashboard)/dashboard/stock-adjustment/view-stock-adjustment.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestFind,
	requestView,
} from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	STOCK_ADJUSTMENT_NOTES_MAX,
	STOCK_ADJUSTMENT_QUANTITY_MAX,
	STOCK_ADJUSTMENT_REASONS,
	type StockAdjustmentDirection,
	StockAdjustmentDirectionEnum,
	type StockAdjustmentModel,
	type StockAdjustmentReason,
	StockAdjustmentReasonEnum,
	type StockAdjustmentStatus,
	StockAdjustmentStatusEnum,
} from '@/models/stock-adjustment.model';
import {
	displayMovementVariant,
	displayMovementWarehouse,
	displaySignedQuantity,
} from '@/models/warehouse-movement.model';
import { requestReverseStockAdjustment } from '@/services/stock-adjustment.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { EntityId } from '@/types/entity-id.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_warehouse_id',
	'invalid_variant_id',
	'invalid_direction',
	'invalid_qty',
	'invalid_reason',
	'reason_direction',
	'invalid_notes',
] as const;

/**
 * Mirrors the backend's `stock-adjustment.validator.ts`
 * (`../nready-api/src/features/warehouse-movement`). Whether the warehouse holds enough to remove,
 * or its lots have room for what is added, is the backend's to answer with a 409 naming the
 * figures.
 */
class StockAdjustmentValidator extends BaseValidator<typeof validatorMessages> {
	manage = () =>
		z
			.object({
				warehouse_id: this.validateId(
					this.getMessage('invalid_warehouse_id'),
				),
				variant_id: this.validateId(
					this.getMessage('invalid_variant_id'),
				),
				direction: this.validateEnum(
					StockAdjustmentDirectionEnum,
					this.getMessage('invalid_direction'),
				),
				qty: this.validateNumber(this.getMessage('invalid_qty'), {
					required: true,
					onlyPositive: true,
					allowDecimals: 2,
				}).refine((value) => value <= STOCK_ADJUSTMENT_QUANTITY_MAX, {
					message: this.getMessage('invalid_qty'),
				}),
				reason: this.validateEnum(
					StockAdjustmentReasonEnum,
					this.getMessage('invalid_reason'),
				),
				notes: z
					.string()
					.max(STOCK_ADJUSTMENT_NOTES_MAX, {
						message: this.getMessage('invalid_notes'),
					})
					.nullable(),
			})
			.superRefine((data, ctx) => {
				if (
					!STOCK_ADJUSTMENT_REASONS[data.direction].includes(
						data.reason,
					)
				) {
					ctx.addIssue({
						path: ['reason'],
						message: this.getMessage('reason_direction'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(values: StockAdjustmentFormValuesType) {
	const validator = new StockAdjustmentValidator(
		await resolveValidatorMessages(validatorMessages, 'stock-adjustment'),
	);

	return validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): StockAdjustmentFormValuesType {
	return {
		warehouse_id: getFormDataAsString(formData, 'warehouse_id'),
		variant_id: getFormDataAsString(formData, 'variant_id'),
		direction:
			getFormDataAsEnum(
				formData,
				'direction',
				StockAdjustmentDirectionEnum,
			) ?? StockAdjustmentDirectionEnum.REMOVE,
		qty: getFormDataAsNumber(formData, 'qty'),
		reason: getFormDataAsEnum(
			formData,
			'reason',
			StockAdjustmentReasonEnum,
		),
		notes: getFormDataAsString(formData, 'notes'),
		warehouse: getFormDataAsString(formData, 'warehouse_label'),
		variant: getFormDataAsString(formData, 'variant_label'),
	};
}

/**
 * Seeded from a prefill when the window is opened from a variant's stock - that warehouse and
 * that variant, picked already - and empty otherwise. Opens on `remove`, the common case: goods
 * break and go missing far more often than they turn up.
 */
function getFormState(
	prefill?: Partial<StockAdjustmentModel>,
): FormStateType<StockAdjustmentFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			warehouse_id: prefill?.warehouse_id ?? null,
			variant_id: prefill?.variant_id ?? null,
			direction: StockAdjustmentDirectionEnum.REMOVE,
			qty: null,
			reason: null,
			notes: null,
			warehouse: prefill?.warehouse
				? `${prefill.warehouse.code} - ${prefill.warehouse.name}`
				: null,
			variant: prefill?.variant?.sku ?? null,
		},
	};
}

/** The labels are the pickers' own; empty notes are left out rather than sent blank. */
function prepareParamsFromFormValues(values: StockAdjustmentFormValuesType) {
	const {
		warehouse: _warehouse,
		variant: _variant,
		notes,
		...params
	} = values;

	return {
		...params,
		...(notes ? { notes: notes } : {}),
	};
}

export type StockAdjustmentDataTableFiltersType = {
	warehouse: { value: string | null; matchMode: 'equals' };
	warehouse_id: { value: EntityId | null; matchMode: 'equals' };
	variant: { value: string | null; matchMode: 'equals' };
	variant_id: { value: EntityId | null; matchMode: 'equals' };
	adjustment_direction: {
		value: StockAdjustmentDirection | null;
		matchMode: 'equals';
	};
	reason: { value: StockAdjustmentReason | null; matchMode: 'equals' };
	status: { value: StockAdjustmentStatus | null; matchMode: 'equals' };
	created_at_start: { value: string | null; matchMode: 'equals' };
	created_at_end: { value: string | null; matchMode: 'equals' };
};

/**
 * Stock added or removed by hand. Nothing here is edited or deleted: an adjustment is posted, and
 * a wrong one is reversed - which puts the units back and leaves both on the record.
 */
export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<StockAdjustmentModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			[
				'create.title',
				'reverse.title',
				'view.title',
				'guide.title',
			] as const,
			'stock-adjustment.action',
		),
		translateBatch(
			[
				'field.id',
				'field.created_at',
				'field.variant',
				'field.warehouse',
				'field.qty',
				'field.reason',
				'field.status',
				...enumTranslationKeys(
					'enum.reason',
					StockAdjustmentReasonEnum,
				),
			] as const,
			'stock-adjustment',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<StockAdjustmentModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'stock-adjustment', 'read')
					? 'view'
					: undefined,
			dataSource: 'stock-adjustment',
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 25,
				sortField: 'created_at',
				sortOrder: -1 as const,
				filters: {
					warehouse: { value: null, matchMode: 'equals' },
					warehouse_id: { value: null, matchMode: 'equals' },
					variant: { value: null, matchMode: 'equals' },
					variant_id: { value: null, matchMode: 'equals' },
					adjustment_direction: { value: null, matchMode: 'equals' },
					reason: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					created_at_start: { value: null, matchMode: 'equals' },
					created_at_end: { value: null, matchMode: 'equals' },
				} satisfies StockAdjustmentDataTableFiltersType,
			},
			columns: [
				{
					field: 'created_at',
					header: labels['field.created_at'],
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
							displayDate: true,
						}),
				},
				{
					field: 'variant_id',
					header: labels['field.variant'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayMovementVariant(entry),
						}),
				},
				{
					field: 'warehouse_id',
					header: labels['field.warehouse'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayMovementWarehouse(entry),
						}),
				},
				{
					field: 'qty',
					header: labels['field.qty'],
					defaultWidth: 112,
					sortable: true,
					// Signed, so the column says the direction without one of its own
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displaySignedQuantity(entry.qty),
						}),
				},
				{
					field: 'reason',
					header: labels['field.reason'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.reason',
								entry.reason,
							),
						}),
				},
				{
					field: 'status',
					header: labels['field.status'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							dataSource: 'stock-adjustment',
							isStatus: true,
						}),
					minWidth: 128,
					maxWidth: 128,
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<StockAdjustmentModel>('stock-adjustment', params),
		},
		displayEntryLabel: (entry: StockAdjustmentModel) =>
			// The SKU alone - the windows add the id themselves
			displayMovementVariant(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageStockAdjustment,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['stock-adjustment', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: StockAdjustmentFormValuesType) =>
					requestCreate<
						StockAdjustmentModel,
						ReturnType<typeof prepareParamsFromFormValues>
					>('stock-adjustment', prepareParamsFromFormValues(params)),
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			reverse: {
				windowType: 'action',
				windowTitle: translations['reverse.title'],
				permission: ['stock-adjustment', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: StockAdjustmentModel) =>
					entry.status === StockAdjustmentStatusEnum.CREATED,
				operationFunction: async (
					entry: StockAdjustmentModel,
				): Promise<ApiResponseFetch<null>> => {
					const response = await requestReverseStockAdjustment(
						entry.id,
					);

					return response && { ...response, data: null };
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewStockAdjustment,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['stock-adjustment', 'read'],
				entriesSelection: 'single',
				// The list carries no movements - only the read does
				reloadEntry: (id: EntityId) =>
					requestView<StockAdjustmentModel>('stock-adjustment', id),
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideStockAdjustment,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['stock-adjustment', 'read'],
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
