import type { AccountModel } from '@/models/account.model';
import {
	type ClientModel,
	type ClientType,
	ClientTypeEnum,
} from '@/models/client.model';
import {
	type OrderPaymentMethod,
	OrderPaymentMethodEnum,
} from '@/models/order.model';
import {
	type ShippingMethod,
	ShippingMethodEnum,
} from '@/models/shipping.model';
import type { OwnClientCreateParams } from '@/services/client.service';
import type { OwnClientAddressParams } from '@/services/client-address.service';

/*
 * Not `'use client'`: the page and the client components read the key tuple, and a value exported
 * from a client module reaches a server importer as a client reference rather than an array.
 */

export const CHECKOUT_TRANSLATION_KEYS = [
	'checkout.heading',
	'checkout.loading',
	'checkout.empty',
	'checkout.has_issues',
	'checkout.back_to_cart',
	'checkout.continue_shopping',
	'checkout.delivery.title',
	'checkout.delivery.method',
	'checkout.delivery.self_pickup',
	'checkout.delivery.self_pickup_hint',
	'checkout.delivery.courier',
	'checkout.billing.title',
	'checkout.billing.intro',
	'checkout.billing.choose',
	'checkout.billing.client_type',
	'checkout.billing.person',
	'checkout.billing.company',
	'checkout.billing.person_name',
	'checkout.billing.company_name',
	'checkout.billing.company_cui',
	'checkout.billing.company_reg_com',
	'checkout.billing.contact_name',
	'checkout.billing.contact_email',
	'checkout.billing.contact_phone',
	'checkout.billing.add',
	'checkout.billing.edit',
	'checkout.billing.save',
	'checkout.billing.cancel',
	'checkout.billing.saved',
	'checkout.billing.save_failed',
	'checkout.address.billing_title',
	'checkout.address.delivery_title',
	'checkout.address.add',
	'checkout.address.save',
	'checkout.address.cancel',
	'checkout.address.saved',
	'checkout.address.save_failed',
	'checkout.address.needs_client',
	'checkout.address.search',
	'checkout.address.search_placeholder',
	'checkout.address.create',
	'checkout.address.new_title',
	'checkout.address.back_to_search',
	'checkout.address.city',
	'checkout.address.city_placeholder',
	'checkout.address.street',
	'checkout.address.postal_code',
	'checkout.address.details',
	'checkout.address.details_placeholder',
	'checkout.address.notes',
	'checkout.address.notes_placeholder',
	'checkout.address.no_results',
	'checkout.address.searching',
	'checkout.payment.title',
	'checkout.payment.method',
	'checkout.payment.cash_on_delivery',
	'checkout.payment.card',
	'checkout.payment.bank_transfer',
	'checkout.notes.label',
	'checkout.notes.placeholder',
	'checkout.summary.title',
	'checkout.summary.edit_cart',
	'checkout.summary.products_cost',
	'checkout.summary.discount',
	'checkout.summary.delivery_cost',
	'checkout.summary.delivery_pending',
	'checkout.summary.delivery_free',
	'checkout.summary.total',
	'checkout.summary.vat_included',
	'checkout.place_order',
	'checkout.placing',
	'checkout.place_failed',
	'checkout.success.title',
	'checkout.success.reference',
	'checkout.success.body',
	'checkout.validation.delivery_method',
	'checkout.validation.billing_address',
	'checkout.validation.delivery_address',
	'checkout.validation.payment_method',
	'checkout.validation.notes',
	'checkout.validation.person_name',
	'checkout.validation.company_name',
	'checkout.validation.company_cui',
	'checkout.validation.contact_email',
	'checkout.validation.contact_phone',
	'checkout.validation.address',
	'checkout.validation.city',
	'checkout.validation.street',
	'checkout.validation.billing',
] as const;

export type CheckoutTranslationKey = (typeof CHECKOUT_TRANSLATION_KEYS)[number];

export type CheckoutTranslations = Record<CheckoutTranslationKey, string>;

/** Mirrors `CART_NOTES_MAX` - checkout notes go through the cart validator's notes schema. */
export const CHECKOUT_NOTES_MAX = 500;

/** Which billing entry the editor is open for, or `null` while the shopper only picks one. */
export type BillingEditor =
	| { mode: 'create' }
	| { mode: 'edit'; clientId: number };

