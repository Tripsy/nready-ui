import type { StatusTransitions } from '@/types/common.type';

/**
 * Normalizes date fields in an object while preserving all other properties.
 *
 * An absent or null field stays as it is — `new Date(null)` is the epoch, not "no date", so
 * converting one would turn a record that has never been updated into one updated on
 * 1 January 1970. `updated_at` and `deleted_at` are nullable on most models, which makes that
 * the ordinary case rather than an edge one.
 *
 * @param obj Object containing date strings
 * @param dateFields Names to normalize. The default covers the timestamps every entity
 *   carries; a model with its own (`user.password_updated_at`) must pass the full list, or
 *   that field silently stays a string while its type claims `Date`.
 */
export function normalizeDates<
	T extends Record<string, unknown>,
	K extends keyof T & string = keyof T & string,
>(
	obj: T | null,
	dateFields: string[] = ['created_at', 'updated_at', 'deleted_at'],
): { [P in keyof T]: P extends K ? Date | null : T[P] } | null {
	if (!obj) return null;

	const result = { ...obj };

	dateFields.forEach((field) => {
		const value = result[field];

		if (value === undefined || value === null) {
			return;
		}

		(result as Record<string, unknown>)[field] = new Date(value as string);
	});

	return result as { [P in keyof T]: P extends K ? Date | null : T[P] };
}

/**
 * Returns the allowed status transitions for a given status
 *
 * @param status
 * @param transitions
 */
export function getStatusTransitions<Status extends string>(
	status: Status,
	transitions: StatusTransitions<Status>,
): Status[] {
	return transitions[status] ?? [];
}
