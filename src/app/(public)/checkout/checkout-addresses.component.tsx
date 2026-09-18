/*
 * No `'use client'`: `checkout.component.tsx` is the boundary that mounts this, and a file carrying
 * the directive is treated as a client entry whose callback props Next's TS plugin rejects
 * (TS71007) - the same reason `checkout-billing.component.tsx` goes without it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX, useEffect, useRef, useState } from 'react';
import {
	type AddressValues,
	type CheckoutTranslationKey,
	type CheckoutTranslations,
	getAddressParams,
	getEmptyAddressValues,
	hasErrors,
	validateAddress,
} from '@/app/(public)/checkout/checkout.definition';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { getLanguageClient } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import type { AddressModel } from '@/models/address.model';
import {
	type ClientAddressType,
	displayOwnClientAddress,
	type OwnClientAddressModel,
} from '@/models/client-address.model';
import { displayPlaceLabel, type PlaceModel } from '@/models/place.model';
import { useToast } from '@/providers/toast.provider';
import {
	requestCreateOwnClientAddress,
	requestOwnClientAddresses,
	requestPublicAddresses,
	requestPublicCities,
} from '@/services/client-address.service';
import type { Language } from '@/types/common.type';

/** The place with its county or country, so two places of the same name are told apart. */
function displayCityLabel(city: PlaceModel, language: Language): string {
	const name = displayPlaceLabel(city, language, false);

	return city.parent
		? `${name}, ${displayPlaceLabel(city.parent, language, false)}`
		: name;
}

/** A search result as the dashboard picker words it: street, postal code, then the place. */
function displaySearchedAddress(
	address: AddressModel,
	language: Language,
): string {
	return [
		address.details,
		address.postal_code,
		address.city ? displayCityLabel(address.city, language) : null,
	]
		.filter((part): part is string => !!part)
		.join(', ');
}

/**
 * The billing or delivery addresses of the billed client: pick one, or add one.
 *
 * Adding mirrors the dashboard's "Add client address": search the address table and pick a row,
 * or - when the search finds nothing - enter the city, street and postal code of a new one; then
 * the flat/floor details and the notes. There is no edit: an address is added or removed, since
 * the linked row may be filed against other clients too.
 *
 * Owns its list, its form and its save - unlike the billing entry, an address is never written as
 * a side effect of "Place order". It hangs off a client that has to exist first, so a shopper still
 * filling in their first billing entry is told to save it before an address can be added.
 *
 * Selection lives with the caller, because the checkout request sends it. This component keeps it
 * valid: when the list arrives or the client changes, a selection the list no longer holds moves to
 * the newest entry, or to nothing.
 */
