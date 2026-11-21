import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { Configuration } from '@/config/settings.config';
import { translateBatch } from '@/config/translate.setup';
import { DisplayAmount, formatAmount } from '@/helpers/display.helper';
import { requestFind } from '@/helpers/services.helper';
import type { CostOverFloorModel } from '@/models/grn.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { DataSourceConfigType } from '@/types/data-source.type';

/**
 * Price rows whose floor - `min_price`, or `sale_price` where none is set - is under the
 * variant's cost: `GET /grns/cost-over-floor`, the list the `cost-over-floor` cron mails every
 * morning. A report, not a list of records: no filters, no actions, and one fixed order (tightest
 * first), which is the only one the backend takes.
 */
export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CostOverFloorModel>
> {
	const labels = await translateBatch(
		[
			'field.sku',
			'field.currency',
			'field.floor',
			'field.floor_base',
			'field.cost_price',
			'field.gap',
			'text.no_min_price',
		] as const,
		'cost-over-floor',
	);

	const baseCurrency = Configuration.currency();

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 25,
				// The backend lists tightest first and takes no other order
				sortField: 'gap',
				sortOrder: 1 as const,
				filters: {},
			},
			columns: [
				{
					field: 'sku',
					header: labels['field.sku'],
				},
				{
					field: 'currency',
					header: labels['field.currency'],
				},
				{
					field: 'floor',
					header: labels['field.floor'],
					body: (entry, column) => {
						const formatted = formatAmount(
							entry.min_price ?? entry.sale_price,
							entry.currency,
						);

						return DataTableValue(entry, column, {
							customValue:
								entry.min_price === null
									? `${formatted.value} ${formatted.currency} (${labels['text.no_min_price']})`
									: `${formatted.value} ${formatted.currency}`,
						});
					},
				},
				{
					field: 'floor_base',
					header: labels['field.floor_base'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayAmount({
								amount: entry.floor_base,
								currencyCode: baseCurrency,
							}),
						}),
				},
				{
					field: 'cost_price',
					header: labels['field.cost_price'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayAmount({
								amount: entry.cost_price,
								currencyCode: baseCurrency,
							}),
						}),
				},
				{
					// Floor less cost, in base currency - negative on every row listed
					field: 'gap',
					header: labels['field.gap'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayAmount({
								amount:
									Math.round(
										(entry.floor_base - entry.cost_price) *
											100,
									) / 100,
								currencyCode: baseCurrency,
							}),
						}),
				},
			],
			// The rows carry no id, and a variant appears once per currency, so the row's position
			// in the report stands in - what the table keys an entry on
			find: async (params: FindFunctionParamsType) => {
				const response = await requestFind<
					Omit<CostOverFloorModel, 'id'>
				>('cost-over-floor', params);

				const offset = ((params.page ?? 1) - 1) * (params.limit ?? 0);

				return (
					response && {
						...response,
						entries: response.entries.map((entry, index) => ({
							...entry,
							id: offset + index + 1,
						})),
					}
				);
			},
		},
		displayEntryLabel: (entry: CostOverFloorModel) =>
			`${entry.sku} (${entry.currency})`,
	};
}
