import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageGrn,
	type GrnFormValuesType,
	type GrnItemFormType,
	nextGrnItemKey,
} from '@/app/(dashboard)/dashboard/grn/form-manage-grn.component';
import { StatusTransitionGrn } from '@/app/(dashboard)/dashboard/grn/status-transition-grn.component';
import { UsageGuideGrn } from '@/app/(dashboard)/dashboard/grn/usage-guide-grn.component';
import { ViewGrn } from '@/app/(dashboard)/dashboard/grn/view-grn.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { toCalendarValue } from '@/helpers/date.helper';
import {
	getFormDataAsJsonList,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayGrnLabel,
	displayGrnReference,
	GRN_ITEMS_MAX,
	GRN_LOT_CODE_MAX,
	GRN_STATUS_TRANSITIONS,
	GRN_SUPPLIER_DOCUMENT_MAX,
	type GrnModel,
	type GrnStatus,
	GrnStatusEnum,
} from '@/models/grn.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { EntityId } from '@/types/entity-id.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_warehouse_id',
	'invalid_vendor_id',
	'invalid_supplier_document_number',
	'invalid_received_at',
	'invalid_currency',
	'invalid_exchange_rate',
	'invalid_items',
	'duplicate_variant',
	'invalid_variant_id',
	'invalid_qty',
	'invalid_unit_cost',
	'invalid_vat_rate',
	'invalid_lot_code',
] as const;

/** Mirrors the backend's `grn.validator.ts` - see `../nready-api/src/features/grn`. */
class GrnValidator extends BaseValidator<typeof validatorMessages> {
	/**
	 * One received line. Whether the variant exists and tracks stock is a data question the backend
	 * answers with a 422 naming it; this schema owns the shape and the figures.
	 */
	private item = () =>
		z.object({
			variant_id: this.validateId(this.getMessage('invalid_variant_id')),
			qty: this.validateNumber(this.getMessage('invalid_qty'), {
				required: true,
				onlyPositive: true,
				allowDecimals: 2,
			}),
			// Zero is accepted, like the backend: free samples are received at no cost
			unit_cost: this.validateNumber(
				this.getMessage('invalid_unit_cost'),
				{
					required: true,
					onlyPositive: false,
					allowDecimals: 2,
				},
			).refine((value) => value >= 0, {
				message: this.getMessage('invalid_unit_cost'),
			}),
			vat_rate: this.validateNumber(this.getMessage('invalid_vat_rate'), {
				required: false,
				onlyPositive: false,
				allowDecimals: 2,
			}).refine(
				(value) =>
					value === null ||
					value === undefined ||
					(value >= 0 && value <= 100),
				{ message: this.getMessage('invalid_vat_rate') },
			),
			lot_code: z
				.string()
				.max(GRN_LOT_CODE_MAX, {
					message: this.getMessage('invalid_lot_code'),
				})
				.nullable(),
			expires_at: z.string().nullable(),
			notes: z.string().nullable(),
		});

	private header = () =>
		z.object({
			warehouse_id: this.validateId(
				this.getMessage('invalid_warehouse_id'),
			),
			vendor_id: this.validateId(this.getMessage('invalid_vendor_id')),
			supplier_document_number: z
				.string()
				.max(GRN_SUPPLIER_DOCUMENT_MAX, {
					message: this.getMessage(
						'invalid_supplier_document_number',
					),
				})
				.nullable(),
			received_at: this.validateString(
				this.getMessage('invalid_received_at'),
			),
			currency: this.validateString(this.getMessage('invalid_currency')),
			exchange_rate: this.validateNumber(
				this.getMessage('invalid_exchange_rate'),
				{ required: false, onlyPositive: true, allowDecimals: 6 },
			),
			notes: z.string().nullable(),
			/*
			 * Carried through so the parsed output keeps it: the pipeline hands the schema's
			 * output - not the raw values - to `operationFunction`, and
			 * `prepareParamsFromFormValues` reads it to decide what may be sent.
			 */
			status: z.string().nullable(),
			items: z.array(this.item()).max(GRN_ITEMS_MAX, {
				message: this.getMessage('invalid_items'),
			}),
		});

	/**
	 * What a confirmed receipt may still change. Built from the bare object: zod refuses `.pick()`
	 * on a schema that carries refinements.
	 */
	manageLocked = () =>
		this.header().pick({
			supplier_document_number: true,
			notes: true,
			status: true,
		});

	manage = () =>
		this.header()
			/*
			 * One line per variant - the backend's unique index allows no second one, and a second
			 * lot of the same variant is entered as a separate receipt.
			 */
			.superRefine((data, ctx) => {
				const seen = new Set<EntityId>();

				for (const item of data.items) {
					// An unpicked row is reported on its own field; it duplicates nothing
					if (item.variant_id === null) {
						continue;
					}

					if (seen.has(item.variant_id)) {
						ctx.addIssue({
							path: ['items'],
							message: this.getMessage('duplicate_variant'),
							code: 'custom',
						});

						return;
					}

					seen.add(item.variant_id);
				}
			});
}

