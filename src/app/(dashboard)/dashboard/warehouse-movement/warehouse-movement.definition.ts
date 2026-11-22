import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { StockVariant } from '@/app/(dashboard)/dashboard/warehouse-movement/stock-variant.component';
import { UsageGuideWarehouseMovement } from '@/app/(dashboard)/dashboard/warehouse-movement/usage-guide-warehouse-movement.component';
import { ViewWarehouseMovement } from '@/app/(dashboard)/dashboard/warehouse-movement/view-warehouse-movement.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayMovementVariant,
	displayMovementWarehouse,
	displaySignedQuantity,
	MOVEMENT_SOURCE_DATA_SOURCE,
	type WarehouseMovementModel,
	type WarehouseMovementSource,
	WarehouseMovementSourceEnum,
	type WarehouseMovementType,
	WarehouseMovementTypeEnum,
} from '@/models/warehouse-movement.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { EntityId } from '@/types/entity-id.type';

/**
 * The pickers carry their visible text (`warehouse`, `variant`) beside the id they filter on; only
 * the ids are read by the backend, which drops the rest.
 */
export type WarehouseMovementDataTableFiltersType = {
	warehouse: { value: string | null; matchMode: 'equals' };
	warehouse_id: { value: EntityId | null; matchMode: 'equals' };
	variant: { value: string | null; matchMode: 'equals' };
	variant_id: { value: EntityId | null; matchMode: 'equals' };
	movement_type: {
		value: WarehouseMovementType | null;
		matchMode: 'equals';
	};
	source_type: {
		value: WarehouseMovementSource | null;
		matchMode: 'equals';
	};
	occurred_at_start: { value: string | null; matchMode: 'equals' };
	occurred_at_end: { value: string | null; matchMode: 'equals' };
};

/**
 * The stock ledger, read-only: no create, edit or delete - every row is posted by the document
 * that moved the goods. A row opens its movement; its SKU opens that variant's stock.
 */
export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<WarehouseMovementModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			['view.title', 'stock.title', 'guide.title'] as const,
			'warehouse-movement.action',
		),
		translateBatch(
			[
				'field.id',
				'field.occurred_at',
				'field.movement_type',
				'field.variant',
				'field.warehouse',
				'field.qty',
				'field.unit_cost_base',
				'field.source',
				...enumTranslationKeys(
					'enum.movement_type',
					WarehouseMovementTypeEnum,
				),
				...enumTranslationKeys(
					'enum.source_type',
					WarehouseMovementSourceEnum,
				),
			] as const,
			'warehouse-movement',
		),
	]);

	function displayButton(
		auth: AccountModel | null,
		action: 'view' | 'stock',
	): DataTableValueOptionsType<WarehouseMovementModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'warehouse-movement', 'read')
					? action
					: undefined,
			dataSource: 'warehouse-movement',
		};
	}

	/** Opens the document behind the row's source line, when the listing resolved one. */
	function displayButtonSource(
		auth: AccountModel | null,
		entry: WarehouseMovementModel,
	): DataTableValueOptionsType<WarehouseMovementModel>['displayButton'] {
		const dataSource = MOVEMENT_SOURCE_DATA_SOURCE[entry.source_type];

		return {
			action: () =>
				entry.source_document && hasPermission(auth, dataSource, 'read')
					? 'view'
					: undefined,
			dataSource,
			alternateEntryId: entry.source_document?.id,
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 25,
				sortField: 'occurred_at',
				sortOrder: -1 as const,
				filters: {
					warehouse: { value: null, matchMode: 'equals' },
					warehouse_id: { value: null, matchMode: 'equals' },
					variant: { value: null, matchMode: 'equals' },
					variant_id: { value: null, matchMode: 'equals' },
					movement_type: { value: null, matchMode: 'equals' },
					source_type: { value: null, matchMode: 'equals' },
					occurred_at_start: { value: null, matchMode: 'equals' },
					occurred_at_end: { value: null, matchMode: 'equals' },
				} satisfies WarehouseMovementDataTableFiltersType,
			},
			columns: [
				{
					field: 'occurred_at',
					header: labels['field.occurred_at'],
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButton(auth, 'view'),
							displayDate: true,
						}),
				},
				{
					field: 'movement_type',
					header: labels['field.movement_type'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.movement_type',
								entry.movement_type,
							),
						}),
				},
				{
					field: 'variant_id',
					header: labels['field.variant'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayMovementVariant(entry),
							displayButton: displayButton(auth, 'stock'),
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
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displaySignedQuantity(entry.qty),
						}),
				},
				{
					field: 'unit_cost_base',
					header: labels['field.unit_cost_base'],
					defaultWidth: 136,
				},
				{
					field: 'source_type',
					header: labels['field.source'],
					body: (entry, column, auth) => {
						const type = translateEnumLabel(
							labels,
							'enum.source_type',
							entry.source_type,
						);
						const reference = entry.source_document?.reference;

						return DataTableValue(entry, column, {
							customValue: reference
								? `${type} ${reference}`
								: type,
							displayButton: displayButtonSource(auth, entry),
						});
					},
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<WarehouseMovementModel>(
					'warehouse-movement',
					params,
				),
		},
		displayEntryLabel: (entry: WarehouseMovementModel) =>
			`${displayMovementVariant(entry)} (#${entry.id})`,
		actions: {
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewWarehouseMovement,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['warehouse-movement', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			stock: {
				windowType: 'other',
				windowTitle: translations['stock.title'],
				windowComponent: StockVariant,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['warehouse-movement', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideWarehouseMovement,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['warehouse-movement', 'read'],
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
