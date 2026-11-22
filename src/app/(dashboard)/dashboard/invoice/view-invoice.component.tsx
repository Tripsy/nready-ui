'use client';

import { Printer } from 'lucide-react';
import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Link } from '@/components/ui/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayAmount, DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type BillingDetails,
	displayInvoiceLabel,
	InvoiceLineKindEnum,
	type InvoiceLineModel,
	type InvoiceModel,
	type InvoicePaymentModel,
	InvoiceScopeEnum,
	InvoiceStatusEnum,
	type SellerDetails,
} from '@/models/invoice.model';
import type { Currency } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'invoice.field.address',
	'invoice.field.amount',
	'invoice.field.bank',
	'invoice.field.cash_flow',
	'invoice.field.created_at',
	'invoice.field.cui',
	'invoice.field.date',
	'invoice.field.discount',
	'invoice.field.due_at',
	'invoice.field.email',
	'invoice.field.exchange_rate',
	'invoice.field.iban',
	'invoice.field.id',
	'invoice.field.issued_at',
	'invoice.field.kind',
	'invoice.field.label',
	'invoice.field.name',
	'invoice.field.notes',
	'invoice.field.order_id',
	'invoice.field.paid_at',
	'invoice.field.parent_invoice_id',
	'invoice.field.phone',
	'invoice.field.qty',
	'invoice.field.reg_com',
	'invoice.field.scope',
	'invoice.field.total',
	'invoice.field.total_discount_reduction',
	'invoice.field.total_gross',
	'invoice.field.total_net',
	'invoice.field.total_vat',
	'invoice.field.unit_price',
	'invoice.field.updated_at',
	'invoice.field.vat',
	'invoice.section.billed_to',
	'invoice.section.info',
	'invoice.section.issued_by',
	'invoice.section.timestamps',
	'invoice.text.details',
	'invoice.text.lines',
	'invoice.text.nothing_has_been_allocated_against_this',
	'invoice.text.payments',
	'invoice.text.print_pdf',
	'invoice.text.this_invoice_has_no_lines',
	'invoice.field.amount_allocated',
	'invoice.text.not_registered',
	'invoice.text.overdue_since',
	...enumTranslationKeys('invoice.enum.line_kind', InvoiceLineKindEnum),
	...enumTranslationKeys('invoice.enum.scope', InvoiceScopeEnum),
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

