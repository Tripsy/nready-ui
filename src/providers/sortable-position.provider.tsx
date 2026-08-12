import { createContext, useContext } from 'react';

interface SortablePositionContextValue {
	isFirst: (id: string | number) => boolean;
	isLast: (id: string | number) => boolean;
	onMoveUp: (id: string | number) => void;
	onMoveDown: (id: string | number) => void;
}

const SortablePositionContext =
	createContext<SortablePositionContextValue | null>(null);

export function useSortablePosition(id: string | number) {
	const ctx = useContext(SortablePositionContext);

	if (!ctx) {
		throw new Error(
			'useSortablePosition must be used within a SortableList',
		);
	}

	return {
		isFirst: ctx.isFirst(id),
		isLast: ctx.isLast(id),
		onMoveUp: () => ctx.onMoveUp(id),
		onMoveDown: () => ctx.onMoveDown(id),
	};
}

export const SortablePositionProvider = SortablePositionContext.Provider;
