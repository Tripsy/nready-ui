import type { Metadata } from 'next';
import NextLink from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { AuthorizationBadge } from '@/app/(public)/api-docs/_components/authorization-badge.component';
import { ApiDocsView } from '@/components/api-docs.component';
import { MethodBadge } from '@/components/api-docs-method-badge.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { requestPublicFeatureDocs } from '@/services/docs.service';
import {
	type ApiDocs,
	apiDocsActionAnchor,
	isApiDocsEnabled,
} from '@/types/api-docs.type';

const TRANSLATION_PREFIX = 'api-docs';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.base_url',
	'text.entity',
	'text.module',
	'text.endpoints',
	'text.auth_none',
	'text.auth_partial',
	'text.auth_required',
	'text.auth_note',
	'text.cors_heading',
	'text.cors_note',
	'text.back_to_list',
] as const;

type Props = {
	params: Promise<{ feature: string }>;
};

/**
 * The backend answers 404 for a name it does not document and 422 for one that is not even a
 * module-shaped slug. Both mean "no such page"; anything else — a timeout, a 500 — is the
 * backend being unreachable and is rethrown, because answering 404 to that would tell a
 * crawler that an existing module is gone.
 */
async function loadFeatureDocs(feature: string): Promise<ApiDocs | null> {
	try {
		return (await requestPublicFeatureDocs(feature)) ?? null;
	} catch (error) {
		if (
			error instanceof ApiError &&
			(error.status === 404 || error.status === 422)
		) {
			return null;
		}

		throw error;
	}
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { feature } = await props.params;

	const [title, description] = await Promise.all([
		translate(`${TRANSLATION_PREFIX}.meta.feature_title`, {
			feature: feature,
			app_name: Configuration.get('app.name'),
		}),
		translate(`${TRANSLATION_PREFIX}.meta.feature_description`, {
			feature: feature,
		}),
	]);

	return { title, description };
}

export default async function Page(props: Props) {
	if (!isApiDocsEnabled()) {
		notFound();
	}

	const { feature } = await props.params;

	const [translations, docs] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		loadFeatureDocs(feature),
	]);

	if (!docs) {
		notFound();
	}

	const actions = Object.entries(docs.actions);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-4xl">
				<Breadcrumb
					items={[
						{
							label: translations['text.heading'],
							href: Routes.get('api-docs'),
						},
						{ label: docs.feature },
					]}
				/>

				<div className="mt-6 flex flex-wrap items-center gap-3">
					<h1 className="text-2xl font-semibold md:text-3xl">
						<code>{docs.basePath}</code>
					</h1>
					<AuthorizationBadge
						authorization={docs.authorization}
						label={translations[`text.auth_${docs.authorization}`]}
					/>
				</div>

				<dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
					<div>
						<dt className="text-muted">
							{translations['text.module']}
						</dt>
						<dd>{docs.feature}</dd>
					</div>
					<div>
						<dt className="text-muted">
							{translations['text.entity']}
						</dt>
						<dd>{docs.entity}</dd>
					</div>
					<div>
						<dt className="text-muted">
							{translations['text.base_url']}
						</dt>
						<dd className="break-all">
							<code>{docs.baseUrl}</code>
						</dd>
					</div>
				</dl>

				{/*
				 * An index of the endpoints below, in the order the module declares them, so a
				 * long module can be scanned and a single endpoint linked to.
				 */}
				<nav className="mt-8">
					<h2 className="text-sm font-semibold uppercase text-muted">
						{translations['text.endpoints']}
					</h2>
					<ul className="mt-2 divide-y divide-line border-y border-line">
						{actions.map(([name, action]) => (
							<li key={name}>
								<a
									href={`#${apiDocsActionAnchor(name)}`}
									className="flex flex-wrap items-baseline gap-2 py-2 hover:text-accent"
								>
									<MethodBadge method={action.method} />
									<code className="break-all">
										{action.path}
									</code>
									<span className="ml-auto text-xs text-muted">
										{name}
									</span>
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="mt-8">
					<ApiDocsView
						actions={docs.actions}
						baseUrl={docs.baseUrl}
						layout="stacked"
					/>
				</div>

				{/* Only where something here actually asks for a token — on a module
				    with no gated action the remark describes nothing on the page. */}
				{docs.authorization !== 'none' && (
					<p className="mt-8 text-sm text-muted">
						{translations['text.auth_note']}
					</p>
				)}

				<section className="mt-8 border-t border-line pt-6">
					<h2 className="text-sm font-semibold">
						{translations['text.cors_heading']}
					</h2>
					<p className="mt-1 text-sm text-muted">
						{translations['text.cors_note']}
					</p>
				</section>

				<NextLink
					href={Routes.get('api-docs')}
					className="mt-8 inline-block text-sm hover:text-accent"
				>
					← {translations['text.back_to_list']}
				</NextLink>
			</div>
		</div>
	);
}
