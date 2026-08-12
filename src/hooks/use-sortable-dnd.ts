import type { DragEndEvent } from '@dnd-kit/core';
import {
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useSortableDnd<T>(
	items: T[],
	onReorder: (reordered: T[]) => void,
	getId: (item: T) => string | number = (item) =>
		(item as { id: string | number }).id,
) {
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 5 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (!over || active.id === over.id) {
			return;
		}

		const oldIndex = items.findIndex((i) => getId(i) === active.id);
		const newIndex = items.findIndex((i) => getId(i) === over.id);

		if (oldIndex === -1 || newIndex === -1) {
			return;
		}

		onReorder(arrayMove(items, oldIndex, newIndex));
	};

	return { sensors, handleDragEnd };
}
