'use client';

import { useMemo } from 'react';
import { ManagerImages } from '@/components/manager-images.component';
import { hasPermission } from '@/models/account.model';
import type { ArticleModel } from '@/models/article.model';
import { ImageSectionEnum, ImageTypeEnum } from '@/models/image.model';
import { useAuth } from '@/providers/auth.provider';
import { LanguageEnum } from '@/types/common.type';

const IMAGE_TYPES = [ImageTypeEnum.GALLERY];
const LANGUAGES = Object.values(LanguageEnum);

/*
 * Captions are per-language because the gallery renders alongside the article content, which is
 * itself translated — an image kept only in the default language would break that pairing.
 */
const ATTRIBUTE_FIELDS = {
	title: 'required' as const,
	description: 'optional' as const,
};

export function ManagerArticleImages({ entries }: { entries: ArticleModel[] }) {
	const { auth } = useAuth();

	const model = entries[0];

	const permissions = useMemo(
		() => ({
			edit: !model.deleted_at && hasPermission(auth, 'article', 'update'),
		}),
		[model.deleted_at, auth],
	);

	return (
		<ManagerImages
			section={ImageSectionEnum.ARTICLE}
			entity_id={model.id}
			types={IMAGE_TYPES}
			permissions={permissions}
			attributeFields={ATTRIBUTE_FIELDS}
			attributeLanguages={LANGUAGES}
		/>
	);
}