async function validateForm(values: GrnFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'grn',
	);

	const validator = new GrnValidator(translations);

	/*
	 * A confirmed receipt sends only the supplier document number and the notes (see
	 * `prepareParamsFromFormValues`), so the rest - including lines it can no longer change - is
	 * not judged here either: a stored value that predates a validator rule would otherwise block
	 * the one edit still allowed.
	 */
	if (values.status && values.status !== GrnStatusEnum.DRAFT) {
		return validator.manageLocked().safeParse(values);
	}

	return validator.manage().safeParse(values);
}

/**
 * The autocomplete labels and the status are the form's own; the backend takes the ids alone. They
 * stay in the values so a failed submit redraws each box with what was picked.
 */
function getFormValues(formData: FormData): GrnFormValuesType {
	return {
		warehouse_id: getFormDataAsString(formData, 'warehouse_id'),
		vendor_id: getFormDataAsString(formData, 'vendor_id'),
		supplier_document_number: getFormDataAsString(
			formData,
			'supplier_document_number',
		),
		received_at: getFormDataAsString(formData, 'received_at'),
		currency: getFormDataAsString(formData, 'currency'),
		exchange_rate: getFormDataAsNumber(formData, 'exchange_rate'),
		notes: getFormDataAsString(formData, 'notes'),
		items: getFormDataAsJsonList<GrnItemFormType>(formData, 'items'),
		warehouse: getFormDataAsString(formData, 'warehouse_label'),
		vendor: getFormDataAsString(formData, 'vendor_label'),
		status: (getFormDataAsString(formData, 'status') ||
			null) as GrnStatus | null,
	};
}

function getFormState(data?: GrnModel): FormStateType<GrnFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			warehouse_id: data?.warehouse_id ?? null,
			vendor_id: data?.vendor_id ?? null,
			supplier_document_number: data?.supplier_document_number ?? null,
			received_at: data?.received_at
				? toCalendarValue(data.received_at)
				: null,
			currency: data?.currency ?? null,
			// Shown only for a foreign currency, where 1 would be a real (and wrong) rate
			exchange_rate:
				data && Number(data.exchange_rate) !== 1
					? Number(data.exchange_rate)
					: null,
			notes: data?.notes ?? null,
			items:
				data?.items?.map((item) => ({
					variant_id: item.variant_id,
					qty: Number(item.qty),
					unit_cost: Number(item.unit_cost),
					vat_rate: Number(item.vat_rate),
					lot_code: item.lot_code,
					expires_at: item.expires_at
						? toCalendarValue(item.expires_at)
						: null,
					notes: item.notes,
					label: item.sku
						? item.label
							? `${item.sku} - ${item.label}`
							: item.sku
						: `#${item.variant_id}`,
					key: nextGrnItemKey(),
				})) ?? [],
			warehouse: data?.warehouse
				? `${data.warehouse.code} - ${data.warehouse.name}`
				: null,
			vendor: data?.vendor?.name ?? null,
			status: data?.status ?? null,
		},
	};
}

/**
 * Strips the display-only fields; the backend takes the ids alone.
 *
 * **A confirmed receipt sends only `supplier_document_number` and `notes`.** The backend answers
 * 409 to anything else once stock has moved, rather than dropping it - so resending the unchanged
 * header would fail every edit.
 *
 * An empty exchange rate is left out rather than sent as null: the API reads an absent rate as
 * "use the published one for the receiving day".
 */
function prepareParamsFromFormValues(values: GrnFormValuesType) {
	if (values.status && values.status !== GrnStatusEnum.DRAFT) {
		return {
			supplier_document_number: values.supplier_document_number,
			notes: values.notes,
		};
	}

	const {
		warehouse: _warehouse,
		vendor: _vendor,
		status: _status,
		exchange_rate,
		items,
		...params
	} = values;

	return {
		...params,
		...(exchange_rate === null || exchange_rate === undefined
			? {}
			: { exchange_rate: exchange_rate }),
		items: items.map(({ label: _label, key: _key, ...item }) => item),
	};
}

/** Whether the receipt has a status left to move to, read from the map the backend enforces. */
const canMoveGrn = (entry: GrnModel): boolean =>
	getStatusTransitions(entry.status, GRN_STATUS_TRANSITIONS).length > 0;

