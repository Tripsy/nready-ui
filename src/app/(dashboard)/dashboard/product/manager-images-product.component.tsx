'use client';

import { useMemo } from 'react';
import { ManagerImages } from '@/components/manager-images.component';
import { hasPermission } from '@/models/account.model';
import { ImageSectionEnum, ImageTypeEnum } from '@/models/image.model';
import type { ProductModel } from '@/models/product.model';
import { useAuth } from '@/providers/auth.provider';
import { LanguageEnum } from '@/types/common.type';

const IMAGE_TYPES = [ImageTypeEnum.GALLERY];
const LANGUAGES = Object.values(LanguageEnum);

/*
 * Captions are per-language for the same reason the article gallery's are: the images render
 * beside the product's own translated content, so a caption kept only in the default language
 * would break that pairing on every other storefront language.
 */
const ATTRIBUTE_FIELDS = {
	title: 'required' as const,
	description: 'optional' as const,
};

export function ManagerImagesProduct({ entries }: { entries: ProductModel[] }) {
	const { auth } = useAuth();

	const model = entries[0];

	const permissions = useMemo(
		() => ({
			edit: !model.deleted_at && hasPermission(auth, 'product', 'update'),
		}),
		[model.deleted_at, auth],
	);

	return (
		<ManagerImages
			section={ImageSectionEnum.PRODUCT}
			entity_id={model.id}
			types={IMAGE_TYPES}
			permissions={permissions}
			attributeFields={ATTRIBUTE_FIELDS}
			attributeLanguages={LANGUAGES}
		/>
	);
}
