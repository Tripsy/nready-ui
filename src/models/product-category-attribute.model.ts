import { capitalizeFirstLetter } from '@/helpers/string.helper';
import { displayTermValue, type TermModel } from '@/models/term.model';
import type { Language } from '@/types/common.type';

/**
 * Which of the two attribute tables a value written against this definition lands in.
 *
 * `product` — descriptive, one row per value; a product may carry several under one label.
 * `variant` — an axis that tells siblings apart, exactly one value per label per variant.
 *
 * Mirrors `ProductCategoryAttributeScopeEnum` in the backend's
 * `product-category-attribute.entity.ts`.
 */
export const ProductCategoryAttributeScopeEnum = {
	PRODUCT: 'product',
	VARIANT: 'variant',
} as const;

export type ProductCategoryAttributeScope =
	(typeof ProductCategoryAttributeScopeEnum)[keyof typeof ProductCategoryAttributeScopeEnum];

/** How the value is stored — which column the product's attribute row occupies. */
export const ProductCategoryAttributeValueTypeEnum = {
	TERM: 'term',
	NUMBER: 'number',
	STRING: 'string',
	BOOLEAN: 'boolean',
} as const;

export type ProductCategoryAttributeValueType =
	(typeof ProductCategoryAttributeValueTypeEnum)[keyof typeof ProductCategoryAttributeValueTypeEnum];

/** How the value is captured. Orthogonal to storage — *330* is a number typed or picked. */
export const ProductCategoryAttributeTypeEnum = {
	INPUT: 'input',
	SELECT: 'select',
	RADIO: 'radio',
	CHECKBOX: 'checkbox',
} as const;

export type ProductCategoryAttributeType =
	(typeof ProductCategoryAttributeTypeEnum)[keyof typeof ProductCategoryAttributeTypeEnum];

export const PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_SCOPE =
	ProductCategoryAttributeScopeEnum.PRODUCT;
export const PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_TYPE =
	ProductCategoryAttributeTypeEnum.SELECT;
export const PRODUCT_CATEGORY_ATTRIBUTE_DEFAULT_VALUE_TYPE =
	ProductCategoryAttributeValueTypeEnum.TERM;

/**
 * Which storage each capture admits, repeating the `@Check` the table carries.
 *
 * The database answers a violation as a masked 500 and the pairing is the first thing a form
 * gets wrong, so the select for `value_type` is narrowed to this rather than offering four
 * options and letting three of them fail. `checkbox` is the only capture taking two — a lone
 * yes/no toggle, or a multi-pick over the option list.
 */
export const VALUE_TYPES_BY_TYPE: Record<
	ProductCategoryAttributeType,
	readonly ProductCategoryAttributeValueType[]
> = {
	[ProductCategoryAttributeTypeEnum.INPUT]: [
		ProductCategoryAttributeValueTypeEnum.NUMBER,
		ProductCategoryAttributeValueTypeEnum.STRING,
		ProductCategoryAttributeValueTypeEnum.BOOLEAN,
	],
	[ProductCategoryAttributeTypeEnum.SELECT]: [
		ProductCategoryAttributeValueTypeEnum.TERM,
	],
	[ProductCategoryAttributeTypeEnum.RADIO]: [
		ProductCategoryAttributeValueTypeEnum.TERM,
	],
	[ProductCategoryAttributeTypeEnum.CHECKBOX]: [
		ProductCategoryAttributeValueTypeEnum.TERM,
		ProductCategoryAttributeValueTypeEnum.BOOLEAN,
	],
};

/**
 * The units a numeric attribute may be quoted in, mirroring `MeasureUnitEnum` in the backend's
 * `src/shared/types/measure-unit.type.ts`.
 *
 * Only the key and how it reads are carried here. The `factor` that turns a value into the
 * dimension's base figure stays on the backend, where the conversion happens on write — a copy
 * of it in the browser would be a second answer to what a stored value means.
 */
