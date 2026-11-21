import type { EntityId } from '@/types/entity-id.type';

/**
 * The VAT classes that carry a percentage and so have rows - mirrors `RatedVatCategoryEnum` on
 * the backend entity. `zero` and `exempt` are 0 everywhere, resolved without a row, and cannot be
 * stored.
 */
export const VatRateCategoryEnum = {
	STANDARD: 'standard',
	REDUCED: 'reduced',
	SECOND_REDUCED: 'second_reduced',
} as const;

export type VatRateCategory =
	(typeof VatRateCategoryEnum)[keyof typeof VatRateCategoryEnum];

// Mirror the column constraints on the backend
export const COUNTRY_CODE_CHARS = 2;
export const VAT_RATE_MAX_DECIMALS = 2;

/**
 * The percentage a VAT class carries in a country from `valid_from` on - RO, reduced, 11,
 * 2025-08-01.
 *
 * A history with no end date: the rate in force on a day is the row with the newest `valid_from`
 * on or before it, so a rate change is one new row dated the day the law applies. The shop is
 * priced at the backend's `company.addressCountry`.
 * Orders and invoices freeze the rate onto their lines, so a row changed here never moves a
 * document already written.
 *
 * No `deleted_at`: the backend table has no soft delete and therefore no restore, for the reason
 * `ExchangeRateModel` gives.
 */
export type VatRateModel<D = Date | string> = {
	id: EntityId;

	country_code: string;
	category: VatRateCategory;
	rate: number;
	/** A calendar day (`YYYY-MM-DD`), not a timestamp - it is a `date` column. */
	valid_from: string;
	notes: string | null;

	created_at: D;
	updated_at: D;
};

export const displayVatRateLabel = (entry: VatRateModel) => {
	return `${entry.country_code} ${entry.category} / ${entry.valid_from}`;
};
