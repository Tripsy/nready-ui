'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type JSX, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import { dispatchDataTableAction } from '@/app/(dashboard)/_events/data-table-action.event';
import { addFilterResetListener } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import {
	DataTableProvider,
	useDataTable,
} from '@/app/(dashboard)/_providers/data-table.provider';
import type { CategoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/category/category.definition';
import { DataTableFiltersCategoryTree } from '@/app/(dashboard)/dashboard/category/tree/data-table-filters-category-tree.component';
import { Icons } from '@/components/icon.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useRefreshDataTable } from '@/hooks/use-refresh-data-table.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/account.model';
import {
	buildCategoryTree,
	CATEGORY_DEFAULT_TYPE,
	type CategoryModel,
	CategoryStatusEnum,
	type CategoryTreeNode,
	getCategoryContentProp,
} from '@/models/category.model';
import { useAuth } from '@/providers/auth.provider';
import type { Language } from '@/types/common.type';

/**
 * The whole active tree is fetched in one page - a hierarchy cannot be paginated without
 * losing the parents that give it shape. The cap is a guard against a pathological dataset,
 * not an expected boundary; the header says so when it bites.
 */
const TREE_LIMIT = 500;

function collectParentIds(
	nodes: CategoryTreeNode[],
	ids: number[] = [],
): number[] {
	for (const node of nodes) {
		if (node.children.length > 0) {
			ids.push(node.entry.id);

			collectParentIds(node.children, ids);
		}
	}

	return ids;
}

type CategoryTreeItemProps = {
	node: CategoryTreeNode;
	language: Language;
	collapsedIds: Set<number>;
	onToggle: (id: number) => void;
	canUpdate: boolean;
	canDelete: boolean;
	detachedTitle: string;
};

const CategoryTreeItem = ({
	node,
	language,
	onToggle,
	collapsedIds,
	canUpdate,
	canDelete,
	detachedTitle,
}: CategoryTreeItemProps): JSX.Element => {
	const { entry, children, isDetached } = node;

	const label = getCategoryContentProp(entry, language, 'label');
	const hasChildren = children.length > 0;
	const isCollapsed = collapsedIds.has(entry.id);

	// The window definitions already own permissions, titles and confirmations - the row only
	// says which action and on which entry.
	const runAction = (action: string) =>
		dispatchDataTableAction<CategoryModel>({
			dataSource: 'category',
			action,
			entries: [entry],
		});

	return (
		<li>
			<div className="flex items-center gap-2 py-1">
				{hasChildren ? (
					<button
						type="button"
						onClick={() => onToggle(entry.id)}
						className="cursor-pointer"
						aria-expanded={!isCollapsed}
						aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
					>
						{isCollapsed ? (
							<Icons.Direction.ArrowRight />
						) : (
							<Icons.Direction.ArrowDown />
						)}
					</button>
				) : (
					<span className="w-4" aria-hidden="true" />
				)}

				<button
					type="button"
					onClick={() => runAction('view')}
					className="cursor-pointer hover:underline text-left"
					title="View details"
				>
					{label}
				</button>

				{isDetached && (
					<Icons.Status.Warning
						className="text-warning"
						aria-label={detachedTitle}
					/>
				)}

				<div className="flex gap-2 ml-2">
					{canUpdate && (
						<button
							type="button"
							onClick={() => runAction('update')}
							className="cursor-pointer opacity-60 hover:opacity-100"
							aria-label={`Update ${label}`}
							title="Update"
						>
							<Icons.Action.Update />
						</button>
					)}
					{canDelete && (
						<button
							type="button"
							onClick={() => runAction('delete')}
							className="cursor-pointer opacity-60 hover:opacity-100 hover:text-danger"
							aria-label={`Delete ${label}`}
							title="Delete"
						>
							<Icons.Action.Delete />
						</button>
					)}
				</div>
			</div>

			{hasChildren && !isCollapsed && (
				<ul className="ml-2 pl-4 border-l border-line">
					{children.map((child) => (
						<CategoryTreeItem
							key={child.entry.id}
							node={child}
							language={language}
							collapsedIds={collapsedIds}
							onToggle={onToggle}
							canUpdate={canUpdate}
							canDelete={canDelete}
							detachedTitle={detachedTitle}
						/>
					))}
				</ul>
			)}
		</li>
	);
};

const DataTableCategoryTreeContent = (): JSX.Element => {
	const translationsKeys = [
		'category-tree.text.no_entries',
		'category-tree.text.truncated',
		'category-tree.text.detached',
		'category-tree.text.expand_all',
		'category-tree.text.collapse_all',
		'category-tree.error.load_failed',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const { auth } = useAuth();

	const { dataSource, dataTableStore } = useDataTable<'category'>();
	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CategoryDataTableFiltersType;

	const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

	const refreshDataTable = useRefreshDataTable();

	/*
	 * An update or a delete announces itself with a filter reset for the data source. Only the
	 * refetch is wanted here - `useDataTableFilterReset`, which the list pages use, would also
	 * restore the default filters and so throw the tree back to another type mid-edit.
	 */
	useEffect(
		() =>
			addFilterResetListener(({ source }) => {
				if (source === dataSource) {
					refreshDataTable(dataSource);
				}
			}),
		[dataSource, refreshDataTable],
	);

	const type = filters.type.value ?? CATEGORY_DEFAULT_TYPE;
	const language = filters.language.value ?? getLanguageClient();

	/*
	 * Keyed under the `dataTable` prefix, unlike the order page: an edit or a delete made from
	 * this page dispatches a filter reset for the data source, which invalidates
	 * `['dataTable', 'category']` - a key outside that prefix would go stale silently.
	 */
	const queryKey = useMemo(
		() => ['dataTable', dataSource, 'tree', type, language],
		[dataSource, type, language],
	);

	const { data, isLoading, isError } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestFind<CategoryModel>('category', {
				order_by: 'sort_order',
				direction: 'DESC',
				limit: TREE_LIMIT,
				filter: {
					status: CategoryStatusEnum.ACTIVE,
					type,
					language,
				},
			});

			if (!response) {
				throw new Error(`Could not retrieve ${dataSource} data`);
			}

			return response;
		},
		placeholderData: keepPreviousData,
	});

	const tree = useMemo(
		() => buildCategoryTree(data?.entries ?? []),
		[data?.entries],
	);

	if (isLoading) {
		return <LoadingComponent />;
	}

	if (isError) {
		return (
			<ErrorComponent
				title=""
				description={translations['category-tree.error.load_failed']}
			/>
		);
	}

	if (tree.length === 0) {
		return (
			<ErrorComponent
				title=""
				description={translations['category-tree.text.no_entries']}
			/>
		);
	}

	const total = data?.pagination?.total ?? 0;

	return (
		<>
			{total > TREE_LIMIT && (
				<p className="mt-4 text-warning">
					{replaceVars(translations['category-tree.text.truncated'], {
						limit: TREE_LIMIT,
						total,
					})}
				</p>
			)}

			<div className="flex gap-3 mt-4">
				<Button
					variant="outline"
					onClick={() => setCollapsedIds(new Set())}
					title={translations['category-tree.text.expand_all']}
				>
					<Icons.Direction.ArrowDown />
					{translations['category-tree.text.expand_all']}
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						setCollapsedIds(new Set(collectParentIds(tree)))
					}
					title={translations['category-tree.text.collapse_all']}
				>
					<Icons.Direction.ArrowRight />
					{translations['category-tree.text.collapse_all']}
				</Button>
			</div>

			<ul className="mt-4">
				{tree.map((node) => (
					<CategoryTreeItem
						key={node.entry.id}
						node={node}
						language={language}
						collapsedIds={collapsedIds}
						onToggle={(id) =>
							setCollapsedIds((current) => {
								const next = new Set(current);

								if (!next.delete(id)) {
									next.add(id);
								}

								return next;
							})
						}
						canUpdate={hasPermission(auth, 'category', 'update')}
						canDelete={hasPermission(auth, 'category', 'delete')}
						detachedTitle={
							translations['category-tree.text.detached']
						}
					/>
				))}
			</ul>

			<div className="flex gap-3 mt-4">
				<Link
					variant="outline"
					title="Back to list"
					href={Routes.get('category')}
				>
					<Icons.Category />
					Back to list
				</Link>
			</div>
		</>
	);
};

export const DataTableCategoryTree = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="category" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCategoryTree />
				{/* Mounted for its action listener: it is what turns a row's dispatch into
				    the view / update / delete window, with the permission checks that go
				    with it. Its own button bar (add, sort) comes along. */}
				<DataTableActions />
				<DataTableCategoryTreeContent />
			</div>
		</DataTableProvider>
	);
};