export const MeasureUnitEnum = {
	MILLILITRE: 'ml',
	CENTILITRE: 'cl',
	DECILITRE: 'dl',
	LITRE: 'l',
	HECTOLITRE: 'hl',
	CUBIC_METRE: 'm3',

	MILLIGRAM: 'mg',
	GRAM: 'g',
	KILOGRAM: 'kg',
	TONNE: 't',

	MILLIMETRE: 'mm',
	CENTIMETRE: 'cm',
	METRE: 'm',
	KILOMETRE: 'km',

	SQUARE_MILLIMETRE: 'mm2',
	SQUARE_CENTIMETRE: 'cm2',
	SQUARE_METRE: 'm2',

	SECOND: 's',
	MINUTE: 'min',
	HOUR: 'h',
	DAY: 'day',

	WATT: 'w',
	KILOWATT: 'kw',

	JOULE: 'j',
	WATT_HOUR: 'wh',
	KILOWATT_HOUR: 'kwh',
} as const;

export type MeasureUnit =
	(typeof MeasureUnitEnum)[keyof typeof MeasureUnitEnum];

/**
 * The unit picker, grouped the way the backend groups the units themselves. A dimension is not
 * a field on the definition — it is only how the list is offered, so a volume and a mass do not
 * sit next to each other in one flat dropdown of twenty-five entries.
 *
 * The symbol is how the unit renders beside a value; the key is an ASCII slug, so `m2` and `m³`
 * are deliberately not the same string.
 */
export const MEASURE_UNIT_GROUPS: {
	dimension: string;
	units: { value: MeasureUnit; symbol: string }[];
}[] = [
	{
		dimension: 'Volume',
		units: [
			{ value: MeasureUnitEnum.MILLILITRE, symbol: 'ml' },
			{ value: MeasureUnitEnum.CENTILITRE, symbol: 'cl' },
			{ value: MeasureUnitEnum.DECILITRE, symbol: 'dl' },
			{ value: MeasureUnitEnum.LITRE, symbol: 'l' },
			{ value: MeasureUnitEnum.HECTOLITRE, symbol: 'hl' },
			{ value: MeasureUnitEnum.CUBIC_METRE, symbol: 'm³' },
		],
	},
	{
		dimension: 'Mass',
		units: [
			{ value: MeasureUnitEnum.MILLIGRAM, symbol: 'mg' },
			{ value: MeasureUnitEnum.GRAM, symbol: 'g' },
			{ value: MeasureUnitEnum.KILOGRAM, symbol: 'kg' },
			{ value: MeasureUnitEnum.TONNE, symbol: 't' },
		],
	},
	{
		dimension: 'Length',
		units: [
			{ value: MeasureUnitEnum.MILLIMETRE, symbol: 'mm' },
			{ value: MeasureUnitEnum.CENTIMETRE, symbol: 'cm' },
			{ value: MeasureUnitEnum.METRE, symbol: 'm' },
			{ value: MeasureUnitEnum.KILOMETRE, symbol: 'km' },
		],
	},
	{
		dimension: 'Area',
		units: [
			{ value: MeasureUnitEnum.SQUARE_MILLIMETRE, symbol: 'mm²' },
			{ value: MeasureUnitEnum.SQUARE_CENTIMETRE, symbol: 'cm²' },
			{ value: MeasureUnitEnum.SQUARE_METRE, symbol: 'm²' },
		],
	},
	{
		dimension: 'Time',
		units: [
			{ value: MeasureUnitEnum.SECOND, symbol: 's' },
			{ value: MeasureUnitEnum.MINUTE, symbol: 'min' },
			{ value: MeasureUnitEnum.HOUR, symbol: 'h' },
			{ value: MeasureUnitEnum.DAY, symbol: 'day' },
		],
	},
	{
		dimension: 'Power',
		units: [
			{ value: MeasureUnitEnum.WATT, symbol: 'W' },
			{ value: MeasureUnitEnum.KILOWATT, symbol: 'kW' },
		],
	},
	{
		dimension: 'Energy',
		units: [
			{ value: MeasureUnitEnum.JOULE, symbol: 'J' },
			{ value: MeasureUnitEnum.WATT_HOUR, symbol: 'Wh' },
			{ value: MeasureUnitEnum.KILOWATT_HOUR, symbol: 'kWh' },
		],
	},
];

