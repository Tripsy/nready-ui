import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedEffect } from './use-debounced-effect.hook';

interface UseSearchFilterOptions {
	initialValue?: string;
	debounceDelay?: number;
	minLength?: number;
	onSearch?: (value: string) => void;
}

export function useSearchFilter(options: UseSearchFilterOptions = {}) {
	const {
		initialValue = '',
		debounceDelay = 500,
		minLength = 3,
		onSearch,
	} = options;

	const [value, setValue] = useState(initialValue);
	const [isSearching, setIsSearching] = useState(false);

	const initialValueRef = useRef(initialValue);
	const currentValueRef = useRef(initialValue);
	const debouncedValueRef = useRef('');
	const triggerSearchRef = useRef(false);
	const onSearchRef = useRef(onSearch);
	const isSyncRef = useRef(true);

	useEffect(() => {
		onSearchRef.current = onSearch;
	}, [onSearch]);

	// Sync when initialValue changes from outside (like `reset`)
	useEffect(() => {
		if (isSyncRef.current) {
			setValue(initialValue);

			currentValueRef.current = initialValue;
			initialValueRef.current = initialValue;
		}

		isSyncRef.current = true;
	}, [initialValue]);

	const handler = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;

			setValue(value);

			currentValueRef.current = value;

			// Determine if we should trigger search
			const shouldTrigger =
				value.length >= minLength ||
				(initialValueRef.current.length >= minLength &&
					value.length < minLength);

			setIsSearching(shouldTrigger);
			triggerSearchRef.current = shouldTrigger;

			// Determine if we should disable value sync
			isSyncRef.current = !(
				initialValueRef.current.length >= minLength &&
				value.length < minLength
			);

			debouncedValueRef.current = value.length < minLength ? '' : value;
		},
		[minLength],
	);

	// Handle the debounced search
	useDebouncedEffect(
		() => {
			if (triggerSearchRef.current && onSearchRef.current) {
				onSearchRef.current(debouncedValueRef.current);
				setIsSearching(false);
				initialValueRef.current = currentValueRef.current;
				triggerSearchRef.current = false;
			}
		},
		[value], // only value drives the debounce timer
		debounceDelay,
	);

	const onReset = useCallback(() => {
		setValue('');
		setIsSearching(false);
		isSyncRef.current = true;
		currentValueRef.current = '';
		initialValueRef.current = '';
		debouncedValueRef.current = '';
	}, []);

	return {
		value,
		handler,
		isSearching,
		onReset: onReset,
	};
}
