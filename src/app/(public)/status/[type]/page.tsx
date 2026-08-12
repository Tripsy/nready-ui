import type { Metadata } from 'next';
import StatusComponent from '@/app/(public)/status/status.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export type ParamsType = 'error' | 'info' | 'success';

const VALID_TYPES = new Set<ParamsType>(['error', 'info', 'success']);

interface PageProps {
	params: Promise<{ type: string }>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { type } = await params;

	const validType: ParamsType = VALID_TYPES.has(type as ParamsType)
		? (type as ParamsType)
		: 'info';

	const appName = Configuration.get('app.name');
	const title = await translate(`status.${validType}.meta.title`, {
		app_name: appName,
	});

	return {
		title,
		...(validType === 'error' && { robots: { index: false } }),
	};
}

export default function Page() {
	return <StatusComponent />;
}
