import {
	FormComponentCheckbox,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useWindowForm } from '@/providers/window-form.provider';

/**
 * The moderator's edit. Only the three fields the backend's `update` accepts are here - the scores
 * belong to the buyer and are not editable from the dashboard at all, and the moderation decision
 * is a separate endpoint driven by the status buttons on the table.
 */
export type ReviewFormValuesType = {
	content: string | null;
	is_pinned: boolean;
	is_verified: boolean;
};

export function FormManageReview() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ReviewFormValuesType>();

	const elementIds = useElementIds([
		'content',
		'is_pinned',
		'is_verified',
	] as const);

	return (
		<>
			<FormComponentTextarea<ReviewFormValuesType>
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

			{/* Pinned reviews lead the product's list, whatever the reader sorts by. */}
			<FormComponentCheckbox
				id={elementIds.is_pinned}
				fieldName="is_pinned"
				checked={formValues.is_pinned}
				disabled={pending}
				onCheckedChange={(value) => handleChange('is_pinned', value)}
			>
				Pin to the top of the product's reviews
			</FormComponentCheckbox>

			{/* Nothing sets this on its own - the badge is a claim the dashboard stands behind,
			    so it is checked here after the purchase has been confirmed. */}
			<FormComponentCheckbox
				id={elementIds.is_verified}
				fieldName="is_verified"
				checked={formValues.is_verified}
				disabled={pending}
				onCheckedChange={(value) => handleChange('is_verified', value)}
			>
				Mark the author as a verified buyer
			</FormComponentCheckbox>
		</>
	);
}
