'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { SortableList } from '@/components/sortable-list.component';
import { LoadingContent } from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { hasPermission } from '@/models/account.model';
import {
	type CategoryModel,
	getCategoryContentProp,
} from '@/models/category.model';
import {
	displayAttributeLabel,
	type ProductCategoryAttributeModel,
} from '@/models/product-category-attribute.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import { requestAttributeOrderUpdate } from '@/services/product.service';
import { useModalStore } from '@/stores/window.store';
import type { Language } from '@/types/common.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';
import type { WindowEntryType } from '@/types/window.type';

/**
 * A category declares a handful of attributes, not a page of them - a product form asking
 * thirty questions is a different problem from this one. The cap is here so a listing cannot be
 * requested unbounded, not because a real category is expected to approach it.
 */
const DEFINITION_LIMIT = 100;

/** How far apart consecutive rows are placed, so one can be slipped between two later. */
const SORT_ORDER_STEP = 10;

function Badge({ children }: { children: string }): JSX.Element {
	return (
		<span className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">
			{children}
		</span>
	);
}

type RowProps = {
	definition: ProductCategoryAttributeModel;
	language: Language;
	canEdit: boolean;
	canDelete: boolean;
	onEdit: () => void;
	onDelete: () => void;
};

/** One definition, draggable by its label. */
function SortableAttributeRow({
	definition,
	language,
	canEdit,
	canDelete,
	onEdit,
	onDelete,
}: RowProps): JSX.Element {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: definition.id, disabled: !canEdit });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const label = displayAttributeLabel(definition, language);

	return (
		<li
			ref={setNodeRef}
			style={style}
			{...attributes}
			className="flex flex-wrap items-center gap-3 py-2"
		>
			<span
				{...listeners}
				className={`select-none touch-none font-medium ${canEdit ? 'cursor-row-resize' : ''}`}
			>
				{label}
			</span>

			<span className="flex flex-wrap gap-1">
				<Badge>{definition.scope}</Badge>
				<Badge>{`${definition.type} / ${definition.value_type}`}</Badge>
				{definition.unit ? <Badge>{definition.unit}</Badge> : null}
				{definition.is_required ? <Badge>required</Badge> : null}
				{definition.is_filterable ? <Badge>filterable</Badge> : null}
				{definition.inherit ? null : <Badge>not inherited</Badge>}
			</span>

			<span className="ml-auto flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					hover="success"
					size="xs"
					disabled={!canEdit}
					onClick={onEdit}
				>
					Edit
				</Button>
				<Button
					type="button"
					variant="outline"
					hover="error"
					size="xs"
					disabled={!canDelete}
					onClick={onDelete}
				>
					Delete
				</Button>
			</span>
		</li>
	);
}

/**
 * The attributes a product in this category is expected to carry - which labels apply, how each
 * is captured and which values are admissible.
 *
 * It edits `product_category_attribute`, an entity of its own with its own endpoints, so the
 * rows are fetched here rather than read off the category: a definition outlives every product
 * that answers to it, and the category payload carries none of them. The create and update
 * windows are the standard form windows for that data source - this is the list and the way in.
 */
