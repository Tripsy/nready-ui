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
	'X-Client-IP': string;
	'X-Client-OS': string;
};

export async function apiHeaders(
	headersProvided?: Headers,
): Promise<ApiHeaders> {
	const headersSource = headersProvided || (await headers());

	return {
		'User-Agent': headersSource.get('user-agent') || '',
		'Accept-Language': headersSource.get('accept-language') || '',
		'X-Client-IP': (await getClientIp(headersSource)) || '',
		'X-Client-OS': headersSource.get('x-client-os') || '',
	};
}
