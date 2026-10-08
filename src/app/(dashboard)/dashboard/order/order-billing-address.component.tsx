import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
	FormComponentInput,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind, requestView } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import {
	type ClientAddressModel,
	ClientAddressTypeEnum,
	displayClientAddressLabel,
} from '@/models/client-address.model';
import type { OrderBillingAddressType } from '@/models/order.model';
import {
	getPlaceContentProp,
	type PlaceModel,
	PlaceTypeEnum,
} from '@/models/place.model';

/** The picker entries that are not an address or a country. */
const COPY_NONE = 'none';
const COUNTRY_NONE = 'none';

const emptyBillingAddress = (): OrderBillingAddressType => ({
	details: null,
	postal_code: null,
	address_city: null,
	address_region: null,
	country_code: null,
	notes: null,
});

/** An emptied text field is no value at all - the backend stores null, never an empty string. */
const toText = (value: string): string | null =>
	value.trim() === '' ? null : value;

/**
 * The order's billing address, edited field by field - the order's own copy, so nothing typed here
 * reaches the client's address book.
 *
 * **Copy from** fills every field from one of the client's billing addresses, flattened by the
 * backend's client-address read (`snapshot`) so the region, country and country code come out the
 * way checkout copies them. The fields stay editable afterwards.
 *
 * The country is picked rather than typed: the order keeps its ISO alpha-2 code, which discount
 * country conditions match against, and the backend fills in the name from it.
 */
export function OrderBillingAddress({
	clientId,
	value,
	disabled,
	error,
	onChange,
}: {
	readonly clientId: number | null;
	readonly value: OrderBillingAddressType | null;
	readonly disabled: boolean;
	readonly error: string[] | undefined;
	readonly onChange: (next: OrderBillingAddressType | null) => void;
}) {
	const ids = useElementIds([
		'copy',
		'country',
		'details',
		'postal-code',
		'city',
		'region',
		'notes',
	] as const);

	const language = getLanguageClient();
	const [copying, setCopying] = useState(false);

	const { data: addresses } = useQuery({
		queryKey: ['order-billing-addresses', clientId],
		queryFn: async () =>
			(
				await requestFind<ClientAddressModel>('client-address', {
					filter: {
						client_id: clientId,
						type: ClientAddressTypeEnum.BILLING,
					},
					order_by: 'id',
					direction: 'ASC',
					limit: 50,
				})
			)?.entries ?? [],
		enabled: clientId !== null,
	});

	const { data: countries } = useQuery({
		queryKey: ['order-billing-countries'],
		queryFn: async () =>
			(
				await requestFind<PlaceModel>('place', {
					filter: { place_type: PlaceTypeEnum.COUNTRY },
					limit: 100,
				})
			)?.entries ?? [],
	});

	const current = value ?? emptyBillingAddress();

	const set = (patch: Partial<OrderBillingAddressType>) => {
		const next = { ...current, ...patch };
		const isEmpty = Object.values(next).every((field) => field === null);

		onChange(isEmpty ? null : next);
	};

	const copyFrom = async (addressId: string) => {
		if (addressId === COPY_NONE) {
			return;
		}

		setCopying(true);

		try {
			const entry = await requestView<ClientAddressModel>(
				'client-address',
				Number(addressId),
			);

			if (entry?.snapshot) {
				onChange({
					details: entry.snapshot.details,
					postal_code: entry.snapshot.postal_code,
					address_city: entry.snapshot.address_city,
					address_region: entry.snapshot.address_region,
					address_country: entry.snapshot.address_country,
					country_code: entry.snapshot.country_code,
					notes: entry.snapshot.notes,
				});
			}
		} finally {
			setCopying(false);
		}
	};

	const countryOptions = [
		{ label: 'Not set', value: COUNTRY_NONE },
		...(countries ?? [])
			.filter((country) => country.alpha2_code)
			.map((country) => ({
				label: getPlaceContentProp(country, language),
				value: country.alpha2_code as string,
			})),
	];

	const isLocked = disabled || copying;

	return (
		<div className="space-y-4">
			<h4 className="text-sm font-semibold">Billing address</h4>

			<FormComponentSelect<{ billing_copy: string }>
				labelText="Copy from a client address"
				id={ids.copy}
				fieldName="billing_copy"
				fieldValue={COPY_NONE}
				disabled={isLocked || !clientId || !addresses?.length}
				options={[
					{ label: 'Choose an address...', value: COPY_NONE },
					...(addresses ?? []).map((address) => ({
						label: displayClientAddressLabel(address, language),
						value: String(address.id),
					})),
				]}
				onChange={(next) => copyFrom(next)}
			/>

			<FormComponentInput<OrderBillingAddressType>
				labelText="Street and number"
				id={ids.details}
				fieldName="details"
				fieldValue={current.details ?? ''}
				disabled={isLocked}
				className="w-full"
				onChange={(e) => set({ details: toText(e.target.value) })}
			/>

			<div className="flex flex-wrap items-start gap-3">
				<FormComponentInput<OrderBillingAddressType>
					labelText="Postal code"
					id={ids['postal-code']}
					fieldName="postal_code"
					fieldValue={current.postal_code ?? ''}
					disabled={isLocked}
					className="w-36"
					onChange={(e) =>
						set({ postal_code: toText(e.target.value) })
					}
				/>
				<FormComponentInput<OrderBillingAddressType>
					labelText="City"
					id={ids.city}
					fieldName="address_city"
					fieldValue={current.address_city ?? ''}
					disabled={isLocked}
					className="w-48"
					onChange={(e) =>
						set({ address_city: toText(e.target.value) })
					}
				/>
				<FormComponentInput<OrderBillingAddressType>
					labelText="Region"
					id={ids.region}
					fieldName="address_region"
					fieldValue={current.address_region ?? ''}
					disabled={isLocked}
					className="w-48"
					onChange={(e) =>
						set({ address_region: toText(e.target.value) })
					}
				/>
				<FormComponentSelect<OrderBillingAddressType>
					labelText="Country"
					id={ids.country}
					fieldName="country_code"
					fieldValue={current.country_code ?? COUNTRY_NONE}
					disabled={isLocked}
					className="w-48"
					options={countryOptions}
					onChange={(next) =>
						set({
							country_code: next === COUNTRY_NONE ? null : next,
						})
					}
				/>
			</div>

			<FormComponentInput<OrderBillingAddressType>
				labelText="Address notes"
				id={ids.notes}
				fieldName="notes"
				fieldValue={current.notes ?? ''}
				disabled={isLocked}
				className="w-full"
				onChange={(e) => set({ notes: toText(e.target.value) })}
			/>

			{error?.map((message) => (
				<p key={message} className="text-sm text-danger">
					{message}
				</p>
			))}
		</div>
	);
}
