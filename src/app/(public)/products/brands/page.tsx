import type { Metadata } from 'next';
import { BrandListing } from '@/app/(public)/_components/brand/brand-listing.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import { BrandTypeEnum } from '@/models/brand.model';

const TRANSLATION_PREFIX = 'brands';

export async function generateMetadata(): Promise<Metadata> {
	const [title, description] = await Promise.all([
		translate(`${TRANSLATION_PREFIX}.meta.title`, {
			app_name: Configuration.get('app.name'),
		}),
		translate(`${TRANSLATION_PREFIX}.meta.description`),
	]);

	return { title, description };
}

export default function Page() {
	return (
		<BrandListing
			type={BrandTypeEnum.PRODUCT}
			translationPrefix={TRANSLATION_PREFIX}
			buildBrandHref={(slug) => Routes.get('products-brand', { slug })}
		/>
	);
}
