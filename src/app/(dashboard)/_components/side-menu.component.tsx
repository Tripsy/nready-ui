'use client';

import { ArrowDown, ArrowRight } from 'lucide-react';
import NextLink from 'next/link';
import React, {
	type ComponentType,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
	type SelectedPageType,
	useBreadcrumb,
} from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { useSideMenu } from '@/app/(dashboard)/_providers/side-menu.provider';
import { Icons } from '@/components/icon.component';
import { LinkPendingIcon } from '@/components/link-pending-icon.component';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';
import { useDebouncedEffect } from '@/hooks/use-debounced-effect.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/auth.model';
import { useAuth } from '@/providers/auth.provider';
import type { DataSourceKey } from '@/types/data-source.key';

type SideMenuSectionProps = {
	isExpanded?: boolean;
	label: string;
	text: string;
	icon: ComponentType<{ className?: string }>;
	items: {
		page: DataSourceKey;
		href: string;
		text: string;
		icon: ComponentType<{ className?: string }>;
		permission: boolean;
	}[];
};

type SideMenuOpenSectionProps = Omit<
	SideMenuSectionProps,
	'items' | 'icon' | 'permission'
> & {
	selectedPage: SelectedPageType;
	items: {
		page: DataSourceKey;
		href: string;
		text: string;
		icon: ComponentType<{ className?: string }>;
	}[];
};

type SideMenuClosedSectionProps = Omit<
	SideMenuSectionProps,
	'items' | 'permission'
> & {
	selectedPage: SelectedPageType;
	items: {
		page: DataSourceKey;
		href: string;
		text: string;
		icon: ComponentType<{ className?: string }>;
	}[];
};

type SectionStateType = 'expanded' | 'collapsed';

