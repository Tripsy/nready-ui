import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import {
	ApiRequest,
	getResponseData,
	resolveRequestPath,
} from '@/helpers/api.helper';
import { formatDate } from '@/helpers/date.helper';
import type {
	TemplateContentPageType,
	TemplateLayoutPage,
	TemplateModel,
} from '@/models/template.model';
import type { ApiResponseFetch } from '@/types/api.type';

interface Props {
	params: Promise<{
		label: string;
	}>;
}

async function getPageData(label: string): Promise<{
	title: string;
	html: string;
	layout: TemplateLayoutPage;
	updated_at: string | Date;
} | null> {
	try {
		const fetchResponse: ApiResponseFetch<TemplateModel> | undefined =
			await new ApiRequest()
				.setRequestMode('remote-api')
				.doFetch(`/${resolveRequestPath('template')}/${label}/page`, {
					method: 'GET',
					next: { revalidate: 3600 },
				});

		if (fetchResponse?.success) {
			const responseData = getResponseData(fetchResponse);

			if (responseData) {
				const content =
					responseData.content as unknown as TemplateContentPageType;

				return {
					title: content.title,
					html: content.html,
					layout: content.layout,
					updated_at: responseData.updated_at,
				};
			}
		}

		return null;
	} catch {
		return null;
	}
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { params } = props;

	const resolvedParams = await params;
	const label = resolvedParams.label;

	const pageData = await getPageData(label);

	if (!pageData) {
		return {
			title: await translate('app.page.not_found', {
				app_name: Configuration.get('app.name'),
			}),
		};
	}

	return {
		title: pageData.title,
	};
}

export default async function Page(props: Props) {
	const { params } = props;

	const resolvedParams = await params;
	const label = resolvedParams.label;

	const pageData = await getPageData(label);

	if (!pageData) {
		notFound();
	}

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-6 md:p-10">
				<h1 className="text-2xl md:text-3xl font-semibold">
					{pageData.title}
				</h1>
				<div
					className="content-page mt-6"
					/*biome-ignore lint/security/noDangerouslySetInnerHtml: It's fine*/
					dangerouslySetInnerHTML={{ __html: pageData.html }}
				/>
				<div className="mt-8 text-sm italic text-right text-muted">
					Last update: {formatDate(pageData.updated_at, 'date-time')}
				</div>
			</div>
		</div>
	);
}