export type GrnDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: GrnStatus | null; matchMode: 'equals' };
	// The label is the autocomplete's text, kept so a redrawn filter bar still shows the pick
	warehouse: { value: string | null; matchMode: 'equals' };
	warehouse_id: { value: EntityId | null; matchMode: 'equals' };
	vendor: { value: string | null; matchMode: 'equals' };
	vendor_id: { value: EntityId | null; matchMode: 'equals' };
	received_at_start: { value: string | null; matchMode: 'equals' };
	received_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<GrnModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			[
				'create.title',
				'update.title',
				'view.title',
				'delete.title',
				'restore.title',
				'statusTransition.title',
				'guide.title',
			] as const,
			'grn.action',
		),
		translateBatch(
			[
				'field.id',
				'field.reference',
				'field.supplier_document_number',
				'field.warehouse',
				'field.vendor',
				'field.received_at',
				'field.status',
				'field.created_at',
			] as const,
			'grn',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<GrnModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'grn', 'read') ? 'view' : undefined,
			dataSource: 'grn',
		};
	}

	/**
	 * The badge opens the transition window: a draft can go two ways, and a deleted row offers a
	 * restore instead. A canceled receipt offers nothing, so the badge stops being a button.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<GrnModel>['displayButton'] {
		return {
			action: (entry: GrnModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'grn', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'grn', 'update')) {
					return undefined;
				}

				return canMoveGrn(entry) ? 'statusTransition' : undefined;
			},
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
					status: { value: null, matchMode: 'equals' },
					warehouse: { value: null, matchMode: 'equals' },
					warehouse_id: { value: null, matchMode: 'equals' },
					vendor: { value: null, matchMode: 'equals' },
					vendor_id: { value: null, matchMode: 'equals' },
					received_at_start: { value: null, matchMode: 'equals' },
					received_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies GrnDataTableFiltersType,
			},
			columns: [
				{
					field: 'ref_number',
					header: labels['field.reference'],
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
							customValue: displayGrnReference(entry),
						}),
				},
				{
					field: 'supplier_document_number',
					header: labels['field.supplier_document_number'],
				},
				{
					field: 'warehouse_id',
					header: labels['field.warehouse'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.warehouse
								? `${entry.warehouse.code} - ${entry.warehouse.name}`
								: `#${entry.warehouse_id}`,
						}),
				},
				{
					field: 'vendor_id',
					header: labels['field.vendor'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue:
								entry.vendor?.name ?? `#${entry.vendor_id}`,
						}),
				},
				{
					field: 'received_at',
					header: labels['field.received_at'],
					sortable: true,
					/*
					 * A calendar day, sent as midnight UTC. Read off the string rather than formatted
					 * in the browser's zone, which would show an hour here and the day before west of
					 * UTC.
					 */
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue:
								toCalendarValue(entry.received_at) ?? '-',
						}),
				},
				{
					field: 'status',
					header: labels['field.status'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'grn',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'created_at',
					header: labels['field.created_at'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<GrnModel>('grn', params),
		},
		displayEntryLabel: (entry: GrnModel) => displayGrnLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageGrn,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['grn', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: GrnFormValuesType) =>
					requestCreate<
						GrnModel,
						ReturnType<typeof prepareParamsFromFormValues>
					>('grn', prepareParamsFromFormValues(params)),
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
				windowComponent: FormManageGrn,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['grn', 'update'],
				entriesSelection: 'single',
				// A canceled receipt takes no change at all
				customEntryCheck: (entry: GrnModel) =>
					!entry.deleted_at &&
					entry.status !== GrnStatusEnum.CANCELED,
				/*
				 * The listing carries no `items` - only the read does - so the form re-fetches the
				 * row first. Seeding it from the table row would submit an empty line set and wipe
				 * the draft's lines.
				 */
				reloadEntry: (id: EntityId) => requestView<GrnModel>('grn', id),
				operationFunction: (params: GrnFormValuesType, id: EntityId) =>
					requestUpdate<
						GrnModel,
						ReturnType<typeof prepareParamsFromFormValues>
					>('grn', prepareParamsFromFormValues(params), id),
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
				permission: ['grn', 'delete'],
				entriesSelection: 'single',
				// A confirmed receipt holds open lots; the backend refuses and asks for a cancel
				customEntryCheck: (entry: GrnModel) =>
					!entry.deleted_at &&
					entry.status !== GrnStatusEnum.CONFIRMED,
				operationFunction: (entry: GrnModel) =>
					requestDelete('grn', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['grn', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: GrnModel) => !!entry.deleted_at,
				operationFunction: (entry: GrnModel) =>
					requestRestore('grn', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionGrn,
				permission: ['grn', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: GrnModel) =>
					!entry.deleted_at && canMoveGrn(entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Action.StatusTransition,
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewGrn,
				windowConfigProps: {
					size: 'xl3',
				},
				permission: ['grn', 'read'],
				entriesSelection: 'single',
				// The lines are on the read only, as above
				reloadEntry: (id: EntityId) => requestView<GrnModel>('grn', id),
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideGrn,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['grn', 'read'],
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
