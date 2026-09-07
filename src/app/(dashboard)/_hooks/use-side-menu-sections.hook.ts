import { type ComponentType, useMemo } from 'react';
import { Icons } from '@/components/icon.component';
import Routes from '@/config/routes.setup';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/account.model';
import { useAuth } from '@/providers/auth.provider';
import type { DataSourceKey } from '@/types/data-source.key';

export type SideMenuItemType = {
	page: DataSourceKey;
	href: string;
	text: string;
	icon: ComponentType<{ className?: string }>;
};

export type SideMenuSectionType = {
	label: string;
	text: string;
	icon: ComponentType<{ className?: string }>;
	/** Whether the section starts expanded, before the per-section localStorage state loads. */
	isExpanded: boolean;
	items: SideMenuItemType[];
};

const TRANSLATION_KEYS = [
	'dashboard.labels.financial',
	'dashboard.labels.client',
	'dashboard.labels.cash-flow',
	'dashboard.labels.discount',
	'dashboard.labels.exchange-rate',
	'dashboard.labels.vendor',

	'dashboard.labels.content',
	'dashboard.labels.place',
	'dashboard.labels.brand',
	'dashboard.labels.category',
	'dashboard.labels.term',
	'dashboard.labels.image',

	'dashboard.labels.shop',
	'dashboard.labels.product',

	'dashboard.labels.logistics',
	'dashboard.labels.address',
	'dashboard.labels.carrier',

	'dashboard.labels.publishing',
	'dashboard.labels.article',
	'dashboard.labels.rating',
	'dashboard.labels.comment',
	'dashboard.labels.complaint',

	'dashboard.labels.settings',
	'dashboard.labels.template',
	'dashboard.labels.document-series',

	'dashboard.labels.logs',
	'dashboard.labels.log-data',
	'dashboard.labels.log-history',
	'dashboard.labels.cron-history',
	'dashboard.labels.mail-queue',

	'dashboard.labels.user-management',
	'dashboard.labels.user',
	'dashboard.labels.permission',
] as const;

/**
 * The dashboard navigation tree, already filtered to what the signed-in user may reach:
 * an item whose permission check fails is dropped, and a section left with no items goes
 * with it.
 *
 * Shared by the side menu and the menu search, which have to offer exactly the same set of
 * destinations - declaring it twice would let the two drift apart.
 */
