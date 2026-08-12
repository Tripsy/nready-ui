import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { Configuration } from '@/config/settings.config';
import { getTrackedCookie } from '@/helpers/session.helper';
import type { ApiResponseFetch } from '@/types/api.type';

type NextResponseCsrf = NextResponse<
	ApiResponseFetch<{
		csrfToken: string;
	}>
>;

export async function GET(): Promise<NextResponseCsrf> {
	const cookieName = Configuration.get('csrf.cookieName');

	const csrfToken = await getTrackedCookie(cookieName);

	if (!csrfToken.value) {
		csrfToken.value = uuid();
	}

	const response: NextResponseCsrf = NextResponse.json(
		{
			data: {
				csrfToken: csrfToken.value,
			},
			success: true,
			message: '',
		},
		{
			status: 200,
			headers: {
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'Referrer-Policy': 'strict-origin-when-cross-origin',
				'Cache-Control': 'no-store, max-age=0',
				'Content-Type': 'application/json',
				'Cross-Origin-Resource-Policy': 'same-origin',
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'require-corp',
			},
		},
	);

	if (csrfToken.action === 'set') {
		const cookieMaxAge = Configuration.get('csrf.cookieMaxAge');

		response.cookies.set(cookieName, csrfToken.value, {
			httpOnly: true,
			secure: Configuration.isEnvironment('production'),
			path: '/',
			sameSite: 'lax',
			maxAge: cookieMaxAge,
		});

		const cookieExpireValue = Date.now() + cookieMaxAge * 1000;

		response.cookies.set(
			`${cookieName}-expiration`,
			String(cookieExpireValue),
			{
				httpOnly: true,
				secure: Configuration.isEnvironment('production'),
				path: '/',
				sameSite: 'lax',
				maxAge: cookieMaxAge,
			},
		);
	}

	return response;
}

export const dynamic = 'force-dynamic'; // Ensure this route is never statically optimized
