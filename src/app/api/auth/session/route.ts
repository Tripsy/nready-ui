import { type NextRequest, NextResponse } from 'next/server';
import { translate } from '@/config/translate.setup';
import { writeSessionCookie } from '@/helpers/session.helper';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Writes the session cookie for a token the backend has just issued.
 */
export async function POST(
	request: NextRequest,
): Promise<NextResponse<ApiResponseFetch<null>>> {
	let token: unknown;

	try {
		({ token } = await request.json());
	} catch {
		token = undefined;
	}

	if (typeof token !== 'string' || !token) {
		return NextResponse.json(
			{
				message: 'No token provided',
				success: false,
			},
			{ status: 400 },
		);
	}

	const response: NextResponse<ApiResponseFetch<null>> = NextResponse.json({
		message: await translate('login.message.auth_success'),
		success: true,
	});

	await writeSessionCookie(token);

	return response;
}
