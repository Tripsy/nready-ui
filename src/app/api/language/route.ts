import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Configuration } from '@/config/settings.config';

export async function POST(req: NextRequest) {
	const body = await req.json();
	const language = body?.language as string;

	if (!language || !Configuration.isSupportedLanguage(language)) {
		return NextResponse.json(
			{ error: 'Unsupported language' },
			{ status: 400 },
		);
	}

	const response = NextResponse.json({
		data: {
			language: language,
		},
		success: true,
		message: '',
	});

	const languageCookie = Configuration.get('language.cookieName');
	const languageCookieMaxAge = Configuration.get('language.cookieMaxAge');

	response.cookies.set(languageCookie, language, {
		maxAge: languageCookieMaxAge,
		path: '/',
		sameSite: 'lax',
		secure: Configuration.isEnvironment('production'),
		httpOnly: true,
	});

	return response;
}

export const dynamic = 'force-dynamic'; // Ensure this route is never statically optimize
