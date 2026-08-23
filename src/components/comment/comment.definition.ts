import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type CommentEntityType,
	CommentEntityTypeEnum,
	type CommentModel,
	CommentStatusEnum,
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
	'thread.show_more',
	'thread.menu',
	'thread.copy_link',
	'thread.copy_link_success',
	'thread.copy_link_failed',
	'thread.report',
	'thread.edit',
	'thread.edit_save',
	'thread.edit_success',
	'thread.edit_failed',
	'thread.edited',
	'thread.delete',
	'thread.delete_title',
	'thread.delete_confirm',
	'thread.delete_success',
	'thread.delete_failed',
	'thread.pin',
	'thread.unpin',
	'thread.pin_success',
	'thread.pin_failed',
	'thread.hide',
	'thread.hide_title',
	'thread.hide_intro',
	'thread.hide_rejected',
	'thread.hide_spam',
	'thread.hide_reason',
	'thread.hide_reason_note',
	'thread.hide_reason_long',
	'thread.hide_submit',
	'thread.hide_success',
	'thread.hide_failed',
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
 * The fragment one comment is addressed by, and the shape a link to it carries.
 *
 * A reply names its parent as well as itself (`comment-<parent>-<id>`), because a reply is not on
 * the page until its thread is opened: the parent is what tells the thread which list to unroll
 * before the target exists to scroll to. A root needs only its own id.
 */
export const commentAnchorId = (entry: {
	id: number;
	parent_id: number | null;
}): string =>
	entry.parent_id
		? `comment-${entry.parent_id}-${entry.id}`
		: `comment-${entry.id}`;

export type CommentAnchorType = {
	/** The thread to open first; null when the target is a root comment. */
	parentId: number | null;
	id: number;
};

/**
 * Reads back what `commentAnchorId` wrote, from a `location.hash` (with or without its `#`).
 * Anything else on the page's fragment — another component's anchor, a stale link — resolves to
 * null rather than to a comment id nobody meant.
 */
export function parseCommentAnchor(hash: string): CommentAnchorType | null {
	const match = /^#?comment-(\d+)(?:-(\d+))?$/.exec(hash);

	if (!match) {
		return null;
	}

	const [, first, second] = match;

	return second
		? { parentId: Number(first), id: Number(second) }
		: { parentId: null, id: Number(first) };
}

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

/**
 * What this reader may do to this comment — resolved in one place so the menu, the inline editor
 * and the thread cannot disagree about it.
 *
 * Everything here decides what to **offer**. The backend gates each endpoint on its own (the
 * public writes by narrowing to the caller's own rows, the moderation ones by permission), so a
 * menu that offers too much produces a 403 or a 404 rather than a write nobody was entitled to.
 *
 * **A guest never gets these controls, including on their own comment.** The backend matches a
 * guest's edit by the hash of their origin address, which this app cannot compute and would not be
 * allowed to see — there is nothing on a rendered comment that identifies its guest author to the
 * browser. Their route back to it is the same one the backend offers: the public endpoints, from a
 * client that knows the id.
 */
export type CommentAbilitiesType = {
	/** The signed-in reader wrote this one. */
	isOwn: boolean;
	canEdit: boolean;
	canDelete: boolean;
	/** Pin and hide — staff only, never something an author does to their own comment. */
	canModerate: boolean;
};

export function resolveCommentAbilities(
	auth: AuthModel | null,
	entry: Pick<CommentModel, 'user_id'>,
): CommentAbilitiesType {
	const isOwn = Boolean(
		auth?.id && entry.user_id !== null && entry.user_id === auth.id,
	);

	const canModerate = hasPermission(auth, 'comment', 'update');

	return {
		isOwn: isOwn,
		canEdit: isOwn || canModerate,
		canDelete: isOwn || hasPermission(auth, 'comment', 'delete'),
		canModerate: canModerate,
	};
}

/**
 * The two ways a moderator takes a comment off the page from the thread itself. Both are reachable
 * from `approved`, which is the only status a public read returns — so this list needs no lookup
 * against `COMMENT_STATUS_TRANSITIONS`.
 *
 * `flagged` is deliberately absent: it is what the automatic reporting threshold sets, not a
 * decision somebody takes.
 */
export const COMMENT_HIDE_STATUSES = [
	CommentStatusEnum.REJECTED,
	CommentStatusEnum.SPAM,
] as const;

export const commentHideLabelKey = (
	status: (typeof COMMENT_HIDE_STATUSES)[number],
): 'thread.hide_rejected' | 'thread.hide_spam' =>
	status === CommentStatusEnum.REJECTED
		? 'thread.hide_rejected'
		: 'thread.hide_spam';

/** The same bounds the backend holds; looser here would turn a 422 into a field nobody can fix. */
export const COMMENT_CONTENT_MIN = 2;
export const COMMENT_CONTENT_MAX = 5000;

/**
 * How much of a comment a thread shows before folding the rest behind "… more".
 *
 * A thread is read by skimming, and one long comment among short ones costs every comment below it
 * a scroll. Well short of `COMMENT_CONTENT_MAX`, which is what somebody may *write*.
 */
export const COMMENT_EXCERPT_LENGTH = 350;

/**
 * How far back the fold may reach to land between words. A word boundary is worth a few characters,
 * not a paragraph: one long token — a URL, a pasted key — sitting just inside the limit would
 * otherwise pull the cut back to the whitespace before it and show a fraction of what fits.
 */
const WORD_BOUNDARY_SLACK = 80;

/**
 * The part of a long comment shown while it is folded, or null when the whole thing fits and there
 * is nothing to fold.
 *
 * Cut back to the last whitespace inside the limit so the fold lands between words rather than
 * mid-word — but only within `WORD_BOUNDARY_SLACK`. Beyond that, and when there is no whitespace to
 * cut back to at all, the hard limit is what is shown.
 */
export function buildCommentExcerpt(content: string): string | null {
	if (content.length <= COMMENT_EXCERPT_LENGTH) {
		return null;
	}

	const slice = content.slice(0, COMMENT_EXCERPT_LENGTH);
	const trimmed = slice.replace(/\s+\S*$/, '');

	const excerpt =
		trimmed.length >= COMMENT_EXCERPT_LENGTH - WORD_BOUNDARY_SLACK
			? trimmed
			: slice;

	return excerpt.trimEnd();
}

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
