import {
	ApiRequest,
	buildQueryString,
	getResponseData,
	resolveRequestPath,
} from '@/helpers/api.helper';
import type { UserPermissionModel } from '@/models/user-permission.model';
import type {
	FindFunctionParamsType,
	FindFunctionResponseType,
} from '@/types/action.type';
import type { ApiResponseFetch, QueryFiltersType } from '@/types/api.type';

export async function getUserPermissions(
	user_id: number,
	params: FindFunctionParamsType,
) {
	const query = buildQueryString(params as QueryFiltersType);

	const response: ApiResponseFetch<
		FindFunctionResponseType<UserPermissionModel>
	> = await new ApiRequest().doFetch(
		`/${resolveRequestPath('user')}/${user_id}/${resolveRequestPath('permission')}?${query}`,
	);

	return getResponseData(response);
}

export async function createUserPermissions(
	user_id: number,
	permission_ids: number[],
): Promise<ApiResponseFetch<{ permission_id: number; message: string }[]>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('user')}/${user_id}/${resolveRequestPath('permission')}`,
		{
			method: 'POST',
			body: JSON.stringify({
				user_id,
				permission_ids,
			}),
		},
	);
}

export async function deleteUserPermission(
	user_id: number,
	permission_id: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('user')}/${user_id}/${resolveRequestPath('permission')}/${permission_id}`,
		{
			method: 'DELETE',
		},
	);
}
