import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableClientLedger } from '@/app/(dashboard)/dashboard/client-ledger/data-table-client-ledger.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('client-ledger.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

type Props = {
	searchParams: Promise<{ client_id?: string }>;
};

export default async function Page(props: Props) {
	const { client_id: clientId } = await props.searchParams;

	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.client-ledger') },
	];

	return (
		<>
			<BreadcrumbSetter page="client-ledger" items={items} />
			<DataTableClientLedger initialClientId={Number(clientId) || null} />
		</>
	);
}
