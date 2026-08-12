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
import { DataTableFiltersBrandOrder } from '@/app/(dashboard)/dashboard/brand/order/data-table-filters-brand-order.component';
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
	BRAND_DEFAULT_TYPE,
	type BrandModel,
	BrandStatusEnum,
	type BrandType,
} from '@/models/brand.model';
import { useSortablePosition } from '@/providers/sortable-position.provider';
import { useToast } from '@/providers/toast.provider';
import { orderUpdate } from '@/services/brand.service';

type SortableBrandItemProps = {
	brand: BrandModel;
};

const SortableBrandItem = ({ brand }: SortableBrandItemProps): JSX.Element => {
	const { isFirst, isLast, onMoveUp, onMoveDown } = useSortablePosition(
		brand.id,
	);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: brand.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<li ref={setNodeRef} style={style} {...attributes}>
			<div className="flex items-center gap-2 bg-default p-2">
				<span
					{...listeners}
					className="cursor-row-resize flex-1 select-none touch-none"
				>
					{brand.name}
				</span>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={onMoveUp}
						disabled={isFirst}
						className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label={`Move ${brand.name} up`}
					>
						<Icons.Direction.ArrowUp />
					</button>
					<button
						type="button"
						onClick={onMoveDown}
						disabled={isLast}
						className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						aria-label={`Move ${brand.name} down`}
					>
						<Icons.Direction.ArrowDown />
					</button>
				</div>
			</div>
		</li>
	);
};

const DataTableBrandOrderContent = (): JSX.Element => {
	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'brand-order.success.order_updated',
		'brand-order.error.order_failed',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const { showToast } = useToast();

	const { dataSource, dataTableStore } = useDataTable<'brand'>();
	const tableState = useStore(dataTableStore, (s) => s.tableState);
	const queryClient = useQueryClient();

	const [orderedBrands, setOrderedBrands] = useState<BrandModel[]>([]);

	const queryKey = useMemo(
		() => [
			'dataTableOrder',
			dataSource,
			tableState.filters.brand_type.value,
			tableState.filters.language.value,
		],
		[
			dataSource,
			tableState.filters.brand_type.value,
			tableState.filters.language.value,
		],
	);

	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestFind<BrandModel>('brand', {
				order_by: 'sort_order',
				direction: 'DESC',
				filter: {
					status: BrandStatusEnum.ACTIVE,
					brand_type:
						tableState.filters.brand_type.value ??
						BRAND_DEFAULT_TYPE,
					language:
						tableState.filters.language.value ??
						getLanguageClient(),
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
			setOrderedBrands(data.entries);
		}
	}, [data]);

	const { mutate: updateOrder, isPending: loading } = useMutation({
		mutationFn: (positions: number[]) =>
			orderUpdate(
				tableState.filters.brand_type.value as BrandType,
				positions,
			),
		onSuccess: async () => {
			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['brand-order.success.order_updated'],
			});

			await queryClient.invalidateQueries({ queryKey });
		},
		onError: () => {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: translations['brand-order.error.order_failed'],
			});
		},
	});

	const handleUpdateOrder = (): void => {
		const positions = orderedBrands.map((brand) => brand.id);

		updateOrder(positions);
	};

	if (isLoading) {
		return <LoadingComponent />;
	}

	if (orderedBrands.length === 0) {
		return <ErrorComponent title="" description="No entries found." />;
	}

	return (
		<>
			<SortableList
				items={orderedBrands}
				onReorder={setOrderedBrands}
				className="list-decimal space-y-2 ml-8 mt-4"
				renderItem={(brand) => (
					<SortableBrandItem key={brand.id} brand={brand} />
				)}
			/>

			<div className="flex gap-3 mt-4">
				<Link
					variant="outline"
					title="Back to list"
					href={Routes.get('brand')}
				>
					<Icons.Brand />
					Back to list
				</Link>
				<Button
					variant="outline"
					hover="default"
					onClick={handleUpdateOrder}
					title="Update"
					disabled={loading}
				>
					<Icons.Action.Save />
					Update order
				</Button>
			</div>
		</>
	);
};

export const DataTableBrandOrder = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="brand" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersBrandOrder />
				<DataTableBrandOrderContent />
			</div>
		</DataTableProvider>
	);
};
