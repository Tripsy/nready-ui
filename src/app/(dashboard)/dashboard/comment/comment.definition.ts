import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type CommentFormValuesType,
	FormManageComment,
} from '@/app/(dashboard)/dashboard/comment/form-manage-comment.component';
import { StatusTransitionComment } from '@/app/(dashboard)/dashboard/comment/status-transition-comment.component';
import { UsageGuideComment } from '@/app/(dashboard)/dashboard/comment/usage-guide-comment.component';
import { ViewComment } from '@/app/(dashboard)/dashboard/comment/view-comment.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsEnum,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	requestDelete,
	requestFind,
	requestUpdate,
} from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	COMMENT_DEFAULT_TYPE,
	COMMENT_STATUS_TRANSITIONS,
	type CommentEntityType,
	type CommentModel,
	type CommentStatus,
	type CommentType,
	CommentTypeEnum,
	displayCommentAuthor,
	displayCommentLabel,
	displayCommentThread,
} from '@/models/comment.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_content',
	'invalid_type',
	'invalid_is_pinned',
] as const;

/** The same bounds the backend validator holds; a mismatch would surface as a 422 the form let through. */
const COMMENT_CONTENT_MIN = 2;
const COMMENT_CONTENT_MAX = 5000;

class CommentValidator extends BaseValidator<typeof validatorMessages> {
	manage = () =>
		z.object({
			content: this.validateString(this.getMessage('invalid_content'), {
				minChars: COMMENT_CONTENT_MIN,
				maxChars: COMMENT_CONTENT_MAX,
			}),
			type: this.validateEnum(
				CommentTypeEnum,
				this.getMessage('invalid_type'),
			),
			is_pinned: this.validateBoolean(
				this.getMessage('invalid_is_pinned'),
				{ required: false },
			),
		});
}

async function validateForm(values: CommentFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'comment.validation',
	);

	const validator = new CommentValidator(translations);

	return validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): CommentFormValuesType {
	return {
		content: getFormDataAsString(formData, 'content'),
		type:
			getFormDataAsEnum(formData, 'type', CommentTypeEnum) ||
			COMMENT_DEFAULT_TYPE,
		is_pinned: getFormDataAsBoolean(formData, 'is_pinned'),
	};
}

function getFormState(
	data?: CommentModel,
): FormStateType<CommentFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			content: data?.content ?? null,
			type: data?.type ?? COMMENT_DEFAULT_TYPE,
			is_pinned: data?.is_pinned ?? false,
		},
	};
}

/**
 * Exactly the keys in the backend's `find.filterSchema`. `term` is the free-text search — it
 * matches the comment body and a guest's name — and reaches the table as `global`, which
 * `data-table-list.component.tsx` renames on the way out.
 *
 * `user` is the label half of the autocomplete pair; only `user_id` reaches the backend.
 */
export type CommentDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	entity_type: { value: CommentEntityType | null; matchMode: 'equals' };
	entity_id: { value: string | null; matchMode: 'equals' };
	type: { value: CommentType | null; matchMode: 'equals' };
	status: { value: CommentStatus | null; matchMode: 'equals' };
	parent_id: { value: string | null; matchMode: 'equals' };
	is_pinned: { value: boolean | null; matchMode: 'equals' };
	user: { value: string | null; matchMode: 'equals' };
	user_id: { value: number | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CommentModel>
> {
	const translations = await translateBatch(
		[
			'update.title',
			'view.title',
			'delete.title',
			'statusTransition.title',
			'viewUser.title',
			'guide.title',
		] as const,
		'comment.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<CommentModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'comment', 'read') ? 'view' : undefined,
			dataSource: 'comment',
		};
	}

	function displayButtonViewUser(
		auth: AccountModel | null,
		entry: CommentModel,
	): DataTableValueOptionsType<CommentModel>['displayButton'] {
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
	 * The status badge opens the transition window rather than performing a move.
	 *
	 * Unlike `complaint`, whose state is a boolean and so has exactly one move from anywhere, a
	 * comment can go several ways from most of its states — the badge cannot pick one, so it
	 * offers the choice.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<CommentModel>['displayButton'] {
		return {
			action: (entry: CommentModel) => {
				if (!hasPermission(auth, 'comment', 'update')) {
					return undefined;
				}

				return getStatusTransitions(
					entry.status,
					COMMENT_STATUS_TRANSITIONS,
				).length > 0
					? 'statusTransition'
					: undefined;
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
					type: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					parent_id: { value: null, matchMode: 'equals' },
					is_pinned: { value: null, matchMode: 'equals' },
					user: { value: null, matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
				} satisfies CommentDataTableFiltersType,
			},
			// Sortable only where the backend's `OrderByEnum` allows it: id, created_at, status.
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
					field: 'entity_type',
					header: 'Target',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: `${formatEnumLabel(entry.entity_type)} #${entry.entity_id}`,
						}),
				},
				{
					field: 'content',
					header: 'Comment',
					minWidth: 260,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// Trimmed here rather than in the model: the view window shows the
							// whole text, and only the list has a width to respect.
							customValue: `${entry.is_pinned ? '📌 ' : ''}${entry.content.slice(0, 120)}${entry.content.length > 120 ? '…' : ''}`,
						}),
				},
				{
					field: 'parent_id',
					header: 'Thread',
					defaultWidth: 128,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayCommentThread(entry),
						}),
				},
				{
					field: 'type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'user_id',
					header: 'Author',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayCommentAuthor(entry),
							displayButton: displayButtonViewUser(auth, entry),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'comment',
							isStatus: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
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
				requestFind<CommentModel>('comment', params),
		},
		displayEntryLabel: (entry: CommentModel) => displayCommentLabel(entry),
		actions: {
			// No `create`: a comment is written by a reader through `/public/comments`, and no
			// `restore`: the table has no `deleted_at`, so a removal is final.
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageComment,
				permission: ['comment', 'update'],
				entriesSelection: 'single',
				operationFunction: (
					params: CommentFormValuesType,
					id: number,
				) =>
					requestUpdate<CommentModel, CommentFormValuesType>(
						'comment',
						params,
						id,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			/*
			 * One window for every moderation decision, since a comment has no single next
			 * state. `windowType: 'other'` because the window owns the request itself — the
			 * moves are rendered from the transition map and each one issues its own
			 * `statusUpdate`, so there is no single `operationFunction` to declare here.
			 */
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionComment,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['comment', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CommentModel) =>
					getStatusTransitions(
						entry.status,
						COMMENT_STATUS_TRANSITIONS,
					).length > 0,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			// Hard delete, and it takes the replies with it — `parent_id` cascades in the
			// database, so there is no orphaned subtree left behind and nothing to restore.
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['comment', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: CommentModel) =>
					requestDelete('comment', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewComment,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['comment', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideComment,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['comment', 'read'],
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
