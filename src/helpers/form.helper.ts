import type { Dispatch, SetStateAction } from 'react';
import type { z } from 'zod';
import { logger } from '@/helpers/logger.helper';
import { parseJson } from '@/helpers/string.helper';
import type {
	FormErrorsType,
	FormValuesType,
	TouchedFieldsType,
} from '@/types/form.type';

/**
 * Flattens a `ZodError` into the shape `FormErrorsType` describes: `string[]` at a leaf, a
 * nested object at any field that has children.
 *
 * A key holds one or the other, never both. So when a validator raises an issue on an object
 * field *and* on a path beneath it, only one can be represented: the nested messages win,
 * because they name the individual field the user has to fix. The displaced parent-level
 * message is reported rather than dropped in silence — seeing it means the validator needs a
 * leaf path (a dedicated sentinel field) for its group-level rule.
 */
export function accumulateZodErrors<T extends FormValuesType>(
	zodError: z.ZodError,
): FormErrorsType<T> {
	const fieldErrors: FormErrorsType<T> = {};

	const warnUnrepresentable = (path: string[], message: string): void => {
		logger.warn(
			'Group-level validation message cannot be shown alongside errors for its own fields, and was discarded',
			undefined,
			{ path: path.join('.'), message },
		);
	};

	for (const issue of zodError.issues) {
		if (issue.path.length === 0) continue;

		// Array indices arrive as numbers; object keys are always strings.
		const path = issue.path.map((segment) => String(segment));

		// Walk the path and build nested objects as needed
		let current = fieldErrors as Record<string, unknown>;

		for (let index = 0; index < path.length - 1; index++) {
			const segment = path[index];
			const existing = current[segment];

			if (Array.isArray(existing)) {
				// A group-level message got here first — nested fields take the key.
				warnUnrepresentable(
					path.slice(0, index + 1),
					(existing as string[]).join('; '),
				);
			}

			if (
				!existing ||
				typeof existing !== 'object' ||
				Array.isArray(existing)
			) {
				current[segment] = {};
			}

			current = current[segment] as Record<string, unknown>;
		}

		const lastSegment = path[path.length - 1];
		const existing = current[lastSegment];

		if (
			existing &&
			typeof existing === 'object' &&
			!Array.isArray(existing)
		) {
			// Nested fields already own this key, so this group-level message has no slot.
			warnUnrepresentable(path, issue.message);

			continue;
		}

		if (!Array.isArray(existing)) {
			current[lastSegment] = [];
		}

		(current[lastSegment] as string[]).push(issue.message);
	}

	return fieldErrors;
}

export function filterErrorsByTouched<FormValues extends FormValuesType>(
	errors: FormErrorsType<FormValues>,
	touched: TouchedFieldsType<FormValues>,
): FormErrorsType<FormValues> {
	const visible: FormErrorsType<FormValues> = {};

	for (const key of Object.keys(touched) as (keyof FormValues)[]) {
		const touchedValue = touched[key];
		const errorValue = errors[key];

		if (!errorValue) {
			continue;
		}

		if (
			typeof touchedValue === 'object' &&
			typeof errorValue === 'object' &&
			!Array.isArray(errorValue)
		) {
			// Recurse into nested touched / error objects
			(visible as Record<string, unknown>)[key as string] =
				filterErrorsByTouched(
					errorValue as FormErrorsType<FormValuesType>,
					touchedValue as TouchedFieldsType<FormValuesType>,
				);
		} else if (touchedValue === true) {
			const k = key as keyof FormValues;

			visible[k] = errorValue as FormErrorsType<FormValues>[typeof k];
		}
	}

	return visible;
}

export function createHandleChange<FormValues extends FormValuesType>(
	setFormValues: Dispatch<SetStateAction<FormValues>>,
	markFieldAsTouched: (path: string) => void, // now a string path, not keyof FormValues
) {
	return <K extends keyof FormValues>(
		field: K,
		value: FormValues[K],
		touchPath?: string,
	) => {
		setFormValues((prev) => ({ ...prev, [field]: value }));
		markFieldAsTouched(touchPath ?? (field as string)); // use touchPath if provided
	};
}

