import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { StockVariant } from '@/app/(dashboard)/dashboard/warehouse-movement/stock-variant.component';
import { translateBatch } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import type { LowStockModel } from '@/models/warehouse-movement.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

/**
 * Tracked variants at or under their own low-stock threshold, on what is available to sell -
 * `GET /warehouse-movements/low-stock`. A report, not a list of records: no filters, and one fixed
 * order (lowest available first), which is the only one the backend takes. Each row opens the
 * variant's stock.
 */
export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<LowStockModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(['stock.title'] as const, 'low-stock.action'),
		translateBatch(
			[
				'field.sku',
				'field.available',
				'field.on_hand',
				'field.reserved',
				'field.low_stock_threshold',
			] as const,
			'warehouse-movement',
		),
	]);

	function displayButtonStock(
		auth: AccountModel | null,
	): DataTableValueOptionsType<LowStockModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'warehouse-movement', 'read')
					? 'stock'
					: undefined,
			dataSource: 'low-stock',
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 25,
				// The backend lists lowest available first and takes no other order
				sortField: 'available',
				sortOrder: 1 as const,
				filters: {},
			},
			columns: [
				{
					field: 'sku',
					header: labels['field.sku'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonStock(auth),
						}),
				},
				{
					field: 'available',
					header: labels['field.available'],
				},
				{
					field: 'low_stock_threshold',
					header: labels['field.low_stock_threshold'],
				},
				{
					field: 'on_hand',
					header: labels['field.on_hand'],
				},
				{
					field: 'reserved',
					header: labels['field.reserved'],
				},
			],
			// The rows carry no id; the variant's stands in, which is what the table and the
			// window stack key an entry on
			find: async (params: FindFunctionParamsType) => {
				const response = await requestFind<Omit<LowStockModel, 'id'>>(
					'low-stock',
					params,
				);

				return (
					response && {
						...response,
						entries: response.entries.map((entry) => ({
							...entry,
							id: entry.variant_id,
						})),
					}
				);
			},
		},
		displayEntryLabel: (entry: LowStockModel) => entry.sku,
		actions: {
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
		},
	};
}
