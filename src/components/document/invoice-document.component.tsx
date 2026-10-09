'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import NextLink from 'next/link';
import type React from 'react';
import { type JSX, useEffect } from 'react';
import type { InvoiceDocumentTranslations } from '@/components/document/invoice-document.translations';
import { Button } from '@/components/ui/button';
import { getLanguageClient } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { formatDate } from '@/helpers/date.helper';
import { replaceVars } from '@/helpers/string.helper';
import {
	type BillingDetails,
	type InvoiceDocumentModel,
	InvoiceStatusEnum,
	type SellerDetails,
} from '@/models/invoice.model';
import {
	type ShippingAddressSnapshot,
	ShippingMethodEnum,
} from '@/models/shipping.model';

/** A document is dated by the day - the time it was issued at is no part of what it states. */
const DATE_FORMAT = 'DD.MM.YYYY';

/*
 * A sheet of paper whichever theme the site is in: the colors are fixed rather than read from the
 * theme tokens, so the screen shows what the printer will put down.
 *
 * A document running past one page carries its reference and page count in the bottom margin, so
 * a loose second sheet still says what it belongs to. Margin boxes are Chrome 131+ - an older
 * browser prints without the footer, nothing else changes.
 */
const buildPageStyle = (reference: string | null) => `
	@page {
		size: A4;
		margin: 14mm;
		${
			reference
				? `@bottom-right {
			content: ${JSON.stringify(`${reference} · `)} counter(page) " / " counter(pages);
			font: 8pt sans-serif;
			color: #737373;
		}`
				: ''
		}
	}
	@media print {
		body {
			background: #fff;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
`;

/** Figures print bare: the currency is stated once, in the header. */
const formatAmount = (value: number): string => value.toFixed(2);

const displayReference = (entry: {
	id: number;
	ref_code: string | null;
	ref_number: number | null;
}): string =>
	entry.ref_code && entry.ref_number
		? `${entry.ref_code}-${entry.ref_number}`
		: `#${entry.id}`;

/**
 * A country as a reader names it. The seller's comes from configuration as an alpha-2 code while a
 * buyer's address usually carries the name, so a code is spelled out in the page's language.
 */
const displayCountry = (country: string | null): string | null => {
	if (!country || !/^[A-Z]{2}$/.test(country)) {
		return country;
	}

	try {
		return (
			new Intl.DisplayNames([getLanguageClient()], {
				type: 'region',
			}).of(country) ?? country
		);
	} catch {
		return country;
	}
};

/** The street line first, then the place - the order an address is written in on a letter. */
const displayAddress = (
	address: BillingDetails | SellerDetails | ShippingAddressSnapshot,
): string =>
	[
		address.details,
		[address.postal_code, address.address_city].filter(Boolean).join(' '),
		address.address_region,
		displayCountry(address.address_country),
	]
		.filter(Boolean)
		.join(', ');

/**
 * One end of the movement: its frozen address once it shipped, before that the warehouse or the
 * client address it points at.
 */
const displayShippingEnd = (
	snapshot: ShippingAddressSnapshot | null,
	warehouse: { name: string } | null,
	clientAddressLabel: string | null,
): string | null =>
	snapshot
		? displayAddress(snapshot)
		: (warehouse?.name ?? clientAddressLabel);

/** Label and value pairs, printed in a compact list; a pair with no value is left out. */
function Details({
	rows,
	className = 'text-xs',
}: {
	readonly rows: readonly [string, string | null | undefined][];
	readonly className?: string;
}) {
	return (
		<dl className={className}>
			{rows
				.filter(([, value]) => value)
				.map(([label, value]) => (
					<div key={label} className="flex gap-1">
						<dt className="shrink-0 text-neutral-500">{label}:</dt>
						<dd>{value}</dd>
					</div>
				))}
		</dl>
	);
}