export function getFormDataAsString(
	formData: FormData,
	key: string,
): string | null {
	const formValue = formData.get(key);

	return formValue ? String(formValue) : null;
}

/** Anything unparseable is `null`, not `NaN` — a missing number and a broken one read alike. */
export function getFormDataAsNumber(
	formData: FormData,
	key: string,
): number | null {
	const formValue = formData.get(key);

	if (formValue === null || String(formValue).trim() === '') {
		return null;
	}

	const parsed = Number(formValue);

	return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Values a form can submit for false. An unchecked checkbox sends nothing at all, but a hidden
 * input or a select carries a literal string — and every non-empty string is truthy, so
 * `"false"` would otherwise read as true.
 */
const FALSE_FORM_VALUES = new Set(['', '0', 'false', 'off', 'no']);

export function getFormDataAsBoolean(formData: FormData, key: string): boolean {
	const formValue = formData.get(key);

	if (formValue === null) {
		return false;
	}

	return !FALSE_FORM_VALUES.has(String(formValue).trim().toLowerCase());
}

export function getFormDataAsEnum<T extends Record<string, string>>(
	formData: FormData,
	key: string,
	enumObject: T,
): T[keyof T] | null {
	const formValue = formData.get(key);

	if (formValue && typeof formValue === 'string') {
		const enumValues = Object.values(enumObject);
		const foundValue = enumValues.find((value) => value === formValue);

		if (foundValue) {
			return foundValue as T[keyof T];
		}
	}

	return null;
}

/**
 * A collection the form submits as one JSON field, because per-input names cannot express a
 * nested shape — a list of variants, each with its own list of prices, has no flat encoding.
 *
 * Built on `parseJson` rather than repeating its `try`/`catch`: what this adds is the array
 * check and an empty list as the fallback, so a missing, blank, malformed or object-valued
 * field all read the same. The field is written by the form's own `JSON.stringify`, so a parse
 * failure means the value was truncated in transit rather than mistyped — and an empty list
 * lets the validator report the missing collection instead of the pipeline throwing.
 */
export function getFormDataAsJsonList<T>(formData: FormData, key: string): T[] {
	const parsed: unknown = parseJson(formData.get(key));

	return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function toOptionsFromEnum(
	enumObj: Record<string, string>,
	options?: {
		formatter?: (value: string) => string;
	},
): Array<{ label: string; value: string }> {
	const values = Object.values(enumObj);

	return values.map((value) => ({
		label: options?.formatter ? options.formatter(value) : value,
		value,
	}));
}

/**
 * Error counts per tab, so a problem on a panel the editor cannot see still announces itself on
 * the tab strip.
 *
 * Three things are summed for a tab, because a form's errors arrive in three shapes:
 *
 *  - the entity's own fields the tab owns (`tabFields`);
 *  - the same tab's translated fields, counted across **every** language rather than the open
 *    one — a missing Romanian label is the content tab's problem whichever translation happens
 *    to be selected (`tabContentFields` against `contentErrors`);
 *  - the list-level message for the translations themselves ("at least one translation"), which
 *    has no field of its own and belongs to the content tab, where an editor would go to fix it.
 *
 * @param tabs - The tab strip, in order; only `id` is read
 * @param tabFields - Which entity fields each tab owns
 * @param tabContentFields - Which translated fields each tab owns
 * @param errors - The form's error state
 * @param contentErrors - One entry per language, each a record of that language's field errors
 * @param contentListError - Messages about the translation list itself, not any one language
 * @param contentTabId - The tab `contentListError` belongs to
 */
export function countTabErrors<TabId extends string>({
	tabs,
	tabFields,
	tabContentFields,
	errors,
	contentErrors,
	contentListError,
	contentTabId,
}: {
	tabs: readonly { id: TabId }[];
	tabFields: Record<TabId, readonly string[]>;
	tabContentFields: Record<TabId, readonly string[]>;
	errors: Record<string, unknown>;
	contentErrors: readonly unknown[];
	contentListError?: string[];
	contentTabId: TabId;
}): Record<TabId, number> {
	return tabs.reduce<Record<TabId, number>>(
		(counts, { id }) => {
			const fieldErrors = tabFields[id].reduce<number>(
				(total, field) => total + countErrorMessages(errors[field]),
				0,
			);

			const perLanguage = contentErrors.reduce<number>((total, entry) => {
				if (!entry || typeof entry !== 'object') {
					return total;
				}

				return (
					total +
					tabContentFields[id].reduce<number>(
						(sum, field) =>
							sum +
							countErrorMessages(
								(entry as Record<string, unknown>)[field],
							),
						0,
					)
				);
			}, 0);

			const listLevel =
				id === contentTabId ? (contentListError?.length ?? 0) : 0;

			counts[id] = fieldErrors + perLanguage + listLevel;

			return counts;
		},
		{} as Record<TabId, number>,
	);
}

/**
 * How many error messages are held anywhere inside an error value.
 *
 * `FormErrorsType` nests differently per field — a plain `string[]`, a record of them, or a
 * record of them keyed by index for a list field — and the count only has to be a total, so
 * this walks whatever shape it is handed rather than encoding each one. Used by every form that
 * groups its fields into tabs, to put a badge on the tab holding the problem.
 */
export function countErrorMessages(value: unknown): number {
	if (!value) {
		return 0;
	}

	if (Array.isArray(value)) {
		return value.reduce<number>(
			(total, entry) =>
				total +
				(typeof entry === 'string' ? 1 : countErrorMessages(entry)),
			0,
		);
	}

	if (typeof value === 'object') {
		return Object.values(value).reduce<number>(
			(total, entry) => total + countErrorMessages(entry),
			0,
		);
	}

	return 0;
}

/**
 * The messages a value holds **itself**, as opposed to ones belonging to its entries.
 *
 * A field's errors arrive in one of two shapes, and which one depends on where the issue was
 * raised:
 *
 *  - a plain `string[]` when the message belongs to the list ("at least one category"), because
 *    `accumulateZodErrors` pushes messages into a list at the leaf;
 *  - an object keyed by the index as a **string** (`{ '0': { sku: [...] } }`) when the issues
 *    belong to individual entries — the accumulator builds every intermediate container with
 *    `{}`, so a numeric path segment never produces a real array.
 *
 * Indexing by number still reads the per-entry value (`obj[0]` is `obj['0']`), which is why a
 * per-entry lookup can pass the value straight through. Anything wanting a field's own messages
 * has to come through here, or it reads a per-entry record as one.
 */
export function ownErrorMessages(value: unknown): string[] | undefined {
	return Array.isArray(value) ? (value as string[]) : undefined;
}

/**
 * The errors belonging to one entry of a list field, by its position.
 *
 * The counterpart of `ownErrorMessages`: that one reads a list's own messages, this one reads a
 * single row's. `Row` only names the keys — every value stays `unknown`, because a field inside
 * the row carries the same two shapes the list itself does and has to go back through
 * `ownErrorMessages` before it is read as messages.
 *
 * Takes `unknown` rather than the host's typed error tree on purpose: that type claims a list
 * field holds an array, which at runtime it never does (see `ownErrorMessages`). Narrowing here
 * keeps the mismatch in one place instead of a cast at every repeatable editor.
 */
export function rowErrorsAt<Row>(
	errors: unknown,
	index: number,
): { [K in keyof Row]?: unknown } | undefined {
	if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
		return undefined;
	}

	return (errors as Record<string, { [K in keyof Row]?: unknown }>)[index];
}
