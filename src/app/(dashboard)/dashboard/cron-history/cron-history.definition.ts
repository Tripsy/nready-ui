import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { ViewCronHistory } from '@/app/(dashboard)/dashboard/cron-history/view-cron-history.component';
import { translateBatch } from '@/config/translate.setup';
import { requestDeleteMultiple, requestFind } from '@/helpers/services.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import type {
	CronHistoryModel,
	CronHistoryStatus,
} from '@/models/cron-history.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

export type CronHistoryDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: CronHistoryStatus | null; matchMode: 'equals' };
	start_at_start: { value: string | null; matchMode: 'equals' };
	start_at_end: { value: string | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CronHistoryModel>
> {
	const translations = await translateBatch(
		['view.title', 'delete.title'] as const,
		'cron-history.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<CronHistoryModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'cron-history', 'read')
					? 'view'
					: undefined,
			dataSource: 'cron-history',
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
					start_at_start: { value: null, matchMode: 'equals' },
					start_at_end: { value: null, matchMode: 'equals' },
				} satisfies CronHistoryDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'label',
					header: 'Label',
					sortable: true,
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
					field: 'status',
					header: 'Status',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							isStatus: true,
							dataSource: 'cron-history',
						}),
					minWidth: 144,
					maxWidth: 144,
				},
				{
					field: 'run_time',
					header: 'Run time',
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<CronHistoryModel>('cron-history', params),
		},
		displayEntryLabel: (entry: CronHistoryModel) => {
			return entry.label;
		},
		actions: {
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['cron-history', 'delete'],
				entriesSelection: 'multiple',
				operationFunction: (ids: number[]) =>
					requestDeleteMultiple('cron-history', ids),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCronHistory,
				windowConfigProps: {
					size: 'x2l',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['cron-history', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
