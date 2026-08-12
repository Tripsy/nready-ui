import type { Dispatch, SetStateAction } from 'react';
import type { z } from 'zod';
import { logger } from '@/helpers/logger.helper';
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
