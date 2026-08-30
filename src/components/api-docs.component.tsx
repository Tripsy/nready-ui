'use client';

import { useQuery } from '@tanstack/react-query';
import { MethodBadge } from '@/components/api-docs-method-badge.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getErrorMessage } from '@/helpers/error.helper';
import { requestFeatureDocs } from '@/services/docs.service';
import {
	type ApiDocsAction,
	type ApiDocsParam,
	type ApiDocsParamGroup,
	apiDocsActionAnchor,
	isApiDocsParam,
} from '@/types/api-docs.type';

function ParamRow({ name, param }: { name: string; param: ApiDocsParam }) {
	const extras = [
		param.values?.length ? param.values.join(' | ') : null,
		param.format,
		param.condition,
		param.default !== undefined
			? `default: ${String(param.default)}`
			: null,
	].filter(Boolean);

	return (
		<li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1.5 border-b border-line last:border-b-0">
			<code className="font-semibold">{name}</code>
			<span className="text-xs text-muted">{param.type}</span>
			{param.required ? (
				<span className="text-xs text-danger">required</span>
			) : (
				<span className="text-xs text-muted">optional</span>
			)}
			{extras.length > 0 && (
				<span className="w-full text-xs text-muted">
					{extras.join(' — ')}
				</span>
			)}
		</li>
	);
}

/**
 * One `params`/`query`/`body` block. Entries are one level nestable — `find` documents its
 * `filter` as a group — so a nested group is rendered as its own indented list rather than
 * flattened, which would lose the fact that those keys live under `filter`.
 */
function ParamGroup({
	title,
	group,
}: {
	title: string;
	group: ApiDocsParamGroup;
}) {
	const entries = Object.entries(group);

	if (entries.length === 0) {
		return null;
	}

	return (
		<div>
			<p className="text-xs font-semibold uppercase text-muted mb-1">
				{title}
			</p>
			<ul>
				{entries.map(([name, value]) =>
					isApiDocsParam(value) ? (
						<ParamRow key={name} name={name} param={value} />
					) : (
						<li key={name} className="py-1.5">
							<code className="font-semibold">{name}</code>
							<ul className="ml-4 mt-1 border-l border-line pl-3">
								{Object.entries(value).map(
									([childName, childParam]) => (
										<ParamRow
											key={childName}
											name={childName}
											param={childParam}
										/>
									),
								)}
							</ul>
						</li>
					),
				)}
			</ul>
		</div>
	);
}

/**
 * Fills the `:name` placeholders in a documented path, since a runnable example cannot carry
 * them literally. The stand-in follows the param's documented type — `1` for a numeric id, the
 * first documented value for an enum — so the result is a request that would actually route.
 * Anything else falls back to `<name>`, which reads as the placeholder it is.
 */
function buildExampleUrl(baseUrl: string, action: ApiDocsAction): string {
	const params = action.request.params;

	const path = action.path.replace(
		/:([a-zA-Z_][a-zA-Z0-9_]*)/g,
		(_match, name) => {
			const param = params?.[name];

			if (!param || !isApiDocsParam(param)) {
				return `<${name}>`;
			}

			if (param.type === 'number') {
				return '1';
			}

			return param.values?.[0] ?? `<${name}>`;
		},
	);

	return `${baseUrl}${path}`;
}

const BEARER_PLACEHOLDER = '<token>';

/**
 * The sample payload, but only where it is a request *body*.
 *
 * `request.sample` is whatever the backend documented for the action, and for a read it describes
 * the path and query instead — the public article read samples `{ slug, language }`, both of which
 * are already in the URL. Keying on a documented `body` is what stops those turning into a GET
 * carrying `-d` and a JSON content type.
 */
function requestBodySample(
	action: ApiDocsAction,
): Record<string, unknown> | undefined {
	return action.request.body ? action.request.sample : undefined;
}

