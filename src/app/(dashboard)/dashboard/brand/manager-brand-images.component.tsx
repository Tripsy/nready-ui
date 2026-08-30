'use client';

import { useMemo } from 'react';
import { ManagerImages } from '@/components/manager-images.component';
import { hasPermission } from '@/models/account.model';
import type { BrandModel } from '@/models/brand.model';
import { ImageSectionEnum, ImageTypeEnum } from '@/models/image.model';
import { useAuth } from '@/providers/auth.provider';
import { LanguageEnum } from '@/types/common.type';

/* A brand carries a single logo — no gallery, so the manager renders only the logo slot. */
const IMAGE_TYPES = [ImageTypeEnum.LOGO];
const LANGUAGES = Object.values(LanguageEnum);

/* `title` is the logo's alt text; it follows the brand's own translated content. */
const ATTRIBUTE_FIELDS = {
	title: 'required' as const,
};

export function ManagerBrandImages({ entries }: { entries: BrandModel[] }) {
	const { auth } = useAuth();

	const model = entries[0];

	const permissions = useMemo(
		() => ({
			edit: !model.deleted_at && hasPermission(auth, 'brand', 'update'),
		}),
		[model.deleted_at, auth],
	);

	return (
		<ManagerImages
			section={ImageSectionEnum.BRAND}
			entity_id={model.id}
			types={IMAGE_TYPES}
			permissions={permissions}
			attributeFields={ATTRIBUTE_FIELDS}
			attributeLanguages={LANGUAGES}
		/>
	);
}
