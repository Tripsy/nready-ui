'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import type React from 'react';
import { type JSX, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	DataTableProvider,
	useDataTable,
} from '@/app/(dashboard)/_providers/data-table.provider';
import type { CategoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/category/category.definition';
import { DataTableFiltersCategoryOrder } from '@/app/(dashboard)/dashboard/category/order/data-table-filters-category-order.component';
import { Icons } from '@/components/icon.component';
import { SortableList } from '@/components/sortable-list.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CATEGORY_DEFAULT_TYPE,
	type CategoryModel,
	CategoryStatusEnum,
	getCategoryContentProp,
} from '@/models/category.model';
import { useSortablePosition } from '@/providers/sortable-position.provider';
import { useToast } from '@/providers/toast.provider';
import { orderUpdate } from '@/services/category.service';
import type { Language } from '@/types/common.type';

/**
 * A sibling group small enough to drag through is far below this; the cap only keeps a
 * pathological group from being requested unbounded, since the list must be complete -
 * the backend rejects a partial permutation.
 */
const GROUP_LIMIT = 200;

type SortableCategoryItemProps = {
	category: CategoryModel;
	language: Language;
};

const SortableCategoryItem = ({
	category,
	language,
}: SortableCategoryItemProps): JSX.Element => {
	const { isFirst, isLast, onMoveUp, onMoveDown } = useSortablePosition(
		category.id,
	);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: category.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const label = getCategoryContentProp(category, language, 'label');

	return (
		<li ref={setNodeRef} style={style} {...attributes}>
			<div className="flex items-center gap-2 bg-default p-2">
				<span
					{...listeners}
					className="cursor-row-resize flex-1 select-none touch-none"
				>
					{label}
				</span>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={onMoveUp}
						disabled={isFirst}
						className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label={`Move ${label} up`}
					>
						<Icons.Direction.ArrowUp />
					</button>
					<button
						type="button"
						onClick={onMoveDown}
						disabled={isLast}
						className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label={`Move ${label} down`}
					>
						<Icons.Direction.ArrowDown />
					</button>
				</div>
			</div>
		</li>
	);
};

const DataTableCategoryOrderContent = (): JSX.Element => {
	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'category-order.success.order_updated',
		'category-order.error.order_failed',
		'category-order.text.group_too_small',
		'category-order.text.no_entries',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const { showToast } = useToast();

	const { dataSource, dataTableStore } = useDataTable<'category'>();
	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CategoryDataTableFiltersType;
	const queryClient = useQueryClient();

	const [orderedCategories, setOrderedCategories] = useState<CategoryModel[]>(
		[],
	);

	const type = filters.type.value ?? CATEGORY_DEFAULT_TYPE;
	const language = filters.language.value ?? getLanguageClient();
	const parentId = filters.parent_id.value;

	const queryKey = useMemo(
		() => ['dataTableOrder', dataSource, type, language, parentId],
		[dataSource, type, language, parentId],
	);

	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestFind<CategoryModel>('category', {
				order_by: 'sort_order',
				direction: 'DESC',
				limit: GROUP_LIMIT,
				filter: {
					status: CategoryStatusEnum.ACTIVE,
					type,
					language,
					// The group is one parent's children, or the roots of this type -
					// `is_root` exists because an absent `parent_id` cannot express the
					// difference between "the roots" and "any parent" in a query string.
					...(parentId ? { parent_id: parentId } : { is_root: true }),
				},
			});

			if (!response) {
				throw new Error(`Could not retrieve ${dataSource} data`);
			}

			return response;
		},
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (data?.entries) {
			setOrderedCategories(data.entries);
		}
	}, [data]);

	const { mutate: updateOrder, isPending: loading } = useMutation({
		mutationFn: (positions: number[]) =>
			orderUpdate(type, parentId, positions),
		onSuccess: async () => {
			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['category-order.success.order_updated'],
			});

			await queryClient.invalidateQueries({ queryKey });
		},
		onError: () => {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: translations['category-order.error.order_failed'],
			});
		},
	});

	const handleUpdateOrder = (): void => {
		updateOrder(orderedCategories.map((category) => category.id));
	};

	if (isLoading) {
		return <LoadingComponent />;
	}

	if (orderedCategories.length === 0) {
		return (
			<ErrorComponent
				title=""
				description={translations['category-order.text.no_entries']}
			/>
		);
	}

	// The backend rejects fewer than two positions - a group of one has no order to state.
	const canReorder = orderedCategories.length > 1;

	return (
		<>
			<SortableList
				items={orderedCategories}
				onReorder={setOrderedCategories}
				className="list-decimal space-y-2 ml-8 mt-4"
				renderItem={(category) => (
					<SortableCategoryItem
						key={category.id}
						category={category}
						language={language}
					/>
				)}
			/>

			{!canReorder && (
				<p className="mt-4 text-muted">
					{translations['category-order.text.group_too_small']}
				</p>
			)}

			<div className="flex gap-3 mt-4">
				<Link
					variant="outline"
					title="Back to list"
					href={Routes.get('category')}
				>
					<Icons.Category />
					Back to list
				</Link>
				<Button
					variant="outline"
					hover="default"
					onClick={handleUpdateOrder}
					title="Update"
					disabled={loading || !canReorder}
				>
					<Icons.Action.Save />
					Update order
				</Button>
			</div>
		</>
	);
};

export const DataTableCategoryOrder = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="category" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCategoryOrder />
				<DataTableCategoryOrderContent />
			</div>
		</DataTableProvider>
	);
};
