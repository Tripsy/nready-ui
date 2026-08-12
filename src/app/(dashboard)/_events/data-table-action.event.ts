import type { DataSourceKey } from '@/types/data-source.key';

const DATA_TABLE_ACTION_EVENT = 'useDataTableAction' as const;

type DataTableActionType<Entry> = {
	dataSource: DataSourceKey;
	action: string;
	entries: Entry[];
};

export function dispatchDataTableAction<Entry>(
	detail: DataTableActionType<Entry>,
): void {
	window.dispatchEvent(new CustomEvent(DATA_TABLE_ACTION_EVENT, { detail }));
}

export function addDataTableActionListener<Entry>(
	handler: (data: DataTableActionType<Entry>) => void,
): () => void {
	const listener = (event: Event) => {
		const { detail } = event as CustomEvent<DataTableActionType<Entry>>;

		handler(detail);
	};

	window.addEventListener(DATA_TABLE_ACTION_EVENT, listener);

	return () => window.removeEventListener(DATA_TABLE_ACTION_EVENT, listener);
}
