import type { EntityId } from '@/types/entity-id.type';

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Whether a value read from a URL or a request body is shaped like a backend id, so a page can
 * answer 404 / 400 itself instead of sending the API a value it can only reject. Shape only - it
 * says nothing about whether such a row exists.
 */
export function isEntityId(value: unknown): value is EntityId {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Orders two ids for `Array.prototype.sort`. A UUID v7 leads with its creation time and is
 * fixed-width lowercase hex, so plain string order is creation order. Not `localeCompare`: a
 * collation is free to reorder characters.
 */
export function compareIds(first: EntityId, second: EntityId): number {
	if (first === second) {
		return 0;
	}

	return first < second ? -1 : 1;
}
