import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';

export function useRemoteAutocomplete<T>({
	query,
	queryKey,
	queryFn,
	minLength = 3,
}: {
	query: string;
	queryKey: unknown[];
	queryFn: (query: string) => Promise<T[]>;
	minLength?: number;
}) {
	const debouncedQuery = useDebounce(query, 300);

	const { data = [], isFetching } = useQuery({
		queryKey: [...queryKey, debouncedQuery],
		queryFn: ({ queryKey }) =>
			queryFn(queryKey[queryKey.length - 1] as string),
		enabled: debouncedQuery.length >= minLength,
		staleTime: 1000 * 60 * 5,
	});

	return {
		suggestions: data,
		isFetching,
	};
}