/**
 * How each unit reads, keyed by its stored value — the same symbols the picker offers, so the
 * field that renders a value cannot drift from the select that chose the unit.
 */
export const MEASURE_UNIT_SYMBOLS: Record<MeasureUnit, string> =
	Object.fromEntries(
		MEASURE_UNIT_GROUPS.flatMap((group) =>
			group.units.map((unit) => [unit.value, unit.symbol]),
		),
	) as Record<MeasureUnit, string>;

/** One admissible value for a list-backed definition — an `attribute_value` term. */
export type ProductCategoryAttributeOptionModel<D = Date | string> = {
	id: number;
	attribute_id: number;
	term_id: number;
	sort_order: number;

	created_at: D;
	updated_at: D;
	deleted_at: D;

	// Joined by `read`, absent from `find` — the definition listing carries no options at all.
	term?: TermModel<D>;
};

export type ProductCategoryAttributeModel<D = Date | string> = {
	id: number;
	category_id: number;
	attribute_label_id: number;

	scope: ProductCategoryAttributeScope;
	value_type: ProductCategoryAttributeValueType;
	type: ProductCategoryAttributeType;

	unit: MeasureUnit | null;
	prefix: string | null;
	suffix: string | null;
	min_value: number | null;
	max_value: number | null;

	is_required: boolean;
	is_filterable: boolean;
	inherit: boolean;
	sort_order: number;

	created_at: D;
	updated_at: D;
	deleted_at: D;

	// Both endpoints join the label and its wording; only `read` joins the options.
	attribute_label?: TermModel<D> | null;
	options?: ProductCategoryAttributeOptionModel<D>[];

	/*
	 * Never returned by the API — carried only on the prefill a create window is seeded with,
	 * naming the categories that window may attach the definition to. `getFormState` reads the
	 * prefill through this same type, which is why it lives here.
	 */
	category_options?: { id: number; label: string }[];
};

/**
 * What the definition is called. The row carries an `attribute_label_id` and the wording comes
 * from the joined term, so the id is the fallback rather than a blank — a definition whose
 * label term was deleted still has to be recognisable enough to be fixed.
 */
export function displayAttributeLabel(
	entry: ProductCategoryAttributeModel,
	language: Language,
): string {
	if (!entry.attribute_label) {
		return `#${entry.attribute_label_id}`;
	}

	/*
	 * Capitalised here rather than stored that way: `TermValidator` lower-cases every wording on
	 * the way in, deliberately — a term is a record many products point at, and "Colour" and
	 * "colour" being two of them is exactly what that avoids. Which leaves the display side to
	 * decide how it reads, and a field label reads as a field label.
	 */
	return capitalizeFirstLetter(
		displayTermValue(
			entry.attribute_label as TermModel,
			language,
			`#${entry.attribute_label_id}`,
		),
	);
}

/**
 * The resolved form for a set of categories: every definition that applies, deduped by label
 * with the deepest category winning, split by the table its values land in.
 *
 * What `GET /product-category-attributes/resolve` answers. The label and the option terms come
 * with their wording — the ids alone would leave a control that cannot be drawn.
 */
export type ResolvedAttributeFormType<D = Date | string> = {
	[ProductCategoryAttributeScopeEnum.PRODUCT]: ProductCategoryAttributeModel<D>[];
	[ProductCategoryAttributeScopeEnum.VARIANT]: ProductCategoryAttributeModel<D>[];
};

