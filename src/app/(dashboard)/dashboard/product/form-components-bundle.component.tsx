import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
	emptyComponent,
	type ProductBundleComponentFormType,
} from '@/app/(dashboard)/dashboard/product/product-bundle.definition';
import {
	FormComponentAutoComplete,
	FormComponentInput,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { ownErrorMessages, rowErrorsAt } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import {
	findBundleCandidates,
	findVariantsByIds,
} from '@/services/product.service';

/**
 * One component of the bundle: what it points at, and how many.
 *
 * The variant it names is fixed once chosen — swapping one component for another is removing a
 * row and adding another, which is also what the API sees, since `syncItems` keys on
 * `variant_id`. So the row shows the SKU and name read-only rather than re-opening the picker.
 */
function ComponentRow({
	component,
	index,
	pending,
	errors,
	resolved,
	onChange,
	onRemove,
}: {
	component: ProductBundleComponentFormType;
	index: number;
	pending: boolean;
	errors: unknown;
	/** Looked up by the editor for a stored component, which arrives as an id alone. */
	resolved?: ProductVariantModel;
	onChange: (value: ProductBundleComponentFormType) => void;
	onRemove: () => void;
}) {
	const elementIds = useElementIds([
		`component-quantity-${component.key}`,
	] as const);

	const rowErrors = rowErrorsAt<ProductBundleComponentFormType>(
		errors,
		index,
	);

	return (
		<div className="rounded-lg border border-line p-3">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium">
						{component.sku ||
							resolved?.sku ||
							`#${component.variant_id}`}
					</div>
					<div className="truncate text-xs text-muted">
						{component.label ||
							resolved?.product?.contents?.[0]?.label ||
							'—'}
					</div>
				</div>

				<FormComponentInput<ProductBundleComponentFormType>
					labelText="Quantity"
					id={elementIds[`component-quantity-${component.key}`]}
					fieldName="quantity"
					fieldValue={component.quantity}
					className="max-w-24"
					disabled={pending}
					onChange={(event) =>
						onChange({
							...component,
							quantity: event.target.value,
						})
					}
					error={ownErrorMessages(rowErrors?.quantity)}
				/>

				<Button
					type="button"
					variant="outline"
					hover="error"
					disabled={pending}
					onClick={onRemove}
					aria-label={`Remove ${component.sku}`}
				>
					<Icons.Action.Delete className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

/**
 * The bundle's components — a flat list, every one of them always included.
 *
 * A bundle is not customizable: there is nothing for the customer to choose between and no
 * per-component price adjustment, so a row is a variant and a quantity. The price is the
 * bundle's own, on the Price tab.
 */
export function FormComponentsBundle({
	value,
	pending,
	errors,
	setError,
	onChange,
}: {
	value: ProductBundleComponentFormType[];
	pending: boolean;
	errors: unknown;
	setError?: string[];
	onChange: (value: ProductBundleComponentFormType[]) => void;
}) {
	const [search, setSearch] = useState('');

	const elementIds = useElementIds(['component-search'] as const);

	/*
	 * A stored component arrives as `variant_id` alone — `attachBranches` does not join the
	 * variant behind a bundle item — so the rows an edit opens with carry no name until they are
	 * looked up. One request for the whole set through the listing's `id` list filter, and only
	 * for the rows that need it: anything just picked already brought its own wording along.
	 */
	const unresolved = value
		.filter((component) => !component.sku)
		.map((component) => component.variant_id)
		.sort((left, right) => left - right);

	const { data: resolvedVariants } = useQuery({
		queryKey: ['bundle-component-names', unresolved.join(',')],
		queryFn: () => findVariantsByIds(unresolved),
		enabled: unresolved.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const { suggestions, isFetching } =
		useRemoteAutocomplete<ProductVariantModel>({
			query: search,
			queryKey: ['s-bundle-component'],
			queryFn: (term) => findBundleCandidates(term),
			minLength: 3,
		});

	const chosen = new Set(value.map((component) => component.variant_id));

	return (
		<div className="space-y-3">
			<FormComponentAutoComplete<
				{ component_search: string },
				ProductVariantModel
			>
				id={elementIds['component-search']}
				ariaLabel="Add a component"
				fieldName="component_search"
				fieldValue={search}
				className="pl-8"
				disabled={pending}
				icons={{
					left: <Icons.Search className="opacity-40 h-4.5 w-4.5" />,
				}}
				placeholderText="Search by SKU or product name…"
				onInputChange={setSearch}
				autoCompleteProps={{
					/*
					 * Already-chosen variants are filtered out of the suggestions rather than
					 * rejected on select: `syncItems` keys on `variant_id`, so a component
					 * added twice silently collapses into one row with the later quantity.
					 */
					suggestions: suggestions.filter(
						(entry) => !chosen.has(entry.id),
					),
					isLoading: isFetching,
					onSelect: (entry) => {
						onChange([...value, emptyComponent(entry)]);
						setSearch('');
					},
					getOptionLabel: (entry) =>
						displayProductVariantLabel(entry),
					getOptionKey: (entry) => entry.id,
				}}
			/>

			<p className="flex items-start gap-1 text-xs text-muted">
				<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
				Only simple products are offered — a bundle cannot contain
				another bundle.
			</p>

			{setError && (
				<p className="text-xs text-danger">{setError.join(' ')}</p>
			)}

			{value.length === 0 ? (
				<p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
					No components yet. A bundle has to add up to at least two
					units.
				</p>
			) : (
				value.map((component, index) => (
					<ComponentRow
						key={component.key}
						component={component}
						index={index}
						pending={pending}
						errors={errors}
						resolved={resolvedVariants?.get(component.variant_id)}
						onChange={(next) =>
							onChange(
								value.map((entry, entryIndex) =>
									entryIndex === index ? next : entry,
								),
							)
						}
						onRemove={() =>
							onChange(
								value.filter(
									(_, entryIndex) => entryIndex !== index,
								),
							)
						}
					/>
				))
			)}

			{/*
			 * The whole list in one hidden field. Per-input names cannot express a nested
			 * repeatable, and `getProductBundleFormValues` parses this back — `position` is
			 * assigned from the array order on the way out, so it is not an input either.
			 */}
			<input
				type="hidden"
				name="components"
				value={JSON.stringify(value)}
			/>
		</div>
	);
}
