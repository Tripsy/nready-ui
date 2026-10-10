import type { Currency } from '@/types/common.type';

/**
 * Which way the money went. Mirrors `ClientLedgerEntryTypeEnum` in the API's
 * `client-ledger.entity.ts`: a `payment` received from the client is positive, a `refund` paid back
 * negative. Documents write nothing to the ledger - what a client owes is read from their invoices.
 */
export const ClientLedgerEntryTypeEnum = {
	PAYMENT: 'payment',
	REFUND: 'refund',
} as const;

export type ClientLedgerEntryType =
	(typeof ClientLedgerEntryTypeEnum)[keyof typeof ClientLedgerEntryTypeEnum];

/**
 * One completed cash movement with a client. Append-only on the API side - an entry is never
 * edited - and written when the movement completes, never by a form.
 */
export type ClientLedgerEntryModel<D = Date | string> = {
	id: number;
	client_id: number;
	entry_type: ClientLedgerEntryType;
	cash_flow_id: number;
	currency: Currency;
	amount: number; // signed: positive, money received; negative, money paid back
	exchange_rate: number;
	amount_base: number;
	occurred_at: D;
	created_at: D;
};

/**
 * The money moved with a client in one currency: `net` is `received - refunded`. Not what they
 * owe. Never summed across currencies; `net_base` is a reporting figure.
 */
export type ClientLedgerBalanceModel = {
	currency: Currency;
	received: number;
	refunded: number;
	net: number;
	net_base: number;
};
