import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { reviewTargetValue } from '@/app/(dashboard)/dashboard/review/data-table-target-review.component';
import {
	FormManageReview,
	type ReviewFormValuesType,
} from '@/app/(dashboard)/dashboard/review/form-manage-review.component';
import { StatusTransitionReview } from '@/app/(dashboard)/dashboard/review/status-transition-review.component';
import { UsageGuideReview } from '@/app/(dashboard)/dashboard/review/usage-guide-review.component';
import { ViewReview } from '@/app/(dashboard)/dashboard/review/view-review.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayReviewAuthor,
	displayReviewLabel,
	REVIEW_STATUS_TRANSITIONS,
	type ReviewModel,
	type ReviewStatus,
} from '@/models/review.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_content',
	'invalid_is_pinned',
	'invalid_is_verified',
] as const;

/** The same bounds the backend validator holds; a mismatch would surface as a 422 the form let through. */
const REVIEW_CONTENT_MIN = 10;
const REVIEW_CONTENT_MAX = 5000;

class ReviewValidator extends BaseValidator<typeof validatorMessages> {
	manage = () =>
		z.object({
			content: this.validateString(this.getMessage('invalid_content'), {
				minChars: REVIEW_CONTENT_MIN,
				maxChars: REVIEW_CONTENT_MAX,
			}),
			is_pinned: this.validateBoolean(
				this.getMessage('invalid_is_pinned'),
				{ required: false },
			),
			is_verified: this.validateBoolean(
				this.getMessage('invalid_is_verified'),
				{ required: false },
			),
		});
}

async function validateForm(values: ReviewFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'review.validation',
	);

	const validator = new ReviewValidator(translations);

	return validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): ReviewFormValuesType {
	return {
		content: getFormDataAsString(formData, 'content'),
		is_pinned: getFormDataAsBoolean(formData, 'is_pinned'),
		is_verified: getFormDataAsBoolean(formData, 'is_verified'),
	};
}

function getFormState(data?: ReviewModel): FormStateType<ReviewFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			content: data?.content ?? null,
			is_pinned: data?.is_pinned ?? false,
			is_verified: data?.is_verified ?? false,
		},
	};
}

/**
 * Exactly the keys in the backend's `find.filterSchema`. `term` is the free-text search - it
 * matches the review body - and reaches the table as `global`, which
 * `data-table-list.component.tsx` renames on the way out.
 *
 * `user` is the label half of the autocomplete pair; only `user_id` reaches the backend.
 * `rating_from` is compared against the stored average, not against a single score.
 */