export function ManagerAttributesCategory({
	uid,
	entries,
}: {
	uid: string;
	entries: CategoryModel[];
}) {
	const category = entries[0];

	const { auth } = useAuth();
	const { open, focus } = useModalStore();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const language = getLanguageClient();

	const canEdit =
		!category.deleted_at && hasPermission(auth, 'product', 'update');
	const canCreate =
		!category.deleted_at && hasPermission(auth, 'product', 'create');
	const canDelete =
		!category.deleted_at && hasPermission(auth, 'product', 'delete');

	const queryKey = useMemo(
		() => ['category', 'attributes', category.id],
		[category.id],
	);

	const { data, isLoading, isError } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestFind<ProductCategoryAttributeModel>(
				'product-category-attribute',
				{
					filter: { category_id: category.id },
					order_by: 'sort_order',
					direction: 'ASC',
					limit: DEFINITION_LIMIT,
				},
			);

			if (!response) {
				throw new Error('Could not retrieve the category attributes');
			}

			return response;
		},
	});

	/*
	 * The list is held here as well as in the query cache: a drop has to move the row at once,
	 * and the refetch that confirms it is a round trip away. The query stays the source of truth
	 * - this follows it back whenever it settles, so a rejected reorder undoes itself.
	 */
	const [definitions, setDefinitions] = useState<
		ProductCategoryAttributeModel[]
	>([]);

	useEffect(() => {
		setDefinitions(data?.entries ?? []);
	}, [data]);

	/**
	 * Opens one of the data source's own windows and comes back here afterward.
	 *
	 * `open` minimizes every other window to make room, this one included, so the manager has to
	 * be focused again on success - otherwise saving an attribute leaves the editor on an empty
	 * desktop with the list parked in the dock. The list is refetched rather than patched: the
	 * response to a create carries no joined label, and the sort order the row was given decides
	 * where it belongs among the others.
	 */
	const openWindow = useCallback(
		(
			action: string,
			data: {
				entries?: WindowEntryType[];
				prefillEntry?: WindowEntryType;
			},
		) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.DASHBOARD,
				dataSource: 'product-category-attribute',
				action,
				data,
				events: {
					success: async () => {
						focus(uid);

						await queryClient.invalidateQueries({ queryKey });
					},
				},
			});
		},
		[open, focus, uid, queryClient, queryKey],
	);

	/**
	 * Persists a drag, then refetches.
	 *
	 * The whole set goes up, in order: a position only means anything relative to its siblings,
	 * and the backend rejects a partial permutation. What comes back is what the product form
	 * will draw from, so the local list is reconciled against the refetch rather than left on the
	 * arrangement the drag produced.
	 */
	const { mutate: updateOrder } = useMutation({
		mutationFn: (positions: number[]) =>
			requestAttributeOrderUpdate(category.id, positions),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey });
		},
		onError: async () => {
			showToast({
				severity: 'error',
				summary: 'Error',
				detail: 'The attribute order could not be saved.',
			});

			await queryClient.invalidateQueries({ queryKey });
		},
	});

	const reorder = (reordered: ProductCategoryAttributeModel[]): void => {
		setDefinitions(reordered);

		updateOrder(reordered.map((definition) => definition.id));
	};

	// Placed after the last one, so a new attribute lands at the end of the product's form
	// rather than in the middle of a set someone has already arranged.
	const nextSortOrder =
		definitions.reduce(
			(highest, definition) => Math.max(highest, definition.sort_order),
			0,
		) + SORT_ORDER_STEP;

	if (isLoading) {
		return <LoadingContent title="Attributes" />;
	}

	if (isError) {
		return (
			<p className="py-6 text-center text-danger">
				The attributes of this category could not be loaded.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted">
				What a product in{' '}
				<strong>
					{getCategoryContentProp(category, language, 'label')}
				</strong>{' '}
				is asked to say about itself. A sub-category inherits these
				unless it defines the same label itself, and the values are
				filled in on the product.
			</p>

			{definitions.length === 0 ? (
				<p className="text-sm text-muted">
					No attributes declared - a product here is asked nothing
					beyond its own fields.
				</p>
			) : (
				<SortableList
					items={definitions}
					onReorder={reorder}
					className="divide-y divide-line"
					renderItem={(definition) => (
						<SortableAttributeRow
							key={definition.id}
							definition={definition}
							language={language}
							canEdit={canEdit}
							canDelete={canDelete}
							onEdit={() =>
								openWindow('update', { entries: [definition] })
							}
							onDelete={() =>
								openWindow('delete', { entries: [definition] })
							}
						/>
					)}
				/>
			)}

			<Button
				type="button"
				variant="default"
				size="sm"
				disabled={!canCreate}
				onClick={() =>
					openWindow('create', {
						prefillEntry: {
							category_id: category.id,
							sort_order: nextSortOrder,
						},
					})
				}
			>
				Add attribute
			</Button>
		</div>
	);
}
