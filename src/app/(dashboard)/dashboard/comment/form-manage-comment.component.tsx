import {
	FormComponentCheckbox,
	FormComponentRadio,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { type CommentType, CommentTypeEnum } from '@/models/comment.model';
import { useWindowForm } from '@/providers/window-form.provider';

/**
 * The moderator's edit. Only the three fields the backend's `update` accepts are here — the
 * moderation decision itself is a separate endpoint, driven by the status buttons on the table.
 */
export type CommentFormValuesType = {
	content: string | null;
	type: CommentType;
	is_pinned: boolean;
};

const commentTypes = toOptionsFromEnum(CommentTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageComment() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<CommentFormValuesType>();

	const elementIds = useElementIds(['content', 'type', 'is_pinned'] as const);

	return (
		<>
			<FormComponentTextarea<CommentFormValuesType>
				labelText="Content"
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
				labelText="Type"
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
				Pin to the top of the thread
			</FormComponentCheckbox>
		</>
	);
}
