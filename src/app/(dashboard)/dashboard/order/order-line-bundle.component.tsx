import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { getLanguageClient } from '@/config/translate.setup';
import { requestView } from '@/helpers/services.helper';
import type { ProductModel } from '@/models/product.model';
import {
	type BundleChoiceType,
	type BundleComponentType,
	bundleComponents,
	chosenBundleComponents,
	defaultBundleChoices,
	isExtraComponent,
	isIncludedComponent,
	normalizeBundleChoices,
	quoteBundleNet,
	sortBundleGroups,
} from '@/models/product-bundle.model';
import { displayProductVariantLabel } from '@/models/product-variant.model';
import { findVariantsByIds } from '@/services/product.service';

/**
 * A bundle line's contents and the choices it leaves to the operator - the dashboard twin of the
 * storefront's `ProductBundleBuilder`, reading the composition through the same
 * `product-bundle.model` helpers so a choice made here is one the API accepts.
 *
 * `choices` is null on a bundle just picked, and holds every component a stored bundle was written
 * with otherwise; either way it is normalized against the composition once it loads - defaults for
 * a fresh one, the kit dropped and unanswered groups defaulted for a stored one - and handed back.
 *
 * **The price is re-suggested only when the operator changes a choice, or on a fresh bundle.** A
 * stored bundle keeps the figure it was agreed at until somebody recomposes it, the way picking a
 * variant suggests a price but an edit never overwrites one silently.
 */