function Party({
	title,
	name,
	identifiers,
	statement,
	addressLabel,
	party,
	translations,
}: {
	readonly title: string;
	readonly name: string;
	/** Label and value pairs naming the party to the tax authority, in the order they print. */
	readonly identifiers: readonly [string, string | null | undefined][];
	/** A status stated in words rather than as a value - a seller not registered for VAT. */
	readonly statement?: string | null;
	/** What the address is - the seller's is its registered office. */
	readonly addressLabel?: string;
	readonly party: BillingDetails | SellerDetails;
	readonly translations: InvoiceDocumentTranslations;
}) {
	const address = displayAddress(party);

	return (
		<div className="space-y-1">
			<p className="text-xs uppercase tracking-wide text-neutral-500">
				{title}
			</p>
			<p className="font-semibold">{name}</p>
			<Details rows={identifiers} />
			{statement && <p className="text-xs">{statement}</p>}
			{addressLabel ? (
				<Details rows={[[addressLabel, address]]} />
			) : (
				<p>{address}</p>
			)}
			<Details
				rows={[
					[translations['invoice.document.iban'], party.iban],
					[
						translations['invoice.document.bank_name'],
						party.bank_name,
					],
					[
						translations['invoice.document.contact_email'],
						party.contact_email,
					],
					[
						translations['invoice.document.contact_phone'],
						party.contact_phone,
					],
				]}
			/>
		</div>
	);
}

/**
 * What the document was raised from: the order it bills, and on a shipping document the movement
 * - who carried it, between which ends, and when.
 */
function Origin({
	invoice,
	format,
	translations,
}: {
	readonly invoice: InvoiceDocumentModel;
	readonly format: (date: string | null) => string | null;
	readonly translations: InvoiceDocumentTranslations;
}) {
	const { order, shipping } = invoice;

	if (!order && !shipping) {
		return null;
	}

	return (
		<section className="grid gap-6 border-t border-neutral-300 py-4 sm:grid-cols-2 print:grid-cols-2">
			{order && (
				<Details
					rows={[
						[
							translations['invoice.document.order'],
							replaceVars(
								translations['invoice.document.order_value'],
								{
									reference: `${order.ref_code}-${order.ref_number}`,
									date: format(order.created_at) ?? '',
								},
							),
						],
					]}
				/>
			)}

			{shipping && (
				<Details
					rows={[
						[
							translations['invoice.document.shipping_method'],
							shipping.method === ShippingMethodEnum.SELF_PICKUP
								? translations[
										'invoice.document.shipping_self_pickup'
									]
								: (shipping.carrier?.name ??
									translations[
										'invoice.document.shipping_courier'
									]),
						],
						[
							translations['invoice.document.shipping_from'],
							displayShippingEnd(
								shipping.pickup_data,
								shipping.pickup_warehouse,
								shipping.pickup_client_address_label,
							),
						],
						[
							translations['invoice.document.shipping_to'],
							displayShippingEnd(
								shipping.destination_data,
								shipping.destination_warehouse,
								shipping.destination_client_address_label,
							),
						],
						[
							translations['invoice.document.shipping_tracking'],
							shipping.tracking_number,
						],
						[
							translations[
								'invoice.document.shipping_shipped_at'
							],
							format(shipping.shipped_at),
						],
						[
							translations[
								'invoice.document.shipping_delivered_at'
							],
							format(shipping.delivered_at),
						],
					]}
				/>
			)}
		</section>
	);
}

