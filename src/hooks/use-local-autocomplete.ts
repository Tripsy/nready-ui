import { useMemo, useState } from 'react';

export type UseLocalAutocompleteOptions<T> = {
	source: readonly T[]; // ← accept readonly arrays
	filter?: (item: T, query: string) => boolean;
	minLength?: number;
};

export function useLocalAutocomplete<T>({
	source,
	filter,
	minLength = 1,
}: UseLocalAutocompleteOptions<T>) {
	const [query, setQuery] = useState('');

	const defaultFilter = (item: T, q: string) => {
		if (typeof item === 'string') {
			return item.toLowerCase().includes(q.toLowerCase());
		}

		return false;
	};

	const activeFilter = filter ?? defaultFilter;

	const suggestions = useMemo(() => {
		if (!query || query.length < minLength) return source;

		return source.filter((item) => activeFilter(item, query));
	}, [source, query, minLength, activeFilter]);

	return {
		query,
		setQuery,
		suggestions,
	};
}
