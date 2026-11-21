import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { UsageGuideRating } from '@/app/(dashboard)/dashboard/rating/usage-guide-rating.component';
import { ViewRating } from '@/app/(dashboard)/dashboard/rating/view-rating.component';
import { Icons } from '@/components/icon.component';
import { translate, translateBatch } from '@/config/translate.setup';
import { requestDelete, requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayRatingLabel,
	displayRatingValue,
	type RatingEmoji,
	RatingEmojiEnum,
	type RatingEntityType,
	RatingEntityTypeEnum,
	type RatingModel,
	type RatingType,
	RatingTypeEnum,
} from '@/models/rating.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { EntityId } from '@/types/entity-id.type';

/**
 * Exactly the keys in the backend's `find.filterSchema` - it accepts no free-text term, so
 * there is no `global` filter here and the table carries no search box.
 *
 * `user` is the label half of the autocomplete pair; only `user_id` reaches the backend.
 */
export type RatingDataTableFiltersType = {
	entity_type: { value: RatingEntityType | null; matchMode: 'equals' };
	entity_id: { value: string | null; matchMode: 'equals' };
	type: { value: RatingType | null; matchMode: 'equals' };
	reaction: { value: RatingEmoji | null; matchMode: 'equals' };
	user: { value: string | null; matchMode: 'equals' };
	user_id: { value: EntityId | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<RatingModel>
> {
	const [translations, labels, guest] = await Promise.all([
		translateBatch(
			[
				'delete.title',
				'view.title',
				'viewUser.title',
				'guide.title',
			] as const,
			'rating.action',
		),
		translateBatch(
			[
				'field.created_at',
				'field.entity_id',
				'field.entity_type',
				'field.id',
				'field.type',
				'field.rated_by',
				'field.rating',
				...enumTranslationKeys(
					'enum.entity_type',
					RatingEntityTypeEnum,
				),
				...enumTranslationKeys('enum.type', RatingTypeEnum),
				...enumTranslationKeys('enum.emoji', RatingEmojiEnum),
			] as const,
			'rating',
		),
		translate('dashboard.text.guest'),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<RatingModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'rating', 'read') ? 'view' : undefined,
			dataSource: 'rating',
		};
	}

	function displayButtonViewUser(
		auth: AccountModel | null,
		entry: RatingModel,
	): DataTableValueOptionsType<RatingModel>['displayButton'] {
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

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					entity_type: { value: null, matchMode: 'equals' },
					entity_id: { value: null, matchMode: 'equals' },
					type: { value: null, matchMode: 'equals' },
					reaction: { value: null, matchMode: 'equals' },
					user: { value: null, matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
				} satisfies RatingDataTableFiltersType,
			},
			// Only `id` and `created_at` are sortable - the two columns the backend's
			// `OrderByEnum` accepts.
			columns: [
				{
					field: 'entity_type',
					header: labels['field.entity_type'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
							customValue: translateEnumLabel(
								labels,
								'enum.entity_type',
								entry.entity_type,
							),
						}),
				},
				{
					field: 'entity_id',
					header: labels['field.entity_id'],
					defaultWidth: 112,
				},
				{
					field: 'type',
					header: labels['field.type'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.type',
								entry.type,
							),
						}),
				},
				{
					// One column for `value` and `reaction` alike: a row only ever fills one
					// of the two, so a column per source would be half empty on every row.
					field: 'value',
					header: labels['field.rating'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayRatingValue(entry, (reaction) =>
								translateEnumLabel(
									labels,
									'enum.emoji',
									reaction,
								),
							),
						}),
				},
				{
					field: 'user_id',
					header: labels['field.rated_by'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: entry.user
								? `${entry.user.name} (#${entry.user_id})`
								: guest,
							displayButton: displayButtonViewUser(auth, entry),
						}),
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
				requestFind<RatingModel>('rating', params),
		},
		displayEntryLabel: (entry: RatingModel) => displayRatingLabel(entry),
		actions: {
			// Hard delete, one row at a time: the backend exposes `DELETE /ratings/:id` only,
			// and the table has no `deleted_at`, so there is no restore to pair with it.
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['rating', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: RatingModel) =>
					requestDelete('rating', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewRating,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['rating', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideRating,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['rating', 'read'],
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
