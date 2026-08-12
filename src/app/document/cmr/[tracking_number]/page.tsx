import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocumentCmrPrint } from '@/app/document/cmr/[tracking_number]/document-cmr-print.component';
import { Configuration } from '@/config/settings.config';
import { getLanguage, translate } from '@/config/translate.setup';
import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import { displayAddressLabel } from '@/models/address.model';
import { type CmrModel, displayCmrLabel } from '@/models/cmr.model';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import type { CmrVehicleModel } from '@/models/cmr-vehicle.model';
import { displayVehicleLabel } from '@/models/vehicle.model';
import type { ApiResponseFetch } from '@/types/api.type';

interface Props {
	params: Promise<{
		tracking_number: string;
	}>;
}

async function getCrmData(tracking_number: string) {
	try {
		const fetchResponse:
			| ApiResponseFetch<
					CmrModel & {
						cmr_sessions: CmrSessionModel[];
						cmr_vehicles: CmrVehicleModel[];
					}
			  >
			| undefined = await new ApiRequest()
			.setRequestMode('remote-api')
			.doFetch(`/cmr-document/${tracking_number}`, {
				method: 'GET',
			});

		if (fetchResponse?.success) {
			return getResponseData(fetchResponse);
		}

		return undefined;
	} catch {
		return undefined;
	}
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { params } = props;

	const resolvedParams = await params;
	const tracking_number = resolvedParams.tracking_number;

	const data = await getCrmData(tracking_number);

	if (!data) {
		return {
			title: await translate('app.page.not_found', {
				app_name: Configuration.get('app.name'),
			}),
		};
	}

	return {
		title: await translate('document.cmr.meta.title', {
			app_name: Configuration.get('app.name'),
			cmr: displayCmrLabel(data),
		}),
	};
}

export default async function Page(props: Props) {
	const { params } = props;

	const resolvedParams = await params;
	const tracking_number = resolvedParams.tracking_number;

	const data = await getCrmData(tracking_number);

	if (!data) {
		notFound();
	}

	const language = await getLanguage();

	return (
		<DocumentCmrPrint
			documentProps={{
				signed: true,
				data: {
					refCode: data.ref_code,
					refNumber: data.ref_number,
					pickupAddress: displayAddressLabel(
						data.pickup_address,
						language,
					),
					deliveryAddress: displayAddressLabel(
						data.delivery_address,
						language,
					),
					cmrVehicles: data.cmr_vehicles.map((cmr_vehicle) => ({
						id: cmr_vehicle.id,
						vehicle: displayVehicleLabel(cmr_vehicle.vehicle),
						vin: cmr_vehicle.vin,
						license_plate: cmr_vehicle.license_plate,
						notes: cmr_vehicle.notes,
					})),
					workSessionUsers: data.cmr_sessions
						.map((session) => session.work_session?.user)
						.filter((user) => user),
					companyVehicleAuto:
						data.cmr_sessions.find(
							(session) => session.company_vehicle_auto != null,
						)?.company_vehicle_auto || null,
					companyVehicleTrailer:
						data.cmr_sessions.find(
							(session) =>
								session.company_vehicle_trailer != null,
						)?.company_vehicle_trailer || null,
				},
			}}
		/>
	);
}
