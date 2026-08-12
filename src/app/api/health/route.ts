import { NextResponse } from 'next/server';

/**
 * Liveness probe for the container healthcheck and the reverse proxy.
 *
 * Deliberately checks nothing beyond "this process is serving requests". Reaching into
 * Redis or the backend API from here would make an outage in either one mark this
 * container unhealthy and take it out of rotation, turning a degraded dependency into a
 * hard outage of the app itself.
 *
 * `proxy.ts` lets this through unauthenticated: the CSRF and origin gates only apply to
 * mutating methods, and `/api/health` matches no entry in `Routes`, so no auth check runs.
 */
export async function GET() {
	return NextResponse.json(
		{ status: 'ok' },
		{
			status: 200,
			headers: {
				'Cache-Control': 'no-store, max-age=0',
			},
		},
	);
}

export const dynamic = 'force-dynamic'; // Ensure this route is never statically optimized
