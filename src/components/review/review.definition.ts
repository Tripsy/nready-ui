import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import {
	REVIEW_RATING_DIMENSIONS,
	REVIEW_RATING_MAX,
	REVIEW_RATING_MIN,
	type ReviewOwnModel,
	type ReviewRating,
	type ReviewRatingDimension,
} from '@/models/review.model';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

/**
 * The storefront review section's copy. It lives in the `review` namespace beside the dashboard's,
 * the way the comment and report widgets do, and not in the product page's - the section is about
 * reviews wherever it is hosted.
 *
 * This module is deliberately **not** `'use client'`: a client module's value exports are client
 * references by the time a server component reads them, so the key tuple below would not be
 * iterable. The page batches these and passes the result down.
 */
export const REVIEW_TRANSLATION_PREFIX = 'review';

export const REVIEW_TRANSLATION_KEYS = [
	'section.heading',
	'section.empty',
	'section.unavailable',
	'section.load_more',
	'section.loading',
	'section.count',
	'section.verified',
	'section.pinned',
	'section.variant',
	'section.no_score',
	'section.average_of',
	'section.your_review',
	'section.pending_note',
	'section.approved_note',
	'section.rejected_note',
	'form.heading',
	'form.heading_edit',
	'form.rating',
	'form.rating_note',
	'form.content',
	'form.content_placeholder',
	'form.submit',
	'form.submit_edit',
	'form.withdraw',
	'form.withdraw_confirm',
	'form.withdraw_success',
	'form.withdraw_failed',
	'form.success',
	'form.success_edit',
	'form.failed',
	'form.guest',
	'form.sign_in',
	'form.clear',
	'dimension.quality',
	'dimension.price',
	'dimension.service',
	'dimension.delivery',
	'validation.invalid_rating',
	'validation.invalid_rating_empty',
	'validation.invalid_content',
] as const;

export type ReviewTranslations = Record<
	(typeof REVIEW_TRANSLATION_KEYS)[number],
	string
>;

/** The translation key each dimension is labeled by, so a caller maps the list without a switch. */
export const reviewDimensionLabelKey = (
	dimension: ReviewRatingDimension,
): keyof ReviewTranslations =>
	`dimension.${dimension}` as keyof ReviewTranslations;

/** The same bounds the backend holds; looser here would turn a 422 into a field nobody can fix. */
export const REVIEW_CONTENT_MIN = 10;
export const REVIEW_CONTENT_MAX = 5000;

/**
 * `product_id`, `variant_id` and `has_own` ride as hidden fields rather than as component props:
 * the submit goes through `processForm`, which reads everything it sends out of the `FormData`.
 *
 * `has_own` says whether this reader already holds a review of this product, which decides whether
 * the action writes one or revises it - the backend refuses the wrong one (409 on a second review,
 * 404 on revising nothing), so the branch is not cosmetic.
 *
 * The four scores are separate fields rather than one object, because that is what a form can
 * carry. `reviewRatingFromValues` folds them back into the `rating` the API takes.
 */
export type ReviewFormValuesType = {
	product_id: number | null;
	variant_id: number | null;
	has_own: boolean;
	quality: number | null;
	price: number | null;
	service: number | null;
	delivery: number | null;
	content: string | null;
};

export type ReviewSituationType = FormSituationType;

export type ReviewStateType = {
	values: ReviewFormValuesType;
	errors: FormErrorsType<ReviewFormValuesType>;
	message: string | null;
	situation: ReviewSituationType;
};

/**
 * @param variantId - the variant the reader is looking at, and only when they chose it: a product
 * page opened without one has a variant *selected* for display, which is not the same as the
 * buyer saying which they bought.
 */
export function buildReviewState(
	productId: number,
	variantId: number | null,
	own: ReviewOwnModel | null,
): ReviewStateType {
	return {
		values: {
			product_id: productId,
			variant_id: own?.variant_id ?? variantId,
			has_own: own !== null,
			quality: own?.rating?.quality ?? null,
			price: own?.rating?.price ?? null,
			service: own?.rating?.service ?? null,
			delivery: own?.rating?.delivery ?? null,
			content: own?.content ?? '',
		},
		errors: {},
		message: null,
		situation: null,
	};
}

/**
 * The scores as the API takes them: an object holding only the dimensions that were actually
 * scored. A dimension left blank is an absent key rather than a zero - the average is over what
 * was given, and a zero would both drag it down and fail the backend's range check.
 */
export function reviewRatingFromValues(
	values: ReviewFormValuesType,
): ReviewRating {
	const rating: ReviewRating = {};

	for (const dimension of REVIEW_RATING_DIMENSIONS) {
		const score = values[dimension];

		if (typeof score === 'number') {
			rating[dimension] = score;
		}
	}

	return rating;
}

const validatorMessages = [
	'invalid_rating',
	'invalid_rating_empty',
	'invalid_content',
] as const;

class ReviewValidator extends BaseValidator<typeof validatorMessages> {
	/** One score, out of 5 and whole - the range `CHK_review_rating` holds on the backend. */
	private score() {
		const message = this.getMessage('invalid_rating');

		return this.validateNumber(
			{ invalid: message, only_positive: message, no_decimals: message },
			{ required: false, onlyPositive: true, allowDecimals: 0 },
		)
			.refine(
				(value) =>
					value === undefined ||
					value === null ||
					(value >= REVIEW_RATING_MIN && value <= REVIEW_RATING_MAX),
				{ message: message },
			)
			.nullable();
	}

	/**
	 * The target and which write applies are validated as shapes rather than through `getMessage`:
	 * no input reaches them, so a failure there is a tampered payload, not something to word for a
	 * reader. `processForm` compares the parsed result against the whole form-values type, which is
	 * why they have to be in the schema rather than stripped.
	 *
	 * At least one score is required - the other half of the backend's own constraint - and the
	 * message is attached to `_global`, since no single field is the one at fault.
	 */
	manage = z
		.object({
			product_id: z.number().nullable(),
			variant_id: z.number().nullable(),
			has_own: z.boolean(),

			quality: this.score(),
			price: this.score(),
			service: this.score(),
			delivery: this.score(),

			content: this.validateString(
				{
					invalid: this.getMessage('invalid_content'),
					min_chars: this.getMessage('invalid_content'),
					max_chars: this.getMessage('invalid_content'),
				},
				{
					minChars: REVIEW_CONTENT_MIN,
					maxChars: REVIEW_CONTENT_MAX,
				},
			),
		})
		.refine(
			(values) =>
				REVIEW_RATING_DIMENSIONS.some(
					(dimension) => typeof values[dimension] === 'number',
				),
			{
				message: this.getMessage('invalid_rating_empty'),
				path: ['_global'],
			},
		);
}

export async function validateFormReview(values: ReviewFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		`${REVIEW_TRANSLATION_PREFIX}.validation`,
	);

	return new ReviewValidator(translations).manage.safeParse(values);
}

export function getReviewFormValues(formData: FormData): ReviewFormValuesType {
	return {
		product_id: getFormDataAsNumber(formData, 'product_id'),
		variant_id: getFormDataAsNumber(formData, 'variant_id'),
		has_own: getFormDataAsBoolean(formData, 'has_own'),
		quality: getFormDataAsNumber(formData, 'quality'),
		price: getFormDataAsNumber(formData, 'price'),
		service: getFormDataAsNumber(formData, 'service'),
		delivery: getFormDataAsNumber(formData, 'delivery'),
		content: getFormDataAsString(formData, 'content'),
	};
}
