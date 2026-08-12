import type { ReactNode } from 'react';
import { LocationNavigator } from '@/components/location-navigator.component';
import { WhatsAppContact } from '@/components/whatsapp-contact';

/**
 * Shared CMR presentational rows, used by both the session-CMR and available-CMR
 * lists which previously duplicated this markup (address + `LocationNavigator`
 * wiring, contact + `tel:`/WhatsApp) verbatim. Only the exact-duplicate blocks
 * live here; the detail rows that differ by `withDetails` gating stay at the call
 * sites so their visibility rules remain readable.
 */

export function CmrFieldRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div>
			<span className="text-muted">{label}:</span>
			<span className="ml-2 font-mono">{children}</span>
		</div>
	);
}

export function CmrAddressRow({
	label,
	address,
}: {
	label: string;
	address: string | null;
}) {
	return (
		<div className="flex flex-col">
			<div className="text-muted flex items-center gap-2">
				{label}:
				<LocationNavigator address={address} />
			</div>
			<div className="ml-4 font-mono">{address}</div>
		</div>
	);
}

export function CmrContactRow({
	label,
	name,
	phone,
	whatsAppMessage,
}: {
	label: string;
	name: string | null;
	phone: string | null;
	// When set, a WhatsApp shortcut is rendered next to the phone number.
	whatsAppMessage?: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<div className="text-muted">{label}:</div>
			<div className="font-mono">{name}</div>
			{phone && <a href={`tel:${phone}`}>{phone}</a>}
			{phone && whatsAppMessage && (
				<WhatsAppContact phone={phone} message={whatsAppMessage} />
			)}
		</div>
	);
}
