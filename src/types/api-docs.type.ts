/**
 * Mirror of the backend's `ApiOutputDocumentation` (`../nready-api/src/helpers/
 * api-documentation.helper.ts`), which is what `GET /docs/:feature` serves.
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

export type ApiDocs = {
	/**
	 * Where the documented API answers. Every `path` is relative to it, and it is the only
	 * source for one: this app reaches the backend through its own proxy and `REMOTE_API_URL`
	 * is server-side, so a runnable example cannot be built without it.
	 */
	baseUrl: string;
	/** Keyed by controller action (`create`, `read`, `find`, ...). */
	actions: Record<string, ApiDocsAction>;
};

/** Narrows a `ApiDocsParamGroup` value, which is either one param or a nested group. */
export function isApiDocsParam(
	value: ApiDocsParam | Record<string, ApiDocsParam>,
): value is ApiDocsParam {
	return typeof (value as ApiDocsParam).type === 'string';
}
