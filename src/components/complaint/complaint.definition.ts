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
	type ComplaintEntityType,
	ComplaintEntityTypeEnum,
	type ComplaintReason,
	ComplaintReasonEnum,
} from '@/models/complaint.model';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

/**
 * The report widget is entity-agnostic: an article renders it today, a comment renders the same
 * one next. Everything that differs is a prop - the target and which reasons are offered - so the
 * copy lives in the `complaint` namespace, beside the dashboard's, rather than in the host page's.
 */
export const COMPLAINT_TRANSLATION_PREFIX = 'complaint';

export const COMPLAINT_TRANSLATION_KEYS = [
	'report.action',
	'report.reported',
	'report.title',
	'report.intro',
	'report.reason',
	'report.details',
	'report.details_placeholder',
	'report.submit',
	'report.update',
	'report.success',
	'report.failed',
	'report.resolved',
	'report.withdraw',
	'report.withdraw_success',
	'report.withdraw_failed',
	'report.guest',
	'report.sign_in',
	'report.close',
	// Every reason the backend knows, so any host can offer whichever subset applies to it.
	'reason.spam',
	'reason.offensive',
	'reason.harassment',
	'reason.hate_speech',
	'reason.misinformation',
	'reason.ai_slop',
	'reason.copyright',
	'validation.invalid_reason',
	'validation.invalid_description',
] as const;

export type ComplaintTranslations = Record<
	(typeof COMPLAINT_TRANSLATION_KEYS)[number],
	string
>;

/** The translation key each reason is labeled by, so a host maps a subset without a switch. */
export const complaintReasonLabelKey = (
	reason: ComplaintReason,
): keyof ComplaintTranslations =>
	`reason.${reason}` as keyof ComplaintTranslations;

/**
 * What an article may be reported for. A subset of the backend enum on purpose: the other reasons
 * describe what somebody wrote *about* an article - spam, abuse - and belong to the comment target.
 * Presentation only; the backend accepts any of its seven, and the validator below mirrors that.
 */
export const COMPLAINT_ARTICLE_REASONS: readonly ComplaintReason[] = [
	ComplaintReasonEnum.MISINFORMATION,
	ComplaintReasonEnum.AI_SLOP,
	ComplaintReasonEnum.COPYRIGHT,
];

/**
 * What a comment may be reported for - the other half of the enum. These describe what somebody
 * wrote rather than what an article claims, so `ai_slop` and `copyright` are left to the article:
 * a reader disputing a comment's honesty reports it as misinformation, which is the same charge.
 */
export const COMPLAINT_COMMENT_REASONS: readonly ComplaintReason[] = [
	ComplaintReasonEnum.SPAM,
	ComplaintReasonEnum.OFFENSIVE,
	ComplaintReasonEnum.HARASSMENT,
	ComplaintReasonEnum.HATE_SPEECH,
	ComplaintReasonEnum.AI_SLOP,
	ComplaintReasonEnum.MISINFORMATION,
];

/**
 * `entity_type`, `entity_id` and `has_own` are carried as hidden fields rather than as component
 * props: the submit goes through `processForm`, which reads everything it sends out of the
 * `FormData`.
 *
 * `has_own` says whether this reader already holds a live complaint on the target, which decides
 * whether the action files one or amends it - the backend refuses the wrong one (409 on a second
 * filing, 404 on amending nothing).
 */
export type ComplaintFormValuesType = {
	entity_type: ComplaintEntityType | null;
	entity_id: number | null;
	has_own: boolean;
	reason: ComplaintReason | null;
	description: string | null;
};

export type ComplaintSituationType = FormSituationType;

export type ComplaintStateType = {
	values: ComplaintFormValuesType;
	errors: FormErrorsType<ComplaintFormValuesType>;
	message: string | null;
	situation: ComplaintSituationType;
};

export function buildComplaintState(
	entityType: ComplaintEntityType,
	entityId: number,
	own: { reason: ComplaintReason; description: string | null } | null,
): ComplaintStateType {
	return {
		values: {
			entity_type: entityType,
			entity_id: entityId,
			has_own: own !== null,
			reason: own?.reason ?? null,
			description: own?.description ?? '',
		},
		errors: {},
		message: null,
		situation: null,
	};
}

/** The same bounds the backend holds; looser here would turn a 422 into a field nobody can fix. */
export const COMPLAINT_DESCRIPTION_MIN = 2;
export const COMPLAINT_DESCRIPTION_MAX = 2000;

const validatorMessages = ['invalid_reason', 'invalid_description'] as const;

class ComplaintValidator extends BaseValidator<typeof validatorMessages> {
	/**
	 * The target and which write applies are validated as shapes rather than through
	 * `getMessage`: no input reaches them, so a failure here is a tampered payload, not something
	 * to word for a reader. `processForm` compares the parsed result against the whole
	 * form-values type, which is why they have to be part of the schema rather than stripped.
	 */
	report = z.object({
		entity_type: z.enum(ComplaintEntityTypeEnum).nullable(),
		entity_id: z.number().nullable(),
		has_own: z.boolean(),

		reason: this.validateEnum(
			ComplaintReasonEnum,
			this.getMessage('invalid_reason'),
		),

		// Optional on both sides: the reason alone is a complete report, and a required
		// free-text field is one people fill with a full stop.
		description: this.validateString(
			{
				invalid: this.getMessage('invalid_description'),
				min_chars: this.getMessage('invalid_description'),
				max_chars: this.getMessage('invalid_description'),
			},
			{
				required: false,
				minChars: COMPLAINT_DESCRIPTION_MIN,
				maxChars: COMPLAINT_DESCRIPTION_MAX,
			},
		),
	});
}

export async function validateFormComplaint(values: ComplaintFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		`${COMPLAINT_TRANSLATION_PREFIX}.validation`,
	);

	return new ComplaintValidator(translations).report.safeParse(values);
}

export function getComplaintFormValues(
	formData: FormData,
): ComplaintFormValuesType {
	return {
		entity_type: getFormDataAsEnum(
			formData,
			'entity_type',
			ComplaintEntityTypeEnum,
		),
		entity_id: getFormDataAsNumber(formData, 'entity_id'),
		has_own: getFormDataAsBoolean(formData, 'has_own'),
		reason: getFormDataAsEnum(formData, 'reason', ComplaintReasonEnum),
		description: getFormDataAsString(formData, 'description'),
	};
}
