import type { DataSourceKey } from '@/types/data-source.key';

const FILTER_RESET_EVENT = 'filterReset' as const;

type FilterResetDetail = { source: DataSourceKey };

export function dispatchFilterReset(source: DataSourceKey): void {
	window.dispatchEvent(
		new CustomEvent(FILTER_RESET_EVENT, {
			detail: { source },
		}),
	);
}

export function addFilterResetListener(
	handler: (detail: FilterResetDetail) => Promise<void> | void,
): () => void {
	const listener = (event: Event) => {
		const { detail } = event as CustomEvent<FilterResetDetail>;

		handler(detail);
	};

	window.addEventListener(FILTER_RESET_EVENT, listener);

	return () => window.removeEventListener(FILTER_RESET_EVENT, listener);
}
