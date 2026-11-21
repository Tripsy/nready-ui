import {
	ApiRequest,
	buildQueryString,
	getResponseData,
} from '@/helpers/api.helper';
import type { UserPermissionModel } from '@/models/user-permission.model';
import type {
	FindFunctionParamsType,
	FindFunctionResponseType,
} from '@/types/action.type';
import type { ApiResponseFetch, QueryFiltersType } from '@/types/api.type';
import type { EntityId } from '@/types/entity-id.type';

/**
 * Where the backend mounts the grants - a resource of its own, gated by the `permission`
 * entity rather than by `user`, so it does not hang off `/users/:id`.
 *
 * Spelled out rather than resolved through `resolveRequestPath`: that maps a `DataSourceKey`,
 * and there is no user-permission data table for one to exist.
 */
const USER_PERMISSION_PATH = '/user-permissions';

export async function getUserPermissions(
	user_id: EntityId,
	params: FindFunctionParamsType,
) {
	const query = buildQueryString(params as QueryFiltersType);

	const response: ApiResponseFetch<
		FindFunctionResponseType<UserPermissionModel>
	> = await new ApiRequest().doFetch(
		`${USER_PERMISSION_PATH}/${user_id}?${query}`,
	);

	return getResponseData(response);
}

export async function createUserPermissions(
	user_id: EntityId,
	permission_ids: EntityId[],
): Promise<ApiResponseFetch<{ permission_id: EntityId; message: string }[]>> {
	return await new ApiRequest().doFetch(
		`${USER_PERMISSION_PATH}/${user_id}`,
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
	user_id: EntityId,
	permission_id: EntityId,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`${USER_PERMISSION_PATH}/${user_id}/${permission_id}`,
		{
			method: 'DELETE',
		},
	);
}
