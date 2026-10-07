'use client';

import { useId, useState } from 'react';
import {
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/helpers/string.helper';
import { type ClientType, ClientTypeEnum } from '@/models/client.model';
import type {
	BillingDetails,
	PartyDetails,
	SellerDetails,
} from '@/models/invoice.model';

type FieldValues = Record<string, string | null>;

/** The address, contact and bank fields both parties carry, in the order they are filled in. */
const PARTY_FIELDS: {
	field: keyof PartyDetails;
	label: string;
	isRequired?: boolean;
	isWide?: boolean;
}[] = [
	{ field: 'address_country', label: 'Country', isRequired: true },
	{ field: 'address_region', label: 'Region' },
	{ field: 'address_city', label: 'City' },
	{ field: 'postal_code', label: 'Postal code' },
	{ field: 'details', label: 'Street and number', isWide: true },
	{ field: 'contact_name', label: 'Contact name' },
	{ field: 'contact_email', label: 'Contact email' },
	{ field: 'contact_phone', label: 'Contact phone' },
	{ field: 'iban', label: 'IBAN' },
	{ field: 'bank_name', label: 'Bank' },
];

const CLIENT_TYPES = Object.values(ClientTypeEnum).map((value) => ({
	label: formatEnumLabel(value),
	value: value,
}));

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
function summarize(party: BillingDetails | SellerDetails | null): string {
	if (!party) {
		return 'Not set';
	}

	const name =
		'type' in party && party.type === ClientTypeEnum.PERSON
			? party.person_name
			: (party as { company_name: string }).company_name;

	return (
		[name, party.address_city, party.address_country]
			.filter((part) => part && part.trim() !== '')
			.join(', ') || 'Not set'
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
	title,
	party,
	isCustom,
	notice,
	onReset,
	children,
}: {
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
				<span className="truncate opacity-70">{summarize(party)}</span>
				{isCustom && (
					<span className="ml-auto shrink-0 text-xs opacity-70">
						Stated by hand
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
							Use the automatic details
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

/** The address, contact and bank fields, laid out two to a row. */
function PartyCommonFields({
	idPrefix,
	party,
	disabled,
	onChange,
}: {
	idPrefix: string;
	party: PartyDetails;
	disabled: boolean;
	onChange: (field: string, value: string | null) => void;
}) {
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{PARTY_FIELDS.map(({ field, label, isRequired, isWide }) => (
				<div
					key={field}
					className={isWide ? 'sm:col-span-2' : undefined}
				>
					<PartyInput
						idPrefix={idPrefix}
						field={field}
						label={label}
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
			title="Buyer"
			party={party}
			isCustom={isCustom}
			notice={notice}
			onReset={onReset}
		>
			<FormComponentRadio<FieldValues>
				labelText="Type"
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
						label="Name"
						value={current.person_name}
						isRequired={true}
						disabled={disabled}
						onChange={setField}
					/>
					<PartyInput
						idPrefix={idPrefix}
						field="person_identification_number"
						label="Identification number"
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
						label="Company name"
						value={current.company_name}
						isRequired={true}
						disabled={disabled}
						onChange={setField}
					/>
					<PartyInput
						idPrefix={idPrefix}
						field="company_cui"
						label="CUI"
						value={current.company_cui}
						disabled={disabled}
						onChange={setField}
					/>
					<PartyInput
						idPrefix={idPrefix}
						field="company_reg_com"
						label="Trade register no."
						value={current.company_reg_com}
						disabled={disabled}
						onChange={setField}
					/>
				</div>
			)}

			<PartyCommonFields
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
			title="Seller"
			party={party}
			isCustom={isCustom}
			onReset={onReset}
		>
			<div className="grid gap-3 sm:grid-cols-3">
				<PartyInput
					idPrefix={idPrefix}
					field="company_name"
					label="Company name"
					value={current.company_name}
					isRequired={true}
					disabled={disabled}
					onChange={setField}
				/>
				<PartyInput
					idPrefix={idPrefix}
					field="company_cui"
					label="CUI"
					value={current.company_cui}
					disabled={disabled}
					onChange={setField}
				/>
				<PartyInput
					idPrefix={idPrefix}
					field="company_reg_com"
					label="Trade register no."
					value={current.company_reg_com}
					disabled={disabled}
					onChange={setField}
				/>
			</div>

			<PartyCommonFields
				idPrefix={idPrefix}
				party={current}
				disabled={disabled}
				onChange={setField}
			/>
		</PartySection>
	);
}
