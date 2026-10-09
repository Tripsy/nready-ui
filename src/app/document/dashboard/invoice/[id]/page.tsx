import type { Metadata } from 'next';
import { DashboardDocumentInvoice } from '@/app/document/dashboard/invoice/[id]/dashboard-document-invoice.component';
import { INVOICE_DOCUMENT_TRANSLATION_KEYS } from '@/components/document/invoice-document.translations';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

interface Props {
	params: Promise<{
		id: string;
	}>;
}

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('invoice.document.meta_title', {
			app_name: Configuration.get('app.name'),
		}),
		robots: { index: false, follow: false },
	};
}

/**
 * The back office's printable copy of an invoice - the same sheet the buyer prints, read through
 * the dashboard's `read` rather than the buyer's order. The route is gated by the `invoice`
 * permission, and the API checks it again on the read.
 */
export default async function Page({ params }: Props) {
	const { id } = await params;
	const translations = await translateBatch(
		INVOICE_DOCUMENT_TRANSLATION_KEYS,
	);

	return (
		<DashboardDocumentInvoice
			invoiceId={Number(id)}
			translations={translations}
		/>
	);
}
