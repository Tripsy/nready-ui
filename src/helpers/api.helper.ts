import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { ApiError } from '@/exceptions/api.error';
import {
	CSRF_HEADER,
	CSRF_REJECTION_CODE,
	getCsrfToken,
	resetCsrfToken,
} from '@/helpers/csrf.helper';
import { logger } from '@/helpers/logger.helper';
import type {
	ApiRequestMode,
	ApiResponseFetch,
	QueryFiltersType,
} from '@/types/api.type';
import type { DataSourceKey } from '@/types/data-source.key';

/**
 * Build a query string from an object
 *
 * @param {Record<string, string | number | boolean | undefined | null>} params - The object to build the query string from
 * @returns {string} - The query string
 */
export const buildQueryString = (params: QueryFiltersType): string => {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined || value === null || value === '') {
			return;
		}

		if (Array.isArray(value)) {
			value.forEach((v) => {
				query.append(key, String(v));
			});
			return;
		}

		if (typeof value === 'object') {
			if (key === 'filter') {
				Object.entries(value).forEach(([filterKey, filterValue]) => {
					// Prune exactly as the top-level branch above does. Without this an
					// unset filter is sent as the literal string "undefined", which the
					// backend then matches against.
					if (
						filterValue === undefined ||
						filterValue === null ||
						filterValue === ''
					) {
						return;
					}

					query.append(`filter[${filterKey}]`, String(filterValue));
				});
			} else {
				logger.warn('Skipping object param in query', undefined, {
					key,
				});
			}

			return;
		}

		query.append(key, String(value));
	});

	return query.toString();
};

