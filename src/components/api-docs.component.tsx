'use client';

import { useQuery } from '@tanstack/react-query';
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
	isApiDocsParam,
} from '@/types/api-docs.type';

/** `get` is the only method that reads; everything else changes state, so it is coloured. */
function methodVariant(method: string) {
	switch (method.toLowerCase()) {
		case 'get':
			return 'info' as const;
		case 'post':
			return 'success' as const;
		case 'put':
		case 'patch':
			return 'warning' as const;
		case 'delete':
			return 'error' as const;
		default:
			return 'secondary' as const;
	}
}

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
 * them literally. The stand-in follows the param's documented type — `1` for the numeric ids
 * every path here uses — so the result stays plausible against the real route.
 */
function buildExampleUrl(baseUrl: string, action: ApiDocsAction): string {
	const params = action.request.params;

	const path = action.path.replace(
		/:([a-zA-Z_][a-zA-Z0-9_]*)/g,
		(_match, name) => {
			const param = params?.[name];

			if (param && isApiDocsParam(param) && param.type === 'number') {
				return '1';
			}

			return `<${name}>`;
		},
	);

	return `${baseUrl}${path}`;
}

const BEARER_PLACEHOLDER = '<token>';

function buildCurlExample(baseUrl: string, action: ApiDocsAction): string {
	const body = action.request.sample;

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
	const body = action.request.sample;

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
}: {
	action: ApiDocsAction;
	baseUrl: string;
}) {
	const { request, responses } = action;

	return (
		<section className="border border-line rounded-lg p-4 space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={methodVariant(action.method)} size="xs">
					{action.method.toUpperCase()}
				</Badge>
				<code className="font-semibold break-all">{action.path}</code>
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

/**
 * Renders the generated backend documentation for one feature.
 *
 * `enabled` is the caller's switch for deferring the request until the docs are actually on
 * screen — the tab hosting this stays mounted while hidden (see `ui/tabs`), so without it the
 * fetch would fire for everyone who opens the window.
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

	// The status components size themselves for a full page, so inside a modal panel they
	// need their min-height cut back to the content.
	const statusClassName = 'min-h-0 py-8';

	if (!enabled || isLoading) {
		return <LoadingComponent className={statusClassName} />;
	}

	if (isError) {
		return (
			<ErrorComponent
				className={statusClassName}
				description={getErrorMessage(error)}
			/>
		);
	}

	const actions = Object.entries(data?.actions ?? {});

	if (actions.length === 0) {
		return (
			<ErrorComponent
				className={statusClassName}
				title="Nothing to show"
				description="This feature has no API documentation."
			/>
		);
	}

	return (
		<Tabs defaultSelectedKey={actions[0][0]} className="w-full">
			{/*
			 * Styled as a plain row of labels rather than a segmented control: the container
			 * drops HeroUI's `bg-default` pill and each tab drops the sliding indicator that
			 * would otherwise track across it.
			 */}
			<TabsList
				containerClassName="bg-transparent rounded-none"
				className="flex flex-wrap justify-start gap-x-4 gap-y-1"
			>
				{actions.map(([name]) => (
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

			{actions.map(([name, action]) => (
				<TabsContent key={name} id={name} className="pt-3">
					<ActionDocs action={action} baseUrl={data?.baseUrl ?? ''} />
				</TabsContent>
			))}
		</Tabs>
	);
}
