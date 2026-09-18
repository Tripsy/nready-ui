import {
	createCurrentDate,
	dateDiff,
	stringToDate,
} from '@/helpers/date.helper';

/**
 * Where a stored rate came from, which decides whether the daily import may replace it -
 * mirrors `ExchangeRateSourceEnum` on the backend entity.
 */
export const ExchangeRateSourceEnum = {
	MANUAL: 'manual',
	IMPORT: 'import',
} as const;

export type ExchangeRateSource =
	(typeof ExchangeRateSourceEnum)[keyof typeof ExchangeRateSourceEnum];

export const ExchangeRateSourceLabels: Record<ExchangeRateSource, string> = {
	[ExchangeRateSourceEnum.MANUAL]: 'Manual',
	[ExchangeRateSourceEnum.IMPORT]: 'Imported',
};

// Mirror the column constraints and the service rules on the backend
export const CURRENCY_CODE_CHARS = 3;
export const EXCHANGE_RATE_MAX_DECIMALS = 8;
export const EXCHANGE_RATE_UPDATE_WINDOW_DAYS = 7;

const SECONDS_PER_DAY = 86400;

/**
 * What one unit of `currency` was worth in `base_currency` on `rate_date` - EUR, 5.2575, RON
 * means 1 EUR = 5.2575 RON.
 *
 * `base_currency` is the deployment's own currency, not the priced one, matching how the word is
 * used everywhere else in this stack (`invoice.base_currency`, the "rate to the base currency" a
 * document freezes). It is filled in by the backend from its `app.currency`, so no form sends it.
 *
 * No `deleted_at`: the backend table has no soft delete, so there is no restore either - a
 * soft-deleted row would keep its (currency, day) key occupied while disappearing from every
 * query, and the next import of that day would fail against a row nobody can see.
 */
export type ExchangeRateModel<D = Date | string> = {
	id: number;

	currency: string;
	base_currency: string;
	rate: number;
	/** A calendar day (`YYYY-MM-DD`), not a timestamp - it is a `date` column. */
	rate_date: string;
	source: ExchangeRateSource;
	provider: string | null;
	notes: string | null;

	created_at: D;
	updated_at: D;
};

/**
 * Whether the backend would still accept an edit of this row: rates stay editable for
 * `EXCHANGE_RATE_UPDATE_WINDOW_DAYS` after the day they apply to, and refuse with a 400 after
 * that, because documents have been priced against them by then.
 *
 * Measured from `rate_date` rather than `created_at`, exactly as the service measures it - a rate
 * backfilled today for three weeks ago is already outside the window.
 */
export const isWithinUpdateWindow = (entry: ExchangeRateModel): boolean => {
	const elapsedSeconds = dateDiff(
		stringToDate(entry.rate_date, true),
		createCurrentDate(true),
		'seconds',
	);

	return elapsedSeconds <= EXCHANGE_RATE_UPDATE_WINDOW_DAYS * SECONDS_PER_DAY;
};

export const displayExchangeRateLabel = (entry: ExchangeRateModel) => {
	return `${entry.currency} / ${entry.rate_date}`;
};
