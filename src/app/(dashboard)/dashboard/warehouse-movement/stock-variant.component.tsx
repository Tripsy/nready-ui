'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import { translateEnumLabel } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/account.model';
import type {
	VariantStockModel,
	WarehouseStockModel,
} from '@/models/warehouse-movement.model';
import { useAuth } from '@/providers/auth.provider';
import { requestVariantStock } from '@/services/warehouse-movement.service';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

const TRANSLATION_KEYS = [
	'warehouse-movement.field.on_hand',
	'warehouse-movement.field.reserved',
	'warehouse-movement.field.available',
	'warehouse-movement.field.warehouse',
	'warehouse-movement.field.status',
	'warehouse-movement.section.stock',
	'warehouse-movement.section.warehouses',
	'warehouse-movement.enum.warehouse_status.active',
	'warehouse-movement.enum.warehouse_status.inactive',
	'warehouse-movement.text.stock_hint',
	'warehouse-movement.text.no_stock',
	'warehouse-movement.text.inactive_site',
	'warehouse-movement.text.over_committed',
	'warehouse-movement.text.loading',
	'warehouse-movement.text.load_failed',
	'stock-adjustment.action.create.label',
] as const;

/**
 * A variant's stock, opened from any row that names one - a ledger movement or a low-stock entry,
 * both of which carry `variant_id`. Read live: the figures move with every receipt, order and
 * shipment, so this window is never seeded from the row it was opened from.
 */
export function StockVariant({
	uid,
	entries,
}: {
	// Absent when embedded in another view (the product's), which has no window of its own here
	uid?: string;
	// The SKU travels under either name: a ledger row joins it as `variant`, a low-stock row
	// carries it flat
	entries: {
		variant_id: number;
		sku?: string;
		variant?: { sku: string } | null;
	}[];
}) {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { auth } = useAuth();
	const { open, focus } = useModalStore();
	const queryClient = useQueryClient();

	const variantId = entries[0]?.variant_id;
	const sku = entries[0]?.variant?.sku ?? entries[0]?.sku;

	// An inactive site's stock is not counted, and the backend refuses to adjust it
	const canAdjust = hasPermission(auth, 'stock-adjustment', 'create');

	/**
	 * Opens a stock adjustment with this warehouse and this variant already picked, then comes back
	 * here and reads the figures again - they are the ones the adjustment just moved.
	 */
	const openAdjustment = (site: WarehouseStockModel) => {
		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'stock-adjustment',
			action: 'create',
			data: {
				prefillEntry: {
					warehouse_id: site.warehouse_id,
					warehouse: {
						id: site.warehouse_id,
						code: site.code,
						name: site.name,
					},
					variant_id: variantId,
					variant: sku
						? { id: variantId, sku: sku, product_id: 0 }
						: null,
				},
			},
			events: {
				success: async () => {
					if (uid) {
						focus(uid);
					}

					await queryClient.invalidateQueries({
						queryKey: ['warehouse-movement', 'stock', variantId],
					});
				},
			},
		});
	};

	const { data, isLoading, isError } = useQuery({
		queryKey: ['warehouse-movement', 'stock', variantId],
		queryFn: async (): Promise<VariantStockModel> => {
			const stock = getResponseData(await requestVariantStock(variantId));

			if (!stock) {
				throw new Error('Could not retrieve the variant stock');
			}

			return stock;
		},
		enabled: !!variantId,
		// The backend never caches this read, for the same reason: a stale figure is the one
		// nobody should act on, so each opening asks again
		staleTime: 0,
	});

	if (isLoading) {
		return (
			<LoadingComponent
				description={translations['warehouse-movement.text.loading']}
			/>
		);
	}

	if (isError || !data) {
		return (
			<ErrorComponent
				description={
					translations['warehouse-movement.text.load_failed']
				}
			/>
		);
	}

	const isOverCommitted = data.available < 0;

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted">
				{translations['warehouse-movement.text.stock_hint']}
			</p>

			<ViewSection
				title={translations['warehouse-movement.section.stock']}
			>
				<ViewField
					label={translations['warehouse-movement.field.on_hand']}
					value={data.on_hand}
				/>
				<ViewField
					label={translations['warehouse-movement.field.reserved']}
					value={data.reserved}
				/>
				<ViewField
					label={translations['warehouse-movement.field.available']}
					value={
						<span
							className={cn(
								'font-semibold',
								isOverCommitted && 'text-danger',
							)}
						>
							{data.available}
						</span>
					}
				/>
			</ViewSection>

			{isOverCommitted && (
				<p className="text-sm text-danger">
					{translations['warehouse-movement.text.over_committed']}
				</p>
			)}

			<ViewSection
				title={translations['warehouse-movement.section.warehouses']}
				layout="rows"
			>
				{data.warehouses.length === 0 ? (
					<p className="text-sm text-muted">
						{translations['warehouse-movement.text.no_stock']}
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
									<th className="py-2 pr-4 text-left font-medium">
										{
											translations[
												'warehouse-movement.field.warehouse'
											]
										}
									</th>
									<th className="py-2 pr-4 text-left font-medium">
										{
											translations[
												'warehouse-movement.field.status'
											]
										}
									</th>
									<th className="py-2 text-right font-medium">
										{
											translations[
												'warehouse-movement.field.on_hand'
											]
										}
									</th>
									{canAdjust && <th className="py-2" />}
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{data.warehouses.map((site) => {
									const isActive = site.status === 'active';

									return (
										<tr
											key={site.warehouse_id}
											className={cn(
												!isActive && 'text-muted',
											)}
										>
											<td className="py-2 pr-4">
												{site.code} - {site.name}
											</td>
											<td className="py-2 pr-4">
												{isActive
													? translateEnumLabel(
															translations,
															'warehouse-movement.enum.warehouse_status',
															site.status,
														)
													: translations[
															'warehouse-movement.text.inactive_site'
														]}
											</td>
											<td className="py-2 text-right tabular-nums">
												{site.on_hand}
											</td>
											{canAdjust && (
												<td className="py-2 pl-4 text-right">
													{isActive && (
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																openAdjustment(
																	site,
																)
															}
														>
															{
																translations[
																	'stock-adjustment.action.create.label'
																]
															}
														</Button>
													)}
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</ViewSection>
		</div>
	);
}
