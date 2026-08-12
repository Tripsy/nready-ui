import { useId } from 'react';

export function useElementIds<T extends readonly string[]>(
	keys: T,
): { [K in T[number]]: string } {
	const id = useId();

	return keys.reduce(
		(acc, field) => {
			acc[field as T[number]] = `id-${field}-${id}`;
			return acc;
		},
		{} as { [K in T[number]]: string },
	);
}