export function getRemoteApiUrl(path: string): string {
	path = path.replace(/^\//, ''); // Remove the first ` / ` if exist

	return `${Configuration.get('remoteApi.url')}/${path}`;
}

export function getResponseData<T>(
	response: ApiResponseFetch<T>,
): T | undefined {
	return response?.data;
}

export class ApiRequest {
	static readonly ABORT_TIMEOUT: number = 10000; // 10s

	private requestInit: RequestInit = {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	};

	private requestMode: ApiRequestMode = 'use-proxy';

	public setRequestMode(mode: ApiRequestMode): this {
		this.requestMode = mode;

		return this;
	}

	private static mergeRequestInit(
		base: RequestInit,
		override: RequestInit,
	): RequestInit {
		const mergedHeaders = new Headers(base.headers || {});

		if (override.headers) {
			new Headers(override.headers).forEach((value, key) => {
				mergedHeaders.set(key, value);
			});
		}

		return {
			...base,
			...override,
			headers: mergedHeaders,
		};
	}

	private async handleJsonResponse(res: Response) {
		const text = await res.text();

		if (!text) {
			return null;
		}

		try {
			return JSON.parse(text);
		} catch {
			if (res.ok) {
				throw new Error('Invalid JSON response');
			}

			return null; // Explicitly return null for non-JSON error responses
		}
	}

	/**
	 * Always throws — declared `never` so callers are known to be unreachable afterward.
	 */
	private handleError(error: unknown): never {
		if (error instanceof ApiError) {
			throw error;
		}

		// `AbortSignal.timeout` rejects with a TimeoutError; a manual `controller.abort()`
		// rejects with an AbortError. Both mean the request ran out of time.
		if (
			error instanceof Error &&
			(error.name === 'TimeoutError' || error.name === 'AbortError')
		) {
			throw new ApiError('Request timeout', 408);
		}

		throw new ApiError(
			error instanceof Error ? error.message : 'Network request failed',
			0,
		);
	}

	private buildProxyRoute(path: string) {
		const [rawPath, rawQuery] = path.split('?');

		const routeSegments = rawPath.split('/').filter(Boolean); // eg: filter(Boolean) removes empty segments

		let proxyRoute = Routes.get('proxy', { path: routeSegments });

		if (rawQuery) {
			proxyRoute += `?${rawQuery}`;
		}

		return Configuration.get('app.url') + proxyRoute;
	}

	/**
	 * The middleware gates mutating `/api/*` requests on the CSRF header, so only requests
	 * that actually go through it need a token — `remote-api` calls leave the app entirely.
	 */
	private needsCsrfToken(requestOptions: RequestInit): boolean {
		const method = (requestOptions.method || 'GET').toUpperCase();

		if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
			return false;
		}

		return (
			this.requestMode === 'use-proxy' || this.requestMode === 'same-site'
		);
	}

	private static isStaleCsrfRejection(
		res: Response,
		payload: unknown,
	): boolean {
		return (
			res.status === 403 &&
			(payload as { code?: string } | null)?.code === CSRF_REJECTION_CODE
		);
	}

	private buildRequestUrl(path: string) {
		switch (this.requestMode) {
			case 'use-proxy':
				return this.buildProxyRoute(path);
			case 'same-site':
				return Configuration.get('app.url') + Routes.get(path);
			case 'remote-api':
				return getRemoteApiUrl(path);
			default:
				return path;
		}
	}

	/**
	 * Single funnel for every failure mode: whatever `performFetch` throws — a bad route
	 * name from `Routes.get`, a network or timeout rejection, an unparsable body, or the
	 * `ApiError` it raises for a non-2xx response — leaves this method as an `ApiError`.
	 */
	public async doFetch<T>(
		path: string,
		requestInit: RequestInit = {},
	): Promise<ApiResponseFetch<T>> {
		try {
			// Awaited rather than returned directly, so a rejection reaches the catch below
			// instead of escaping to the caller raw.
			return await this.performFetch<T>(path, requestInit);
		} catch (error) {
			this.handleError(error);
		}
	}

	private async performFetch<T>(
		path: string,
		requestInit: RequestInit,
	): Promise<ApiResponseFetch<T>> {
		const requestUrl = this.buildRequestUrl(path);

		const requestOptions = ApiRequest.mergeRequestInit(
			this.requestInit,
			requestInit,
		);

		// The platform has to set Content-Type for FormData because only it knows the
		// multipart boundary; the default JSON header would make the body unreadable.
		if (requestOptions.body instanceof FormData) {
			(requestOptions.headers as Headers).delete('Content-Type');
		}

		const withCsrf = this.needsCsrfToken(requestOptions);

		/*
		 * Two attempts at most. The CSRF cookie lives an hour, so a tab left open past
		 * that submits a stale token and earns one 403 — refreshing and retrying turns
		 * it into a save the user never notices, where a bare failure would look
		 * arbitrary. Only a rejection the middleware explicitly marked as stale is
		 * retried; every other 403 is a real refusal.
		 */
		for (let attempt = 0; attempt < 2; attempt++) {
			if (withCsrf) {
				(requestOptions.headers as Headers).set(
					CSRF_HEADER,
					await getCsrfToken(),
				);
			}

			const res = await fetch(requestUrl, {
				...requestOptions,
				/*
				 * One signal covering the whole exchange, headers and body alike.
				 * `fetch` resolves as soon as the headers arrive, so a deadline that
				 * ended there would leave the body read below unbounded and a server
				 * stalling mid-response would hang the request indefinitely. A signal
				 * also cannot be leaked the way a manually cleared timer can when
				 * something throws before the clear.
				 */
				signal: AbortSignal.timeout(ApiRequest.ABORT_TIMEOUT),
			});

			// Handle non-JSON responses (like 204 No Content)
			if (res.status === 204) {
				return undefined;
			}

			const jsonResponse: ApiResponseFetch<T> =
				await this.handleJsonResponse(res);

			if (res.ok) {
				return jsonResponse;
			}

			if (
				withCsrf &&
				attempt === 0 &&
				ApiRequest.isStaleCsrfRejection(res, jsonResponse)
			) {
				resetCsrfToken();

				continue;
			}

			throw new ApiError(
				`HTTP ${res.status} Error`,
				res.status,
				jsonResponse,
			);
		}

		return undefined;
	}
}

/** Data sources whose backend endpoint is the plural of the key. */
const PLURAL_ENDPOINT_KEYS: ReadonlySet<DataSourceKey> = new Set([
	'brand',
	'client',
	'image',
	'permission',
	'place',
	'template',
	'user',
	'vehicle',
	'vendor',
	'company-vehicle',
	'cmr-session',
	'cmr-vehicle',
	'work-session',
	'work-session-vehicle',
]);

export function resolveRequestPath(key: DataSourceKey) {
	if (PLURAL_ENDPOINT_KEYS.has(key)) {
		return `${key}s`;
	}

	return key;
}