export function CheckoutAddresses({
	clientId,
	type,
	title,
	selectedId,
	isMissingSelection,
	missingMessageKey,
	translations,
	disabled,
	onSelect,
}: {
	/** The billed client, or null while it has not been saved yet. */
	readonly clientId: number | null;
	readonly type: ClientAddressType;
	readonly title: string;
	readonly selectedId: number | null;
	/** Checkout was attempted without an address of this type chosen. */
	readonly isMissingSelection: boolean;
	readonly missingMessageKey: CheckoutTranslationKey;
	readonly translations: CheckoutTranslations;
	readonly disabled: boolean;
	readonly onSelect: (addressId: number | null) => void;
}): JSX.Element {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const language = getLanguageClient();

	const elementIds = useElementIds([
		'list',
		'address',
		'city',
		'street',
		'postal_code',
		'details',
		'notes',
	] as const);

	const queryKey = ['client-address', 'own', clientId, type] as const;

	const addressesQuery = useQuery({
		queryKey: queryKey,
		queryFn: async () =>
			clientId === null
				? []
				: (getResponseData(
						await requestOwnClientAddresses(clientId, type),
					)?.entries ?? []),
		enabled: clientId !== null,
		// The account's own rows, changed from this page - a cached list would hide a save.
		staleTime: 0,
	});

	const entries = addressesQuery.data;

	const [isAdding, setIsAdding] = useState(false);
	const [values, setValues] = useState<AddressValues>(getEmptyAddressValues);
	const [showErrors, setShowErrors] = useState(false);
	const [addressSearch, setAddressSearch] = useState('');
	const [citySearch, setCitySearch] = useState('');

	/*
	 * The client an empty list has already opened the form for. Once per client: after a shopper
	 * cancels, the list staying empty must not keep reopening the form over them.
	 */
	const autoOpenedFor = useRef<number | null>(null);

	const openForm = () => {
		setValues(getEmptyAddressValues());
		setAddressSearch('');
		setCitySearch('');
		setShowErrors(false);
		setIsAdding(true);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset the form when the client changes
	useEffect(() => {
		setIsAdding(false);
		setShowErrors(false);
	}, [clientId]);

	useEffect(() => {
		if (clientId === null) {
			if (selectedId !== null) {
				onSelect(null);
			}

			return;
		}

		if (!entries) {
			return;
		}

		if (
			selectedId === null ||
			!entries.some((entry) => entry.id === selectedId)
		) {
			const newestId = entries[0]?.id ?? null;

			if (newestId !== selectedId) {
				onSelect(newestId);
			}
		}

		if (entries.length === 0 && autoOpenedFor.current !== clientId) {
			autoOpenedFor.current = clientId;

			setValues(getEmptyAddressValues());
			setIsAdding(true);
		}
	}, [clientId, entries, selectedId, onSelect]);

	const { suggestions: addressSuggestions, isFetching: isAddressFetching } =
		useRemoteAutocomplete<AddressModel>({
			query: addressSearch,
			queryKey: ['s-public-address'],
			queryFn: async (term) =>
				getResponseData(await requestPublicAddresses(term))?.entries ??
				[],
			minLength: 3,
		});

	const { suggestions: citySuggestions, isFetching: isCityFetching } =
		useRemoteAutocomplete<PlaceModel>({
			query: citySearch,
			queryKey: ['s-public-city'],
			queryFn: async (term) =>
				getResponseData(await requestPublicCities(term))?.entries ?? [],
			minLength: 3,
		});

	const errors = validateAddress(values);

	const saveMutation = useMutation({
		mutationFn: async (): Promise<OwnClientAddressModel> => {
			if (clientId === null) {
				throw new Error(translations['checkout.address.needs_client']);
			}

			const saved = getResponseData(
				await requestCreateOwnClientAddress({
					...getAddressParams(values),
					client_id: clientId,
					type: type,
				}),
			);

			if (!saved) {
				throw new Error(translations['checkout.address.save_failed']);
			}

			return saved;
		},
		onSuccess: async (saved) => {
			/*
			 * Refetched before selecting: selecting first would let the effect above see an id the
			 * stale list does not hold yet and move the selection straight back to the newest row.
			 * The address search is dropped too - a newly written address is a result it lacks.
			 */
			await queryClient.invalidateQueries({ queryKey: queryKey });
			await queryClient.invalidateQueries({
				queryKey: ['s-public-address'],
			});

			onSelect(saved.id);
			setIsAdding(false);
			setShowErrors(false);

			showToast({
				severity: 'success',
				summary: translations['checkout.address.saved'],
			});
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['checkout.address.save_failed'],
				detail: getErrorMessage(error),
			}),
	});

	const isBusy = disabled || saveMutation.isPending;

	const fieldError = (field: keyof AddressValues): string[] | undefined => {
		const key = errors[field];

		return showErrors && key ? [translations[key]] : undefined;
	};

	const setField = <K extends keyof AddressValues>(
		field: K,
		value: AddressValues[K],
	) => setValues((current) => ({ ...current, [field]: value }));

	const onSave = () => {
		setShowErrors(true);

		if (!hasErrors(errors)) {
			saveMutation.mutate();
		}
	};

	return (
		/*
		 * `form-element` + `label-placeholder`: the structure `FormComponentRadio` renders for
		 * "Delivery method", so inside `.form-section` the title takes the same style and the same
		 * `gap-3` below it as the other questions in the section. It also names the list below.
		 */
		<div className="form-element">
			<div id={elementIds.list} className="label-placeholder">
				{title}
			</div>

			{clientId === null ? (
				<p className="text-sm text-muted">
					{translations['checkout.address.needs_client']}
				</p>
			) : addressesQuery.isLoading ? (
				<p className="text-sm text-muted">
					{translations['checkout.loading']}
				</p>
			) : (
				<>
					{entries && entries.length > 0 && (
						<>
							<RadioGroup
								aria-labelledby={elementIds.list}
								value={
									selectedId === null
										? null
										: String(selectedId)
								}
								onChange={(value) => onSelect(Number(value))}
								isDisabled={isBusy}
								className="divide-y divide-border"
							>
								{entries.map((entry) => (
									<div
										key={entry.id}
										className="py-3 first:pt-0 last:pb-0"
									>
										{/* `mt-0!`: see `checkout-billing.component.tsx` - HeroUI's vertical-group `mt-4` */}
										<Radio
											value={String(entry.id)}
											className="mt-0!"
											contentClassName="font-normal"
										>
											<span>
												<span className="block">
													{displayOwnClientAddress(
														entry,
													)}
												</span>
												{entry.notes && (
													<span className="block text-xs text-muted">
														{entry.notes}
													</span>
												)}
											</span>
										</Radio>
									</div>
								))}
							</RadioGroup>
						</>
					)}

					{isMissingSelection && (
						<p className="text-sm font-medium text-danger">
							{translations[missingMessageKey]}
						</p>
					)}

					{isAdding ? (
						<div className="form-section gap-4 rounded-xl border border-border p-4">
							{values.is_new ? (
								<>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-sm font-medium">
											{
												translations[
													'checkout.address.new_title'
												]
											}
										</p>

										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={isBusy}
											onClick={() =>
												setValues((current) => ({
													...current,
													is_new: false,
												}))
											}
										>
											{
												translations[
													'checkout.address.back_to_search'
												]
											}
										</Button>
									</div>

									<FormComponentAutoComplete<
										AddressValues,
										PlaceModel
									>
										id={elementIds.city}
										labelText={
											translations[
												'checkout.address.city'
											]
										}
										placeholderText={
											translations[
												'checkout.address.city_placeholder'
											]
										}
										fieldName="city"
										fieldValue={values.city}
										isRequired={true}
										className="pl-8"
										disabled={isBusy}
										error={fieldError('city_id')}
										onInputChange={(value) => {
											// Typed text is not a city until one is picked from the list
											setValues((current) => ({
												...current,
												city: value,
												city_id: null,
											}));
											setCitySearch(value);
										}}
										autoCompleteProps={{
											suggestions: citySuggestions,
											isLoading: isCityFetching,
											onSelect: (city) =>
												setValues((current) => ({
													...current,
													city: displayCityLabel(
														city,
														language,
													),
													city_id: city.id,
												})),
											getOptionLabel: (city) =>
												displayCityLabel(
													city,
													language,
												),
											getOptionKey: (city) => city.id,
											emptyMessage:
												translations[
													'checkout.address.no_results'
												],
											loadingMessage:
												translations[
													'checkout.address.searching'
												],
										}}
										icons={{
											left: (
												<Icons.City className="opacity-40 h-4.5 w-4.5" />
											),
										}}
									/>

									<div className="grid gap-4 sm:grid-cols-2">
										<FormComponentInput<AddressValues>
											id={elementIds.street}
											labelText={
												translations[
													'checkout.address.street'
												]
											}
											fieldName="street"
											fieldValue={values.street}
											isRequired={true}
											disabled={isBusy}
											onChange={(event) =>
												setField(
													'street',
													event.target.value,
												)
											}
											error={fieldError('street')}
										/>

										<FormComponentInput<AddressValues>
											id={elementIds.postal_code}
											labelText={
												translations[
													'checkout.address.postal_code'
												]
											}
											fieldName="postal_code"
											fieldValue={values.postal_code}
											disabled={isBusy}
											onChange={(event) =>
												setField(
													'postal_code',
													event.target.value,
												)
											}
											error={fieldError('postal_code')}
										/>
									</div>
								</>
							) : (
								/*
								 * The id is what the backend takes; the box carries the label only.
								 * Typing clears the id, so only a picked address validates - and
								 * "Add new address" takes the typed text over as the street.
								 */
								<FormComponentAutoComplete<
									AddressValues,
									AddressModel
								>
									id={elementIds.address}
									labelText={
										translations['checkout.address.search']
									}
									placeholderText={
										translations[
											'checkout.address.search_placeholder'
										]
									}
									fieldName="address"
									fieldValue={values.address}
									isRequired={true}
									className="pl-8"
									disabled={isBusy}
									error={fieldError('address_id')}
									onInputChange={(value) => {
										setValues((current) => ({
											...current,
											address: value,
											address_id: null,
										}));
										setAddressSearch(value);
									}}
									autoCompleteProps={{
										suggestions: addressSuggestions,
										isLoading: isAddressFetching,
										onSelect: (address) =>
											setValues((current) => ({
												...current,
												address: displaySearchedAddress(
													address,
													language,
												),
												address_id: address.id,
											})),
										getOptionLabel: (address) =>
											displaySearchedAddress(
												address,
												language,
											),
										getOptionKey: (address) => address.id,
										emptyMessage:
											translations[
												'checkout.address.no_results'
											],
										loadingMessage:
											translations[
												'checkout.address.searching'
											],
										allowCreate: true,
										onCreate: (value) =>
											setValues((current) => ({
												...current,
												is_new: true,
												address_id: null,
												street: value,
											})),
										createLabel: (value) =>
											`${translations['checkout.address.create']} "${value}"`,
									}}
									icons={{
										left: (
											<Icons.Address className="opacity-40 h-4.5 w-4.5" />
										),
									}}
								/>
							)}

							<FormComponentInput<AddressValues>
								id={elementIds.details}
								labelText={
									translations['checkout.address.details']
								}
								placeholderText={
									translations[
										'checkout.address.details_placeholder'
									]
								}
								fieldName="details"
								fieldValue={values.details}
								disabled={isBusy}
								onChange={(event) =>
									setField('details', event.target.value)
								}
								error={fieldError('details')}
							/>

							<FormComponentTextarea<AddressValues>
								id={elementIds.notes}
								labelText={
									translations['checkout.address.notes']
								}
								placeholderText={
									translations[
										'checkout.address.notes_placeholder'
									]
								}
								fieldName="notes"
								fieldValue={values.notes}
								rows={3}
								disabled={isBusy}
								onChange={(event) =>
									setField('notes', event.target.value)
								}
								error={fieldError('notes')}
							/>

							<div className="flex flex-wrap items-center gap-3">
								<Button
									type="button"
									disabled={isBusy}
									onClick={onSave}
								>
									{translations['checkout.address.save']}
								</Button>

								{entries && entries.length > 0 && (
									<Button
										type="button"
										variant="ghost"
										disabled={isBusy}
										onClick={() => setIsAdding(false)}
									>
										{
											translations[
												'checkout.address.cancel'
											]
										}
									</Button>
								)}
							</div>
						</div>
					) : (
						<Button
							type="button"
							variant="outline"
							hover="success"
							className="self-start"
							disabled={isBusy}
							onClick={openForm}
						>
							{translations['checkout.address.add']}
						</Button>
					)}
				</>
			)}
		</div>
	);
}