/**
 * One value a product (or a variant) has recorded, as the backend stores and returns it.
 *
 * Exactly one of the four value columns is filled, decided by the definition's `value_type`.
 * `value_base` is derived on write from the definition's unit and is never sent back up.
 */
export type ProductAttributeValueType = {
	attribute_label_id: number;
	value_term_id?: number | null;
	value_numeric?: number | null;
	value_text?: string | null;
	value_boolean?: boolean | null;
	value_base?: number | null;
};

/**
 * One attribute as the form holds it — one entry per definition rather than per stored row.
 *
 * The four value columns are flattened into three fields, because a form field is what the
 * editor sees and which column carries the answer is the definition's business, not theirs.
 * `terms` is a list for the one capture that admits several — a `checkbox` over terms, where
 * each choice becomes its own row — and holds at most one for every other.
 *
 * `value_type` rides along so the payload can be built without the definitions in hand:
 * `prepareParamsFromFormValues` runs in the definition file, which never sees the resolved form.
 *
 * `text` holds numbers as typed, for the reason every figure in these forms does: a controlled
 * input whose value is `String(Number(raw))` cannot hold a half-typed decimal.
 */
export type ProductAttributeFormType = {
	attribute_label_id: number;
	/*
	 * A plain string, not the union: the entry crosses a JSON boundary on every submit — the
	 * form writes it into a hidden field and `getFormValues` parses it back — so what arrives
	 * is whatever was in the DOM. The switches below compare it against the enum and ignore
	 * anything else rather than pretend it was checked.
	 */
	value_type: string;
	/*
	 * Carried, not looked up: the validator runs in `<entity>.definition.ts`, which never sees
	 * the resolved form, so the only way a required attribute can fail the submit is for the
	 * entry itself to say it is one.
	 */
	is_required: boolean;
	/*
	 * `{ id }` rather than a bare `number[]`: `FormValuesType` admits a list of groups or a
	 * primitive, never a list of primitives — the same shape the category and tag pickers use.
	 */
	terms: { id: number }[];
	text: string;
	boolean: boolean;
};

/** An empty answer for a definition — what a field renders before anything is filled in. */
export function emptyAttributeValue(
	definition: ProductCategoryAttributeModel,
): ProductAttributeFormType {
	return {
		attribute_label_id: definition.attribute_label_id,
		value_type: definition.value_type,
		is_required: definition.is_required,
		terms: [],
		text: '',
		boolean: false,
	};
}

/**
 * The stored rows, folded back into one entry per label.
 *
 * Grouped rather than mapped one-to-one because a term-backed attribute may hold several rows
 * under one label — three allergens are three rows and one field. Which column is filled is
 * what says how it was stored, so the entry can be rebuilt without the definitions: the form is
 * seeded the moment the window opens, and `resolve` has not answered yet.
 */
export function groupStoredAttributes(
	stored: ProductAttributeValueType[] | undefined,
): ProductAttributeFormType[] {
	const byLabel = new Map<number, ProductAttributeFormType>();

	for (const row of stored ?? []) {
		const entry = byLabel.get(row.attribute_label_id) ?? {
			attribute_label_id: row.attribute_label_id,
			value_type: ProductCategoryAttributeValueTypeEnum.TERM,
			// Restamped from the definition once `resolve` answers; a stored value says
			// nothing about whether it was compulsory
			is_required: false,
			terms: [],
			text: '',
			boolean: false,
		};

		if (row.value_term_id !== null && row.value_term_id !== undefined) {
			entry.value_type = ProductCategoryAttributeValueTypeEnum.TERM;
			entry.terms.push({ id: row.value_term_id });
		}

		if (row.value_numeric !== null && row.value_numeric !== undefined) {
			entry.value_type = ProductCategoryAttributeValueTypeEnum.NUMBER;
			entry.text = String(row.value_numeric);
		}

		if (row.value_text !== null && row.value_text !== undefined) {
			entry.value_type = ProductCategoryAttributeValueTypeEnum.STRING;
			entry.text = row.value_text;
		}

		if (row.value_boolean !== null && row.value_boolean !== undefined) {
			entry.value_type = ProductCategoryAttributeValueTypeEnum.BOOLEAN;
			entry.boolean = row.value_boolean;
		}

		byLabel.set(row.attribute_label_id, entry);
	}

	return [...byLabel.values()];
}

