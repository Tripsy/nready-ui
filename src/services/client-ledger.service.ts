import {
	ApiRequest,
	buildQueryString,
	getResponseData,
} from '@/helpers/api.helper';
import type {
	ClientLedgerBalanceModel,
	ClientLedgerEntryModel,
} from '@/models/client-ledger.model';
import type {
	FindFunctionParamsType,
	FindFunctionResponseType,
} from '@/types/action.type';
import type { ApiResponseFetch, QueryFiltersType } from '@/types/api.type';

/**
 * The client ledger is read-only and scoped to one client by the path, which the generic
 * `services.helper` requests cannot address.
 */

/** The money moved with the client, one row per currency - received, refunded, net. */
export async function requestClientLedgerBalance(clientId: number): Promise<
	ApiResponseFetch<{
		client_id: number;
		balances: ClientLedgerBalanceModel[];
	}>
> {
	return await new ApiRequest().doFetch(`/client-ledger/${clientId}`, {
		method: 'GET',
	});
}

/**
 * The completed movements behind it, in the data-table `find` shape. `client_id` goes into the
 * path; whatever else sits in the filter is passed through as is - the API folds the path's id
 * back into its filter and drops keys it does not know, such as the client label the filter form
 * keeps beside the id.
 */
export async function requestClientLedgerEntries(
	clientId: number,
	params: FindFunctionParamsType,
): Promise<FindFunctionResponseType<ClientLedgerEntryModel> | undefined> {
	const { client_id: _clientId, ...filter } = params.filter ?? {};

	const query = buildQueryString({
		...params,
		filter: filter,
	} as QueryFiltersType);

	const response: ApiResponseFetch<
		FindFunctionResponseType<ClientLedgerEntryModel>
	> = await new ApiRequest().doFetch(
		`/client-ledger/${clientId}/entries${query ? `?${query}` : ''}`,
	);

	return getResponseData(response);
}
