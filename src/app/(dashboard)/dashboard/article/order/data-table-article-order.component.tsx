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
import { DataTableFiltersArticleOrder } from '@/app/(dashboard)/dashboard/article/order/data-table-filters-article-order.component';
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
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type ArticleFeaturedStatus,
	ArticleFeaturedStatusEnum,
	type ArticleModel,
	getArticleContentProp,
} from '@/models/article.model';
import { useSortablePosition } from '@/providers/sortable-position.provider';
import { useToast } from '@/providers/toast.provider';
import { orderUpdate } from '@/services/article.service';
import type { EntityId } from '@/types/entity-id.type';

const TRANSLATION_KEYS = [
	'dashboard.text.back_to_list',
	'dashboard.text.label_move_down',
	'dashboard.text.label_move_up',
	'dashboard.text.no_entries',
	'article.text.pick_a_category_to_order_its',
	'article.text.update',
	'dashboard.text.update_order',
	'app.error.title',
	'app.success.title',
	'article-order.success.order_updated',
	'article-order.error.order_failed',
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

type SortableArticleItemProps = {
	translations: TranslationsType;
	article: ArticleModel;
};

const SortableArticleItem = ({
	translations,
	article,
}: SortableArticleItemProps): JSX.Element => {
	const { isFirst, isLast, onMoveUp, onMoveDown } = useSortablePosition(
		article.id,
	);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: article.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const title = getArticleContentProp(article, getLanguageClient());

	return (
		<li ref={setNodeRef} style={style} {...attributes}>
			<div className="flex items-center gap-2 bg-default p-2">
				<span
					{...listeners}
					className="cursor-row-resize flex-1 select-none touch-none"
				>
					{title}
				</span>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={onMoveUp}
						disabled={isFirst}
						className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label={replaceVars(
							translations['dashboard.text.label_move_up'],
							{
								name: title,
							},
						)}
					>
						<Icons.Direction.ArrowUp />
					</button>
					<button
						type="button"
						onClick={onMoveDown}
						disabled={isLast}
						className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label={replaceVars(
							translations['dashboard.text.label_move_down'],
							{
								name: title,
							},
						)}
					>
						<Icons.Direction.ArrowDown />
					</button>
				</div>
			</div>
		</li>
	);
};

const DataTableArticleOrderContent = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { showToast } = useToast();

	const { dataSource, dataTableStore } = useDataTable<'article'>();
	const tableState = useStore(dataTableStore, (s) => s.tableState);
	const queryClient = useQueryClient();

	const [orderedArticles, setOrderedArticles] = useState<ArticleModel[]>([]);

	const featuredStatus = (tableState.filters.featured_status.value ??
		ArticleFeaturedStatusEnum.SECTION) as ArticleFeaturedStatus;
	const categoryId = tableState.filters.category_id.value as EntityId | null;
	const language = tableState.filters.language.value as string | null;

	/**
	 * The category slot is only orderable once a category is chosen: the group is the subtree,
	 * and without one the list would be every category-featured article at once - a set no
	 * single running order describes.
	 */
	const isReady =
		featuredStatus !== ArticleFeaturedStatusEnum.CATEGORY || !!categoryId;

	const queryKey = useMemo(
		() => [
			'dataTableOrder',
			dataSource,
			featuredStatus,
			categoryId,
			language,
		],
		[dataSource, featuredStatus, categoryId, language],
	);

	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestFind<ArticleModel>('article', {
				order_by: 'featured_order',
				direction: 'DESC',
				// The whole group has to be on screen, because the save posts the set back and
				// the API rejects anything short of it. A featured group is a handful of rows.
				limit: 100,
				filter: {
					featured_status: featuredStatus,
					...(categoryId ? { category_id: categoryId } : {}),
					language: language ?? getLanguageClient(),
				},
			});

			if (!response) {
				throw new Error(`Could not retrieve ${dataSource} data`);
			}

			return response;
		},
		enabled: isReady,
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (data?.entries) {
			setOrderedArticles(data.entries);
		}
	}, [data]);

	const { mutate: updateOrder, isPending: loading } = useMutation({
		mutationFn: (positions: EntityId[]) =>
			orderUpdate(featuredStatus, positions, categoryId ?? undefined),
		onSuccess: async () => {
			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['article-order.success.order_updated'],
			});

			await queryClient.invalidateQueries({ queryKey });
		},
		onError: () => {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: translations['article-order.error.order_failed'],
			});
		},
	});

	const handleUpdateOrder = (): void => {
		updateOrder(orderedArticles.map((article) => article.id));
	};

	if (!isReady) {
		return (
			<ErrorComponent
				title=""
				description={
					translations['article.text.pick_a_category_to_order_its']
				}
			/>
		);
	}

	if (isLoading) {
		return <LoadingComponent />;
	}

	if (orderedArticles.length === 0) {
		return (
			<ErrorComponent
				title=""
				description={translations['dashboard.text.no_entries']}
			/>
		);
	}

	return (
		<>
			<SortableList
				items={orderedArticles}
				onReorder={setOrderedArticles}
				className="list-decimal space-y-2 ml-8 mt-4"
				renderItem={(article) => (
					<SortableArticleItem
						translations={translations}
						key={article.id}
						article={article}
					/>
				)}
			/>

			<div className="flex gap-3 mt-4">
				<Link
					variant="outline"
					title={translations['dashboard.text.back_to_list']}
					href={Routes.get('article')}
				>
					<Icons.Article />
					{translations['dashboard.text.back_to_list']}
				</Link>
				<Button
					variant="outline"
					hover="default"
					onClick={handleUpdateOrder}
					title={translations['article.text.update']}
					disabled={loading}
				>
					<Icons.Action.Save />
					{translations['dashboard.text.update_order']}
				</Button>
			</div>
		</>
	);
};

export const DataTableArticleOrder = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="article" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersArticleOrder />
				<DataTableArticleOrderContent />
			</div>
		</DataTableProvider>
	);
};
