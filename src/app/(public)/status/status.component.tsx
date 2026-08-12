'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { ParamsType } from '@/app/(public)/status/[type]/page';
import {
	ErrorComponent,
	InfoComponent,
	LoadingComponent,
	SuccessComponent,
} from '@/components/status.component';
import Routes from '@/config/routes.setup';
import { useTranslation } from '@/hooks/use-translation.hook';

const COMPONENT_MAP = {
	error: ErrorComponent,
	success: SuccessComponent,
	info: InfoComponent,
} as const;

const TITLE_KEY_MAP: Record<ParamsType, string> = {
	error: 'status.title.error',
	success: 'status.title.success',
	info: 'status.title.info',
} as const;

const STATIC_TRANSLATION_KEYS = [
	'status.title.error',
	'status.title.success',
	'status.title.info',
	'status.link.back_home_prompt',
	'status.link.back_home',
] as const;

type StaticTranslations = Record<
	(typeof STATIC_TRANSLATION_KEYS)[number],
	string
>;

const HomeLink = ({ labels }: { labels: StaticTranslations }) => (
	<div className="text-center mt-6">
		{labels['status.link.back_home_prompt']}{' '}
		<Link
			href={Routes.get('home')}
			className="text-accent font-medium hover:underline"
		>
			{labels['status.link.back_home']}
		</Link>
	</div>
);

export default function StatusComponent() {
	const params = useParams<{ type: ParamsType }>();
	const searchParams = useSearchParams();

	const type = params.type;
	const r = searchParams.get('r') || 'generic';
	const messageKey = `app.${type}.${r}`;

	const { translations, isTranslationLoading } = useTranslation([
		messageKey,
		...STATIC_TRANSLATION_KEYS,
	]);

	if (isTranslationLoading) {
		return <LoadingComponent />;
	}

	const StatusComponent = COMPONENT_MAP[type] ?? InfoComponent;
	const labels = translations as unknown as StaticTranslations;
	const title =
		labels[
			(TITLE_KEY_MAP[type] ??
				'status.title.info') as keyof StaticTranslations
		];

	return (
		<StatusComponent title={title} description={translations[messageKey]}>
			<HomeLink labels={labels} />
		</StatusComponent>
	);
}