export function SideMenu() {
	const { auth } = useAuth();
	const { menuState } = useSideMenu();
	const { selectedPage } = useBreadcrumb();

	const translationsKeys = [
		'dashboard.labels.financial',
		'dashboard.labels.client',
		'dashboard.labels.cash-flow',
		'dashboard.labels.discount',
		'dashboard.labels.vendor',

		'dashboard.labels.content',
		'dashboard.labels.place',
		'dashboard.labels.brand',
		'dashboard.labels.category',
		'dashboard.labels.term',
		'dashboard.labels.image',

		'dashboard.labels.logistics',
		'dashboard.labels.address',
		'dashboard.labels.carrier',

		'dashboard.labels.publishing',
		'dashboard.labels.article',

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

	const { translations, isTranslationLoading } =
		useTranslation(translationsKeys);

	// Memoize the menu groups to prevent unnecessary re-renders
	const menuContent = useMemo(() => {
		if (isTranslationLoading) {
			return [];
		}

		const sections: SideMenuSectionProps[] = [
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
				],
			},
			{
				label: 'settings',
				text: translations['dashboard.labels.settings'],
				icon: Icons.Settings,
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

		const displaySections = sections
			.map((section) => ({
				...section,
				items: section.items.filter((item) => item.permission),
			}))
			.filter((section) => section.items.length > 0);

		if (menuState === 'open') {
			return displaySections.map((section) => (
				<SideMenuOpenSection
					key={`side-menu-section-${section.label}`}
					selectedPage={selectedPage}
					{...section}
				/>
			));
		}

		return displaySections.map((section) => (
			<SideMenuClosedSection
				key={`side-menu-section-${section.label}`}
				selectedPage={selectedPage}
				{...section}
			/>
		));
	}, [auth, isTranslationLoading, translations, menuState, selectedPage]);

	return (
		<div className="side-menu-container">
			<div className="flex flex-col h-full">
				<nav aria-description="Side menu" className="side-menu-content">
					{menuContent}
				</nav>

				{menuState === 'open' && (
					<div className="p-4 border-t border-sidebar-border">
						<div className="rounded-lg bg-sidebar-accent p-4">
							<p className="text-sm font-medium text-sidebar-accent-foreground mb-1">
								Need help?
							</p>
							<p className="text-xs text-muted mb-3">
								Check our documentation for guidance.
							</p>
							<Link
								size="sm"
								variant="secondary"
								className="w-full"
								href={Routes.get('docs')}
								title="Check out the documentation"
							>
								View Docs
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function SideMenuOpenSection({
	isExpanded = false,
	label,
	text,
	items,
	selectedPage,
}: SideMenuOpenSectionProps) {
	const keyStorageSectionState = `side-menu-section-state-${label}`;

	const [sectionState, setSectionState] = useState<SectionStateType>(() =>
		isExpanded ? 'expanded' : 'collapsed',
	);

	useLayoutEffect(() => {
		const storageSectionState: string | null = localStorage.getItem(
			keyStorageSectionState,
		);

		if (
			storageSectionState !== null &&
			storageSectionState !== 'undefined'
		) {
			setSectionState(storageSectionState as SectionStateType);
		}
	}, [keyStorageSectionState]);

	useDebouncedEffect(
		() => {
			localStorage.setItem(keyStorageSectionState, sectionState);
		},
		[sectionState],
		1000,
	);

	const toggleSectionState = (e: React.MouseEvent<HTMLElement>) => {
		e.preventDefault();

		setSectionState((previousState) =>
			previousState === 'expanded' ? 'collapsed' : 'expanded',
		);
	};

	if (items.length === 0) {
		return null;
	}

	return (
		<div>
			<button
				type="button"
				onClick={toggleSectionState}
				className="flex items-center text-left gap-2 px-3 py-2.5 w-full transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent"
			>
				{sectionState === 'expanded' ? (
					<ArrowDown className="h-4 w-4 shrink-0" />
				) : (
					<ArrowRight className="h-4 w-4 shrink-0" />
				)}
				<span className="flex-1 truncate">{text}</span>
			</button>
			<div
				className={cn(
					'transition-all duration-300 ease-in-out',
					sectionState === 'expanded'
						? 'max-h-96 opacity-100 translate-y-0'
						: 'max-h-0 opacity-0 -translate-y-2 overflow-hidden',
				)}
			>
				<ul className="ml-6 py-1">
					{items.map((item) => (
						<li key={`side-menu-item-${item.page}`}>
							<NextLink
								href={item.href}
								className={cn(
									'flex items-center text-left gap-2 px-3 py-2 transition-all duration-200 group',
									selectedPage === item.page
										? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
										: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
								)}
							>
								<LinkPendingIcon
									icon={item.icon}
									className="h-4 w-4 shrink-0"
								/>{' '}
								{item.text}
							</NextLink>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function SideMenuClosedSection({
	text,
	icon: SectionIcon,
	items,
	selectedPage,
}: SideMenuClosedSectionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});
	const triggerRef = useRef<HTMLDivElement>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const openFlyout = () => {
		if (closeTimer.current) {
			clearTimeout(closeTimer.current);
		}
		const rect = triggerRef.current?.getBoundingClientRect();
		if (rect) {
			setPosition({ top: rect.top, left: rect.right });
		}
		setIsOpen(true);
	};

	// Small delay so the pointer can travel across the gap into the flyout.
	const closeFlyout = () => {
		closeTimer.current = setTimeout(() => setIsOpen(false), 120);
	};

	useEffect(
		() => () => {
			if (closeTimer.current) {
				clearTimeout(closeTimer.current);
			}
		},
		[],
	);

	if (items.length === 0) {
		return null;
	}

	const isSelected: boolean = items.some(
		(item) => item.page === selectedPage,
	);

	const flyout = items.map((item) => (
		<li key={`side-menu-item-${item.page}`}>
			<NextLink
				href={item.href}
				className={cn(
					'flex items-center text-left gap-2 px-3 py-2 rounded-md transition-all duration-200 group',
					selectedPage === item.page
						? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
				)}
			>
				<LinkPendingIcon
					icon={item.icon}
					className="h-4 w-4 shrink-0"
				/>{' '}
				{item.text}
			</NextLink>
		</li>
	));

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover-reveal flyout container (mouse-only, mirrors prior collapsed-sidebar behaviour)
		<div
			ref={triggerRef}
			onMouseEnter={openFlyout}
			onMouseLeave={closeFlyout}
		>
			<div
				className={cn(
					'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-default',
					isSelected
						? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
				)}
				aria-description={text}
			>
				<SectionIcon
					className={cn(
						'h-5 w-5 shrink-0',
						isSelected && 'text-sidebar-primary',
					)}
				/>
			</div>

			{/*
			 * Interactive hover flyout for the collapsed sidebar. Rendered in a portal so it
			 * escapes the sidebar's overflow-clipping; positioned to the right of the icon.
			 * (A tooltip role can't hold links, and HeroUI has no hover-card.)
			 */}
			{isOpen &&
				createPortal(
					// biome-ignore lint/a11y/noStaticElementInteractions: hover-bridge wrapper that keeps the flyout open while the pointer is over it
					<div
						className="fixed z-50 pl-2"
						style={{ top: position.top, left: position.left }}
						onMouseEnter={openFlyout}
						onMouseLeave={closeFlyout}
					>
						<nav
							aria-label={text}
							className="min-w-48 rounded-lg border border-border bg-overlay text-overlay-foreground shadow-md p-1 animate-fade-in"
						>
							<ul className="py-1">{flyout}</ul>
						</nav>
					</div>,
					document.body,
				)}
		</div>
	);
}
