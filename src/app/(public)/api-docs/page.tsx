import type { Metadata } from 'next';
import NextLink from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { AuthorizationBadge } from '@/app/(public)/api-docs/_components/authorization-badge.component';
import { MethodBadge } from '@/components/api-docs-method-badge.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';
import { logger } from '@/helpers/logger.helper';
import { requestDocsCatalogue } from '@/services/docs.service';
import {
	type ApiDocsAuthorization,
	type ApiDocsCatalogue,
	type ApiDocsCatalogueEntry,
	isApiDocsEnabled,
} from '@/types/api-docs.type';

const TRANSLATION_PREFIX = 'api-docs';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.subheading',
	'text.base_url',
	'text.group_none',
	'text.group_none_hint',
	'text.group_required',
	'text.group_required_hint',
	'text.entity',
	'text.auth_none',
	'text.auth_partial',
	'text.auth_required',
	'text.auth_note',
	'text.cors_heading',
	'text.cors_note',
	'text.unavailable',
] as const;

type Translations = Record<(typeof TRANSLATION_KEYS)[number], string>;

/**
 * The order the groups are presented in - open first, because that is the half of the API a
 * reader with no account can act on today.
 *
 * `partial` is deliberately absent: a feature that mixes open and gated endpoints is split into
 * two route modules on the backend, so every entry reports one state or the other. An entry that
 * did report `partial` would fall outside every group, which `loadCatalogue`'s caller logs rather
 * than dropping in silence.
 */
const GROUP_ORDER: Exclude<ApiDocsAuthorization, 'partial'>[] = [
	'none',
	'required',
];

export async function generateMetadata(): Promise<Metadata> {
	const [title, description] = await Promise.all([
		translate(`${TRANSLATION_PREFIX}.meta.title`, {
			app_name: Configuration.get('app.name'),
		}),
		translate(`${TRANSLATION_PREFIX}.meta.description`),
	]);

	return { title, description };
}

/**
 * The catalog is one request for every module, so a failure is total - rendered as a notice
 * rather than thrown, since an unreachable backend should not turn the reference into an
 * error page.
 */
async function loadCatalogue(): Promise<ApiDocsCatalogue | null> {
	try {
		return (await requestDocsCatalogue()) ?? null;
	} catch (error) {
		logger.error('Failed to load the API documentation catalog', error);

		return null;
	}
}

function ModuleCard({
	entry,
	translations,
}: {
	entry: ApiDocsCatalogueEntry;
	translations: Translations;
}) {
	return (
		<NextLink
			href={Routes.get('api-docs-feature', { feature: entry.feature })}
			className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent"
		>
			{/* The path gets the row to itself - a long one would otherwise push the
			    badge onto a second line and leave the card header ragged. */}
			<code className="font-semibold break-all">{entry.basePath}</code>

			<p className="text-sm text-muted">
				{translations['text.entity']}:{' '}
				<span className="text-foreground">{entry.entity}</span>
			</p>

			{/*
			 * Deduplicated: a module documents one action per route, and several of them share
			 * a method - the row is meant to say which verbs the module answers to, not how
			 * many times each appears.
			 */}
			<div className="flex flex-wrap gap-1.5">
				{[...new Set(entry.actions.map((action) => action.method))].map(
					(method) => (
						<MethodBadge key={method} method={method} />
					),
				)}
			</div>

			<div className="mt-auto flex items-center justify-between gap-2 pt-1">
				<span className="text-xs text-muted">{entry.feature}</span>
				<AuthorizationBadge
					authorization={entry.authorization}
					label={translations[`text.auth_${entry.authorization}`]}
				/>
			</div>
		</NextLink>
	);
}

export default async function Page() {
	if (!isApiDocsEnabled()) {
		notFound();
	}

	const [translations, catalogue] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		loadCatalogue(),
	]);

	const entries = catalogue?.entries ?? [];

	const groups = GROUP_ORDER.map((authorization) => ({
		authorization,
		entries: entries.filter(
			(entry) => entry.authorization === authorization,
		),
	})).filter((group) => group.entries.length > 0);

	/*
	 * Only `partial` can land here, and only if a backend module regains a mixed set of
	 * endpoints. The page cannot render it - there is no group to put it in - so it is named
	 * in the server log rather than disappearing from an index that claims to list every
	 * documented module.
	 */
	const ungrouped = entries.filter(
		(entry) =>
			!GROUP_ORDER.some(
				(authorization) => authorization === entry.authorization,
			),
	);

	if (ungrouped.length > 0) {
		logger.warn('API documentation modules left out of the catalog', null, {
			features: ungrouped.map((entry) => entry.feature),
		});
	}

	return (
		<div className="container-default py-12 md:py-16">
			<div>
				<Breadcrumb items={[{ label: translations['text.heading'] }]} />

				<h1 className="mt-6 text-3xl font-semibold md:text-4xl">
					{translations['text.heading']}
				</h1>
				<p className="mt-3 max-w-2xl text-muted">
					{translations['text.subheading']}
				</p>

				{catalogue ? (
					<>
						<p className="mt-6 text-sm text-muted">
							{translations['text.base_url']}:{' '}
							<code className="text-foreground">
								{catalogue.baseUrl}
							</code>
						</p>

						{groups.map((group) => (
							<section
								key={group.authorization}
								className="mt-10"
							>
								<h2 className="text-xl font-semibold">
									{
										translations[
											`text.group_${group.authorization}`
										]
									}
								</h2>
								<p className="mt-1 text-sm text-muted">
									{
										translations[
											`text.group_${group.authorization}_hint`
										]
									}
								</p>

								{/*
								 * Sits with the groups that have gated endpoints rather than
								 * at the foot of the page: it qualifies what "requires a
								 * token" buys you, and read anywhere else it looks like a
								 * remark about the open modules too.
								 */}
								{group.authorization !== 'none' && (
									<p className="mt-1 text-sm text-muted">
										{translations['text.auth_note']}
									</p>
								)}

								<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{group.entries.map((entry) => (
										<ModuleCard
											key={entry.feature}
											entry={entry}
											translations={translations}
										/>
									))}
								</div>
							</section>
						))}

						<section className="mt-12 border-t border-line pt-6">
							<h2 className="text-sm font-semibold">
								{translations['text.cors_heading']}
							</h2>
							<p className="mt-1 max-w-3xl text-sm text-muted">
								{translations['text.cors_note']}
							</p>
						</section>
					</>
				) : (
					<p className="mt-10 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
						{translations['text.unavailable']}
					</p>
				)}
			</div>
		</div>
	);
}
