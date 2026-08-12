'use client';

import { useMemo } from 'react';
import { ManagerImages } from '@/components/manager-images.component';
import { arrayHasValue } from '@/helpers/objects.helper';
import { hasPermission } from '@/models/auth.model';
import { type CmrModel, CmrStatusEnum } from '@/models/cmr.model';
import { ImageSectionEnum, ImageTypeEnum } from '@/models/image.model';
import { useAuth } from '@/providers/auth.provider';
import { LanguageEnum } from '@/types/common.type';

const IMAGE_TYPES = [ImageTypeEnum.GALLERY];
const LANGUAGES = Object.values(LanguageEnum);

export function ManagerCmrImages({ entries }: { entries: CmrModel[] }) {
	const { auth } = useAuth();

	const model = entries[0];

	const permissions = useMemo(() => {
		const canEdit =
			arrayHasValue(model.status, [
				CmrStatusEnum.ORDERED,
				CmrStatusEnum.PREPARING,
				CmrStatusEnum.TRANSIT,
			]) && hasPermission(auth, 'cmr', 'update');

		return {
			edit: canEdit,
		};
	}, [model.status, auth]);

	const attributeFields = useMemo(() => {
		return {
			title: 'required' as const,
			description: 'required' as const,
		};
	}, []);

	return (
		<ManagerImages
			section={ImageSectionEnum.CMR}
			entity_id={model.id}
			types={IMAGE_TYPES}
			permissions={permissions}
			attributeFields={attributeFields}
			attributeLanguages={LANGUAGES}
		/>
	);
}
