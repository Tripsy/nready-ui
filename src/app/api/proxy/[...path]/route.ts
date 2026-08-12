'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { Configuration } from '@/config/settings.config';
import { getRemoteApiUrl } from '@/helpers/api.helper';
import { getCookie } from '@/helpers/session.helper';
import { apiHeaders } from '@/helpers/system.helper';

async function handler(request: NextRequest, path: string[]) {
	const token = await getCookie(Configuration.get('user.sessionToken'));
	const baseUrl = getRemoteApiUrl(path.join('/'));
	const url = `${baseUrl}${request.nextUrl.search || ''}`;

	const headers = {
		'Content-Type': 'application/json',
		...(token && { Authorization: `Bearer ${token}` }),
		...(await apiHeaders(request.headers)),
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

		return new NextResponse(JSON.stringify(data), {
			status: backendRes.status,
			headers: responseHeaders,
		});
	}

	// Non-JSON bodies (file downloads) are binary — reading them as text would
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
