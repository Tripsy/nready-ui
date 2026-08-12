import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { ViewMailQueue } from '@/app/(dashboard)/dashboard/mail-queue/view-mail-queue.component';
import { translateBatch } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { requestDeleteMultiple, requestFind } from '@/helpers/services.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import type {
	MailQueueModel,
	MailQueueStatus,
} from '@/models/mail-queue.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

export type MailQueueDataTableFiltersType = {
	status: { value: MailQueueStatus | null; matchMode: 'equals' };
	template: { value: string | null; matchMode: 'contains' };
	content: { value: string | null; matchMode: 'contains' };
	to: { value: string | null; matchMode: 'contains' };
	sent_at_start: { value: string | null; matchMode: 'equals' };
	sent_at_end: { value: string | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<MailQueueModel>
> {
	const translations = await translateBatch(
		['delete.title', 'view.title', 'viewTemplate.label'] as const,
		'mail-queue.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<MailQueueModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'mail-queue', 'read') ? 'view' : undefined,
			dataSource: 'mail-queue',
		};
	}

	function displayButtonViewTemplate(
		auth: AuthModel | null,
		entry: MailQueueModel,
	): DataTableValueOptionsType<MailQueueModel>['displayButton'] {
		if (!entry.template) {
			return undefined;
		}

		return {
			action: () =>
				hasPermission(auth, 'template', 'read') ? 'view' : undefined,
			dataSource: 'template',
			title: translations['viewTemplate.label'],
			alternateEntryId: entry.template.id,
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
					status: { value: null, matchMode: 'equals' },
					template: { value: null, matchMode: 'contains' },
					content: { value: null, matchMode: 'contains' },
					to: { value: null, matchMode: 'contains' },
					sent_at_start: { value: null, matchMode: 'equals' },
					sent_at_end: { value: null, matchMode: 'equals' },
				} satisfies MailQueueDataTableFiltersType,
			},
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
					field: 'template',
					header: 'Template',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: entry.template?.label || 'n/a',
							displayButton: displayButtonViewTemplate(
								auth,
								entry,
							),
						}),
				},
				{
					field: 'to',
					header: 'To',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.to.address,
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							isStatus: true,
							dataSource: 'mail-queue',
						}),
					minWidth: 144,
					maxWidth: 144,
				},
				{
					field: 'sent_at',
					header: 'Sent At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<MailQueueModel>('mail-queue', params),
		},
		displayEntryLabel: (entry: MailQueueModel) => {
			return formatDate(entry.sent_at) || '';
		},
		actions: {
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['mail-queue', 'delete'],
				entriesSelection: 'multiple',
				operationFunction: (ids: number[]) =>
					requestDeleteMultiple('mail-queue', ids),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewMailQueue,
				windowConfigProps: {
					size: 'x4l',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['mail-queue', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