function Sheet({
	invoice,
	translations,
}: {
	readonly invoice: InvoiceDocumentModel;
	readonly translations: InvoiceDocumentTranslations;
}) {
	const language = getLanguageClient();
	const format = (date: string | null) =>
		formatDate(date, undefined, {
			customFormat: DATE_FORMAT,
			language: language,
		});
	const { billing_details: buyer, seller_details: seller } = invoice;

	const headerDates: [string, string | null][] = [
		[translations['invoice.document.issued_at'], format(invoice.issued_at)],
		[translations['invoice.document.due_at'], format(invoice.due_at)],
		[translations['invoice.document.paid_at'], format(invoice.paid_at)],
		[translations['invoice.document.currency'], invoice.currency],
	];

	return (
		<article className="mx-auto w-full max-w-[210mm] bg-white p-[14mm] text-sm text-neutral-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
			<header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
				<div>
					<h1 className="text-2xl font-bold uppercase tracking-wide">
						{invoice.is_reversal
							? translations['invoice.document.title_reversal']
							: translations['invoice.document.title']}
					</h1>
					<p className="mt-1 text-base font-semibold tabular-nums">
						{replaceVars(translations['invoice.document.number'], {
							reference: displayReference(invoice),
						})}
					</p>
					{invoice.parent_invoice && (
						<p className="mt-1 text-xs text-neutral-600">
							{replaceVars(
								translations['invoice.document.reverses'],
								{
									reference: displayReference(
										invoice.parent_invoice,
									),
									date:
										format(
											invoice.parent_invoice.issued_at,
										) ?? '',
								},
							)}
						</p>
					)}
				</div>

				<dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs">
					{headerDates
						.filter(([, value]) => value)
						.map(([label, value]) => (
							<div key={label} className="contents">
								<dt className="text-neutral-500">{label}</dt>
								<dd className="text-right tabular-nums">
									{value}
								</dd>
							</div>
						))}
				</dl>
			</header>

			<section className="grid gap-6 py-6 sm:grid-cols-2 print:grid-cols-2">
				{seller && (
					<Party
						title={translations['invoice.document.seller']}
						name={seller.company_name}
						identifiers={[
							[
								translations['invoice.document.company_cui'],
								seller.company_cui,
							],
							[
								translations[
									'invoice.document.company_vat_number'
								],
								seller.company_vat_number,
							],
							[
								translations[
									'invoice.document.company_reg_com'
								],
								seller.company_reg_com,
							],
						]}
						// `null` states it; a snapshot older than the field states nothing
						statement={
							seller.company_vat_number === null
								? translations[
										'invoice.document.not_vat_registered'
									]
								: null
						}
						addressLabel={
							translations['invoice.document.registered_office']
						}
						party={seller}
						translations={translations}
					/>
				)}

				{buyer && (
					<Party
						title={translations['invoice.document.buyer']}
						name={
							buyer.type === 'company'
								? buyer.company_name
								: buyer.person_name
						}
						identifiers={
							buyer.type === 'company'
								? [
										[
											translations[
												'invoice.document.company_cui'
											],
											buyer.company_cui,
										],
										[
											translations[
												'invoice.document.company_reg_com'
											],
											buyer.company_reg_com,
										],
									]
								: [
										[
											translations[
												'invoice.document.person_identification_number'
											],
											buyer.person_identification_number,
										],
									]
						}
						party={buyer}
						translations={translations}
					/>
				)}
			</section>

			<Origin
				invoice={invoice}
				format={format}
				translations={translations}
			/>

			<table className="w-full border-collapse text-xs">
				<thead>
					<tr className="border-y border-neutral-900 bg-neutral-100 text-left">
						<th className="px-2 py-2 font-semibold">
							{translations['invoice.document.col_index']}
						</th>
						<th className="px-2 py-2 font-semibold">
							{translations['invoice.document.col_label']}
						</th>
						{(
							[
								'invoice.document.col_quantity',
								'invoice.document.col_unit_price',
								'invoice.document.col_vat_rate',
								'invoice.document.col_net',
								'invoice.document.col_vat',
								'invoice.document.col_total',
							] as const
						).map((key) => (
							<th
								key={key}
								className="px-2 py-2 text-right font-semibold"
							>
								{translations[key]}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{invoice.lines.map((line, index) => (
						<tr
							key={line.id}
							className="break-inside-avoid border-b border-neutral-300 align-top"
						>
							<td className="px-2 py-2 tabular-nums">
								{index + 1}
							</td>
							<td className="px-2 py-2">
								{line.label}
								{line.discount_reduction > 0 && (
									<span className="block text-neutral-500">
										{replaceVars(
											translations[
												'invoice.document.line_discount'
											],
											{
												amount: formatAmount(
													line.discount_reduction,
												),
											},
										)}
									</span>
								)}
							</td>
							<td className="px-2 py-2 text-right tabular-nums">
								{line.quantity}
							</td>
							<td className="px-2 py-2 text-right tabular-nums">
								{formatAmount(line.unit_price)}
							</td>
							<td className="px-2 py-2 text-right tabular-nums">
								{line.vat_rate}
							</td>
							<td className="px-2 py-2 text-right tabular-nums">
								{formatAmount(line.line_net)}
							</td>
							<td className="px-2 py-2 text-right tabular-nums">
								{formatAmount(line.line_vat)}
							</td>
							<td className="px-2 py-2 text-right tabular-nums">
								{formatAmount(line.line_total)}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* Stored figures, never re-summed here - see `total_gross` on the API entity */}
			<dl className="ml-auto mt-6 w-full max-w-xs space-y-1 break-inside-avoid">
				{invoice.total_discount_reduction > 0 && (
					<div className="flex justify-between text-neutral-500">
						<dt>
							{translations['invoice.document.total_discount']}
						</dt>
						<dd className="tabular-nums">
							-{formatAmount(invoice.total_discount_reduction)}
						</dd>
					</div>
				)}
				<div className="flex justify-between">
					<dt>{translations['invoice.document.total_net']}</dt>
					<dd className="tabular-nums">
						{formatAmount(invoice.total_net)}
					</dd>
				</div>
				<div className="flex justify-between">
					<dt>{translations['invoice.document.total_vat']}</dt>
					<dd className="tabular-nums">
						{formatAmount(invoice.total_vat)}
					</dd>
				</div>
				<div className="flex justify-between border-t-2 border-neutral-900 pt-2 text-base font-bold">
					<dt>
						{invoice.is_reversal
							? translations[
									'invoice.document.total_gross_reversal'
								]
							: translations['invoice.document.total_gross']}
					</dt>
					{/* Figures stay positive on a reversal; the sign is stated here, once */}
					<dd className="tabular-nums">
						{invoice.is_reversal && '-'}
						{formatAmount(invoice.total_gross)} {invoice.currency}
					</dd>
				</div>
			</dl>
		</article>
	);
}

/**
 * The printable page around the sheet: the toolbar, the paper backdrop and the read's states.
 * Only an issued document prints - a draft holds no number and no frozen parties, and a canceled
 * one was never valid.
 */
export function InvoiceDocument({
	query,
	isValidId,
	backHref,
	backLabel,
	translations,
}: {
	readonly query: UseQueryResult<InvoiceDocumentModel>;
	/** False for an id the URL got wrong, whose query is disabled and would stay pending. */
	readonly isValidId: boolean;
	readonly backHref: string;
	readonly backLabel: string;
	readonly translations: InvoiceDocumentTranslations;
}): JSX.Element {
	const invoice =
		query.data?.status === InvoiceStatusEnum.ISSUED ? query.data : null;

	/*
	 * The tab title is what a browser's "Save as PDF" names the file, so it carries the document's
	 * own name and number once they are known.
	 */
	useEffect(() => {
		if (!invoice) {
			return;
		}

		document.title = `${
			invoice.is_reversal
				? translations['invoice.document.title_reversal']
				: translations['invoice.document.title']
		} ${displayReference(invoice)}`;
	}, [invoice, translations]);

	const renderMessage = (message: string, className = 'text-neutral-600') => (
		<p className={`py-24 text-center ${className}`}>{message}</p>
	);

	let content: React.ReactNode;

	if (!isValidId) {
		content = renderMessage(translations['invoice.document.not_found']);
	} else if (query.isPending) {
		content = renderMessage(translations['invoice.document.loading']);
	} else if (query.isError) {
		content =
			query.error instanceof ApiError && query.error.status === 404
				? renderMessage(translations['invoice.document.not_found'])
				: renderMessage(
						translations['invoice.document.error'],
						'text-red-600',
					);
	} else if (!invoice) {
		content = renderMessage(translations['invoice.document.not_issued']);
	} else {
		content = <Sheet invoice={invoice} translations={translations} />;
	}

	return (
		<div className="min-h-screen bg-neutral-200 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
			<style>
				{buildPageStyle(invoice ? displayReference(invoice) : null)}
			</style>

			<div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
				<NextLink
					href={backHref}
					className="text-sm text-neutral-700 underline-offset-4 hover:underline"
				>
					← {backLabel}
				</NextLink>

				{invoice && (
					<Button
						type="button"
						size="sm"
						onClick={() => window.print()}
					>
						<Printer aria-hidden="true" className="size-4" />
						{translations['invoice.document.print']}
					</Button>
				)}
			</div>

			{content}
		</div>
	);
}
