import { useAttachCmrToSession } from '@/app/(public)/_hooks/use-attach-cmr-to-session.hook';
import { useAvailableCmr } from '@/app/(public)/_providers/available-cmr.provider';
import { useWorkSession } from '@/app/(public)/_providers/work-session.provider';
import {
	CmrAddressRow,
	CmrContactRow,
} from '@/app/(public)/driver-panel/driver-panel-cmr-fields.component';
import { Icons } from '@/components/icon.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { displayAddressLabel } from '@/models/address.model';
import { displayClientLabel } from '@/models/client.model';
import {
	type CmrModel,
	CmrStatusEnum,
	displayCmrReference,
} from '@/models/cmr.model';

const TRANSLATION_KEYS = [
	'driver-panel.empty.no_available_cmrs',
	'driver-panel.field.notes',
	'driver-panel.field.transport',
	'driver-panel.field.client',
	'driver-panel.field.contact',
	'driver-panel.field.ordered_at',
	'driver-panel.field.pick_scheduled_at',
	'driver-panel.field.estimated_delivery_at',
	'driver-panel.field.pickup_address',
	'driver-panel.field.delivery_address',
	'driver-panel.value.na',
	'driver-panel.button.assign_to_me',
	'driver-panel.button.reconnect',
	'driver-panel.tooltip.assign_cmr',
	'driver-panel.tooltip.reconnect',
	'driver-panel.ws.connection_aborted',
	'driver-panel.ws.connection_lost',
] as const;

export function DriverPanelAvailableCmrs() {
	const {
		entries: cmrs,
		wsStatus,
		errorMessage,
		reconnect,
	} = useAvailableCmr();
	const { translations } = useTranslation(TRANSLATION_KEYS);

	if (wsStatus === 'connecting') {
		return <LoadingComponent className="min-h-[calc(40vh-4rem)]" />;
	}

	if (wsStatus === 'terminated') {
		return (
			<div className="min-h-[calc(40vh-4rem)] flex flex-col items-center justify-center gap-4">
				<ErrorComponent
					description={
						errorMessage ??
						translations['driver-panel.ws.connection_aborted']
					}
				/>
				<Button
					onClick={reconnect}
					title={translations['driver-panel.tooltip.reconnect']}
				>
					<Icons.Action.Return className="h-4 w-4" />{' '}
					{translations['driver-panel.button.reconnect']}
				</Button>
			</div>
		);
	}

	if (wsStatus === 'error' || wsStatus === 'disconnected') {
		return (
			<LoadingComponent
				description={translations['driver-panel.ws.connection_lost']}
				className="min-h-[calc(40vh-4rem)]"
			/>
		);
	}

	return (
		<div className="space-y-4">
			{cmrs.length === 0 ? (
				<div className="text-center py-8 px-4 bg-surface-secondary rounded-lg border border-border">
					<p className="text-sm text-muted">
						{translations['driver-panel.empty.no_available_cmrs']}
					</p>
				</div>
			) : (
				cmrs.map((cmr) => (
					<div
						key={cmr.id}
						className="bg-surface border border-border rounded-lg p-4"
					>
						<DriverPanelAvailableCmrEntry cmr={cmr} />
					</div>
				))
			)}
		</div>
	);
}

function DriverPanelAvailableCmrEntry({ cmr }: { cmr: CmrModel }) {
	const { activeSession, activeSessionVehicleAuto } = useWorkSession();
	const attachCmrToSession = useAttachCmrToSession();
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const language = getLanguageClient();

	const deliveryAddress = cmr.delivery_address
		? displayAddressLabel(cmr.delivery_address, language)
		: null;
	const pickupAddress = cmr.pickup_address
		? displayAddressLabel(cmr.pickup_address, language)
		: null;

	return (
		<div className="flex justify-between">
			<div className="flex flex-col justify-between items-start self-stretch gap-2">
				<h3 className="flex items-center gap-4">
					<div className="font-semibold text-surface-foreground ">
						{displayCmrReference(cmr.ref_code, cmr.ref_number)}
					</div>
					<DisplayStatus status={cmr.status} dataSource="cmr" />

					{activeSession && activeSessionVehicleAuto && (
						<Button
							variant="default"
							onClick={() => attachCmrToSession(cmr.id)}
							title={
								translations['driver-panel.tooltip.assign_cmr']
							}
							className="text-sm px-2 py-1.5"
						>
							<Icons.Action.Add />{' '}
							{translations['driver-panel.button.assign_to_me']}
						</Button>
					)}
				</h3>
				<div className="flex items-center">
					<span className="text-muted">
						{translations['driver-panel.field.notes']}:
					</span>
					<span className="ml-2 font-mono">{cmr.notes}</span>
				</div>
				<div className="flex">
					<div className="text-muted">
						{translations['driver-panel.field.transport']}:
					</div>
					<div className="ml-4 font-mono">
						{formatEnumLabel(cmr.transport_type)}
					</div>
				</div>
				<div>
					<span className="text-muted">
						{translations['driver-panel.field.client']}:
					</span>
					<span className="ml-2 font-mono">
						{displayClientLabel(cmr.client)}
					</span>
				</div>
				<CmrContactRow
					label={translations['driver-panel.field.contact']}
					name={cmr.contact_name}
					phone={cmr.contact_phone}
				/>
				<div className="flex items-center">
					<span className="text-muted">
						{translations['driver-panel.field.ordered_at']}:
					</span>
					<span className="ml-2 font-mono">
						{formatDate(cmr.ordered_at, undefined, {
							customFormat: 'D MMMM, HH:mm',
						})}
					</span>
				</div>
				{cmr.status === CmrStatusEnum.ORDERED && (
					<div className="flex items-center">
						<span className="text-muted">
							{
								translations[
									'driver-panel.field.pick_scheduled_at'
								]
							}
							:
						</span>
						<span className="ml-2 font-mono">
							{formatDate(cmr.pick_scheduled_at, undefined, {
								customFormat: 'D MMMM, HH:mm',
							}) ?? translations['driver-panel.value.na']}
						</span>
					</div>
				)}
				{cmr.status === CmrStatusEnum.ORDERED && (
					<CmrAddressRow
						label={
							translations['driver-panel.field.pickup_address']
						}
						address={pickupAddress}
					/>
				)}
				{arrayHasValue(cmr.status, [
					CmrStatusEnum.ORDERED,
					CmrStatusEnum.PREPARING,
					CmrStatusEnum.TRANSIT,
					CmrStatusEnum.DELAYED,
				]) && (
					<div className="flex items-center">
						<span className="text-muted">
							{
								translations[
									'driver-panel.field.estimated_delivery_at'
								]
							}
							:
						</span>
						<span className="ml-2 font-mono">
							{formatDate(cmr.estimated_delivery_at, undefined, {
								customFormat: 'D MMMM, HH:mm',
							}) ?? translations['driver-panel.value.na']}
						</span>
					</div>
				)}
				<CmrAddressRow
					label={translations['driver-panel.field.delivery_address']}
					address={deliveryAddress}
				/>
			</div>
		</div>
	);
}
