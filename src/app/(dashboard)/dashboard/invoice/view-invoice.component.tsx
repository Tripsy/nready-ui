'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayAmount, DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type {
	BillingDetails,
	InvoiceLineModel,
	InvoiceModel,
	InvoicePaymentModel,
	SellerDetails,
} from '@/models/invoice.model';
import { displayInvoiceLabel } from '@/models/invoice.model';
import type { Currency } from '@/types/common.type';

function ViewInvoiceLines({
	lines,
	currency,
}: {
	lines: InvoiceLineModel[];
	currency: Currency;
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">
							Kind
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Label
						</th>
						<th className="text-left py-2 px-2 font-medium">Qty</th>
						<th className="text-left py-2 px-2 font-medium">
							Unit Price
						</th>
						<th className="text-left py-2 px-2 font-medium">VAT</th>
						<th className="text-left py-2 px-2 font-medium">
							Discount
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Total
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
								{formatEnumLabel(line.kind)}
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
	payments,
	currency,
}: {
	payments: InvoicePaymentModel[];
	currency: Currency;
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">ID</th>
						<th className="text-left py-2 px-2 font-medium">
							Cash Flow
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Amount
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Date
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
	details,
}: {
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
			<ViewField label="Name" value={name} />
			{'company_cui' in details && details.company_cui && (
				<ViewField label="CUI" value={details.company_cui} />
			)}
			{'company_reg_com' in details && details.company_reg_com && (
				<ViewField label="Reg. Com." value={details.company_reg_com} />
			)}
			<ViewField label="Address" value={address || '-'} full />
			{details.contact_email && (
				<ViewField label="Email" value={details.contact_email} />
			)}
			{details.contact_phone && (
				<ViewField label="Phone" value={details.contact_phone} />
			)}
			{details.iban && <ViewField label="IBAN" value={details.iban} />}
			{details.bank_name && (
				<ViewField label="Bank" value={details.bank_name} />
			)}
		</>
	);
}

export function ViewInvoice({ entry }: { entry: InvoiceModel }) {
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
			</div>

			<ViewSection title="Info">
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField label="Order" value={`#${entry.order_id}`} />
				{entry.parent_invoice_id && (
					<ViewField
						label="Credits Invoice"
						value={`#${entry.parent_invoice_id}`}
					/>
				)}
				<ViewField
					label="Net"
					value={
						<DisplayAmount
							amount={entry.total_net}
							currencyCode={entry.currency}
						/>
					}
				/>
				<ViewField
					label="VAT"
					value={
						<DisplayAmount
							amount={entry.total_vat}
							currencyCode={entry.currency}
						/>
					}
				/>
				<ViewField
					label="Total"
					value={
						<DisplayAmount
							amount={entry.total_gross}
							currencyCode={entry.currency}
						/>
					}
				/>
				{entry.total_discount_reduction > 0 && (
					<ViewField
						label="Discount"
						value={
							<DisplayAmount
								amount={entry.total_discount_reduction}
								currencyCode={entry.currency}
							/>
						}
					/>
				)}
				<ViewField
					label="Allocated"
					value={
						<DisplayAmount
							amount={allocated}
							currencyCode={entry.currency}
						/>
					}
				/>
				{entry.currency !== Configuration.currency() && (
					<ViewField
						label="Exchange Rate"
						value={entry.exchange_rate}
					/>
				)}
				{entry.notes && (
					<ViewField label="Notes" value={entry.notes} full />
				)}
			</ViewSection>

			<ViewSection title="Dates">
				<ViewField
					label="Issued At"
					value={
						entry.issued_at
							? formatDate(entry.issued_at, 'date-time')
							: '-'
					}
				/>
				<ViewField
					label="Due At"
					value={
						entry.due_at ? formatDate(entry.due_at, 'default') : '-'
					}
				/>
				{/* Never cleared once stamped, so it reads "was late", not "is late now" */}
				{entry.overdue_at && (
					<ViewField
						label="Went Overdue"
						value={
							<span className="text-danger">
								{formatDate(entry.overdue_at, 'default')}
							</span>
						}
					/>
				)}
				{entry.paid_at && (
					<ViewField
						label="Paid At"
						value={formatDate(entry.paid_at, 'date-time')}
					/>
				)}
			</ViewSection>

			{entry.billing_details && (
				<ViewSection title="Billed To">
					<ViewInvoiceParty details={entry.billing_details} />
				</ViewSection>
			)}

			{entry.seller_details && (
				<ViewSection title="Issued By">
					<ViewInvoiceParty details={entry.seller_details} />
				</ViewSection>
			)}

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label="Deleted At"
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>

			{lines.length > 0 && (
				<div>
					<h3 className="font-bold border-b border-line pb-2 mb-3">
						Lines
					</h3>
					<ViewInvoiceLines lines={lines} currency={entry.currency} />
				</div>
			)}

			{payments.length > 0 && (
				<div>
					<h3 className="font-bold border-b border-line pb-2 mb-3">
						Payments
					</h3>
					<ViewInvoicePayments
						payments={payments}
						currency={entry.currency}
					/>
				</div>
			)}
		</div>
	);
}
