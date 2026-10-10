import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { UsageGuideClientLedger } from '@/app/(dashboard)/dashboard/client-ledger/usage-guide-client-ledger.component';
import { Icons } from '@/components/icon.component';
import { Configuration } from '@/config/settings.config';
import { translateBatch } from '@/config/translate.setup';
import { DisplayAmount, formatAmount } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import type {
	ClientLedgerEntryModel,
	ClientLedgerEntryType,
} from '@/models/client-ledger.model';
import { requestClientLedgerEntries } from '@/services/client-ledger.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Currency } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

/**
 * `client` is the label the autocomplete shows and `client_id` what is sent; the API reads the id
 * from the path, so the filter is meaningless without it. Sortable fields are the API's
 * `OrderByEnum`: `id`, `occurred_at`, `amount`.
 */
export type ClientLedgerDataTableFiltersType = {
	client: { value: string; matchMode: 'equals' };
	client_id: { value: number | null; matchMode: 'equals' };
	entry_type: { value: ClientLedgerEntryType | null; matchMode: 'equals' };
	currency: { value: Currency | null; matchMode: 'equals' };
	occurred_at_start: { value: string | null; matchMode: 'equals' };
	occurred_at_end: { value: string | null; matchMode: 'equals' };
};

/** The listing before a client is picked - answered here rather than by a request the API would reject. */
const NO_CLIENT_RESPONSE = {
	entries: [],
	pagination: { page: 1, limit: 0, total: 0 },
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ClientLedgerEntryModel>
> {
	const translations = await translateBatch(
		['guide.title'] as const,
		'client-ledger.action',
	);

	function displayButtonCashFlow(
		auth: AccountModel | null,
		entry: ClientLedgerEntryModel,
	): DataTableValueOptionsType<ClientLedgerEntryModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'cash-flow', 'read') ? 'view' : undefined,
			dataSource: 'cash-flow',
			// Loads the cash flow by id - the entry only carries the key
			alternateEntryId: entry.cash_flow_id,
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'occurred_at',
				sortOrder: -1 as const,
				filters: {
					client: { value: '', matchMode: 'equals' },
					client_id: { value: null, matchMode: 'equals' },
					entry_type: { value: null, matchMode: 'equals' },
					currency: { value: null, matchMode: 'equals' },
					occurred_at_start: { value: null, matchMode: 'equals' },
					occurred_at_end: { value: null, matchMode: 'equals' },
				} satisfies ClientLedgerDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
				},
				{
					field: 'entry_type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.entry_type),
						}),
				},
				{
					field: 'amount',
					header: 'Amount',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayAmount({
								amount: entry.amount,
								currencyCode: entry.currency,
							}),
						}),
				},
				{
					field: 'amount_base',
					header: 'Base Amount',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// In the deployment base currency, at the rate frozen on the row
							customValue: DisplayAmount({
								amount: entry.amount_base,
								currencyCode: Configuration.currency(),
							}),
						}),
				},
				{
					field: 'cash_flow_id',
					header: 'Cash Flow',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonCashFlow(auth, entry),
						}),
				},
				{
					field: 'occurred_at',
					header: 'Occurred At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) => {
				const clientId = Number(params.filter?.client_id);

				if (!clientId) {
					return Promise.resolve(NO_CLIENT_RESPONSE);
				}

				return requestClientLedgerEntries(clientId, params);
			},
		},
		displayEntryLabel: (entry: ClientLedgerEntryModel) => {
			const formatted = formatAmount(entry.amount, entry.currency);

			return `${formatEnumLabel(entry.entry_type)} ${formatted.value} ${formatted.currency}`;
		},
		actions: {
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideClientLedger,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['client-ledger', 'read'],
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
