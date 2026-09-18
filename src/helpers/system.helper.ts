import { headers } from 'next/headers';

/**
 * Removes a trailing `:port` without damaging the address itself.
 *
 * An IPv6 address is built out of colons, so splitting on the first one keeps a single hextet
 * (`2001:db8::1` becomes `2001`). Only two forms actually carry a port: the bracketed IPv6
 * form, and `host:port` where the host holds no colon of its own.
 */
function stripPort(value: string): string {
	const bracketed = value.match(/^\[(.+)\]/);

	if (bracketed) {
		return bracketed[1];
	}

	// More than one colon means a bare IPv6 address, which cannot carry a port unbracketed.
	if (value.indexOf(':') !== value.lastIndexOf(':')) {
		return value;
	}

	return value.split(':')[0];
}

export async function getClientIp(
	headersProvided?: Headers,
): Promise<string | undefined> {
	const headersSource = headersProvided || (await headers());

	// 1. First try x-forwarded-for header (common in proxies)
	const forwardedIp = headersSource.get('x-forwarded-for');

	// Extract the first IP from x-forwarded-for if exists
	let ip = forwardedIp
		? forwardedIp.split(',')[0].trim()
		: headersSource.get('cf-connecting-ip') ||
			headersSource.get('x-real-ip');

	if (!ip) {
		return undefined;
	}

	// Unwrap an IPv4-mapped IPv6 address (`::ffff:203.0.113.7`) to its IPv4 form first, so
	// what follows sees a plain address.
	ip = ip.replace(/^::ffff:/, '');

	// Remove port number if exists; brackets around an IPv6 address go with it
	return stripPort(ip);
}

type ApiHeaders = {
	'User-Agent': string;
	'Accept-Language': string;
	'X-Forwarded-For': string;
	'X-Client-IP': string;
	'X-Client-OS': string;
};

/**
 * Headers describing the visitor, attached to every backend call the proxy makes on their
 * behalf - without them the backend sees this app's container and nothing of the reader.
 *
 * `X-Forwarded-For` is the one the backend's `getClientIp` actually reads (it falls back to
 * `req.ip`, which through the proxy is this container). `X-Client-IP` carries the same value
 * and no backend reads it; it stays because the header is part of the request shape other
 * deployments may already log against.
 *
 * That matters beyond the audit trail: `rating` rations one vote per origin address, so a
 * backend that cannot tell two readers apart gives the whole site a single vote per target.
 */
export async function apiHeaders(
	headersProvided?: Headers,
): Promise<ApiHeaders> {
	const headersSource = headersProvided || (await headers());

	// Resolved rather than forwarded verbatim: `getClientIp` reads the edge proxy's own
	// `x-forwarded-for` and takes the first entry, so a visitor appending their own value
	// cannot push a forged address ahead of it.
	const clientIp = (await getClientIp(headersSource)) || '';

	return {
		'User-Agent': headersSource.get('user-agent') || '',
		'Accept-Language': headersSource.get('accept-language') || '',
		'X-Forwarded-For': clientIp,
		'X-Client-IP': clientIp,
		'X-Client-OS': headersSource.get('x-client-os') || '',
	};
}
