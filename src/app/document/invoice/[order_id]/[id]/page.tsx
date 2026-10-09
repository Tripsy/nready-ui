import type { Metadata } from 'next';
import { DocumentInvoice } from '@/app/document/invoice/[order_id]/[id]/document-invoice.component';
import { INVOICE_DOCUMENT_TRANSLATION_KEYS } from '@/components/document/invoice-document.translations';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

interface Props {
	params: Promise<{
		order_id: string;
		id: string;
	}>;
}

export async function generateMetadata(): Promise<Metadata> {
	return {
		// The reference is only known to the client-side read, as on the order view
		title: await translate('invoice.document.meta_title', {
			app_name: Configuration.get('app.name'),
		}),
		robots: { index: false, follow: false },
	};
}

/**
 * The printable copy of one of the buyer's invoices - "download" is the browser's own Save as PDF.
 * Rendered outside the site layout, so the page holds nothing but the document and its toolbar.
 *
 * The labels are translated here and handed down: the document itself is a client island, since
 * the read needs the session the proxy attaches, and client translations are empty for a render.
 */
export default async function Page({ params }: Props) {
	const { order_id, id } = await params;
	const translations = await translateBatch(
		INVOICE_DOCUMENT_TRANSLATION_KEYS,
	);

	return (
		<DocumentInvoice
			orderId={Number(order_id)}
			invoiceId={Number(id)}
			translations={translations}
		/>
	);
}
