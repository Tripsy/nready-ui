import { z } from 'zod';

/** `HH:MM` on a 24-hour clock, which is the only shape the time picker produces. */
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A stored clock time as the form holds it: `HH:MM`, or null for an all-day window.
 *
 * Postgres hands a `time` column back as `HH:MM:SS`, which neither the picker nor the schema
 * accepts - a window seeded raw would render as "09:00:00" and then fail validation on the next
 * save without the user having touched it. Null passes through: the two columns are null together
 * and that is what all day means.
 */
export function toClockValue(value: string | null): string | null {
	return value ? value.slice(0, 5) : null;
}

/**
 * One recurring ordering window, validated.
 *
 * A factory rather than a field on a validator class because both the product form and the
 * bundle form edit the same `availabilities` array against the same endpoint - a bundle is a
 * product - and the rules must not drift between them. It takes its messages already resolved,
 * so it stays free of any one entity's translation namespace.
 *
 * Plain zod primitives rather than `BaseValidator`'s helpers: the list rides in a hidden JSON
 * field, so `day_of_week` arrives as a real number and the times as `HH:MM` strings, with no
 * coercion from form-encoded text to undo. The helpers also widen their output with `null`,
 * which a required clock time is not.
 *
 * Both refinements mirror `@Check` constraints on `product_availability`. They are repeated here
 * rather than left to the server because a constraint violation reaches the client as a masked
 * 500 - the backend's own validator makes the same pair for the same reason.
 */
export function buildAvailabilitySchema(messages: {
	invalid: string;
	endBeforeStart: string;
	hoursPaired: string;
	dayDuplicate: string;
	everyDayExclusive: string;
}) {
	return (
		z
			.object({
				// Client-only row identity - see `ProductAvailabilityFormType`. In the schema so
				// a re-parse keeps it; stripped before the payload is built.
				key: z.string(),
				/*
				 * ISO 8601, 1 = Monday … 7 = Sunday - not what `getDay()` returns. Null is a
				 * real value meaning every day, which is why it is nullable rather than
				 * defaulted, and the range mirrors the table's check constraint.
				 */
				day_of_week: z
					.number({ message: messages.invalid })
					.int({ message: messages.invalid })
					.min(1, { message: messages.invalid })
					.max(7, { message: messages.invalid })
					.nullable(),
				/*
				 * Null in both together means all day. The pairing is a rule of its own below,
				 * and a check constraint on the table enforces the same thing.
				 */
				starts_at: z
					.string({ message: messages.invalid })
					.regex(CLOCK_PATTERN, { message: messages.invalid })
					.nullable(),
				ends_at: z
					.string({ message: messages.invalid })
					.regex(CLOCK_PATTERN, { message: messages.invalid })
					.nullable(),
			})
			// Reported on `ends_at` because that is the one a half-filled row usually lacks.
			.refine((data) => !data.starts_at === !data.ends_at, {
				message: messages.hoursPaired,
				path: ['ends_at'],
			})
			/*
			 * String comparison is correct for `HH:MM`, which is zero-padded and so sorts
			 * lexicographically. A window may not wrap past midnight - an overnight service is
			 * two windows, and the backend refuses a single wrapping one too.
			 */
			.refine(
				(data) =>
					!data.starts_at ||
					!data.ends_at ||
					data.ends_at > data.starts_at,
				{
					message: messages.endBeforeStart,
					path: ['ends_at'],
				},
			)
	);
}

/**
 * The set of intervals, with the two rules that hold across it.
 *
 * One interval per day: a product is orderable on a given weekday between one pair of hours, not
 * several. A partial unique index on `(product_id, day_of_week) NULLS NOT DISTINCT` backs the
 * same-day half up at the database; the every-day half has no index that could reach it, because
 * it compares rows holding *different* values.
 *
 * Each message lands on the offending row's own `day_of_week` rather than on the array. That is
 * both better placed - it renders against the select the editor has to change - and simpler than
 * the sentinel-field dance an array-level message needs, since `accumulateZodErrors` keys a
 * list's errors by index and discards a parent message that collides with them.
 */
export function buildAvailabilitiesSchema(messages: {
	invalid: string;
	endBeforeStart: string;
	hoursPaired: string;
	dayDuplicate: string;
	everyDayExclusive: string;
}) {
	return z
		.array(buildAvailabilitySchema(messages))
		.superRefine((windows, ctx) => {
			const seen = new Set<number>();

			windows.forEach((window, index) => {
				if (window.day_of_week === null) {
					// An every-day interval covers every weekday, so it can only stand alone.
					if (windows.length > 1) {
						ctx.addIssue({
							code: 'custom',
							path: [index, 'day_of_week'],
							message: messages.everyDayExclusive,
						});
					}

					return;
				}

				if (seen.has(window.day_of_week)) {
					ctx.addIssue({
						code: 'custom',
						path: [index, 'day_of_week'],
						message: messages.dayDuplicate,
					});

					return;
				}

				seen.add(window.day_of_week);
			});
		});
}
