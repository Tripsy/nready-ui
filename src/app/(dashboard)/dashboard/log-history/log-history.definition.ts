import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { UsageGuideLogHistory } from '@/app/(dashboard)/dashboard/log-history/usage-guide-log-history.component';
import { ViewLogHistory } from '@/app/(dashboard)/dashboard/log-history/view-log-history.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { requestDeleteMultiple, requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	LogHistoryActions,
	LogHistoryEntities,
	type LogHistoryModel,
	type LogHistorySource,
} from '@/models/log-history.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

export type LogHistoryDataTableFiltersType = {
	request_id: { value: string | null; matchMode: 'contains' };
	entity: { value: string | null; matchMode: 'equals' };
	entity_id: { value: string | null; matchMode: 'equals' };
	action: { value: string | null; matchMode: 'equals' };
	source: { value: LogHistorySource | null; matchMode: 'equals' };
	recorded_at_start: { value: string | null; matchMode: 'equals' };
	recorded_at_end: { value: string | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<LogHistoryModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			[
				'delete.title',
				'view.title',
				'viewUser.title',
				'guide.title',
			] as const,
			'log-history.action',
		),
		translateBatch(
			[
				'field.action',
				'field.entity',
				'field.entity_id',
				'field.id',
				'field.performed_by',
				'field.recorded_at',
				'field.request_id',
				...enumTranslationKeys('enum.entity', LogHistoryEntities),
				...enumTranslationKeys('enum.action', LogHistoryActions),
			] as const,
			'log-history',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<LogHistoryModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'log-history', 'read') ? 'view' : undefined,
			dataSource: 'log-history',
		};
	}

	function displayButtonViewUser(
		auth: AccountModel | null,
		entry: LogHistoryModel,
	): DataTableValueOptionsType<LogHistoryModel>['displayButton'] {
		if (!entry.auth_id) {
			return undefined;
		}

		return {
			action: () =>
				hasPermission(auth, 'user', 'read') ? 'view' : undefined,
			dataSource: 'user',
			title: translations['viewUser.title'],
			alternateEntryId: entry.auth_id,
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
					request_id: { value: null, matchMode: 'contains' },
					entity: { value: null, matchMode: 'equals' },
					entity_id: { value: null, matchMode: 'equals' },
					action: { value: null, matchMode: 'equals' },
					source: { value: null, matchMode: 'equals' },
					recorded_at_start: { value: null, matchMode: 'equals' },
					recorded_at_end: { value: null, matchMode: 'equals' },
				} satisfies LogHistoryDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: labels['field.id'],
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'request_id',
					header: labels['field.request_id'],
				},
				{
					field: 'entity',
					header: labels['field.entity'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.entity',
								entry.entity,
							),
						}),
				},
				{
					field: 'entity_id',
					header: labels['field.entity_id'],
				},
				{
					field: 'action',
					header: labels['field.action'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.action',
								entry.action,
							),
						}),
				},
				{
					field: 'performed_by',
					header: labels['field.performed_by'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: entry.auth_id
								? `${entry.performed_by} (#${entry.auth_id})`
								: entry.performed_by,
							displayButton: displayButtonViewUser(auth, entry),
						}),
				},
				{
					field: 'recorded_at',
					header: labels['field.recorded_at'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<LogHistoryModel>('log-history', params),
		},
		displayEntryLabel: (entry: LogHistoryModel) => {
			return `${entry.entity}-${entry.entity_id}`;
		},
		actions: {
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['log-history', 'delete'],
				entriesSelection: 'multiple',
				operationFunction: (ids: number[]) =>
					requestDeleteMultiple('log-history', ids),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewLogHistory,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['log-history', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideLogHistory,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['log-history', 'read'],
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
