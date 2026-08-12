import {
	ApiRequest,
	buildQueryString,
	getResponseData,
	resolveRequestPath,
} from '@/helpers/api.helper';
import type {
	FindFunctionParamsType,
	FindFunctionResponseType,
} from '@/types/action.type';
import type { ApiResponseFetch, QueryFiltersType } from '@/types/api.type';
import type { DataSourceKey } from '@/types/data-source.key';

export async function requestView<Entry>(
	dataSource: DataSourceKey,
	id: number,
) {
	const response: ApiResponseFetch<Entry> = await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}/${id}`,
	);

	return getResponseData(response);
}

export async function requestFind<Entry>(
	dataSource: DataSourceKey,
	params: FindFunctionParamsType,
) {
	const query = buildQueryString(params as QueryFiltersType);

	const path = `/${resolveRequestPath(dataSource)}${query ? `?${query}` : ''}`;

	const response: ApiResponseFetch<FindFunctionResponseType<Entry>> =
		await new ApiRequest().doFetch(path);

	return getResponseData<FindFunctionResponseType<Entry>>(response);
}

export async function requestCreate<Entry, RequestParams>(
	dataSource: DataSourceKey,
	params: RequestParams,
): Promise<ApiResponseFetch<Partial<Entry>>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}`,
		{
			method: 'POST',
			body: JSON.stringify(params),
		},
	);
}

export async function requestUpdate<Entry, RequestParams>(
	dataSource: DataSourceKey,
	params: RequestParams,
	id: number,
): Promise<ApiResponseFetch<Partial<Entry>>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}/${id}`,
		{
			method: 'PUT',
			body: JSON.stringify(params),
		},
	);
}

export async function requestDelete<Entry extends { id: number }>(
	dataSource: DataSourceKey,
	entry: Entry,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}/${entry.id}`,
		{
			method: 'DELETE',
		},
	);
}

export async function requestDeleteMultiple(
	dataSource: DataSourceKey,
	ids: number[],
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}`,
		{
			method: 'DELETE',
			body: JSON.stringify({
				ids,
			}),
		},
	);
}

export async function requestRestore<Entry extends { id: number }>(
	dataSource: DataSourceKey,
	entry: Entry,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}/${entry.id}/restore`,
		{
			method: 'PATCH',
		},
	);
}

export async function requestUpdateStatus<
	Entry extends { id: number; status: string },
>(
	dataSource: DataSourceKey,
	entry: Entry,
	status: Entry['status'],
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath(dataSource)}/${entry.id}/status/${status}`,
		{
			method: 'PATCH',
		},
	);
}