/**
 * The form entries as the payload wants them: one row per recorded value.
 *
 * A definition the editor left empty contributes nothing — absent is how "no value" is said,
 * and `syncValues` reads the list as the complete set. A boolean is the exception: unticked is
 * an answer rather than a blank, so it always writes a row.
 */
export function toAttributePayload(
	values: ProductAttributeFormType[],
): ProductAttributeValueType[] {
	const payload: ProductAttributeValueType[] = [];

	for (const value of values) {
		const attribute_label_id = value.attribute_label_id;

		switch (value.value_type) {
			case ProductCategoryAttributeValueTypeEnum.TERM:
				for (const term of value.terms) {
					payload.push({
						attribute_label_id,
						value_term_id: term.id,
					});
				}
				break;

			case ProductCategoryAttributeValueTypeEnum.NUMBER:
				if (value.text.trim() !== '') {
					payload.push({
						attribute_label_id,
						value_numeric: Number(value.text),
					});
				}
				break;

			case ProductCategoryAttributeValueTypeEnum.STRING:
				if (value.text.trim() !== '') {
					payload.push({
						attribute_label_id,
						value_text: value.text.trim(),
					});
				}
				break;

			case ProductCategoryAttributeValueTypeEnum.BOOLEAN:
				payload.push({
					attribute_label_id,
					value_boolean: value.boolean,
				});
				break;

			// A storage the form does not recognise contributes nothing rather than a guess
			default:
				break;
		}
	}

	return payload;
}

/**
 * Drops the answers whose definition no longer applies.
 *
 * A product's categories are editable, and the resolved form changes with them — an answer left
 * behind from a category since removed would be sent against a label the backend no longer
 * declares, which it refuses with a 422.
 */
export function pruneAttributeValues(
	definitions: ProductCategoryAttributeModel[],
	values: ProductAttributeFormType[],
): ProductAttributeFormType[] {
	const answered = new Map(
		values.map((value) => [value.attribute_label_id, value]),
	);

	/*
	 * One entry per definition, in the order the form renders them — including the ones with no
	 * answer yet. The empties are what lets the validator see a required attribute that was
	 * never filled in, and `toAttributePayload` drops them again on the way out, so they cost
	 * nothing on the wire.
	 *
	 * Anything not in the resolved set falls away with it: an answer left behind from a
	 * category since removed would be sent against a label the backend no longer declares,
	 * which it refuses outright.
	 */
	return definitions.map((definition) => {
		const value = answered.get(definition.attribute_label_id);

		if (!value) {
			return emptyAttributeValue(definition);
		}

		return {
			...value,
			value_type: definition.value_type,
			is_required: definition.is_required,
		};
	});
}

/** Whether an attribute has been answered — what the required check reads. */
export function hasAttributeValue(
	value: ProductAttributeFormType | undefined,
): boolean {
	if (!value) {
		return false;
	}

	switch (value.value_type) {
		case ProductCategoryAttributeValueTypeEnum.TERM:
			return value.terms.length > 0;
		case ProductCategoryAttributeValueTypeEnum.NUMBER:
		case ProductCategoryAttributeValueTypeEnum.STRING:
			return value.text.trim() !== '';
		// A boolean always carries one, which is why `is_required` cannot fail on it
		case ProductCategoryAttributeValueTypeEnum.BOOLEAN:
			return true;
		default:
			return false;
	}
}