export function OrderLineBundle({
	index,
	productId,
	variantId,
	currency,
	choices,
	disabled,
	error,
	onChange,
}: {
	readonly index: number;
	readonly productId: number;
	readonly variantId: number;
	readonly currency: string | null;
	readonly choices: BundleChoiceType[] | null;
	readonly disabled: boolean;
	readonly error: string[] | undefined;
	readonly onChange: (patch: {
		components: BundleChoiceType[];
		price?: number;
	}) => void;
}) {
	const {
		data: product,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ['order-line-bundle', productId],
		queryFn: () => requestView<ProductModel>('product', productId),
	});

	const items = bundleComponents(product?.bundle_items ?? []);
	const groups = sortBundleGroups(product?.bundle_groups ?? []);

	// The bundle's own variant and every component's, for SKUs and standalone prices
	const variantIds = [
		...new Set([variantId, ...items.map((item) => item.variant_id)]),
	].sort((left, right) => left - right);

	const { data: variantsById } = useQuery({
		queryKey: ['order-line-bundle-variants', variantIds],
		queryFn: () => findVariantsByIds(variantIds),
		enabled: items.length > 0,
	});

	const priceOf = (id: number): number | null => {
		const sale = variantsById
			?.get(id)
			?.prices?.find((price) => price.currency === currency)?.sale_price;

		return sale === null || sale === undefined ? null : Number(sale);
	};

	const quote = (next: BundleChoiceType[]): number | null =>
		currency
			? quoteBundleNet(
					priceOf(variantId),
					chosenBundleComponents(items, next),
					(item) => priceOf(item.variant_id),
					currency,
				)
			: null;

	const isReady = items.length > 0 && variantsById !== undefined;

	const normalized = isReady
		? normalizeBundleChoices(
				items,
				groups,
				choices ?? defaultBundleChoices(items, groups),
			)
		: null;

	/*
	 * Hands the normalized choices back once - and on a fresh bundle the price they quote. Keyed
	 * on the serialized pair so a re-render that changes nothing does not loop.
	 */
	const normalizedKey = JSON.stringify(normalized);
	const choicesKey = JSON.stringify(choices);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the keys above stand for `normalized` and `choices`
	useEffect(() => {
		if (!normalized || normalizedKey === choicesKey) {
			return;
		}

		const suggested = choices === null ? quote(normalized) : null;

		onChange({
			components: normalized,
			...(suggested === null ? {} : { price: suggested }),
		});
	}, [normalizedKey, choicesKey]);

	if (isLoading) {
		return <p className="my-4 text-sm text-muted">Loading bundle...</p>;
	}

	// A failed read is not an empty bundle - saying so would send the operator to fix the catalog
	if (isError || !product) {
		return (
			<p className="my-4 text-sm text-danger">
				The bundle's composition could not be loaded - reopen the order
				to try again.
			</p>
		);
	}

	if (items.length === 0) {
		return (
			<p className="my-4 text-sm text-danger">
				This bundle has no components in the catalog.
			</p>
		);
	}

	const current = normalized ?? [];
	const language = getLanguageClient();

	const change = (next: BundleChoiceType[]) => {
		const suggested = quote(next);

		onChange({
			components: next,
			...(suggested === null ? {} : { price: suggested }),
		});
	};

	const nameOf = (item: BundleComponentType) => {
		const variant = variantsById?.get(item.variant_id);
		const name = variant
			? displayProductVariantLabel(variant)
			: `#${item.variant_id}`;

		// `quantity` is numeric on the backend and arrives as a string
		const units = Number(item.quantity);

		return units !== 1 ? `${units} × ${name}` : name;
	};

	const included = items.filter(isIncludedComponent);
	const extras = items.filter(isExtraComponent);

	return (
		<div className="my-4 space-y-4">
			{included.length > 0 && (
				<div>
					<h4 className="text-sm font-semibold">Included</h4>
					<ul className="mt-2 space-y-1 text-sm">
						{included.map((item) => (
							<li key={item.id}>{nameOf(item)}</li>
						))}
					</ul>
				</div>
			)}

			{groups.map((group) => {
				const candidates = items.filter(
					(item) => item.group_id === group.id,
				);
				const picked = current.find((choice) =>
					candidates.some(
						(candidate) => candidate.id === choice.item_id,
					),
				);
				const contents = group.label?.contents ?? [];
				const label =
					contents.find((content) => content.language === language)
						?.value ??
					contents[0]?.value ??
					`Choice #${group.id}`;
				const headingId = `line-${index}-bundle-group-${group.id}`;

				return (
					<div key={group.id}>
						<h4 id={headingId} className="text-sm font-semibold">
							{label}{' '}
							<span className="font-normal text-muted">
								(exactly 1)
							</span>
						</h4>

						<RadioGroup
							aria-labelledby={headingId}
							className="mt-2 flex flex-wrap gap-x-6 gap-y-2"
							isDisabled={disabled}
							value={picked ? String(picked.item_id) : null}
							onChange={(value: string) =>
								change([
									...current.filter(
										(choice) => choice !== picked,
									),
									{ item_id: Number(value) },
								])
							}
						>
							{candidates.map((item) => (
								<Radio
									key={item.id}
									value={String(item.id)}
									contentClassName="text-sm"
								>
									{nameOf(item)}
								</Radio>
							))}
						</RadioGroup>
					</div>
				);
			})}

			{extras.length > 0 && (
				<div>
					<h4 className="text-sm font-semibold">
						Extras{' '}
						<span className="font-normal text-muted">
							(optional)
						</span>
					</h4>

					<div className="mt-2 flex flex-col gap-2">
						{extras.map((item) => {
							const taken = current.find(
								(choice) => choice.item_id === item.id,
							);
							const units = taken?.units ?? 1;
							const without = current.filter(
								(choice) => choice !== taken,
							);

							return (
								<div
									key={item.id}
									className="flex items-center gap-2"
								>
									<Checkbox
										id={`line-${index}-bundle-extra-${item.id}`}
										isSelected={taken !== undefined}
										isDisabled={disabled}
										onChange={(checked: boolean) =>
											change(
												checked
													? [
															...without,
															{
																item_id:
																	item.id,
																units: 1,
															},
														]
													: without,
											)
										}
										contentClassName="text-sm"
									>
										{nameOf({ ...item, quantity: 1 })}
									</Checkbox>

									{/* A ceiling above one is a count to choose, not only a yes */}
									{taken && Number(item.quantity) > 1 && (
										<span className="flex items-center gap-1 text-sm">
											<Button
												type="button"
												variant="ghost"
												className="h-7 w-7"
												disabled={
													disabled || units <= 1
												}
												aria-label="One fewer"
												onClick={() =>
													change([
														...without,
														{
															item_id: item.id,
															units: units - 1,
														},
													])
												}
											>
												<Icons.Action.Subtract className="h-3 w-3" />
											</Button>
											<span className="w-5 text-center tabular-nums">
												{units}
											</span>
											<Button
												type="button"
												variant="ghost"
												className="h-7 w-7"
												disabled={
													disabled ||
													units >=
														Number(item.quantity)
												}
												aria-label="One more"
												onClick={() =>
													change([
														...without,
														{
															item_id: item.id,
															units: units + 1,
														},
													])
												}
											>
												<Icons.Action.Add className="h-3 w-3" />
											</Button>
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{error?.map((message) => (
				<p key={message} className="text-sm text-danger">
					{message}
				</p>
			))}
		</div>
	);
}
