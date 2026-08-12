import { type DependencyList, useEffect, useRef } from 'react';

export function useDebouncedEffect(
	effect: () => void,
	deps: DependencyList,
	delay: number,
) {
	const effectRef = useRef(effect);

	useEffect(() => {
		effectRef.current = effect;
	}, [effect]);

	useEffect(() => {
		const handler = setTimeout(() => effectRef.current(), delay);

		return () => clearTimeout(handler);
	}, [...deps, delay]);
}
