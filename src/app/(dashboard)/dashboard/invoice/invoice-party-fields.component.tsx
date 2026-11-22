'use client';

import { useId, useMemo, useState } from 'react';
import {
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { Button } from '@/components/ui/button';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type ClientType, ClientTypeEnum } from '@/models/client.model';
import type {
	BillingDetails,
	PartyDetails,
	SellerDetails,
} from '@/models/invoice.model';

/** The shared address, contact and bank fields' label keys. */
const PARTY_FIELD_KEYS = [
	'invoice.field.party_address_country',
	'invoice.field.party_address_region',
	'invoice.field.party_address_city',
	'invoice.field.party_postal_code',
	'invoice.field.party_details',
	'invoice.field.party_contact_name',
	'invoice.field.party_contact_email',
	'invoice.field.party_contact_phone',
	'invoice.field.party_iban',
	'invoice.field.party_bank_name',
] as const;

const TRANSLATION_KEYS = [
	'invoice.field.type',
	'invoice.section.buyer',
	'invoice.section.seller',
	'invoice.text.company_name',
	'invoice.text.cui',
	'invoice.text.identification_number',
	'invoice.text.name',
	'invoice.text.stated_by_hand',
	'invoice.text.trade_register_no',
	'invoice.text.use_the_automatic_details',
	'invoice.text.vat_number',
	'invoice.text.not_set',
	...enumTranslationKeys('invoice.enum.client_type', ClientTypeEnum),
	...PARTY_FIELD_KEYS,
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

type FieldValues = Record<string, string | null>;

/** The address, contact and bank fields both parties carry, in the order they are filled in. */
const PARTY_FIELDS: {
	field: keyof PartyDetails;
	labelKey: (typeof PARTY_FIELD_KEYS)[number];
	isRequired?: boolean;
	isWide?: boolean;
}[] = [
	{
		field: 'address_country',
		labelKey: 'invoice.field.party_address_country',
		isRequired: true,
	},
	{ field: 'address_region', labelKey: 'invoice.field.party_address_region' },
	{ field: 'address_city', labelKey: 'invoice.field.party_address_city' },
	{ field: 'postal_code', labelKey: 'invoice.field.party_postal_code' },
	{ field: 'details', labelKey: 'invoice.field.party_details', isWide: true },
	{ field: 'contact_name', labelKey: 'invoice.field.party_contact_name' },
	{ field: 'contact_email', labelKey: 'invoice.field.party_contact_email' },
	{ field: 'contact_phone', labelKey: 'invoice.field.party_contact_phone' },
	{ field: 'iban', labelKey: 'invoice.field.party_iban' },
	{ field: 'bank_name', labelKey: 'invoice.field.party_bank_name' },
];

/** What an empty buyer form starts from: an order with no billing address resolves to nothing. */
export const EMPTY_BILLING_DETAILS: BillingDetails = {
	type: ClientTypeEnum.COMPANY,
	company_name: '',
	company_cui: null,
	company_reg_com: null,
	address_country: '',
	address_region: null,
	address_city: null,
	details: null,
	postal_code: null,
	contact_name: null,
	contact_email: null,
	contact_phone: null,
	iban: null,
	bank_name: null,
};

/** A party the API would refuse: it has to name someone, and a country to bill in. */
export function isPartyIncomplete(
	party: BillingDetails | SellerDetails,
): boolean {
	const name =
		'type' in party && party.type === ClientTypeEnum.PERSON
			? party.person_name
			: (party as { company_name: string }).company_name;

	return name.trim() === '' || party.address_country.trim() === '';
}

/** One line naming the party while its section is folded. */
function summarize(
	party: BillingDetails | SellerDetails | null,
	notSet: string,
): string {
	if (!party) {
		return notSet;
	}

	const name =
		'type' in party && party.type === ClientTypeEnum.PERSON
			? party.person_name
			: (party as { company_name: string }).company_name;

	return (
		[name, party.address_city, party.address_country]
			.filter((part) => part && part.trim() !== '')
			.join(', ') || notSet
	);
}

/**
 * A text input bound to one field of a party. Blank is stored as `null` on an optional field, the
 * way the API stores it, and as `''` on a required one so the form can tell it is missing.
 */
function PartyInput({
	idPrefix,
	field,
	label,
	value,
	isRequired = false,
	disabled,
	onChange,
}: {
	idPrefix: string;
	field: string;
	label: string;
	value: string | null | undefined;
	isRequired?: boolean;
	disabled: boolean;
	onChange: (field: string, value: string | null) => void;
}) {
	return (
		<FormComponentInput<FieldValues>
			labelText={label}
			id={`${idPrefix}-${field}`}
			fieldName={field}
			fieldValue={value ?? ''}
			isRequired={isRequired}
			disabled={disabled}
			onChange={(event) =>
				onChange(
					field,
					isRequired || event.target.value !== ''
						? event.target.value
						: null,
				)
			}
		/>
	);
}

/**
 * A folded section for one party: a summary line, whether it is stated by hand, and - when the
 * party can be handed back to issuing - a reset.
 *
 * Folded by state rather than a native `<details>`: inside a window a real click on its summary
 * does not toggle it - the window's pointer handling cancels the default action a `<summary>`
 * relies on, while a scripted click still works.
 */
function PartySection({
	translations,
	title,
	party,
	isCustom,
	notice,
	onReset,
	children,
}: {
	translations: TranslationsType;
	title: string;
	party: BillingDetails | SellerDetails | null;
	isCustom: boolean;
	notice?: string;
	onReset?: () => void;
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const contentId = useId();

	return (
		<div className="rounded-md border border-line">
			<button
				type="button"
				className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm"
				aria-expanded={isOpen}
				aria-controls={contentId}
				onClick={() => setIsOpen((previous) => !previous)}
			>
				<span className="font-medium">{title}</span>
				<span className="truncate opacity-70">
					{summarize(party, translations['invoice.text.not_set'])}
				</span>
				{isCustom && (
					<span className="ml-auto shrink-0 text-xs opacity-70">
						{translations['invoice.text.stated_by_hand']}
					</span>
				)}
			</button>

			<div
				id={contentId}
				hidden={!isOpen}
				className="space-y-3 border-t border-line p-3"
			>
				{notice && <p className="text-sm text-danger">{notice}</p>}

				{children}

				{onReset && (
					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							hover="warning"
							onClick={onReset}
						>
							{
								translations[
									'invoice.text.use_the_automatic_details'
								]
							}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

/** The address, contact and bank fields, laid out two to a row. */
function PartyCommonFields({
	translations,
	idPrefix,
	party,
	disabled,
	onChange,
}: {
	translations: TranslationsType;
	idPrefix: string;
	party: PartyDetails;
	disabled: boolean;
	onChange: (field: string, value: string | null) => void;
}) {
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{PARTY_FIELDS.map(({ field, labelKey, isRequired, isWide }) => (
				<div
					key={field}
					className={isWide ? 'sm:col-span-2' : undefined}
				>
					<PartyInput
						idPrefix={idPrefix}
						field={field}
						label={translations[labelKey]}
						value={party[field]}
						isRequired={isRequired}
						disabled={disabled}
						onChange={onChange}
					/>
				</div>
			))}
		</div>
	);
}

/**
 * The buyer as the document will name them. A person or a company: switching carries the name
 * across and drops the identifiers that belong only to the other kind.
 */
export function BillingDetailsFields({
	party,
	isCustom,
	notice,
	disabled,
	onChange,
	onReset,
}: {
	party: BillingDetails | null;
	isCustom: boolean;
	notice?: string;
	disabled: boolean;
	onChange: (party: BillingDetails) => void;
	onReset?: () => void;
}) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const CLIENT_TYPES = useMemo(
		() =>
			Object.values(ClientTypeEnum).map((value) => ({
				label: translateEnumLabel(
					translations,
					'invoice.enum.client_type',
					value,
				),
				value: value,
			})),
		[translations],
	);

	const idPrefix = useId();
	const current = party ?? EMPTY_BILLING_DETAILS;

	const setField = (field: string, value: string | null) =>
		onChange({ ...current, [field]: value } as BillingDetails);

	const setType = (type: ClientType) => {
		if (type === current.type) {
			return;
		}

		const name =
			current.type === ClientTypeEnum.PERSON
				? current.person_name
				: current.company_name;

		const { type: _type, ...rest } = current;
		const shared: PartyDetails = {
			address_country: rest.address_country,
			address_region: rest.address_region,
			address_city: rest.address_city,
			details: rest.details,
			postal_code: rest.postal_code,
			contact_name: rest.contact_name,
			contact_email: rest.contact_email,
			contact_phone: rest.contact_phone,
			iban: rest.iban,
			bank_name: rest.bank_name,
		};

		onChange(
			type === ClientTypeEnum.PERSON
				? {
						...shared,
						type: ClientTypeEnum.PERSON,
						person_name: name,
						person_identification_number: null,
					}
				: {
						...shared,
						type: ClientTypeEnum.COMPANY,
						company_name: name,
						company_cui: null,
						company_reg_com: null,
					},
		);
	};

	return (
		<PartySection
			translations={translations}
			title={translations['invoice.section.buyer']}
			party={party}
			isCustom={isCustom}
			notice={notice}
			onReset={onReset}
		>
			<FormComponentRadio<FieldValues>
				labelText={translations['invoice.field.type']}
				id={`${idPrefix}-type`}
				fieldName="type"
				fieldValue={current.type}
				options={CLIENT_TYPES}
				disabled={disabled}
				onChange={(value) => setType(value as ClientType)}
			/>

			{current.type === ClientTypeEnum.PERSON ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<PartyInput
						idPrefix={idPrefix}
						field="person_name"
						label={translations['invoice.text.name']}
						value={current.person_name}
						isRequired={true}
						disabled={disabled}
						onChange={setField}
					/>
					<PartyInput
						idPrefix={idPrefix}
						field="person_identification_number"
						label={
							translations['invoice.text.identification_number']
						}
						value={current.person_identification_number}
						disabled={disabled}
						onChange={setField}
					/>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-3">
					<PartyInput
						idPrefix={idPrefix}
						field="company_name"
						label={translations['invoice.text.company_name']}
						value={current.company_name}
						isRequired={true}
						disabled={disabled}
						onChange={setField}
					/>
					<PartyInput
						idPrefix={idPrefix}
						field="company_cui"
						label={translations['invoice.text.cui']}
						value={current.company_cui}
						disabled={disabled}
						onChange={setField}
					/>
					<PartyInput
						idPrefix={idPrefix}
						field="company_reg_com"
						label={translations['invoice.text.trade_register_no']}
						value={current.company_reg_com}
						disabled={disabled}
						onChange={setField}
					/>
				</div>
			)}

			<PartyCommonFields
				translations={translations}
				idPrefix={idPrefix}
				party={current}
				disabled={disabled}
				onChange={setField}
			/>
		</PartySection>
	);
}

/** The issuer as the document will name it - always a company. */
export function SellerDetailsFields({
	party,
	isCustom,
	disabled,
	onChange,
	onReset,
}: {
	party: SellerDetails | null;
	isCustom: boolean;
	disabled: boolean;
	onChange: (party: SellerDetails) => void;
	onReset?: () => void;
}) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const idPrefix = useId();

	const { type: _type, ...emptySeller } = EMPTY_BILLING_DETAILS as Extract<
		BillingDetails,
		{ type: 'company' }
	>;
	const current: SellerDetails = party ?? emptySeller;

	const setField = (field: string, value: string | null) =>
		onChange({ ...current, [field]: value });

	return (
		<PartySection
			translations={translations}
			title={translations['invoice.section.seller']}
			party={party}
			isCustom={isCustom}
			onReset={onReset}
		>
			<div className="grid gap-3 sm:grid-cols-2">
				<PartyInput
					idPrefix={idPrefix}
					field="company_name"
					label={translations['invoice.text.company_name']}
					value={current.company_name}
					isRequired={true}
					disabled={disabled}
					onChange={setField}
				/>
				<PartyInput
					idPrefix={idPrefix}
					field="company_cui"
					label={translations['invoice.text.cui']}
					value={current.company_cui}
					disabled={disabled}
					onChange={setField}
				/>
				<PartyInput
					idPrefix={idPrefix}
					field="company_reg_com"
					label={translations['invoice.text.trade_register_no']}
					value={current.company_reg_com}
					disabled={disabled}
					onChange={setField}
				/>
				{/* Empty states the seller is not registered for VAT - the printed copy says so */}
				<PartyInput
					idPrefix={idPrefix}
					field="company_vat_number"
					label={translations['invoice.text.vat_number']}
					value={current.company_vat_number}
					disabled={disabled}
					onChange={setField}
				/>
			</div>

			<PartyCommonFields
				translations={translations}
				idPrefix={idPrefix}
				party={current}
				disabled={disabled}
				onChange={setField}
			/>
		</PartySection>
	);
}
