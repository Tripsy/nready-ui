import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import type { OperationalRecordModel } from '@/models/operational-record.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The operational records attached to a cash flow entry.
 *
 * Always an array. A cash flow with no records comes back with no payload at all, and an
 * absent list and an empty one mean the same thing on read - while `undefined` does not:
 * TanStack Query rejects it outright ("Query data cannot be undefined"), so a queryFn handing
 * it back turns "nothing to show" into a query error.
 */
export async function requestOperationalRecords(
	cash_flow_id: number,
): Promise<OperationalRecordModel[]> {
	const response: ApiResponseFetch<OperationalRecordModel[]> =
		await new ApiRequest().doFetch(
			`/cash-flow/operational-records/${cash_flow_id}`,
			{
				method: 'GET',
			},
		);

	return getResponseData(response) ?? [];
}
