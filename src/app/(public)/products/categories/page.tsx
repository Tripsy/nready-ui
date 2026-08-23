import type { Metadata } from 'next';
import { CategoryListing } from '@/app/(public)/_components/category/category-listing.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import { CategoryTypeEnum } from '@/models/category.model';

const TRANSLATION_PREFIX = 'categories';

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
		<CategoryListing
			type={CategoryTypeEnum.PRODUCT}
			translationPrefix={TRANSLATION_PREFIX}
		/>
	);
}
