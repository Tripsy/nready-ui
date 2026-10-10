import {
	type ProductBundleGroupType,
	type ProductBundleItemType,
	roundMoney,
} from '@/models/product.model';

/**
 * What a bundle's composition means, read the way the backend's `ProductBundleSelectionService`
 * reads it (`rules/product.md` §8.1) - shared by the storefront's bundle builder and the dashboard's
 * order editor, so a choice made in either is the choice the API accepts.
 *
 * Three kinds of component: the kit (no group, not optional) comes with the bundle and is never
 * sent; a group takes exactly one candidate; an optional component is a tick box taking 1 up to its
 * own `quantity` units.
 */

/** A component as a read hands it back - every read carries `id`. */
export type BundleComponentType = ProductBundleItemType & { id: number };

/** One decision, in the payload shape the cart and the order both take. */
export type BundleChoiceType = {
	item_id: number;
	/** Units of a tick box; a candidate is taken at its own `quantity`. */
	units?: number;
};

/** A component as actually taken, per one bundle. */
export type ChosenBundleComponentType = {
	item: BundleComponentType;
	units: number;
};

export function bundleComponents(
	items: readonly ProductBundleItemType[],
): BundleComponentType[] {
	return items
		.filter((item): item is BundleComponentType => item.id !== undefined)
		.sort((a, b) => a.position - b.position);
}

export function isIncludedComponent(item: ProductBundleItemType): boolean {
	return item.group_id === null && !item.is_optional;
}

export function isExtraComponent(item: ProductBundleItemType): boolean {
	return item.group_id === null && item.is_optional;
}

export function sortBundleGroups(
	groups: readonly ProductBundleGroupType[],
): ProductBundleGroupType[] {
	return [...groups].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** What a fresh bundle starts at: each group's default candidate, each default tick box once. */
export function defaultBundleChoices(
	items: readonly BundleComponentType[],
	groups: readonly ProductBundleGroupType[],
): BundleChoiceType[] {
	return [
		...sortBundleGroups(groups).flatMap((group) => {
			const pick = items.find(
				(item) => item.group_id === group.id && item.is_default,
			);

			return pick ? [{ item_id: pick.id }] : [];
		}),
		...items
			.filter((item) => isExtraComponent(item) && item.is_default)
			.map((item) => ({ item_id: item.id, units: 1 })),
	];
}

/**
 * Stored decisions brought in line with the composition as it stands now: a kit component or one
 * the bundle no longer has is dropped, a group keeps its first candidate, a tick box is held within
 * its ceiling, and a group left unanswered falls back to its default. A stored order's components
 * come back as every line it holds, kit included - this is what turns them into the decisions that
 * produced them.
 */
export function normalizeBundleChoices(
	items: readonly BundleComponentType[],
	groups: readonly ProductBundleGroupType[],
	stored: readonly BundleChoiceType[],
): BundleChoiceType[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	const pickByGroup = new Map<number, number>();
	const extraUnits = new Map<number, number>();

	for (const choice of stored) {
		const item = byId.get(choice.item_id);

		if (!item || isIncludedComponent(item)) {
			continue;
		}

		if (item.group_id !== null) {
			// The first candidate named for a group answers it; a second would be two answers
			if (!pickByGroup.has(item.group_id)) {
				pickByGroup.set(item.group_id, item.id);
			}

			continue;
		}

		extraUnits.set(
			item.id,
			Math.min(Math.max(choice.units ?? 1, 1), Number(item.quantity)),
		);
	}

	const choices: BundleChoiceType[] = [];

	for (const group of sortBundleGroups(groups)) {
		const pick =
			pickByGroup.get(group.id) ??
			items.find((item) => item.group_id === group.id && item.is_default)
				?.id;

		if (pick !== undefined) {
			choices.push({ item_id: pick });
		}
	}

	for (const item of items) {
		const units = extraUnits.get(item.id);

		if (units !== undefined) {
			choices.push({ item_id: item.id, units: units });
		}
	}

	return choices;
}

/** The decisions as the components they take, units per one bundle. */
export function chosenBundleComponents(
	items: readonly BundleComponentType[],
	choices: readonly BundleChoiceType[],
): ChosenBundleComponentType[] {
	const byId = new Map(items.map((item) => [item.id, item]));

	return choices.flatMap((choice) => {
		const item = byId.get(choice.item_id);

		if (!item) {
			return [];
		}

		return [
			{
				item: item,
				units:
					item.group_id === null
						? (choice.units ?? 1)
						: Number(item.quantity),
			},
		];
	});
}

/** The decisions in the payload shape - a candidate names itself, a tick box its units too. */
export function toBundleChoices(
	chosen: readonly ChosenBundleComponentType[],
): BundleChoiceType[] {
	return chosen.map(({ item, units }) =>
		item.group_id === null
			? { item_id: item.id, units: units }
			: { item_id: item.id },
	);
}

/**
 * What one bundle costs as composed, net, in `currency`: the headline price plus, for each taken
 * component, its standalone price moved by its delta, per unit - the backend's `quoteBundleUnit`.
 * `null` when the headline price or a taken component's standalone price is missing in that market,
 * which leaves the figure unquotable rather than quietly wrong.
 */
export function quoteBundleNet(
	basePrice: number | null,
	chosen: readonly ChosenBundleComponentType[],
	standaloneOf: (item: BundleComponentType) => number | null,
	currency: string,
): number | null {
	if (basePrice === null) {
		return null;
	}

	let total = basePrice;

	for (const { item, units } of chosen) {
		const standalone = standaloneOf(item);

		if (standalone === null) {
			return null;
		}

		const delta = Number(
			item.prices.find((price) => price.currency === currency)
				?.price_delta ?? 0,
		);

		total += roundMoney((standalone + delta) * units);
	}

	return roundMoney(total);
}
