import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { WorkSessionVehicleModel } from '@/models/work-session-vehicle.model';
import type { ApiResponseFetch } from '@/types/api.type';

export async function createWorkSessionVehicle<P>(
	params: Partial<P>,
	work_session_id: number | null,
): Promise<ApiResponseFetch<WorkSessionVehicleModel>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('work-session-vehicle')}/${work_session_id}`,
		{
			method: 'POST',
			body: JSON.stringify(params),
		},
	);
}

export async function updateWorkSessionVehicle<P>(
	params: Partial<P>,
	id: number,
	work_session_id: number | null,
): Promise<ApiResponseFetch<WorkSessionVehicleModel>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('work-session-vehicle')}/${work_session_id}/${id}`,
		{
			method: 'PUT',
			body: JSON.stringify(params),
		},
	);
}

export async function updateStatusWorkSessionVehicle(
	entry: WorkSessionVehicleModel,
	status: string,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('work-session-vehicle')}/${entry.work_session.id}/${entry.id}/status/${status}`,
		{
			method: 'PATCH',
		},
	);
}

export async function deleteWorkSessionVehicle(
	entry: WorkSessionVehicleModel,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('work-session-vehicle')}/${entry.work_session.id}/${entry.id}`,
		{
			method: 'DELETE',
		},
	);
}
