import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';

/**
 * Header carrying the token on every mutating request. `/api/csrf` hands the same value to
 * the client and writes it to the httpOnly `csrf.cookieName` cookie; the middleware compares
 * the two.
 *
 * A custom header is doing real work here, not just transport: a cross-origin page cannot set
 * one without a CORS preflight it will not be granted, so the header alone already blocks a
 * forged submission, with the cookie comparison as the second factor.
 */
export const CSRF_HEADER = Configuration.get('csrf.inputName');

/** Marks a 403 as "stale token" rather than a genuine refusal, so the caller can retry. */
export const CSRF_REJECTION_CODE = 'csrf';

/**
 * Deliberately a plain `fetch` rather than `ApiRequest`: `api.helper` imports this module to
 * attach the header, so reaching back into it would close an import cycle.
 */
async function fetchCsrfToken(): Promise<string> {
	try {
		const response = await fetch(Routes.get('csrf'), {
			method: 'GET',
			credentials: 'same-origin',
		});

		if (!response.ok) {
			return '';
		}

		const payload = await response.json();

		return payload?.data?.csrfToken || '';
	} catch (error) {
		logger.error('Failed to fetch CSRF token', error);

		return '';
	}
}

/**
 * The in-flight request, not the resolved value, so concurrent first callers share one
 * `/api/csrf` round trip instead of racing several.
 */
let tokenRequest: Promise<string> | undefined;

export function getCsrfToken(): Promise<string> {
	// Server-side callers reach the backend directly through `remote-api` mode and never pass
	// the middleware's gate, so there is nothing to attach.
	if (typeof document === 'undefined') {
		return Promise.resolve('');
	}

	tokenRequest ??= fetchCsrfToken().then((token) => {
		// A failed fetch must not be cached, or one blip would leave the tab unable to submit
		// anything until reload.
		if (!token) {
			tokenRequest = undefined;
		}

		return token;
	});

	return tokenRequest;
}

/** Drops the cached token so the next read re-fetches — used after a rejected request. */
export function resetCsrfToken(): void {
	tokenRequest = undefined;
}
