/**
 * Mirror of the backend's `ApiOutputDocumentation` (`../nready-api/src/helpers/
 * api-documentation.helper.ts`), which is what `GET /api-docs/:feature` serves.
 *
 * Restated rather than imported — the two projects connect only over HTTP — so it has to be
 * kept in step with that type by hand when the backend's documentation shape changes.
 */

/** A single query/body/param entry. `values` is present for `type: 'enum'`. */
export type ApiDocsParam = {
	type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
	required: boolean;
	format?: string;
	values?: string[];
	default?: unknown;
	condition?: string;
};

/**
 * Params are one level nestable: the `find` action documents `filter` as a group of params
 * rather than a single one, so a value here is either a param or a named group of them.
 */
export type ApiDocsParamGroup = Record<
	string,
	ApiDocsParam | Record<string, ApiDocsParam>
>;

export type ApiDocsResponse = {
	description: string;
	content?: {
		success?: { type: 'boolean'; value: boolean };
		message?: { type: 'string'; value?: string };
		errors?: { type: 'array'; format: unknown[] };
		data?: {
			type: 'object' | 'array' | 'string' | 'number';
			sample?: unknown;
		};
	};
};

export type ApiDocsAction = {
	description: string;
	method: string;
	path: string;
	authorization?: string;
	request: {
		notes?: string;
		query?: ApiDocsParamGroup;
		body?: ApiDocsParamGroup;
		params?: ApiDocsParamGroup;
		sample?: Record<string, unknown>;
	};
	responses: Record<string, ApiDocsResponse>;
};

/**
 * How much of a route module needs a bearer token. `partial` is real, not defensive — the
 * `template` module gates every action but `readPage`, which is what renders a public page.
 */
export type ApiDocsAuthorization = 'none' | 'partial' | 'required';

export type ApiDocs = {
	/**
	 * Where the documented API answers. Every `path` is relative to it, and it is the only
	 * source for one: this app reaches the backend through its own proxy and `REMOTE_API_URL`
	 * is server-side, so a runnable example cannot be built without it.
	 */
	baseUrl: string;
	/** The route module's own name — `article` and `article-public` are separate entries. */
	feature: string;
	/** The permission entity the module's routes belong to; both article modules report `article`. */
	entity: string;
	basePath: string;
	authorization: ApiDocsAuthorization;
	/** Keyed by controller action (`create`, `read`, `find`, ...). */
	actions: Record<string, ApiDocsAction>;
};

/** One action as it appears in the catalogue: enough to list an endpoint, not to document it. */
export type ApiDocsCatalogueAction = {
	name: string;
	method: string;
	path: string;
	description: string;
	requires_authorization: boolean;
};

export type ApiDocsCatalogueEntry = {
	feature: string;
	entity: string;
	basePath: string;
	authorization: ApiDocsAuthorization;
	actions: ApiDocsCatalogueAction[];
};

/**
 * Every documented route module, served by `GET /docs` in one response — the catalogue page
 * renders the whole index without a request per feature.
 */
export type ApiDocsCatalogue = {
	baseUrl: string;
	entries: ApiDocsCatalogueEntry[];
};

/**
 * Anchor for one action on the `/api-docs/:feature` page, e.g. `#action-read`.
 *
 * Shared rather than inlined: the page's action index links to it and the renderer stamps it,
 * and the two silently stop matching if either side spells it alone.
 */
export function apiDocsActionAnchor(name: string): string {
	return `action-${name}`;
}

/** Narrows a `ApiDocsParamGroup` value, which is either one param or a nested group. */
export function isApiDocsParam(
	value: ApiDocsParam | Record<string, ApiDocsParam>,
): value is ApiDocsParam {
	return typeof (value as ApiDocsParam).type === 'string';
}
