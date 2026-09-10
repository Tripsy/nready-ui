import {
	buildAttributeLabel,
	buildAttributeValue,
	type ProductAttributeDisplayType,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

export const PRODUCT_ATTRIBUTE_TRANSLATION_KEYS = [
	'text.attributes',
	'text.attribute_yes',
	'text.attribute_no',
] as const;

export type ProductAttributeTranslations = Record<
	(typeof PRODUCT_ATTRIBUTE_TRANSLATION_KEYS)[number],
	string
>;

/**
 * The product's own attributes as a spec table - what it says about itself, as opposed to the
 * axes that tell its variants apart, which the variant chooser already shows.
 *
 * Ordered by the backend, which sorts on the definition's `sort_order` across the product's
 * categories. Nothing is re-sorted here: insertion order would shuffle the moment an attribute is
 * re-saved, and a second opinion on the order is a second way for it to be wrong.
 *
 * Rows the served language cannot render - a term with no wording in it - are dropped rather than
 * shown unnamed. Renders nothing at all once that leaves the list empty, so a product with no
 * attributes gets no empty heading.
 */
export function ProductAttributes({
	attributes,
	language,
	translations,
}: {
	attributes: ProductAttributeDisplayType[] | undefined;
	language: Language;
	translations: ProductAttributeTranslations;
}) {
	const booleanLabels = {
		yes: translations['text.attribute_yes'],
		no: translations['text.attribute_no'],
	};

	const rows = (attributes ?? []).flatMap((attribute) => {
		const label = buildAttributeLabel(attribute);
		const value = buildAttributeValue(attribute, language, booleanLabels);

		return label && value ? [{ label, value }] : [];
	});

	if (rows.length === 0) {
		return null;
	}

	return (
		<section className="mt-8 rounded-2xl border border-border p-5">
			<h2 className="text-xs uppercase tracking-wide text-muted">
				{translations['text.attributes']}
			</h2>

			{/*
			 * A definition list rather than a table: each row is one label and one value, which
			 * is what `<dl>` describes. A `<table>` would promise a grid with columns to compare
			 * across, and there is only ever the one product here.
			 */}
			<dl className="mt-3 divide-y divide-line text-sm">
				{rows.map((row) => (
					<div
						key={`${row.label}-${row.value}`}
						className="flex flex-wrap gap-x-4 gap-y-1 py-2"
					>
						<dt className="w-40 shrink-0 text-muted">
							{row.label}
						</dt>
						<dd className="font-medium">{row.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
