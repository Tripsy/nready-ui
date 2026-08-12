export type ObjectValue =
	| string
	| number
	| boolean
	| Date
	| RegExp
	| null
	| undefined
	| ObjectValue[]
	| { [key: string]: ObjectValue };

/**
 * Get the value of a key in an object
 * ex: key = "user.create"
 *
 * @param {Record<string, any>} obj - The object to get the value from
 * @param {string} key - The key to get the value of
 * @returns {any} - The value of the key
 */
export function getObjectValue(
	obj: { [key: string]: ObjectValue },
	key: string,
): ObjectValue | undefined {
	return key.split('.').reduce<ObjectValue | undefined>((acc, part) => {
		// `Object.hasOwn` rather than `in`: `in` walks the prototype chain, so a path segment
		// like `constructor` or `toString` would resolve to a built-in instead of missing.
		if (
			acc &&
			typeof acc === 'object' &&
			!Array.isArray(acc) &&
			Object.hasOwn(acc, part)
		) {
			return (acc as { [key: string]: ObjectValue })[part];
		}
		return undefined;
	}, obj);
}

/**
 * Set the value of a key in an object
 * ex: key = "user.create", value = "new value"
 * Returns a new object with the value set at the dot-separated path (immutable)
 *
 * @param obj
 * @param path
 * @param value
 */
export function setNestedValue<T extends Record<string, unknown>>(
	obj: T,
	path: string,
	value: unknown,
): T {
	const [head, ...rest] = path.split('.');

	// An empty path has no field to set; writing would create a `""` key.
	if (!head) {
		return obj;
	}

	if (rest.length === 0) {
		return { ...obj, [head]: value };
	}

	const nested =
		obj[head] && typeof obj[head] === 'object'
			? (obj[head] as Record<string, unknown>)
			: {};

	return {
		...obj,
		[head]: setNestedValue(nested, rest.join('.'), value),
	};
}

/**
 * Determine if value is included in array
 *
 * @param value
 * @param array
 */
export function arrayHasValue<T extends readonly unknown[]>(
	value: unknown,
	array: T,
): value is T[number] {
	return array.includes(value);
}