/**
 * The billing editor's fields, as typed. Strings throughout - an empty field is `''` here and
 * becomes `null` only in `getBillingParams`, so a controlled input never flips to uncontrolled.
 */
export type BillingValues = {
	client_type: ClientType;
	person_name: string;
	company_name: string;
	company_cui: string;
	company_reg_com: string;
	contact_name: string;
	contact_email: string;
	contact_phone: string;
};

export type BillingErrors = Partial<
	Record<keyof BillingValues, CheckoutTranslationKey>
>;

/**
 * The add-address form, in its two branches. `is_new` false: `address` is the search box text and
 * `address_id` the row picked from it. `is_new` true: the search found nothing, and `city` /
 * `city_id`, `street` and `postal_code` describe a new row. In both, typing into a search box
 * clears its id, so a half-typed value is never saved as a pick.
 */
export type AddressValues = {
	is_new: boolean;
	address_id: number | null;
	address: string;
	city_id: number | null;
	city: string;
	street: string;
	postal_code: string;
	details: string;
	notes: string;
};

export type AddressErrors = Partial<
	Record<keyof AddressValues, CheckoutTranslationKey>
>;

export type CheckoutValues = {
	delivery_method: ShippingMethod | null;
	billing_address_id: number | null;
	/** Sent for a courier only - a pickup is collected from the warehouse. */
	delivery_address_id: number | null;
	payment_method: OrderPaymentMethod | null;
	notes: string;
};

export type CheckoutErrors = Partial<
	Record<keyof CheckoutValues, CheckoutTranslationKey>
>;

/**
 * Preselected to the common case - a courier delivery paid in cash on arrival - so most shoppers
 * only confirm. The types stay nullable: a radio group can still hand back an unknown value, which
 * `toShippingMethod` / `toPaymentMethod` narrow to null and `validateCheckout` reports.
 */
export const CHECKOUT_INITIAL_VALUES: CheckoutValues = {
	delivery_method: ShippingMethodEnum.COURIER,
	billing_address_id: null,
	delivery_address_id: null,
	payment_method: OrderPaymentMethodEnum.CASH_ON_DELIVERY,
	notes: '',
};

export const DELIVERY_METHOD_OPTIONS: readonly {
	value: ShippingMethod;
	labelKey: CheckoutTranslationKey;
}[] = [
	{
		value: ShippingMethodEnum.SELF_PICKUP,
		labelKey: 'checkout.delivery.self_pickup',
	},
	{
		value: ShippingMethodEnum.COURIER,
		labelKey: 'checkout.delivery.courier',
	},
];

export const PAYMENT_METHOD_OPTIONS: readonly {
	value: OrderPaymentMethod;
	labelKey: CheckoutTranslationKey;
}[] = [
	{
		value: OrderPaymentMethodEnum.CASH_ON_DELIVERY,
		labelKey: 'checkout.payment.cash_on_delivery',
	},
	{ value: OrderPaymentMethodEnum.CARD, labelKey: 'checkout.payment.card' },
	{
		value: OrderPaymentMethodEnum.BANK_TRANSFER,
		labelKey: 'checkout.payment.bank_transfer',
	},
];

/** Narrows a radio group's string value back onto its enum, or null for anything else. */
function toEnumValue<T extends string>(
	values: Record<string, T>,
	value: string,
): T | null {
	return (Object.values(values) as string[]).includes(value)
		? (value as T)
		: null;
}

export const toShippingMethod = (value: string): ShippingMethod | null =>
	toEnumValue(ShippingMethodEnum, value);

export const toPaymentMethod = (value: string): OrderPaymentMethod | null =>
	toEnumValue(OrderPaymentMethodEnum, value);

export const toClientType = (value: string): ClientType | null =>
	toEnumValue(ClientTypeEnum, value);

/**
 * The first billing entry an account gets: the account holder as a person. The account carries no
 * phone, so that one field is left for the shopper - it is what a courier calls.
 */
export function getDefaultBillingValues(
	auth: AccountModel | null,
): BillingValues {
	return {
		client_type: ClientTypeEnum.PERSON,
		person_name: auth?.name ?? '',
		company_name: '',
		company_cui: '',
		company_reg_com: '',
		contact_name: '',
		contact_email: auth?.email ?? '',
		contact_phone: '',
	};
}

