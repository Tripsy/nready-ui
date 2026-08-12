import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { CmrVehicleModel } from '@/models/cmr-vehicle.model';
import type { ApiResponseFetch } from '@/types/api.type';

export async function createCmrVehicle<P>(
	params: Partial<P>,
	cmr_id: number | null,
): Promise<ApiResponseFetch<CmrVehicleModel>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('cmr-vehicle')}/${cmr_id}`,
		{
			method: 'POST',
			body: JSON.stringify(params),
		},
	);
}

export async function updateCmrVehicle<P>(
	params: Partial<P>,
	id: number,
	cmr_id: number | null,
): Promise<ApiResponseFetch<CmrVehicleModel>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('cmr-vehicle')}/${cmr_id}/${id}`,
		{
			method: 'PUT',
			body: JSON.stringify(params),
		},
	);
}

export async function deleteCmrVehicle(
	entry: CmrVehicleModel,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('cmr-vehicle')}/${entry.cmr.id}/${entry.id}`,
		{
			method: 'DELETE',
		},
	);
}

export async function restoreCmrVehicle(
	entry: CmrVehicleModel,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('cmr-vehicle')}/${entry.cmr.id}/${entry.id}/restore`,
		{
			method: 'PATCH',
		},
	);
}
