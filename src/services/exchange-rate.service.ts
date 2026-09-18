import { Configuration } from '@/config/settings.config';
import { requestFind } from '@/helpers/services.helper';
import type { ExchangeRateModel } from '@/models/exchange-rate.model';

/**
 * The most recent rate published for each of `currencies`, as `{ EUR: 5.2575 }` - one unit of the
 * currency expressed in the deployment's base currency.
 *
 * One request per currency: the list endpoint has no "latest per currency" mode, and asking for a
 * page of rates ordered by day instead would silently miss a currency whose last rate predates
 * the page. The set is the currencies a variant is priced in, so it is one or two in practice.
 *
 * **A currency may be absent from the result, and that is not an error.** No rate has been entered
 * for it, or the caller cannot read the `exchange-rate` entity - both leave the figure unknown
 * rather than wrong, and a caller comparing against it has to say so instead of assuming parity.
 * The whole call therefore resolves rather than rejects; a caller wanting the failure has to ask
 * the endpoint itself.
 */
export async function requestLatestExchangeRates(
	currencies: readonly string[],
): Promise<Record<string, number>> {
	const baseCurrency = Configuration.get('app.currency');

	const results = await Promise.all(
		currencies.map(async (currency) => {
			try {
				const response = await requestFind<ExchangeRateModel>(
					'exchange-rate',
					{
						filter: { currency },
						order_by: 'rate_date',
						direction: 'DESC',
						limit: 1,
						page: 1,
					},
				);

				const entry = response?.entries?.[0];

				if (!entry || entry.base_currency !== baseCurrency) {
					return null;
				}

				return [currency, Number(entry.rate)] as const;
			} catch {
				return null;
			}
		}),
	);

	return Object.fromEntries(
		results.filter((entry) => entry !== null),
	) as Record<string, number>;
}