function ViewInvoiceLines({
	translations,
	lines,
	currency,
}: {
	translations: TranslationsType;
	lines: InvoiceLineModel[];
	currency: Currency;
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.kind']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.label']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.qty']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.unit_price']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.vat']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.discount']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.total']}
						</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((line) => (
						<tr
							key={`line-${line.id}`}
							className="border-t border-line hover:bg-surface-secondary/30"
						>
							<td className="py-2 px-3">
								{translateEnumLabel(
									translations,
									'invoice.enum.line_kind',
									line.kind,
								)}
							</td>
							<td className="py-2 px-3">{line.label}</td>
							<td className="py-2 px-3">{line.quantity}</td>
							<td className="py-2 px-3">
								<DisplayAmount
									amount={line.unit_price}
									currencyCode={currency}
								/>
							</td>
							<td className="py-2 px-3">{line.vat_rate}%</td>
							<td className="py-2 px-3">
								{line.discount_reduction > 0 ? (
									<DisplayAmount
										amount={line.discount_reduction}
										currencyCode={currency}
									/>
								) : (
									'-'
								)}
							</td>
							<td className="py-2 px-3">
								<DisplayAmount
									amount={line.line_total}
									currencyCode={currency}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ViewInvoicePayments({
	translations,
	payments,
	currency,
}: {
	translations: TranslationsType;
	payments: InvoicePaymentModel[];
	currency: Currency;
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.id']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.cash_flow']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.amount']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['invoice.field.date']}
						</th>
					</tr>
				</thead>
				<tbody>
					{payments.map((payment) => (
						<tr
							key={`payment-${payment.id}`}
							className="border-t border-line hover:bg-surface-secondary/30"
						>
							<td className="py-2 px-3">#{payment.id}</td>
							<td className="py-2 px-3">
								#{payment.cash_flow_id}
							</td>
							<td className="py-2 px-3">
								<DisplayAmount
									amount={payment.amount}
									currencyCode={currency}
								/>
							</td>
							<td className="py-2 px-3">
								{formatDate(payment.created_at, 'date-time')}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** A frozen party, printed as the document carries it. */
function ViewInvoiceParty({
	translations,
	details,
}: {
	translations: TranslationsType;
	details: BillingDetails | SellerDetails;
}) {
	const name =
		'company_name' in details && details.company_name
			? details.company_name
			: 'person_name' in details
				? details.person_name
				: '-';

	const address = [
		details.details,
		details.address_city,
		details.address_region,
		details.postal_code,
		details.address_country,
	]
		.filter((part) => !!part)
		.join(', ');

	return (
		<>
			<ViewField
				label={translations['invoice.field.name']}
				value={name}
			/>
			{'company_cui' in details && details.company_cui && (
				<ViewField
					label={translations['invoice.field.cui']}
					value={details.company_cui}
				/>
			)}
			{'company_reg_com' in details && details.company_reg_com && (
				<ViewField
					label={translations['invoice.field.reg_com']}
					value={details.company_reg_com}
				/>
			)}
			{/* `null` states the seller is not VAT-registered; an older snapshot lacks the key */}
			{'company_vat_number' in details && (
				<ViewField
					label={translations['invoice.field.vat']}
					value={
						details.company_vat_number ??
						translations['invoice.text.not_registered']
					}
				/>
			)}
			<ViewField
				label={translations['invoice.field.address']}
				value={address || '-'}
				full
			/>
			{details.contact_email && (
				<ViewField
					label={translations['invoice.field.email']}
					value={details.contact_email}
				/>
			)}
			{details.contact_phone && (
				<ViewField
					label={translations['invoice.field.phone']}
					value={details.contact_phone}
				/>
			)}
			{details.iban && (
				<ViewField
					label={translations['invoice.field.iban']}
					value={details.iban}
				/>
			)}
			{details.bank_name && (
				<ViewField
					label={translations['invoice.field.bank']}
					value={details.bank_name}
				/>
			)}
		</>
	);
}

export function ViewInvoice({ entry }: { entry: InvoiceModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const lines = entry.lines ?? [];
	const payments = entry.payments ?? [];

	const allocated = payments.reduce(
		(carry, payment) => carry + Number(payment.amount),
		0,
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{displayInvoiceLabel(entry)}
				</span>
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="invoice" />
				</div>
				<div className="max-w-60">
					<DisplayStatus
						status={entry.payment_status}
						dataSource="invoice"
					/>
				</div>
				{/* Only an issued document prints - a draft holds no number and no frozen parties */}
				{entry.status === InvoiceStatusEnum.ISSUED && (
					<Link
						href={Routes.get('invoice-print', { id: entry.id })}
						target="_blank"
						prefetch={false}
						variant="outline"
						size="xs"
						className="ml-auto"
					>
						<Printer aria-hidden="true" className="size-3.5" />
						{translations['invoice.text.print_pdf']}
					</Link>
				)}
			</div>

			<Tabs defaultSelectedKey="details" className="w-full">
				<TabsList>
					<TabsTrigger id="details">
						{translations['invoice.text.details']}
					</TabsTrigger>
					<TabsTrigger id="lines">
						{translations['invoice.text.lines']}
						<span className="ml-1.5 text-xs text-muted">
							{lines.length}
						</span>
					</TabsTrigger>
					<TabsTrigger id="payments">
						{translations['invoice.text.payments']}
						<span className="ml-1.5 text-xs text-muted">
							{payments.length}
						</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent id="details" className="space-y-6">
					<ViewSection
						title={translations['invoice.section.info']}
						layout="rows"
					>
						<ViewRow>
							<ViewField
								label={translations['invoice.field.scope']}
								value={translateEnumLabel(
									translations,
									'invoice.enum.scope',
									entry.scope,
								)}
							/>
							<ViewField
								label={translations['invoice.field.issued_at']}
								value={
									entry.issued_at
										? formatDate(
												entry.issued_at,
												'date-time',
											)
										: '-'
								}
							/>
							{/* A document raised from a bare cash flow entry bills no order */}
							{entry.order_id && (
								<ViewField
									label={
										translations['invoice.field.order_id']
									}
									value={`#${entry.order_id}`}
								/>
							)}
							{entry.parent_invoice_id && (
								<ViewField
									label={
										translations[
											'invoice.field.parent_invoice_id'
										]
									}
									value={`#${entry.parent_invoice_id}`}
								/>
							)}
						</ViewRow>

						{/* Four across when the discount joins them, so Total stays on the same line */}
						<ViewRow
							className={
								entry.total_discount_reduction > 0
									? 'lg:grid-cols-4'
									: undefined
							}
						>
							<ViewField
								label={translations['invoice.field.total_net']}
								value={
									<DisplayAmount
										amount={entry.total_net}
										currencyCode={entry.currency}
									/>
								}
							/>
							<ViewField
								label={translations['invoice.field.total_vat']}
								value={
									<DisplayAmount
										amount={entry.total_vat}
										currencyCode={entry.currency}
									/>
								}
							/>
							{entry.total_discount_reduction > 0 && (
								<ViewField
									label={
										translations[
											'invoice.field.total_discount_reduction'
										]
									}
									value={
										<DisplayAmount
											amount={
												entry.total_discount_reduction
											}
											currencyCode={entry.currency}
										/>
									}
								/>
							)}
							<ViewField
								label={
									translations['invoice.field.total_gross']
								}
								value={
									<DisplayAmount
										amount={entry.total_gross}
										currencyCode={entry.currency}
									/>
								}
							/>
						</ViewRow>

						<ViewRow>
							<ViewField
								label={
									translations[
										'invoice.field.amount_allocated'
									]
								}
								value={
									<DisplayAmount
										amount={allocated}
										currencyCode={entry.currency}
									/>
								}
							/>
							<ViewField
								label={translations['invoice.field.due_at']}
								value={
									entry.due_at ? (
										<>
											{formatDate(
												entry.due_at,
												'default',
											)}
											{/* Never cleared once stamped, so it reads "was late", not "is late now" */}
											{entry.overdue_at && (
												<span className="ml-2 text-danger">
													{replaceVars(
														translations[
															'invoice.text.overdue_since'
														],
														{
															date:
																formatDate(
																	entry.overdue_at,
																	'default',
																) ?? '',
														},
													)}
												</span>
											)}
										</>
									) : (
										'-'
									)
								}
							/>
							<ViewField
								label={translations['invoice.field.paid_at']}
								value={
									entry.paid_at
										? formatDate(entry.paid_at, 'date-time')
										: '-'
								}
							/>
						</ViewRow>

						{entry.currency !== Configuration.currency() && (
							<ViewRow>
								<ViewField
									label={
										translations[
											'invoice.field.exchange_rate'
										]
									}
									value={entry.exchange_rate}
								/>
							</ViewRow>
						)}

						{entry.notes && (
							<ViewRow>
								<ViewField
									label={translations['invoice.field.notes']}
									value={entry.notes}
									full
								/>
							</ViewRow>
						)}
					</ViewSection>

					{entry.billing_details && (
						<ViewSection
							title={translations['invoice.section.billed_to']}
						>
							<ViewInvoiceParty
								translations={translations}
								details={entry.billing_details}
							/>
						</ViewSection>
					)}

					{entry.seller_details && (
						<ViewSection
							title={translations['invoice.section.issued_by']}
						>
							<ViewInvoiceParty
								translations={translations}
								details={entry.seller_details}
							/>
						</ViewSection>
					)}

					<ViewSection
						title={translations['invoice.section.timestamps']}
					>
						<ViewField
							label={translations['invoice.field.created_at']}
							value={formatDate(entry.created_at, 'date-time')}
						/>
						<ViewField
							label={translations['invoice.field.updated_at']}
							value={formatDate(entry.updated_at, 'date-time')}
						/>
					</ViewSection>
				</TabsContent>

				<TabsContent id="lines">
					<ViewSection layout="rows">
						{lines.length === 0 ? (
							<p className="text-sm text-muted">
								{
									translations[
										'invoice.text.this_invoice_has_no_lines'
									]
								}
							</p>
						) : (
							<ViewInvoiceLines
								translations={translations}
								lines={lines}
								currency={entry.currency}
							/>
						)}
					</ViewSection>
				</TabsContent>

				<TabsContent id="payments">
					<ViewSection layout="rows">
						{payments.length === 0 ? (
							<p className="text-sm text-muted">
								{
									translations[
										'invoice.text.nothing_has_been_allocated_against_this'
									]
								}
							</p>
						) : (
							<ViewInvoicePayments
								translations={translations}
								payments={payments}
								currency={entry.currency}
							/>
						)}
					</ViewSection>
				</TabsContent>
			</Tabs>
		</div>
	);
}
