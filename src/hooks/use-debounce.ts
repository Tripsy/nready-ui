import { useEffect, useState } from 'react';

interface UseDebounceOptions {
	leading?: boolean;
	trailing?: boolean;
}

export function useDebounce<T>(
	value: T,
	delay: number,
	options: UseDebounceOptions = { trailing: true },
): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		// For leading edge, set value immediately
		if (options.leading) {
			setDebouncedValue(value);
		}

		const handler = setTimeout(() => {
			// For trailing edge, set after delay
			if (options.trailing) {
				setDebouncedValue(value);
			}
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay, options.leading, options.trailing]);

	return debouncedValue;
}
