import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { UsageGuideCart } from '@/app/(dashboard)/dashboard/cart/usage-guide-cart.component';
import { ViewCart } from '@/app/(dashboard)/dashboard/cart/view-cart.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import {
	requestDelete,
	requestFind,
	requestRestore,
	requestView,
} from '@/helpers/services.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	type CartModel,
	type CartStatus,
	displayCartLabel,
	displayCartOwner,
} from '@/models/cart.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';

/**
 * Exactly the keys in the backend's `find.filterSchema`.
 *
 * There is no free-text search and no `global`: the only string a cart carries is its token, which
 * is the guest's whole credential - a back-office search by it would turn this screen into a way to
 * open any cart. Everything here narrows by something the business already knows.
 */
export type CartDataTableFiltersType = {
	status: { value: CartStatus | null; matchMode: 'equals' };
	user_id: { value: string | null; matchMode: 'equals' };
	order_id: { value: string | null; matchMode: 'equals' };
	currency: { value: string | null; matchMode: 'equals' };
	/** Whether removed carts join the listing - what `restore` needs to reach a row. */
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CartModel>
> {
	const translations = await translateBatch(
		[
			'view.title',
			'delete.title',
			'restore.title',
			'viewUser.title',
			'guide.title',
		] as const,
		'cart.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<CartModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'cart', 'read') ? 'view' : undefined,
			dataSource: 'cart',
		};
	}

	/** Only a member's cart can open a user window; a guest cart names nobody to open. */
	function displayButtonViewUser(
		auth: AccountModel | null,
		entry: CartModel,
	): DataTableValueOptionsType<CartModel>['displayButton'] {
		return {
			action: () =>
				entry.user_id && hasPermission(auth, 'user', 'read')
					? 'view'
					: undefined,
			dataSource: 'user',
			title: translations['viewUser.title'],
			alternateEntryId: entry.user_id ?? undefined,
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				// Most recently touched first: this screen is read to answer "what is happening
				// now", and `updated_at` moves on every line a shopper adds.
				sortField: 'updated_at',
				sortOrder: -1 as const,
				rows: 10,
				filters: {
					status: { value: null, matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
					order_id: { value: null, matchMode: 'equals' },
					currency: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies CartDataTableFiltersType,
			},
			/*
			 * No total column. The listing selects the row's columns only - pricing a whole page
			 * would re-read the catalog once per cart - so a total here would either be blank or
			 * cost a query per row. The view window is where the money is.
			 */
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
					field: 'user_id',
					header: 'Shopper',
					defaultWidth: 160,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayCartOwner(entry),
							displayButton: displayButtonViewUser(auth, entry),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					sortable: true,
					minWidth: 128,
					maxWidth: 128,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							dataSource: 'cart',
							isStatus: true,
						}),
				},
				{
					field: 'currency',
					header: 'Currency',
					defaultWidth: 104,
				},
				{
					field: 'order_id',
					header: 'Order',
					defaultWidth: 120,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// Only a converted cart names one; every other row has nothing to
							// point at rather than a missing value.
							customValue: entry.order_id
								? `#${entry.order_id}`
								: '-',
						}),
				},
				{
					field: 'expires_at',
					header: 'Expires At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							/*
							 * Meaningful only while the cart is active - it is the deadline the
							 * cleanup job measures against. On a converted or abandoned cart it
							 * is the moment that has already passed, so it reads as noise.
							 */
							customValue:
								entry.status === 'active'
									? (formatDate(entry.expires_at) ?? '-')
									: '-',
						}),
				},
				{
					field: 'updated_at',
					header: 'Last Activity',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
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
				requestFind<CartModel>('cart', params),
		},
		displayEntryLabel: (entry: CartModel) => displayCartLabel(entry),
		actions: {
			/*
			 * No `create` and no `update`. A cart is the shopper's own working state, filled
			 * through `/public/cart`; a back office able to edit one would be changing the record
			 * of what they chose. The order is where the business takes over.
			 */
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['cart', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CartModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: CartModel) =>
					requestDelete('cart', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['cart', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CartModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: CartModel) =>
					requestRestore('cart', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCart,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['cart', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				/*
				 * Always re-fetched, and not as an optimization: the row the table holds carries
				 * no `pricing` at all, because the listing does not resolve it. The read is what
				 * prices the lines - against the catalog as it is at that moment, which is also
				 * why a cached copy would be wrong.
				 */
				reloadEntry: (id: number) => requestView<CartModel>('cart', id),
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideCart,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['cart', 'read'],
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
