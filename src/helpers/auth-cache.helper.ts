import { createHash } from 'node:crypto';
import { Configuration } from '@/config/settings.config';
import { getCacheProvider } from '@/helpers/cache.provider';
import { type AuthModel, prepareAuthModel } from '@/models/auth.model';

const KEY_NAMESPACE = 'auth';
const KEY_LABEL = 'me';

/**
 * Short-lived cache for the backend's `/account/me` response.
 *
 * The proxy (`src/proxy.ts`) resolves auth on every matched request, so uncached, every
 * single navigation pays a backend round-trip before the page can start rendering.
 *
 * Driven through `CacheProvider`'s `read`/`set`/`delete` rather than its read-through
 * `get()`, because only a *successful* lookup may be stored — see `resolveAuthModel()` in
 * the proxy.
 *
 * Staleness is bounded by the TTL: a permission or role change made in the backend takes up
 * to `cache.authTtl` seconds to reach the proxy. Logout clears the entry outright, so a
 * logged-out session is never authorised from cache.
 */

/**
 * The session token is a bearer credential, so it never becomes part of a Redis key —
 * anyone able to read the keyspace could otherwise harvest live sessions. A SHA-256 digest
 * gives a stable, collision-free lookup; reversibility is not wanted here.
 */
function buildKey(sessionToken: string): string {
	return getCacheProvider().buildKey(
		KEY_NAMESPACE,
		KEY_LABEL,
		createHash('sha256').update(sessionToken).digest('hex'),
	);
}

function getTtl(): number {
	return Number(Configuration.get('cache.authTtl'));
}

export async function getCachedAuthModel(
	sessionToken: string,
): Promise<AuthModel | null> {
	if (getTtl() <= 0) {
		return null;
	}

	const cached = await getCacheProvider().read(buildKey(sessionToken));

	if (!cached || typeof cached !== 'object') {
		return null;
	}

	// JSON round-tripping turns the model's Date fields back into strings, so re-run the
	// same normalisation the fresh path applies — the cached and uncached results are then
	// indistinguishable to every caller.
	return prepareAuthModel(cached as AuthModel);
}

export async function setCachedAuthModel(
	sessionToken: string,
	auth: AuthModel,
): Promise<void> {
	const ttl = getTtl();

	if (ttl <= 0) {
		return;
	}

	await getCacheProvider().set(buildKey(sessionToken), auth, ttl);
}

export async function clearCachedAuthModel(
	sessionToken: string,
): Promise<void> {
	if (getTtl() <= 0) {
		return;
	}

	await getCacheProvider().delete(buildKey(sessionToken));
}
