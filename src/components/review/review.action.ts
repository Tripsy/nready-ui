import {
	getReviewFormValues,
	type ReviewFormValuesType,
	type ReviewStateType,
	reviewRatingFromValues,
	validateFormReview,
} from '@/components/review/review.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import {
	requestCreateReview,
	requestUpdateOwnReview,
} from '@/services/review.service';

/**
 * One submit, two possible writes - which one depends on whether the reader already holds a review
 * of this product, and the backend refuses the wrong one (409 on a second review, 404 on revising
 * nothing), so the branch is not cosmetic.
 *
 * `variant_id` is sent on the first write only. It says which variant the reviewer received, and a
 * revision is not the moment to change that: the text may be rewritten, what was bought cannot.
 */
async function writeReviewOperation(values: ReviewFormValuesType) {
	const productId = values.product_id as number;
	const rating = reviewRatingFromValues(values);
	const content = values.content as string;

	if (values.has_own) {
		return requestUpdateOwnReview(productId, {
			rating: rating,
			content: content,
		});
	}

	return requestCreateReview({
		product_id: productId,
		...(values.variant_id ? { variant_id: values.variant_id } : {}),
		rating: rating,
		content: content,
	});
}

export async function reviewAction(
	formState: ReviewStateType,
	formData: FormData,
): Promise<ReviewStateType> {
	return processForm(formState, formData, {
		getFormValues: getReviewFormValues,
		validateForm: validateFormReview,
		operationFunction: writeReviewOperation,
		fallbackErrorKey: 'review.form.failed',
		mapApiError: async (error) => {
			switch (error.status) {
				/*
				 * The backend's own wording, and it is worth showing verbatim: a 400 says the
				 * variant does not belong to this product, a 403 that a moderator has decided on
				 * this review while the form was open - so it is no longer the author's to change
				 * - and a 409 that one was written while this form was open. None of the three is
				 * something the form's own copy could distinguish.
				 */
				case 400:
				case 403:
				case 409:
					return { message: error.message };
				// Ahead of `error.message`: the throttler's body is resolved in the backend's
				// language, not the one this page is rendered in.
				case 429:
					return {
						message: await translate('app.error.rate_limited'),
					};
				default:
					return {};
			}
		},
	});
}
