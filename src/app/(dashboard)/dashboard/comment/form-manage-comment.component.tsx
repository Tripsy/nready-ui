'use client';

import { useMemo } from 'react';
import {
	FormComponentCheckbox,
	FormComponentRadio,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type CommentType, CommentTypeEnum } from '@/models/comment.model';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'comment.field.content',
	'comment.text.pin_to_top',
	'comment.field.type',
	...enumTranslationKeys('comment.enum.type', CommentTypeEnum),
] as const;

/**
 * The moderator's edit. Only the three fields the backend's `update` accepts are here - the
 * moderation decision itself is a separate endpoint, driven by the status buttons on the table.
 */
export type CommentFormValuesType = {
	content: string | null;
	type: CommentType;
	is_pinned: boolean;
};

export function FormManageComment() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const commentTypes = useMemo(
		() =>
			toOptionsFromEnum(CommentTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'comment.enum.type',
						value,
					),
			}),
		[translations],
	);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<CommentFormValuesType>();

	const elementIds = useElementIds(['content', 'type', 'is_pinned'] as const);

	return (
		<>
			<FormComponentTextarea<CommentFormValuesType>
				labelText={translations['comment.field.content']}
				id={elementIds.content}
				fieldName="content"
				fieldValue={formValues.content ?? ''}
				isRequired={true}
				rows={8}
				disabled={pending}
				onChange={(e) => handleChange('content', e.target.value)}
				error={errors.content}
			/>

			<FormComponentRadio<CommentFormValuesType>
				labelText={translations['comment.field.type']}
				id={elementIds.type}
				fieldName="type"
				fieldValue={formValues.type}
				options={commentTypes}
				disabled={pending}
				onChange={(value) => handleChange('type', value as CommentType)}
				error={errors.type}
			/>

			{/* Pinned comments lead their thread page, whatever the ordering. */}
			<FormComponentCheckbox
				id={elementIds.is_pinned}
				fieldName="is_pinned"
				checked={formValues.is_pinned}
				disabled={pending}
				onCheckedChange={(value) => handleChange('is_pinned', value)}
			>
				{translations['comment.text.pin_to_top']}
			</FormComponentCheckbox>
		</>
	);
}
