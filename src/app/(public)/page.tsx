import {
	ArrowRight,
	FileCheck2,
	LayoutDashboard,
	ShieldCheck,
	Truck,
	Users,
	Wallet,
} from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';
import { logger } from '@/helpers/logger.helper';
import type { AuthModel } from '@/models/auth.model';
import { UserRoleEnum } from '@/models/user.model';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('home.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

const features = [
	{ icon: FileCheck2, key: 'cmr' },
	{ icon: Truck, key: 'fleet' },
	{ icon: Wallet, key: 'cash_flow' },
	{ icon: Users, key: 'directory' },
	{ icon: ShieldCheck, key: 'permissions' },
	{ icon: LayoutDashboard, key: 'dashboard' },
] as const;

const TRANSLATION_KEYS = [
	'home.hero.title_prefix',
	'home.hero.title_highlight',
	'home.hero.title_suffix',
	'home.hero.subtitle',
	'home.feature.heading',
	'home.feature.subheading',
	...features.flatMap(
		({ key }) =>
			[
				`home.feature.${key}_title`,
				`home.feature.${key}_description`,
			] as const,
	),
	'home.cta.go_dashboard',
	'home.cta.create_account',
	'home.cta.sign_in',
	'home.cta.back_title',
	'home.cta.back_description',
	'home.cta.open_dashboard',
	'home.cta.ready_title',
	'home.cta.ready_description',
] as const;

async function getAuth(): Promise<AuthModel | null> {
	const headersList = await headers();
	const authHeader = headersList.get('x-auth-data');

	try {
		return authHeader ? JSON.parse(authHeader) : null;
	} catch (error: unknown) {
		logger.error('Failed to parse the x-auth-data header', error);

		return null;
	}
}

export default async function Page() {
	const auth = await getAuth();

	// Driver get redirect to their own operational panel, not the marketing/admin home page.
	if (auth?.role === UserRoleEnum.DRIVER) {
		redirect(Routes.get('driver-panel'));
	}

	const isDashboardUser = auth !== null;
	const t = await translateBatch(TRANSLATION_KEYS);

	return (
		<>
			{/* Hero Section */}
			<section className="relative overflow-hidden bg-gradient-hero">
				<div className="container-default py-20">
					<div className="max-w-3xl mx-auto text-center">
						<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
							{t['home.hero.title_prefix']}{' '}
							<span className="text-gradient">
								{t['home.hero.title_highlight']}
							</span>
							<br className="hidden sm:block" />{' '}
							{t['home.hero.title_suffix']}
						</h1>
						<p className="text-lg md:text-xl text-muted mb-8 max-w-2xl mx-auto">
							{t['home.hero.subtitle']}
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							{isDashboardUser ? (
								<Link
									size="lg"
									className="h-12 px-8 text-base"
									href={Routes.get('dashboard')}
								>
									{t['home.cta.go_dashboard']}
									<ArrowRight className="ml-2 h-5 w-5" />
								</Link>
							) : (
								<>
									<Link
										size="lg"
										className="h-12 px-8 text-base"
										href={Routes.get('register')}
										title={t['home.cta.create_account']}
									>
										{t['home.cta.create_account']}
										<ArrowRight className="ml-2 h-5 w-5" />
									</Link>
									<Link
										size="lg"
										variant="outline"
										className="h-12 px-8 text-base"
										href={Routes.get('login')}
										title={t['home.cta.sign_in']}
									>
										{t['home.cta.sign_in']}
									</Link>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Decorative elements */}
				<div className="absolute top-20 left-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
				<div className="absolute bottom-20 right-10 w-96 h-96 bg-default/50 rounded-full blur-3xl" />
			</section>

			{/* Features Section */}
			<section className="py-20">
				<div className="container-default">
					<div className="text-center mb-16">
						<h2 className="text-3xl md:text-4xl font-bold mb-4">
							{t['home.feature.heading']}
						</h2>
						<p className="text-lg text-muted max-w-2xl mx-auto">
							{t['home.feature.subheading']}
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{features.map((feature) => (
							<div
								key={feature.key}
								className="group p-6 rounded-xl border border-border bg-surface card-hover"
							>
								<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft mb-4">
									<feature.icon className="h-6 w-6 text-accent-soft-foreground" />
								</div>
								<h3 className="text-lg font-semibold mb-2">
									{t[`home.feature.${feature.key}_title`]}
								</h3>
								<p className="text-sm text-muted">
									{
										t[
											`home.feature.${feature.key}_description`
										]
									}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="pb-20 bg-surface-secondary/30">
				<div className="container-default">
					<div className="max-w-3xl mx-auto text-center">
						{isDashboardUser ? (
							<>
								<h2 className="text-3xl md:text-4xl font-bold mb-4">
									{t['home.cta.back_title']}
								</h2>
								<p className="text-lg text-muted mb-8">
									{t['home.cta.back_description']}
								</p>
								<div className="flex flex-col sm:flex-row gap-4 justify-center">
									<Link
										size="lg"
										className="h-12 px-8"
										href={Routes.get('dashboard')}
									>
										{t['home.cta.open_dashboard']}
									</Link>
								</div>
							</>
						) : (
							<>
								<h2 className="text-3xl md:text-4xl font-bold mb-4">
									{t['home.cta.ready_title']}
								</h2>
								<p className="text-lg text-muted mb-8">
									{t['home.cta.ready_description']}
								</p>
								<div className="flex flex-col sm:flex-row gap-4 justify-center">
									<Link
										size="lg"
										className="h-12 px-8"
										href={Routes.get('register')}
									>
										{t['home.cta.create_account']}
									</Link>
									<Link
										size="lg"
										variant="secondary"
										className="h-12 px-8"
										href={Routes.get('login')}
									>
										{t['home.cta.sign_in']}
									</Link>
								</div>
							</>
						)}
					</div>
				</div>
			</section>
		</>
	);
}