export function useSideMenuSections(): {
	sections: SideMenuSectionType[];
	isTranslationLoading: boolean;
} {
	const { auth } = useAuth();
	const { translations, isTranslationLoading } =
		useTranslation(TRANSLATION_KEYS);

	const sections = useMemo(() => {
		if (isTranslationLoading) {
			return [];
		}

		const allSections: (Omit<SideMenuSectionType, 'items'> & {
			items: (SideMenuItemType & { permission: boolean })[];
		})[] = [
			{
				label: 'financial',
				text: translations['dashboard.labels.financial'],
				icon: Icons.Financial,
				isExpanded: false,
				items: [
					{
						page: 'client',
						href: Routes.get('client'),
						text: translations['dashboard.labels.client'],
						icon: Icons.Client,
						permission: hasPermission(auth, 'client'),
					},
					{
						page: 'cash-flow',
						href: Routes.get('cash-flow'),
						text: translations['dashboard.labels.cash-flow'],
						icon: Icons.CashFlow,
						permission: hasPermission(auth, 'cash-flow'),
					},
					{
						page: 'discount',
						href: Routes.get('discount'),
						text: translations['dashboard.labels.discount'],
						icon: Icons.Discount,
						permission: hasPermission(auth, 'discount'),
					},
					{
						page: 'exchange-rate',
						href: Routes.get('exchange-rate'),
						text: translations['dashboard.labels.exchange-rate'],
						icon: Icons.ExchangeRate,
						permission: hasPermission(auth, 'exchange-rate'),
					},
					{
						page: 'vendor',
						href: Routes.get('vendor'),
						text: translations['dashboard.labels.vendor'],
						icon: Icons.Vendor,
						permission: hasPermission(auth, 'vendor'),
					},
				],
			},
			{
				label: 'content',
				text: translations['dashboard.labels.content'],
				icon: Icons.Content,
				isExpanded: false,
				items: [
					{
						page: 'place',
						href: Routes.get('place'),
						text: translations['dashboard.labels.place'],
						icon: Icons.Location,
						permission: hasPermission(auth, 'place'),
					},
					{
						page: 'brand',
						href: Routes.get('brand'),
						text: translations['dashboard.labels.brand'],
						icon: Icons.Brand,
						permission: hasPermission(auth, 'brand'),
					},
					{
						page: 'category',
						href: Routes.get('category'),
						text: translations['dashboard.labels.category'],
						icon: Icons.Category,
						permission: hasPermission(auth, 'category'),
					},
					{
						page: 'term',
						href: Routes.get('term'),
						text: translations['dashboard.labels.term'],
						icon: Icons.Term,
						permission: hasPermission(auth, 'term'),
					},
					{
						page: 'image',
						href: Routes.get('image'),
						text: translations['dashboard.labels.image'],
						icon: Icons.Image,
						permission: hasPermission(auth, 'image'),
					},
				],
			},
			{
				label: 'shop',
				text: translations['dashboard.labels.shop'],
				icon: Icons.Shop,
				isExpanded: false,
				items: [
					{
						page: 'product',
						href: Routes.get('product'),
						text: translations['dashboard.labels.product'],
						icon: Icons.Product,
						permission: hasPermission(auth, 'product'),
					},
				],
			},
			{
				label: 'logistics',
				text: translations['dashboard.labels.logistics'],
				icon: Icons.Logistics,
				isExpanded: false,
				items: [
					{
						page: 'address',
						href: Routes.get('address'),
						text: translations['dashboard.labels.address'],
						icon: Icons.Address,
						permission: hasPermission(auth, 'address'),
					},
					{
						page: 'carrier',
						href: Routes.get('carrier'),
						text: translations['dashboard.labels.carrier'],
						icon: Icons.Carrier,
						permission: hasPermission(auth, 'carrier'),
					},
				],
			},
			{
				label: 'publishing',
				text: translations['dashboard.labels.publishing'],
				icon: Icons.Publishing,
				isExpanded: false,
				items: [
					{
						page: 'article',
						href: Routes.get('article'),
						text: translations['dashboard.labels.article'],
						icon: Icons.Article,
						permission: hasPermission(auth, 'article'),
					},
					{
						page: 'rating',
						href: Routes.get('rating'),
						text: translations['dashboard.labels.rating'],
						icon: Icons.Rating,
						permission: hasPermission(auth, 'rating'),
					},
					{
						page: 'comment',
						href: Routes.get('comment'),
						text: translations['dashboard.labels.comment'],
						icon: Icons.Comment,
						permission: hasPermission(auth, 'comment'),
					},
					{
						page: 'complaint',
						href: Routes.get('complaint'),
						text: translations['dashboard.labels.complaint'],
						icon: Icons.Complaint,
						permission: hasPermission(auth, 'complaint'),
					},
				],
			},
			{
				label: 'settings',
				text: translations['dashboard.labels.settings'],
				icon: Icons.Settings,
				isExpanded: false,
				items: [
					{
						page: 'template',
						href: Routes.get('template'),
						text: translations['dashboard.labels.template'],
						icon: Icons.Template,
						permission: hasPermission(auth, 'template'),
					},
					{
						page: 'document-series',
						href: Routes.get('document-series'),
						text: translations['dashboard.labels.document-series'],
						icon: Icons.DocumentSeries,
						permission: hasPermission(auth, 'document-series'),
					},
				],
			},
			{
				label: 'logs',
				text: translations['dashboard.labels.logs'],
				icon: Icons.Logs,
				isExpanded: true,
				items: [
					{
						page: 'log-data',
						href: Routes.get('log-data'),
						text: translations['dashboard.labels.log-data'],
						icon: Icons.HardDrive,
						permission: hasPermission(auth, 'log-data'),
					},
					{
						page: 'log-history',
						href: Routes.get('log-history'),
						text: translations['dashboard.labels.log-history'],
						icon: Icons.History,
						permission: hasPermission(auth, 'log-history'),
					},
					{
						page: 'cron-history',
						href: Routes.get('cron-history'),
						text: translations['dashboard.labels.cron-history'],
						icon: Icons.Cron,
						permission: hasPermission(auth, 'cron-history'),
					},
					{
						page: 'mail-queue',
						href: Routes.get('mail-queue'),
						text: translations['dashboard.labels.mail-queue'],
						icon: Icons.Mails,
						permission: hasPermission(auth, 'mail-queue'),
					},
				],
			},
			{
				label: 'user-management',
				text: translations['dashboard.labels.user-management'],
				icon: Icons.Account,
				isExpanded: true,
				items: [
					{
						page: 'user',
						href: Routes.get('user'),
						text: translations['dashboard.labels.user'],
						icon: Icons.User,
						permission: hasPermission(auth, 'user'),
					},
					{
						page: 'permission',
						href: Routes.get('permission'),
						text: translations['dashboard.labels.permission'],
						icon: Icons.Permission,
						permission: hasPermission(auth, 'permission'),
					},
				],
			},
		];

		return allSections
			.map((section) => ({
				...section,
				items: section.items
					.filter((item) => item.permission)
					.map(({ permission: _permission, ...item }) => item),
			}))
			.filter((section) => section.items.length > 0);
	}, [auth, isTranslationLoading, translations]);

	return { sections, isTranslationLoading };
}
