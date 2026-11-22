'use client';

import { useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import {
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { EntityId } from '@/types/entity-id.type';

/** The fields every adjustment starts from - where, and what. */
export type StockAdjustmentTargetFormType = {
	warehouse_id: EntityId | null;
	variant_id: EntityId | null;
	// display-only fields, not part of validation
	warehouse: string | null;
	variant: string | null;
};

const SEARCH_MIN_LENGTH = 3;

/**
 * The warehouse and variant pickers both adjustment forms open with. Only variants that track
 * stock are offered - the backend refuses any other, since an untracked variant has no lots.
 *
 * Each picker clears its id as soon as the text is edited, so a changed label never keeps the
 * previously picked row silently attached. The ids and labels also travel as hidden inputs, which
 * is what the form's `getFormValues` reads.
 */
export function FormTargetStockAdjustment({
	labels,
	elementIds,
}: {
	labels: { warehouse: string; variant: string };
	elementIds: { warehouse: string; variant: string };
}) {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<StockAdjustmentTargetFormType>();

	const [searchWarehouse, setSearchWarehouse] = useState('');
	const [searchVariant, setSearchVariant] = useState('');

	const {
		suggestions: warehouseSuggestions,
		isFetching: isWarehouseFetching,
	} = useRemoteAutocomplete<WarehouseModel>({
		query: searchWarehouse,
		queryKey: ['s-stock-adjustment-warehouse'],
		queryFn: async (term) => {
			const response:
				| FindFunctionResponseType<WarehouseModel>
				| undefined = await requestFind('warehouse', {
				filter: { term: term },
				limit: 10,
			});

			return response?.entries ?? [];
		},
		minLength: SEARCH_MIN_LENGTH,
	});

	const { suggestions: variantSuggestions, isFetching: isVariantFetching } =
		useRemoteAutocomplete<ProductVariantModel>({
			query: searchVariant,
			queryKey: ['s-stock-adjustment-variant'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<ProductVariantModel>
					| undefined = await requestFind('product-variant', {
					filter: { term: term, track_stock: true },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: SEARCH_MIN_LENGTH,
		});

	return (
		<>
			<input
				type="hidden"
				name="warehouse_id"
				value={formValues.warehouse_id ?? ''}
			/>
			<input
				type="hidden"
				name="warehouse_label"
				value={formValues.warehouse ?? ''}
			/>
			<FormComponentAutoComplete<
				StockAdjustmentTargetFormType,
				WarehouseModel
			>
				labelText={labels.warehouse}
				id={elementIds.warehouse}
				fieldName="warehouse"
				fieldValue={formValues.warehouse ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.warehouse_id}
				onInputChange={(value) => {
					handleChange('warehouse', value);
					handleChange('warehouse_id', null);
					setSearchWarehouse(value);
				}}
				autoCompleteProps={{
					suggestions: warehouseSuggestions,
					isLoading: isWarehouseFetching,
					onSelect: (warehouse) => {
						handleChange(
							'warehouse',
							displayWarehouseLabel(warehouse),
						);
						handleChange('warehouse_id', warehouse.id);
					},
					getOptionLabel: (warehouse) =>
						displayWarehouseLabel(warehouse),
					getOptionKey: (warehouse) => warehouse.id,
				}}
				icons={{
					left: (
						<Icons.Warehouse className="opacity-40 h-4.5 w-4.5" />
					),
				}}
			/>

			<input
				type="hidden"
				name="variant_id"
				value={formValues.variant_id ?? ''}
			/>
			<input
				type="hidden"
				name="variant_label"
				value={formValues.variant ?? ''}
			/>
			<FormComponentAutoComplete<
				StockAdjustmentTargetFormType,
				ProductVariantModel
			>
				labelText={labels.variant}
				id={elementIds.variant}
				fieldName="variant"
				fieldValue={formValues.variant ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.variant_id}
				onInputChange={(value) => {
					handleChange('variant', value);
					handleChange('variant_id', null);
					setSearchVariant(value);
				}}
				autoCompleteProps={{
					suggestions: variantSuggestions,
					isLoading: isVariantFetching,
					onSelect: (variant) => {
						handleChange(
							'variant',
							displayProductVariantLabel(variant),
						);
						handleChange('variant_id', variant.id);
					},
					getOptionLabel: (variant) =>
						displayProductVariantLabel(variant),
					getOptionKey: (variant) => variant.id,
				}}
				icons={{
					left: <Icons.Product className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>
		</>
	);
}
