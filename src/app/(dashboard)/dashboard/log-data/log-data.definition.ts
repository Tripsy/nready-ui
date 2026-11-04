import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { UsageGuideLogData } from '@/app/(dashboard)/dashboard/log-data/usage-guide-log-data.component';
import { ViewLogData } from '@/app/(dashboard)/dashboard/log-data/view-log-data.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { requestDeleteMultiple, requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	type LogCategory,
	LogCategoryEnum,
	type LogDataModel,
	type LogLevel,
	LogLevelEnum,
} from '@/models/log-data.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

export type LogDataDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	level: { value: LogLevel | null; matchMode: 'equals' };
	category: { value: LogCategory | null; matchMode: 'equals' };
	create_at_start: { value: string | null; matchMode: 'equals' };
	create_at_end: { value: string | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<LogDataModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			['view.title', 'delete.title', 'guide.title'] as const,
			'log-data.action',
		),
		translateBatch(
			[
				'field.category',
				'field.created_at',
				'field.id',
				'field.level',
				'field.message',
				...enumTranslationKeys('enum.category', LogCategoryEnum),
				...enumTranslationKeys('enum.level', LogLevelEnum),
			] as const,
			'log-data',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<LogDataModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'log-data', 'read') ? 'view' : undefined,
			dataSource: 'log-data',
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
					level: { value: null, matchMode: 'equals' },
					category: { value: null, matchMode: 'equals' },
					create_at_start: { value: null, matchMode: 'equals' },
					create_at_end: { value: null, matchMode: 'equals' },
				} satisfies LogDataDataTableFiltersType,
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
					field: 'category',
					header: labels['field.category'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.category',
								entry.category,
							),
						}),
				},
				{
					field: 'level',
					header: labels['field.level'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.level',
								entry.level,
							),
						}),
				},
				{
					field: 'message',
					header: labels['field.message'],
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
				requestFind<LogDataModel>('log-data', params),
		},
		displayEntryLabel: (entry: LogDataModel) => {
			return entry.pid;
		},
		actions: {
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['log-data', 'delete'],
				entriesSelection: 'multiple',
				operationFunction: (ids: number[]) =>
					requestDeleteMultiple('log-data', ids),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewLogData,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['log-data', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideLogData,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['log-data', 'read'],
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
