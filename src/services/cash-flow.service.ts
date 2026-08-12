import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import type { OperationalRecordModel } from '@/models/operational-record.model';
import type { ApiResponseFetch } from '@/types/api.type';

export async function requestOperationalRecords(
	cash_flow_id: number,
): Promise<OperationalRecordModel[] | undefined> {
	const response: ApiResponseFetch<OperationalRecordModel[]> =
		await new ApiRequest().doFetch(
			`/cash-flow/operational-records/${cash_flow_id}`,
			{
				method: 'GET',
			},
		);

	return getResponseData(response);
}
