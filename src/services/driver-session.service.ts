import { ApiRequest, buildQueryString } from '@/helpers/api.helper';
import type { CashFlowModel } from '@/models/cash-flow.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import type { ApiResponseFetch } from '@/types/api.type';
import type { WorkSessionType } from '@/types/auth.type';

export async function requestActiveWorkSession(): Promise<WorkSessionType | null> {
	const response: ApiResponseFetch<WorkSessionType> =
		await new ApiRequest().doFetch('/driver-session/active', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(response?.message ?? 'Failed to fetch data');
	}

	return response.data ?? null;
}

export async function requestAvailableCompanyVehicles(): Promise<
	CompanyVehicleModel[] | null
> {
	const response: ApiResponseFetch<CompanyVehicleModel[]> =
		await new ApiRequest().doFetch(
			'/driver-session/available-company-vehicles',
			{
				method: 'GET',
			},
		);

	if (!response?.success) {
		throw new Error(response?.message ?? 'Failed to fetch data');
	}

	return response.data ?? null;
}

export async function requestSessionCashFlowEntries(params: {
	user_id: number;
	create_at_start: Date | null;
}): Promise<CashFlowModel[] | null> {
	const query = buildQueryString({
		...params,
		create_at_start: params.create_at_start?.toISOString(),
	});

	const response: ApiResponseFetch<CashFlowModel[]> =
		await new ApiRequest().doFetch(
			`/driver-session/session-cash-flow-entries?${query}`,
			{
				method: 'GET',
			},
		);

	if (!response?.success) {
		throw new Error(response?.message ?? 'Failed to fetch data');
	}

	return response.data ?? null;
}

export async function requestWsTicket(): Promise<string> {
	// Routes through the proxy (default `use-proxy` mode), which attaches the
	// httpOnly session token as a Bearer server-side — so the JWT never reaches
	// client JS. The returned single-use ticket is the only credential safe to put
	// on the ws:// URL.
	const response: ApiResponseFetch<{ ticket: string }> =
		await new ApiRequest().doFetch('/driver-session/ws-ticket', {
			method: 'POST',
		});

	if (!response?.success || !response.data?.ticket) {
		throw new Error(
			response?.message ?? 'Failed to obtain WebSocket ticket',
		);
	}

	return response.data.ticket;
}

type DriverCashBalanceType = {
	currency: string;
	balance: number;
};

export async function requestDriverCashBalance(
	user_id: number,
	currency: string,
): Promise<DriverCashBalanceType | null> {
	const response: ApiResponseFetch<DriverCashBalanceType> =
		await new ApiRequest().doFetch(
			`/driver-session/driver-cash-balance/${user_id}/${currency}`,
			{
				method: 'GET',
			},
		);

	if (!response?.success) {
		throw new Error(response?.message ?? 'Failed to fetch data');
	}

	return response.data ?? null;
}