export type ReviewDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	product_id: { value: string | null; matchMode: 'equals' };
	variant_id: { value: string | null; matchMode: 'equals' };
	status: { value: ReviewStatus | null; matchMode: 'equals' };
	rating_from: { value: string | null; matchMode: 'equals' };
	is_pinned: { value: boolean | null; matchMode: 'equals' };
	is_verified: { value: boolean | null; matchMode: 'equals' };
	user: { value: string | null; matchMode: 'equals' };
	user_id: { value: number | null; matchMode: 'equals' };
	/** Whether withdrawn reviews join the listing - what `restore` needs to reach a row. */
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ReviewModel>
> {
	const translations = await translateBatch(
		[
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'statusTransition.title',
			'viewUser.title',
			'guide.title',
		] as const,
		'review.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ReviewModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'review', 'read') ? 'view' : undefined,
			dataSource: 'review',
		};
	}

	function displayButtonViewUser(
		auth: AccountModel | null,
		entry: ReviewModel,
	): DataTableValueOptionsType<ReviewModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'user', 'read') ? 'view' : undefined,
			dataSource: 'user',
			title: translations['viewUser.title'],
			alternateEntryId: entry.user_id,
		};
	}

	/**
	 * The status badge opens the transition window rather than performing a move: a review can go
	 * several ways from most of its states, so the badge cannot pick one and offers the choice.
	 *
	 * A deleted review is left alone - it is off every page already, and the backend's status
	 * endpoint reads the live row.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ReviewModel>['displayButton'] {
		return {
			action: (entry: ReviewModel) => {
				if (
					!hasPermission(auth, 'review', 'update') ||
					entry.deleted_at
				) {
					return undefined;
				}

				return getStatusTransitions(
					entry.status,
					REVIEW_STATUS_TRANSITIONS,
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
					product_id: { value: null, matchMode: 'equals' },
					variant_id: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					rating_from: { value: null, matchMode: 'equals' },
					is_pinned: { value: null, matchMode: 'equals' },
					is_verified: { value: null, matchMode: 'equals' },
					user: { value: null, matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies ReviewDataTableFiltersType,
			},
			// Sortable only where the backend's `OrderByEnum` allows it: id, created_at, status,
			// rating_avg.
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
					field: 'product_id',
					header: 'Target',
					defaultWidth: 240,
					/*
					 * Built by hand rather than through `displayButton`: the cell carries two
					 * controls - the name opens the product window, the icon leaves for the
					 * public page - and an anchor cannot live inside the button `displayButton`
					 * would wrap the whole value in.
					 */
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: reviewTargetValue(entry, auth),
						}),
				},
				{
					field: 'rating_avg',
					header: 'Rating',
					defaultWidth: 104,
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// The per-dimension scores are not in the list projection - the
							// average is the whole of what a row can say about the score.
							customValue: `${entry.rating_avg} / 5`,
						}),
				},
				{
					field: 'content',
					header: 'Review',
					minWidth: 260,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// Trimmed here rather than in the model: the view window shows the
							// whole text, and only the list has a width to respect.
							customValue: `${entry.is_pinned ? '📌 ' : ''}${entry.content.slice(0, 120)}${entry.content.length > 120 ? '…' : ''}`,
						}),
				},
				{
					field: 'user_id',
					header: 'Author',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayReviewAuthor(entry),
							displayButton: displayButtonViewUser(auth, entry),
						}),
				},
				{
					field: 'is_verified',
					header: 'Verified',
					defaultWidth: 104,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.is_verified ? 'Yes' : 'No',
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'review',
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
				requestFind<ReviewModel>('review', params),
		},
		displayEntryLabel: (entry: ReviewModel) => displayReviewLabel(entry),
		actions: {
			// No `create`: a review is written by the buyer it belongs to, through
			// `/public/reviews`, and there is nobody else to attribute one to.
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageReview,
				permission: ['review', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ReviewModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: ReviewFormValuesType, id: number) =>
					requestUpdate<ReviewModel, ReviewFormValuesType>(
						'review',
						params,
						id,
					),
				/*
				 * The three editable fields are all in the list projection, so the row the table
				 * holds would seed the form correctly today. Re-fetched anyway: the backend's
				 * list select is narrower than its read, and the day `content` leaves it a save
				 * would silently blank the text of every review edited from this window.
				 */
				reloadEntry: (id: number) =>
					requestView<ReviewModel>('review', id),
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
			 * One window for every moderation decision, since a review has no single next state.
			 * `windowType: 'other'` because the window owns the request itself - the moves are
			 * rendered from the transition map and each one issues its own `statusUpdate`, so
			 * there is no single `operationFunction` to declare here.
			 */
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionReview,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['review', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ReviewModel) =>
					!entry.deleted_at &&
					getStatusTransitions(
						entry.status,
						REVIEW_STATUS_TRANSITIONS,
					).length > 0,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			// Soft, and it frees the slot: the unique allowing one live review per buyer per
			// product is partial on `deleted_at IS NULL`, so the author may write another one -
			// which is what a restore can then collide with.
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['review', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ReviewModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: ReviewModel) =>
					requestDelete('review', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['review', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ReviewModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: ReviewModel) =>
					requestRestore('review', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewReview,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['review', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				/*
				 * The per-dimension scores and the moderation trail are selected by the backend's
				 * read and not by its list, so the row the table hands over carries neither.
				 */
				reloadEntry: (id: number) =>
					requestView<ReviewModel>('review', id),
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideReview,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['review', 'read'],
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
