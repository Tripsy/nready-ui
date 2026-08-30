import { Heart } from 'lucide-react';
import NextLink from 'next/link';
import { Icons } from '@/components/icon.component';
import { LogoComponent } from '@/components/layout/logo.default';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';

type FooterLinkSection = {
	name: string;
	links: { label: string; href: string; title?: string }[];
};

const footerLinkSections: FooterLinkSection[] = [
	{
		name: 'Shopping',
		links: [
			{ label: 'Categories', href: Routes.get('products-categories') },
			{ label: 'Products', href: Routes.get('products') },
		],
	},
	{
		name: 'Blog',
		links: [
			{ label: 'Categories', href: Routes.get('articles-categories') },
			{ label: 'Articles', href: Routes.get('articles') },
		],
	},
	{
		name: 'Developers',
		links: [
			{
				label: 'API reference',
				href: Routes.get('api-docs'),
				title: 'API reference',
			},
		],
	},
	{
		name: 'Company',
		links: [
			{ label: 'About', href: 'https://play-zone.ro' },
			{ label: 'Contact', href: 'https://play-zone.ro/contact' },
			{ label: 'Careers', href: 'https://play-zone.ro/careers' },
		],
	},
	{
		name: 'Legal',
		links: [
			{
				label: 'Privacy',
				href: Routes.get('page', {
					label: 'privacy-policy',
				}),
				title: 'Privacy Policy',
			},
			{
				label: 'Terms',
				href: Routes.get('page', {
					label: 'terms-and-conditions',
				}),
				title: 'Terms & Conditions',
			},
		],
	},
];

const socialLinks = [
	{
		icon: Icons.Social.GitHub,
		href: 'https://github.com/Tripsy',
		label: 'GitHub',
	},
	{
		icon: Icons.Social.LinkedIn,
		href: 'https://www.linkedin.com/in/david-gabriel-8853a7115/',
		label: 'LinkedIn',
	},
	{
		icon: Icons.Social.Email,
		href: 'mailto:engine@play-zone.ro',
		label: 'Email',
	},
];

export function Footer() {
	return (
		<footer className="border-t border-border bg-surface-secondary/30">
			<div className="container-default py-8 md:py-12">
				<div className="flex flex-col md:flex-row gap-12 md:gap-20">
					{/* Brand column */}
					<div className="flex flex-col mx-auto md:mx-0 items-center text-center md:items-start md:text-left">
						{/* Same wrapper as the header's logo link, so the mark sits
						    on its own box rather than on a full-width anchor. */}
						<NextLink
							href={Routes.get('home')}
							className="flex w-fit items-center gap-2 mb-4"
						>
							<LogoComponent />
						</NextLink>
						<p className="text-sm text-muted-foreground mb-4 max-w-xs">
							The solution to quickly build MVPs, CMS platforms,
							E-commerce solutions
						</p>
						<div className="flex gap-3">
							{socialLinks.map((social) => (
								<a
									key={social.label}
									href={social.href}
									target="_blank"
									rel="noopener noreferrer"
									className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
									aria-label={social.label}
								>
									<social.icon className="h-5 w-5" />
								</a>
							))}
						</div>
					</div>

					<div className="flex justify-around md:gap-20">
						{footerLinkSections.map((section) => (
							<div key={section.name}>
								<h3 className="text-sm font-semibold text-foreground mb-4">
									{section.name}
								</h3>
								<ul className="space-y-3">
									{section.links.map((link) => (
										<li key={link.href}>
											<NextLink
												href={link.href}
												title={link.title}
												className="text-sm text-muted-foreground hover:text-foreground transition-colors"
											>
												{link.label}
											</NextLink>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				<div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
					<p className="text-sm text-muted-foreground">
						© {new Date().getFullYear()}{' '}
						{Configuration.get('app.name')}. All rights reserved.
					</p>
					<p className="text-sm text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
						Made with <Heart className="h-4 w-4 text-red-500" /> for
						developers
					</p>
				</div>
			</div>
		</footer>
	);
}
