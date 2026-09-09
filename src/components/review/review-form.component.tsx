import { useActionState, useEffect } from 'react';
import {
	FormComponentSubmit,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { reviewAction } from '@/components/review/review.action';
import {
	buildReviewState,
	type ReviewFormValuesType,
	type ReviewSituationType,
	type ReviewTranslations,
	reviewDimensionLabelKey,
	validateFormReview,
} from '@/components/review/review.definition';
import { ReviewStarsInput } from '@/components/review/review-stars.component';
import { createHandleChange } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';
import {
	REVIEW_RATING_DIMENSIONS,
	type ReviewOwnModel,
} from '@/models/review.model';

/**
 * Writing a review, or revising the one this reader already wrote - the same form either way, and
 * `has_own` decides which write the action performs.
 *
 * It never resets itself: `useFormValidation` keeps `submitted` once a submit has happened, so
 * clearing the fields in place would re-validate them as empty and paint a form somebody has just
 * used successfully red. The section remounts it instead, on the `key` it passes.
 */
export function ReviewForm({
	productId,
	variantId,
	own,
	translations,
	onWritten,
	onWithdraw,
	withdrawing,
}: {
	productId: number;
	/** Only when the reader chose it - see `buildReviewState`. */
	variantId: number | null;
	own: ReviewOwnModel | null;
	translations: ReviewTranslations;
	onWritten: () => void;
	onWithdraw: () => void;
	withdrawing: boolean;
}) {
	const [state, action, pending] = useActionState(
		reviewAction,
		buildReviewState(productId, variantId, own),
	);

	const [formValues, setFormValues] = useFormValues<ReviewFormValuesType>(
		state.values,
	);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		ReviewFormValuesType,
		ReviewSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormReview,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds(['content'] as const);

	/*
	 * The "score at least one" refusal belongs to no single field, so the validator files it
	 * under `_global` - which is not a key of the form's own values, hence the read through a
	 * widened record. It is rendered under the star rows, where the reader is looking when it
	 * fires; the form-level `FormError` below only ever says how many fields need attention.
	 */
	const ratingErrors = (errors as Record<string, string[] | undefined>)
		._global;

	useEffect(() => {
		if (formSituation === 'success') {
			onWritten();
		}
	}, [formSituation, onWritten]);

	return (
		<form action={action} onSubmit={markSubmit} className="form-section">
			{/* The request's shape, not the reader's input - see the definition. */}
			<input type="hidden" name="product_id" value={productId} />
			<input
				type="hidden"
				name="variant_id"
				value={formValues.variant_id ?? ''}
			/>
			<input type="hidden" name="has_own" value={own ? '1' : '0'} />

			<div>
				<h4 className="text-sm font-medium">
					{translations['form.rating']}
				</h4>
				<p className="mt-1 text-xs text-muted">
					{translations['form.rating_note']}
				</p>

				{ratingErrors?.length ? (
					<p className="mt-2 text-sm text-danger">
						{ratingErrors[0]}
					</p>
				) : null}

				<div className="mt-3 space-y-2">
					{REVIEW_RATING_DIMENSIONS.map((dimension) => (
						<ReviewStarsInput
							key={dimension}
							name={dimension}
							label={
								translations[reviewDimensionLabelKey(dimension)]
							}
							value={formValues[dimension]}
							disabled={pending || withdrawing}
							clearLabel={translations['form.clear']}
							onChange={(value) => handleChange(dimension, value)}
						/>
					))}
				</div>
			</div>

			<FormComponentTextarea<ReviewFormValuesType>
				labelText={translations['form.content']}
				id={elementIds.content}
				fieldName="content"
				fieldValue={formValues.content ?? ''}
				isRequired={true}
				rows={5}
				placeholderText={translations['form.content_placeholder']}
				disabled={pending || withdrawing}
				onChange={(e) => handleChange('content', e.target.value)}
				error={errors.content}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{
						label: own
							? translations['form.submit_edit']
							: translations['form.submit'],
					}}
				/>

				{/*
				 * Taking a review back is only offered once there is one to take back - and the
				 * section mounts this form only for a review still awaiting moderation, which is
				 * the only state the backend lets an author withdraw from.
				 */}
				{own && (
					<button
						type="button"
						onClick={onWithdraw}
						disabled={pending || withdrawing}
						className="text-sm text-danger hover:underline disabled:opacity-60"
					>
						{translations['form.withdraw']}
					</button>
				)}
			</div>

			{/*
			 * `_global` carries the "score at least one" refusal, which belongs to no single
			 * field - `FormError` is where a message with no field lands.
			 */}
			<FormError
				formSituation={formSituation}
				formMessage={formMessage}
			/>
		</form>
	);
}