export function getBillingValuesFromClient(client: ClientModel): BillingValues {
	return {
		client_type: client.client_type,
		person_name: client.person_name ?? '',
		company_name: client.company_name ?? '',
		company_cui: client.company_cui ?? '',
		company_reg_com: client.company_reg_com ?? '',
		contact_name: client.contact_name ?? '',
		contact_email: client.contact_email ?? '',
		contact_phone: client.contact_phone ?? '',
	};
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The fields the backend requires per branch, plus the two contacts a delivery is arranged through.
 * Email and phone are optional on a client, but checkout copies them onto the shipment, so an entry
 * written here asks for both. The phone format itself is left to the backend's check.
 */
export function validateBilling(values: BillingValues): BillingErrors {
	const errors: BillingErrors = {};

	if (values.client_type === ClientTypeEnum.PERSON) {
		if (!values.person_name.trim()) {
			errors.person_name = 'checkout.validation.person_name';
		}
	} else {
		if (!values.company_name.trim()) {
			errors.company_name = 'checkout.validation.company_name';
		}

		if (!values.company_cui.trim()) {
			errors.company_cui = 'checkout.validation.company_cui';
		}
	}

	if (!EMAIL_PATTERN.test(values.contact_email.trim())) {
		errors.contact_email = 'checkout.validation.contact_email';
	}

	if (!values.contact_phone.trim()) {
		errors.contact_phone = 'checkout.validation.contact_phone';
	}

	return errors;
}

/**
 * The payload for `POST` / `PUT /public/clients`. Only the chosen branch's identity fields are
 * sent - the backend schema types the other branch's fields as `never` and refuses them even empty.
 */
export function getBillingParams(values: BillingValues): OwnClientCreateParams {
	const text = (value: string): string | null => value.trim() || null;

	const contact = {
		contact_email: text(values.contact_email),
		contact_phone: text(values.contact_phone),
	};

	if (values.client_type === ClientTypeEnum.COMPANY) {
		return {
			client_type: ClientTypeEnum.COMPANY,
			company_name: text(values.company_name),
			company_cui: text(values.company_cui),
			company_reg_com: text(values.company_reg_com),
			contact_name: text(values.contact_name),
			...contact,
		};
	}

	return {
		client_type: ClientTypeEnum.PERSON,
		person_name: text(values.person_name),
		...contact,
	};
}

export const getEmptyAddressValues = (): AddressValues => ({
	is_new: false,
	address_id: null,
	address: '',
	city_id: null,
	city: '',
	street: '',
	postal_code: '',
	details: '',
	notes: '',
});

export function validateAddress(values: AddressValues): AddressErrors {
	const errors: AddressErrors = {};

	if (!values.is_new) {
		if (values.address_id === null) {
			errors.address_id = 'checkout.validation.address';
		}

		return errors;
	}

	if (values.city_id === null) {
		errors.city_id = 'checkout.validation.city';
	}

	if (!values.street.trim()) {
		errors.street = 'checkout.validation.street';
	}

	return errors;
}

/**
 * The payload for adding an address: the picked row's id, or the new row's city, street and postal
 * code - never both, which the backend refuses. The details and notes ride along either way.
 */
export function getAddressParams(
	values: AddressValues,
): OwnClientAddressParams {
	const text = (value: string): string | null => value.trim() || null;

	const location: OwnClientAddressParams =
		values.is_new && values.city_id !== null
			? {
					city_id: values.city_id,
					street: values.street.trim(),
					postal_code: text(values.postal_code),
				}
			: values.address_id !== null
				? { address_id: values.address_id }
				: {};

	return {
		...location,
		details: text(values.details),
		notes: text(values.notes),
	};
}

export function validateCheckout(values: CheckoutValues): CheckoutErrors {
	const errors: CheckoutErrors = {};

	if (!values.delivery_method) {
		errors.delivery_method = 'checkout.validation.delivery_method';
	}

	if (values.billing_address_id === null) {
		errors.billing_address_id = 'checkout.validation.billing_address';
	}

	if (
		values.delivery_method === ShippingMethodEnum.COURIER &&
		values.delivery_address_id === null
	) {
		errors.delivery_address_id = 'checkout.validation.delivery_address';
	}

	if (!values.payment_method) {
		errors.payment_method = 'checkout.validation.payment_method';
	}

	if (values.notes.trim().length > CHECKOUT_NOTES_MAX) {
		errors.notes = 'checkout.validation.notes';
	}

	return errors;
}

export const hasErrors = (errors: object): boolean =>
	Object.keys(errors).length > 0;
