import { closestCenter, DndContext } from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type * as React from 'react';
import { useSortableDnd } from '@/hooks/use-sortable-dnd';
import { SortablePositionProvider } from '@/providers/sortable-position.provider';

interface SortableListProps<T> {
	items: T[];
	onReorder: (reordered: T[]) => void;
	renderItem: (item: T, index: number) => React.ReactNode;
	className: string;
	getId?: (item: T) => string | number;
}

export function SortableList<T>({
	items,
	onReorder,
	renderItem,
	className,
	getId = (item: T) => (item as { id: string | number }).id,
}: SortableListProps<T>) {
	const { sensors, handleDragEnd } = useSortableDnd(items, onReorder, getId);

	const moveBy = (id: string | number, delta: number) => {
		const index = items.findIndex((i) => getId(i) === id);
		const target = index + delta;

		if (target < 0 || target >= items.length) {
			return;
		}

		const next = [...items];

		[next[index], next[target]] = [next[target], next[index]];
		onReorder(next);
	};

	return (
		<SortablePositionProvider
			value={{
				isFirst: (id) => getId(items[0]) === id,
				isLast: (id) => getId(items[items.length - 1]) === id,
				onMoveUp: (id) => moveBy(id, -1),
				onMoveDown: (id) => moveBy(id, 1),
			}}
		>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={items.map(getId)}
					strategy={verticalListSortingStrategy}
				>
					<ol className={className}>
						{items.map((item, index) => renderItem(item, index))}
					</ol>
				</SortableContext>
			</DndContext>
		</SortablePositionProvider>
	);
}