function buildCurlExample(baseUrl: string, action: ApiDocsAction): string {
	const body = requestBodySample(action);

	const lines = [
		`curl -X ${action.method.toUpperCase()} '${buildExampleUrl(baseUrl, action)}'`,
	];

	if (action.authorization) {
		lines.push(`  -H 'Authorization: Bearer ${BEARER_PLACEHOLDER}'`);
	}

	if (body) {
		lines.push(`  -H 'Content-Type: application/json'`);
		// Single-quoted so the JSON's own double quotes need no escaping.
		lines.push(`  -d '${JSON.stringify(body)}'`);
	}

	return lines.join(' \\\n');
}

function buildNodeExample(baseUrl: string, action: ApiDocsAction): string {
	const body = requestBodySample(action);

	const headers = [
		action.authorization
			? `\t\tAuthorization: \`Bearer \${token}\`,`
			: null,
		body ? `\t\t'Content-Type': 'application/json',` : null,
	].filter(Boolean);

	const options = [
		`\tmethod: '${action.method.toUpperCase()}',`,
		headers.length > 0 ? `\theaders: {\n${headers.join('\n')}\n\t},` : null,
		// Tab-indented, then every line after the first shifted one more tab, so the object
		// nests under `body:` and its closing brace lands back on that key's column.
		body
			? `\tbody: JSON.stringify(${JSON.stringify(body, null, '\t').replace(/\n/g, '\n\t')}),`
			: null,
	].filter(Boolean);

	return [
		`const response = await fetch('${buildExampleUrl(baseUrl, action)}', {`,
		...options,
		'});',
		'',
		'const result = await response.json();',
	].join('\n');
}

function CodeBlock({ title, code }: { title: string; code: string }) {
	return (
		<div>
			<p className="text-xs font-semibold uppercase text-muted mb-1">
				{title}
			</p>
			<pre className="bg-surface-secondary border border-line rounded p-2 text-xs overflow-x-auto">
				{code}
			</pre>
		</div>
	);
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
	return (
		<div>
			<p className="text-xs font-semibold uppercase text-muted mb-1">
				{title}
			</p>
			<pre className="bg-surface-secondary border border-line rounded p-2 text-xs overflow-x-auto">
				{JSON.stringify(value, null, 2)}
			</pre>
		</div>
	);
}

function ActionDocs({
	action,
	baseUrl,
	anchor,
	name,
}: {
	action: ApiDocsAction;
	baseUrl: string;
	/** Set by the stacked layout so a full-page action is directly linkable. */
	anchor?: string;
	/** The controller action, shown only where the actions are not already labeled by tabs. */
	name?: string;
}) {
	const { request, responses } = action;

	return (
		<section
			id={anchor}
			className="border border-line rounded-lg p-4 space-y-3 scroll-mt-24"
		>
			<div className="flex flex-wrap items-center gap-2">
				<MethodBadge method={action.method} />
				<code className="font-semibold break-all">{action.path}</code>
				{name && (
					<span className="text-xs text-muted ml-auto">{name}</span>
				)}
			</div>

			<p className="text-sm text-muted">{action.description}</p>

			{action.authorization && (
				<p className="text-xs text-muted">{action.authorization}</p>
			)}

			{request.notes && (
				<p className="text-xs text-warning">{request.notes}</p>
			)}

			{request.params && (
				<ParamGroup title="Path params" group={request.params} />
			)}
			{request.query && (
				<ParamGroup title="Query" group={request.query} />
			)}
			{request.body && <ParamGroup title="Body" group={request.body} />}

			{request.sample && (
				<JsonBlock title="Request sample" value={request.sample} />
			)}

			<CodeBlock title="cURL" code={buildCurlExample(baseUrl, action)} />
			<CodeBlock
				title="Node.js"
				code={buildNodeExample(baseUrl, action)}
			/>

			<div>
				<p className="text-xs font-semibold uppercase text-muted mb-1">
					Responses
				</p>
				<ul className="space-y-1">
					{Object.entries(responses).map(([status, response]) => (
						<li
							key={status}
							className="flex flex-wrap items-baseline gap-2 text-sm"
						>
							<Badge
								variant={
									status.startsWith('2')
										? 'success'
										: 'secondary'
								}
								size="xs"
							>
								{status}
							</Badge>
							<span className="text-muted">
								{response.description}
							</span>
						</li>
					))}
				</ul>
			</div>

			{responses['200']?.content?.data?.sample !== undefined && (
				<JsonBlock
					title="Response sample"
					value={responses['200'].content?.data?.sample}
				/>
			)}
		</section>
	);
}

