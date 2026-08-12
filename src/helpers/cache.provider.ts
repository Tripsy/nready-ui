import type Redis from 'ioredis';
import { getRedisClient } from '@/config/init-redis.config';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';

type CacheData = unknown;

type CacheGetResults = {
	isCached: boolean;
	data: CacheData | null;
};

export class CacheProvider {
	constructor(private readonly cache: Redis) {}

	buildKey(...args: string[]) {
		return [Configuration.get('redis.keyPrefix'), ...args]
			.filter((arg) => arg !== '')
			.join(':');
	}

	determineTtl(ttl?: number): number {
		return ttl === undefined ? Configuration.get('cache.ttl') : ttl;
	}

	formatInputData(data: CacheData): string | number {
		if (typeof data === 'number') {
			return data;
		}

		if (typeof data === 'boolean') {
			return data ? 'true' : 'false';
		}

		if (typeof data === 'string') {
			return data;
		}

		try {
			return JSON.stringify(data);
		} catch {
			return String(data);
		}
	}

	formatOutputData(data: CacheData): CacheData {
		if (data === null || typeof data !== 'string') {
			return data;
		}

		try {
			const trimmed = data.trim();

			if (
				trimmed.startsWith('{') ||
				trimmed.startsWith('[') ||
				trimmed.startsWith('"')
			) {
				return JSON.parse(data);
			}

			return data;
		} catch {
			// Return as-is if not valid JSON
			return data;
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const exists = await this.cache.exists(key);

			return exists === 1;
		} catch (error) {
			logger.error('Cache exists check failed', error, { key });

			return false;
		}
	}

	async get(
		key: string,
		fetchFunction: () => Promise<CacheData>,
		ttl?: number,
	): Promise<CacheGetResults> {
		const results: CacheGetResults = {
			isCached: false,
			data: null,
		};

		const resolvedTtl = this.determineTtl(ttl);

		if (resolvedTtl === 0) {
			results.data = await fetchFunction();

			return results;
		}

		let cachedData: string | null = null;

		try {
			cachedData = await this.cache.get(key);
		} catch (error) {
			logger.error('Cache read failed', error, { key });
		}

		if (cachedData) {
			results.isCached = true;
			results.data = this.formatOutputData(cachedData);

			return results;
		}

		results.data = await fetchFunction();

		await this.set(key, results.data, resolvedTtl);

		return results;
	}

	/**
	 * Raw read with no fetch-on-miss.
	 *
	 * The read-through `get()` always stores whatever the fetch function returned, so it
	 * cannot express "only some outcomes may be cached" — auth is the case in point: a
	 * backend outage has to stay a live decision instead of being persisted for the TTL.
	 * Callers with that constraint drive the cache themselves via `read()`/`set()`.
	 *
	 * Worth backporting to `star-api`, which has the same gap.
	 */
	async read(key: string): Promise<CacheData> {
		try {
			return this.formatOutputData(await this.cache.get(key));
		} catch (error) {
			logger.error('Cache raw read failed', error, { key });

			return null;
		}
	}

	async set(key: string, data: CacheData, ttl?: number) {
		const resolvedTtl = this.determineTtl(ttl);

		/*
		 * Redis rejects `EX 0` outright ("ERR invalid expire time in 'set' command"), and the
		 * catch below would turn that into a silent no-op with only a log line. A resolved TTL
		 * of 0 means caching is switched off — `get()` already reads it that way — so skip the
		 * write rather than issue one that cannot succeed. This is reachable through the
		 * default alone: `cache.ttl` is 0 in .env, so any caller omitting `ttl` lands here.
		 */
		if (resolvedTtl <= 0) {
			return;
		}

		try {
			if (data !== null) {
				await this.cache.set(
					key,
					this.formatInputData(data),
					'EX',
					resolvedTtl,
				);
			}
		} catch (error) {
			logger.error('Cache write failed', error, { key });
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await this.cache.del(key);
		} catch (error) {
			logger.error('Cache delete failed', error, { key });
		}
	}

	/**
	 * Atomically read a key and delete it in the same round-trip, returning the
	 * previous value (or null). Used for single-use tokens where a read must not
	 * be replayable. A MULTI is used rather than GETDEL so it works regardless of
	 * the Redis server version.
	 */
	async readAndDrop(key: string): Promise<CacheData> {
		try {
			const results = await this.cache.multi().get(key).del(key).exec();

			// results: [[err, value], [err, delCount]]
			const value = (results?.[0]?.[1] ?? null) as string | null;

			return this.formatOutputData(value);
		} catch (error) {
			logger.error('Cache read-and-drop failed', error, { key });

			return null;
		}
	}

	/**
	 * Delete multiple cache entries by pattern.
	 * @param pattern - The pattern to match cache keys.
	 *
	 * ex: pattern = user:* > user:1, user:2
	 */
	async deleteByPattern(pattern: string): Promise<void> {
		try {
			let cursor = '0';

			do {
				// Scan for matching keys in small batches
				const [nextCursor, keys] = await this.cache.scan(
					cursor,
					'MATCH',
					pattern,
					'COUNT',
					100,
				);
				cursor = nextCursor;

				if (keys.length > 0) {
					const pipeline = this.cache.pipeline();

					keys.forEach((key) => {
						pipeline.del(key);
					});

					await pipeline.exec();
				}
			} while (cursor !== '0'); // Continue until all keys are scanned
		} catch (error) {
			logger.error('Cache pattern delete failed', error, { pattern });
		}
	}
}

let cacheProviderInstance: CacheProvider | null = null;

export const getCacheProvider = (): CacheProvider => {
	cacheProviderInstance ??= new CacheProvider(getRedisClient());

	return cacheProviderInstance;
};
