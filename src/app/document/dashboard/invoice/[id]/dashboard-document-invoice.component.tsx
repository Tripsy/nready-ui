'use client';

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import { InvoiceDocument } from '@/components/document/invoice-document.component';
import type { InvoiceDocumentTranslations } from '@/components/document/invoice-document.translations';
import Routes from '@/config/routes.setup';
import { ApiError } from '@/exceptions/api.error';
import { getResponseData } from '@/helpers/api.helper';
import { isEntityId } from '@/helpers/id.helper';
import { requestInvoiceDocument } from '@/services/invoice.service';
import type { EntityId } from '@/types/entity-id.type';

export function DashboardDocumentInvoice({
	invoiceId,
	translations,
}: {
	readonly invoiceId: EntityId;
	readonly translations: InvoiceDocumentTranslations;
}): JSX.Element {
	const isValidId = isEntityId(invoiceId);

	const invoiceQuery = useQuery({
		queryKey: ['invoice', 'print', invoiceId],
		queryFn: async () => {
			const data = getResponseData(
				await requestInvoiceDocument(invoiceId),
			);

			if (!data) {
				throw new Error('Could not retrieve invoice');
			}

			return data;
		},
		enabled: isValidId,
		// A 404 is the answer, not a transient failure worth a second request
		retry: (failureCount, error) =>
			!(error instanceof ApiError && error.status === 404) &&
			failureCount < 1,
	});

	return (
		<InvoiceDocument
			query={invoiceQuery}
			isValidId={isValidId}
			backHref={Routes.get('invoice')}
			backLabel={translations['invoice.document.back_dashboard']}
			translations={translations}
		/>
	);
}
