import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import {
	type CommentEntityType,
	CommentEntityTypeEnum,
} from '@/models/comment.model';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

/**
 * The comments section is entity-agnostic: an article renders it today, a review will render the
 * same one. Everything that differs is a prop — the target — so the copy below lives in the
 * `comment` namespace rather than in the host page's, and every host resolves the same keys.
 */
export const COMMENT_TRANSLATION_PREFIX = 'comment';

export const COMMENT_TRANSLATION_KEYS = [
	'thread.heading',
	'thread.empty',
	'thread.unavailable',
	'thread.load_more',
	'thread.loading',
	'thread.guest',
	'thread.staff',
	'thread.pinned',
	'thread.replies',
	'thread.see_replies',
	'thread.collapse_replies',
	'thread.reply',
	'thread.reply_to',
	'thread.cancel',
	'form.heading',
	'form.content_placeholder',
	'form.guest_name',
	'form.guest_email',
	'form.guest_email_note',
	'form.guest_website',
	'form.submit',
	'form.success',
	'form.write_another',
	'form.failed',
	'validation.invalid_content',
	'validation.invalid_guest_name',
	'validation.invalid_guest_email',
	'validation.invalid_guest_website',
] as const;

export type CommentTranslations = Record<
	(typeof COMMENT_TRANSLATION_KEYS)[number],
	string
>;

/**
 * `entity_type`, `entity_id` and `parent_id` are carried as hidden fields rather than as component
 * props: the submit goes through `processForm`, which reads everything it sends out of the
 * `FormData`.
 *
 * `requires_guest` is the same — it says whether this visitor has an account, which decides
 * whether the name and email below are required. It is not a claim the backend trusts: it reads
 * the session itself and ignores the guest fields for a member.
 */
export type CommentFormValuesType = {
	entity_type: CommentEntityType | null;
	entity_id: number | null;
	parent_id: number | null;
	requires_guest: boolean;
	content: string | null;
	guest_name: string | null;
	guest_email: string | null;
	guest_website: string | null;
};

export type CommentSituationType = FormSituationType;

export type CommentStateType = {
	values: CommentFormValuesType;
	errors: FormErrorsType<CommentFormValuesType>;
	message: string | null;
	situation: CommentSituationType;
};

export function buildCommentState(
	entityType: CommentEntityType,
	entityId: number,
	parentId: number | null,
	requiresGuest: boolean,
): CommentStateType {
	return {
		values: {
			entity_type: entityType,
			entity_id: entityId,
			parent_id: parentId,
			requires_guest: requiresGuest,
			content: '',
			guest_name: '',
			guest_email: '',
			guest_website: '',
		},
		errors: {},
		message: null,
		situation: null,
	};
}

/** The same bounds the backend holds; looser here would turn a 422 into a field nobody can fix. */
export const COMMENT_CONTENT_MIN = 2;
export const COMMENT_CONTENT_MAX = 5000;
const GUEST_NAME_MIN = 2;
const GUEST_NAME_MAX = 100;
const GUEST_WEBSITE_MAX = 255;

const validatorMessages = [
	'invalid_content',
	'invalid_guest_name',
	'invalid_guest_email',
	'invalid_guest_website',
] as const;

class CommentValidator extends BaseValidator<typeof validatorMessages> {
	private content() {
		return this.validateString(
			{
				invalid: this.getMessage('invalid_content'),
				min_chars: this.getMessage('invalid_content'),
				max_chars: this.getMessage('invalid_content'),
			},
			{ minChars: COMMENT_CONTENT_MIN, maxChars: COMMENT_CONTENT_MAX },
		);
	}

	private website() {
		return this.validateString(
			{
				invalid: this.getMessage('invalid_guest_website'),
				max_chars: this.getMessage('invalid_guest_website'),
			},
			{ required: false, maxChars: GUEST_WEBSITE_MAX },
		);
	}

	/**
	 * The fields the form carries but nobody types — the target, the parent and which of the two
	 * schemas below applies. They are validated as shapes rather than through `getMessage`: no
	 * input reaches them, so a failure here is a tampered payload, not something to word for a
	 * reader. `processForm` compares the parsed result against the whole form-values type, which
	 * is why they have to be part of each schema rather than stripped.
	 */
	private structural() {
		return {
			entity_type: z.enum(CommentEntityTypeEnum).nullable(),
			entity_id: z.number().nullable(),
			parent_id: z.number().nullable(),
			requires_guest: z.boolean(),
		};
	}

	/** A signed-in reader is identified by their session; the guest fields are not theirs to fill. */
	member = z.object({
		...this.structural(),
		content: this.content(),
		guest_name: z.string().nullable(),
		guest_email: z.string().nullable(),
		guest_website: this.website(),
	});

	/**
	 * `CHK_comment_author` requires a guest to leave a name and an address, so both are required
	 * here — the backend answers 400 otherwise, which is a worse way to learn it.
	 */
	guest = z.object({
		...this.structural(),
		content: this.content(),
		guest_name: this.validateString(
			{
				invalid: this.getMessage('invalid_guest_name'),
				min_chars: this.getMessage('invalid_guest_name'),
				max_chars: this.getMessage('invalid_guest_name'),
			},
			{ minChars: GUEST_NAME_MIN, maxChars: GUEST_NAME_MAX },
		),
		guest_email: this.validateEmail(this.getMessage('invalid_guest_email')),
		guest_website: this.website(),
	});
}

export async function validateFormComment(values: CommentFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		`${COMMENT_TRANSLATION_PREFIX}.validation`,
	);

	const validator = new CommentValidator(translations);

	return values.requires_guest
		? validator.guest.safeParse(values)
		: validator.member.safeParse(values);
}

export function getCommentFormValues(
	formData: FormData,
): CommentFormValuesType {
	return {
		entity_type: getFormDataAsEnum(
			formData,
			'entity_type',
			CommentEntityTypeEnum,
		),
		entity_id: getFormDataAsNumber(formData, 'entity_id'),
		// A root comment submits the field empty, which `getFormDataAsNumber` reads as null.
		parent_id: getFormDataAsNumber(formData, 'parent_id'),
		requires_guest: getFormDataAsBoolean(formData, 'requires_guest'),
		content: getFormDataAsString(formData, 'content'),
		guest_name: getFormDataAsString(formData, 'guest_name'),
		guest_email: getFormDataAsString(formData, 'guest_email'),
		guest_website: getFormDataAsString(formData, 'guest_website'),
	};
}
