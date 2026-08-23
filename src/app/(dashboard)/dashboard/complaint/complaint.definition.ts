import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { ViewComplaint } from '@/app/(dashboard)/dashboard/complaint/view-complaint.component';
import { translateBatch } from '@/config/translate.setup';
import {
	requestDelete,
	requestFind,
	requestRestore,
} from '@/helpers/services.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type ComplaintEntityType,
	type ComplaintModel,
	type ComplaintReason,
	displayComplaintLabel,
	displayComplaintReporter,
	displayComplaintTarget,
} from '@/models/complaint.model';
import { requestResolveComplaint } from '@/services/complaint.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	ActionConfigPermission,
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

/**
 * Exactly the keys in the backend's `find.filterSchema`. `term` is the free-text search — it
 * matches the complaint's description — and reaches the table as `global`, which
 * `data-table-list.component.tsx` renames on the way out.
 *
 * `user` is the label half of the autocomplete pair; only `user_id` reaches the backend.
 *
 * `resolved_by` is accepted by the backend too but has no control here: a moderator looking for
 * their own decisions is a report, not a queue filter, and the bar is already long.
 */
export type ComplaintDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	entity_type: { value: ComplaintEntityType | null; matchMode: 'equals' };
	entity_id: { value: string | null; matchMode: 'equals' };
	reason: { value: ComplaintReason | null; matchMode: 'equals' };
	is_resolved: { value: boolean | null; matchMode: 'equals' };
	user: { value: string | null; matchMode: 'equals' };
	user_id: { value: number | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ComplaintModel>
> {
	const translations = await translateBatch(
		[
			'view.title',
			'resolve.title',
			'reopen.title',
			'delete.title',
			'restore.title',
			'viewUser.title',
		] as const,
		'complaint.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ComplaintModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'complaint', 'read') ? 'view' : undefined,
			dataSource: 'complaint',
		};
	}

	function displayButtonViewUser(
		auth: AuthModel | null,
		entry: ComplaintModel,
	): DataTableValueOptionsType<ComplaintModel>['displayButton'] {
		if (!entry.user_id) {
			return undefined;
		}

		return {
			action: () =>
				hasPermission(auth, 'user', 'read') ? 'view' : undefined,
			dataSource: 'user',
			title: translations['viewUser.title'],
			alternateEntryId: entry.user_id,
		};
	}

	/**
	 * The resolution badge is the trigger, the way `user`'s status badge is: one click selects the
	 * row and fires the move that matters from where it sits — close an open complaint, reopen a
	 * closed one, restore a dismissed one.
	 */
	function displayButtonResolution(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ComplaintModel>['displayButton'] {
		return {
			// `DataTableValue` throws without a data source to run the action against, and this
			// cell links to no other entity that would carry one.
			dataSource: 'complaint',
			action: (entry: ComplaintModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'complaint', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'complaint', 'update')) {
					return undefined;
				}

				return entry.is_resolved ? 'reopen' : 'resolve';
			},
		};
	}

	/**
	 * The two directions of the decision. They differ only in the flag they send and the state
	 * they are offered from — a complaint already in that state has nothing to move, and a deleted
	 * one is restored before it is decided on.
	 */
	function resolutionAction(
		action: 'resolve' | 'reopen',
		isResolved: boolean,
		hover: 'default' | 'success',
	) {
		return {
			windowType: 'action' as const,
			windowTitle: translations[`${action}.title`],
			permission: ['complaint', 'update'] as ActionConfigPermission,
			entriesSelection: 'single' as const,
			customEntryCheck: (entry: ComplaintModel) =>
				!entry.deleted_at && entry.is_resolved !== isResolved,
			operationFunction: (entry: ComplaintModel) =>
				requestResolveComplaint(entry, isResolved),
			buttonPosition: 'left' as const,
			button: {
				variant: 'outline' as const,
				hover: hover,
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
					entity_type: { value: null, matchMode: 'equals' },
					entity_id: { value: null, matchMode: 'equals' },
					reason: { value: null, matchMode: 'equals' },
					is_resolved: { value: null, matchMode: 'equals' },
					user: { value: null, matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies ComplaintDataTableFiltersType,
			},
			// Sortable only where the backend's `OrderByEnum` allows it: id, created_at,
			// resolved_at.
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
					field: 'entity_type',
					header: 'Target',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayComplaintTarget(entry),
						}),
				},
				{
					field: 'reason',
					header: 'Reason',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'description',
					header: 'Description',
					minWidth: 240,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// Trimmed here rather than in the model: the view window shows the
							// whole text, and only the list has a width to respect.
							customValue: entry.description
								? `${entry.description.slice(0, 120)}${entry.description.length > 120 ? '…' : ''}`
								: '',
						}),
				},
				{
					field: 'user_id',
					header: 'Reporter',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayComplaintReporter(entry),
							displayButton: displayButtonViewUser(auth, entry),
						}),
				},
				/*
				 * A complaint's state, rendered as the status badge every other feature's status
				 * column carries. It is not a `status` column on the table — the state is the
				 * `is_resolved` flag — so the cell hands the key over as `customValue`.
				 */
				{
					field: 'is_resolved',
					header: 'Resolution',
					minWidth: 148,
					maxWidth: 148,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'complaint',
							isStatus: true,
							markDeleted: true,
							// The status key `DisplayStatus` renders from, since the state is a
							// boolean here rather than a `status` column.
							customValue: entry.is_resolved
								? 'resolved'
								: 'open',
							displayButton: displayButtonResolution(auth),
						}),
				},
				{
					field: 'created_at',
					header: 'Created At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<ComplaintModel>('complaint', params),
		},
		displayEntryLabel: (entry: ComplaintModel) =>
			displayComplaintLabel(entry),
		actions: {
			// No `create` and no `update`: a complaint is filed by a reader through
			// `/public/complaints`, and its text is their accusation — a moderator decides on it
			// rather than rewriting it.
			resolve: resolutionAction('resolve', true, 'success'),
			reopen: resolutionAction('reopen', false, 'default'),
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['complaint', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ComplaintModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: ComplaintModel) =>
					requestDelete('complaint', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['complaint', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ComplaintModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: ComplaintModel) =>
					requestRestore('complaint', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewComplaint,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['complaint', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
