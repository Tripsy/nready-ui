import { Configuration } from '@/config/settings.config';
import { capitalizeFirstLetter } from '@/helpers/string.helper';
import type { Language } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

export const BrandStatusEnum = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
} as const;

export type BrandStatus =
	(typeof BrandStatusEnum)[keyof typeof BrandStatusEnum];

export const BrandTypeEnum = {
	VEHICLE: 'vehicle',
	PRODUCT: 'product',
} as const;

export const BRAND_DEFAULT_TYPE = BrandTypeEnum.PRODUCT;

export type BrandType = (typeof BrandTypeEnum)[keyof typeof BrandTypeEnum];

export type BrandContentType = {
	language: Language;
	description: string | null;
	meta: PageMeta;
};

// Full brand model with relations
export type BrandModel<D = Date | string> = {
	id: number;
	name: string;
	slug: string;
	status: BrandStatus;
	brand_type: BrandType;
	sort_order: number;
	details: Record<string, string | number | boolean> | null;

	// Timestamps
	created_at: D;
	updated_at: D;
	deleted_at: D;

	// Content translations
	contents?: BrandContentType[];
};

// Helpers
export function getBrandDescription(
	brand: BrandModel,
	language: Language,
): string {
	if (!brand.contents) {
		return '[empty description]';
	}

	const contentSelected = brand.contents.find((c) => c.language === language);

	if (contentSelected?.description) {
		return contentSelected.description;
	}

	const contentDefault = brand.contents.find(
		(c) => c.language === Configuration.defaultLanguage(),
	);

	if (contentDefault?.description) {
		return contentDefault.description;
	}

	const contentFirst = brand.contents[0];

	if (contentFirst?.description) {
		return contentFirst.description;
	}

	return '[empty description]';
}

export const displayBrandLabel = (m: BrandModel) => {
	return `${capitalizeFirstLetter(m.brand_type)} / ${m.name}`;
};
