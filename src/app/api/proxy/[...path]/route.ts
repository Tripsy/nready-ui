import { type NextRequest, NextResponse } from 'next/server';
import { Configuration } from '@/config/settings.config';
import { getRemoteApiUrl, remoteApiKeyHeader } from '@/helpers/api.helper';
import { getCookie } from '@/helpers/session.helper';
import { apiHeaders } from '@/helpers/system.helper';

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
	};

	const body = ['GET', 'HEAD'].includes(request.method)
		? undefined
		: await request.text();

	const backendRes = await fetch(url, {
		method: request.method,
		headers,
		body,
		next: { revalidate: 0 }, // Do not cache
	});

	const contentType = backendRes.headers.get('content-type') || '';
	const isJson = contentType.includes('application/json');

	const responseHeaders: Record<string, string> = {
		'Content-Type': contentType,
	};
	const contentDisposition = backendRes.headers.get('content-disposition');

	if (contentDisposition) {
		responseHeaders['Content-Disposition'] = contentDisposition;
	}

	if (isJson) {
		const data = await backendRes.json();

		/*
		 * A cart response carries the handle the next request has to send back. Stored here
		 * rather than returned to the page, so it stays out of anything running in the
		 * browser - the field is still in the body the client receives, but nothing there
		 * needs to read it.
		 *
		 * Rewritten on every cart response, not only the first: the handle changes when a
		 * guest cart is merged into an account's at sign-in, and when a converted cart is
		 * replaced by a fresh one after checkout.
		 */
		const nextCartToken = (data as { data?: { token?: unknown } })?.data
			?.token;

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
		if (
			path[0] === 'public' &&
			path[1] === 'cart' &&
			typeof nextCartToken === 'string' &&
			nextCartToken !== cartToken
		) {
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

	// Non-JSON bodies (file downloads) are binary - reading them as text would
	// corrupt anything that isn't valid UTF-8, e.g. an .xlsx's zip bytes.
	const data = await backendRes.arrayBuffer();

	return new NextResponse(data, {
		status: backendRes.status,
		headers: responseHeaders,
	});
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