// The status components size themselves for a full page, so inside a modal panel they
// need their min-height cut back to the content.
const STATUS_CLASS_NAME = 'min-h-0 py-8';

/**
 * The documented actions of one route module.
 *
 * `tabs` is the modal layout — one action at a time, which is all a window has room for.
 * `stacked` is the page layout: every action rendered in full, each behind its own anchor, so
 * a reader can scroll the module end to end and link to a single endpoint. Both put the same
 * markup in the DOM (the tab panels force-mount), so neither hides content from a crawler.
 */
export function ApiDocsView({
	actions,
	baseUrl,
	layout = 'tabs',
}: {
	actions: Record<string, ApiDocsAction>;
	baseUrl: string;
	layout?: 'tabs' | 'stacked';
}) {
	const entries = Object.entries(actions);

	if (entries.length === 0) {
		return (
			<ErrorComponent
				className={STATUS_CLASS_NAME}
				title="Nothing to show"
				description="This feature has no API documentation."
			/>
		);
	}

	if (layout === 'stacked') {
		return (
			<div className="space-y-6">
				{entries.map(([name, action]) => (
					<ActionDocs
						key={name}
						name={name}
						anchor={apiDocsActionAnchor(name)}
						action={action}
						baseUrl={baseUrl}
					/>
				))}
			</div>
		);
	}

	return (
		<Tabs defaultSelectedKey={entries[0][0]} className="w-full">
			{/*
			 * Styled as a plain row of labels rather than a segmented control: the container
			 * drops HeroUI's `bg-default` pill and each tab drops the sliding indicator that
			 * would otherwise track across it.
			 */}
			<TabsList
				containerClassName="bg-transparent rounded-none"
				className="flex flex-wrap justify-start gap-x-4 gap-y-1"
			>
				{entries.map(([name]) => (
					<TabsTrigger
						key={name}
						id={name}
						withIndicator={false}
						// Inverted against the HeroUI default, which mutes the *unselected*
						// tabs: here the selected action is the muted one.
						className="h-auto w-auto min-w-0 px-0 font-semibold text-foreground data-[selected=true]:text-muted"
					>
						{name}
					</TabsTrigger>
				))}
			</TabsList>

			{entries.map(([name, action]) => (
				<TabsContent key={name} id={name} className="pt-3">
					<ActionDocs action={action} baseUrl={baseUrl} />
				</TabsContent>
			))}
		</Tabs>
	);
}

/**
 * Fetches and renders the documentation for one feature, for a caller that has only the
 * feature name — the dashboard's usage guide.
 *
 * `enabled` is the caller's switch for deferring the request until the docs are actually on
 * screen — the tab hosting this stays mounted while hidden (see `ui/tabs`), so without it the
 * fetch would fire for everyone who opens the window.
 *
 * A page that can fetch server-side should render `ApiDocsView` with the data instead, so the
 * docs are in the first HTML rather than behind a client round trip.
 */
export function ApiDocs({
	feature,
	enabled = true,
}: {
	feature: string;
	enabled?: boolean;
}) {
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ['api-docs', feature],
		queryFn: () => requestFeatureDocs(feature),
		enabled,
	});

	if (!enabled || isLoading) {
		return <LoadingComponent className={STATUS_CLASS_NAME} />;
	}

	if (isError) {
		return (
			<ErrorComponent
				className={STATUS_CLASS_NAME}
				description={getErrorMessage(error)}
			/>
		);
	}

	return (
		<ApiDocsView
			actions={data?.actions ?? {}}
			baseUrl={data?.baseUrl ?? ''}
		/>
	);
}
