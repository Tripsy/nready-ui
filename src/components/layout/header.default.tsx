'use client';

import { Menu, X } from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/layout/language-switcher.component';
import { LogoComponent } from '@/components/layout/logo.default';
import { ToggleTheme } from '@/components/layout/toggle-theme';
import { UserMenu } from '@/components/layout/user-menu.component';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';
import { useAuth } from '@/providers/auth.provider';
import type { LayoutTranslations } from '@/types/layout.type';

export function Header({
	currentLanguage,
	supportedLanguages,
	translations,
}: {
	currentLanguage: string;
	supportedLanguages: string[];
	translations: LayoutTranslations;
}) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const { authStatus } = useAuth();

	const pathname = usePathname();
	const homePath = Routes.get('home');
	const [activeHash, setActiveHash] = useState('');
	const observerRef = useRef<IntersectionObserver | null>(null);

	/*
	 * Every entry is public, so the nav is no longer gated on `authStatus` — it used to be,
	 * because the only destination besides home was the dashboard. Signed-in users still
	 * reach that from `UserMenu`, which is where the authenticated destinations live.
	 *
	 * `hash` marks an entry that scrolls to a section of the home page; an entry pointing at
	 * a page of its own has none, and the observer below skips it.
	 */
	const navLinks = useMemo(
		() => [
			{
				href: Routes.get('home'),
				label: translations['layout.nav.home'],
				hash: 'home',
			},
			{
				href: Routes.get('categories'),
				label: translations['layout.nav.categories'],
			},
		],
		[translations],
	);

	useEffect(() => {
		if (pathname !== homePath) {
			if (activeHash) {
				setActiveHash('');
			}

			return;
		}

		// Disconnect existing observer
		if (observerRef.current) {
			observerRef.current.disconnect();
		}

		observerRef.current = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveHash(entry.target.id);
					}
				});
			},
			{ rootMargin: '-20% 0% -70% 0%' },
		);

		// Observe all target elements
		const observer = observerRef.current;

		const observeSections = () => {
			navLinks.forEach((d) => {
				if (!d.hash) {
					return;
				}

				const element = document.querySelector(`#${d.hash}`);

				if (element) {
					observer.observe(element);
				}
			});
		};

		observeSections();

		// Add delay to ensure DOM is ready
		setTimeout(observeSections, 100);

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, [pathname, homePath, activeHash, navLinks]);

	const isActive = (path: string, hash?: string) => {
		if (pathname !== path) {
			return false;
		}

		if (hash) {
			return activeHash === hash;
		}

		return true;
	};

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container-default">
				<div className="flex h-16 items-center justify-between">
					<NextLink
						href={Routes.get('home')}
						className="flex items-center gap-2"
					>
						<LogoComponent />
					</NextLink>

					{/* Desktop Navigation */}
					<nav className="hidden md:flex items-center gap-1">
						{navLinks.map((link) => (
							<NextLink
								key={link.href}
								href={link.href}
								className={cn(
									'px-4 py-2 text-sm font-medium rounded-md transition-colors',
									isActive(link.href)
										? 'bg-accent-soft text-accent-soft-foreground'
										: 'text-muted hover:text-foreground hover:bg-surface-secondary',
								)}
							>
								{link.label}
							</NextLink>
						))}
					</nav>

					{/* Right side actions */}
					<div className="flex items-center gap-2">
						{/* Mobile menu button */}
						<Button
							variant="ghost"
							className="md:hidden h-10 w-10"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label={translations['layout.aria.toggle_menu']}
						>
							{mobileMenuOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</Button>
						<LanguageSwitcher
							currentLanguage={currentLanguage}
							supportedLanguages={supportedLanguages}
							translations={translations}
						/>
						<ToggleTheme translations={translations} />
						<UserMenu translations={translations} />
					</div>
				</div>

				{/* Mobile menu */}
				{mobileMenuOpen && (
					<div className="md:hidden py-4 border-t border-border animate-fade-in">
						<nav className="flex flex-col gap-1">
							{navLinks.map((link) => (
								<NextLink
									key={link.href}
									href={link.href}
									onClick={() => setMobileMenuOpen(false)}
									className={cn(
										'px-4 py-3 text-sm font-medium rounded-md transition-colors',
										isActive(link.href)
											? 'bg-accent-soft text-accent-soft-foreground'
											: 'text-muted hover:text-foreground hover:bg-surface-secondary',
									)}
								>
									{link.label}
								</NextLink>
							))}
							{authStatus === 'unauthenticated' && (
								<div className="sm:hidden border-t border-border mt-2 pt-3 px-4 space-y-2">
									<Link
										variant="outline"
										className="w-full"
										href={Routes.get('login')}
										title={
											translations[
												'layout.menu.login_title'
											]
										}
									>
										{translations['layout.menu.login']}
									</Link>
									<Link
										className="w-full"
										href={Routes.get('register')}
										title={
											translations[
												'layout.menu.register_title'
											]
										}
									>
										{translations['layout.menu.register']}
									</Link>
								</div>
							)}
						</nav>
					</div>
				)}
			</div>
		</header>
	);
}
