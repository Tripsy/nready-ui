import { type NextRequest, NextResponse } from 'next/server';
import { Configuration } from '@/config/settings.config';
import { getRemoteApiUrl, remoteApiKeyHeader } from '@/helpers/api.helper';
import { getCookie } from '@/helpers/session.helper';
import { apiHeaders } from '@/helpers/system.helper';

/*
 * Longer than `ApiRequest.ABORT_TIMEOUT` (10s): this hop also carries file exports, which the
 * backend builds before answering. Without any bound, a backend that stalls holds the
 * connection - and the Node worker's socket - open indefinitely.
 */
const UPSTREAM_TIMEOUT = 30000;

/*
 * Backend response headers the browser can use. `RateLimit-*` / `Retry-After` let a caller see
 * its budget and back off; `ETag` pairs with the forwarded `If-None-Match` so an unchanged
 * read comes back as an empty 304; `X-Request-ID` ties a failure seen in the browser to the
 * backend's log line.
 */
const FORWARDED_RESPONSE_HEADERS = [
	'content-disposition',
	'etag',
	'ratelimit-policy',
	'ratelimit-limit',
	'ratelimit-remaining',
	'ratelimit-reset',
	'retry-after',
	'x-request-id',
];

const FORWARDED_REQUEST_HEADERS = ['if-none-match'];

function isCartResponse(path: string[]): boolean {
	return path[0] === 'public' && path[1] === 'cart';
}

async function handler(request: NextRequest, path: string[]) {
	const token = await getCookie(Configuration.get('user.sessionToken'));
	/*
	 * The guest cart handle, attached the same way the session token is and for the same
	 * reason: the browser called this origin, and neither credential exists on its side of
	 * the hop. A handle a script could read is a basket any script could take over.
	 *
	 * Absent on a first visit, which is not an error - the backend creates a cart and returns
	 * its token, and the response pass below is what stores it.
	 */
	const cartToken = await getCookie(Configuration.get('user.cartToken'));
	const baseUrl = getRemoteApiUrl(path.join('/'));
	const url = `${baseUrl}${request.nextUrl.search || ''}`;

	const headers = {
		'Content-Type': 'application/json',
		...(token && { Authorization: `Bearer ${token}` }),
		...(cartToken && { 'X-Cart-Token': cartToken }),
		...(await apiHeaders(request.headers)),
		// Attached here rather than by `ApiRequest`, which never sees this hop: the browser
		// called this origin, and the key only exists on this side of it.
		...remoteApiKeyHeader(),
		...Object.fromEntries(
			FORWARDED_REQUEST_HEADERS.flatMap((name) => {
				const value = request.headers.get(name);

				return value ? [[name, value]] : [];
			}),
		),
		/*
		 * A request carrying `If-None-Match` is switched to `no-store` by the Fetch spec, and
		 * `fetch` then appends `Cache-Control: no-cache` - which Express reads as "never answer
		 * 304". An explicit value stops the append and keeps the condition meaningful.
		 */
		...(request.headers.has('if-none-match') && {
			'Cache-Control': 'max-age=0',
		}),
	};

	const body = ['GET', 'HEAD'].includes(request.method)
		? undefined
		: await request.text();

	let backendRes: Response;

	try {
		backendRes = await fetch(url, {
			method: request.method,
			headers,
			body,
			next: { revalidate: 0 }, // Do not cache
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'TimeoutError') {
			return NextResponse.json(
				{
					success: false,
					message: 'The server took too long to respond',
				},
				{ status: 504 },
			);
		}

		throw error;
	}

	const contentType = backendRes.headers.get('content-type') || '';

	const responseHeaders = new Headers({
		/*
		 * Per-user data: the browser may keep a copy and revalidate it through the ETag, a
		 * shared cache in front of this app must not store it at all.
		 */
		'Cache-Control': 'private, no-cache',
	});

	if (contentType) {
		responseHeaders.set('Content-Type', contentType);
	}

	for (const name of FORWARDED_RESPONSE_HEADERS) {
		const value = backendRes.headers.get(name);

		if (value) {
			responseHeaders.set(name, value);
		}
	}

	/*
	 * Everything but a cart body streams through untouched - parsing and re-serializing every
	 * JSON response costs CPU on this hop for nothing. A 304 has no body to read either.
	 */
	if (
		!isCartResponse(path) ||
		!contentType.includes('application/json') ||
		backendRes.status === 304
	) {
		return new NextResponse(backendRes.body, {
			status: backendRes.status,
			headers: responseHeaders,
		});
	}

	const data = await backendRes.json();

	/*
	 * A cart response carries the handle the next request has to send back. Stored here
	 * rather than returned to the page, so it stays out of anything running in the
	 * browser - the field is still in the body the client receives, but nothing there
	 * needs to read it.
	 *
	 * Rewritten on every cart response, not only the first: the handle changes when a
	 * guest cart is merged into an account's at sign-in, and again after checkout, which
	 * deletes the cart - the next read finds nothing for the old handle and starts a fresh
	 * cart whose token arrives here.
	 */
	const nextCartToken = (data as { data?: { token?: unknown } })?.data?.token;

	const response = new NextResponse(JSON.stringify(data), {
		status: backendRes.status,
		headers: responseHeaders,
	});

	/*
	 * Set on the response object rather than through `cookies()` from `next/headers`.
	 * That helper writes to the request-scoped store, which a Route Handler returning its
	 * own `NextResponse` never folds back in - the cookie is silently dropped, and every
	 * page load then reads a cart it has no handle for and gets a brand new one.
	 */
	if (typeof nextCartToken === 'string' && nextCartToken !== cartToken) {
		response.cookies.set(
			Configuration.get('user.cartToken'),
			nextCartToken,
			{
				httpOnly: true,
				secure: Configuration.isEnvironment('production'),
				sameSite: 'lax',
				path: '/',
				maxAge: Configuration.get('user.cartTokenMaxAge'),
			},
		);
	}

	return response;
}

type Params = { params: Promise<{ path: string[] }> };

// Generic handler for all methods
async function handleRequest(req: NextRequest, { params }: Params) {
	const { path } = await params;

	return handler(req, path);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
