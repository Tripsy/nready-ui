import {
	type ComplaintFormValuesType,
	type ComplaintStateType,
	getComplaintFormValues,
	validateFormComplaint,
} from '@/components/complaint/complaint.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import type {
	ComplaintEntityType,
	ComplaintReason,
} from '@/models/complaint.model';
import {
	requestCreateComplaint,
	requestUpdateComplaint,
} from '@/services/complaint.service';

/**
 * One submit, two possible writes - which one depends on whether the reader already holds a live
 * complaint on this target, and the backend refuses the wrong one (409 on a second filing, 404 on
 * amending nothing), so the branch is not cosmetic.
 *
 * An empty description is omitted rather than sent: the backend takes the field as optional and
 * leaves what it does not receive untouched, so a reader amending their report keeps the text they
 * wrote unless they replace it.
 */
async function reportComplaintOperation(values: ComplaintFormValuesType) {
	const entityType = values.entity_type as ComplaintEntityType;
	const entityId = values.entity_id as number;
	const reason = values.reason as ComplaintReason;
	const description = values.description || undefined;

	if (values.has_own) {
		return requestUpdateComplaint(entityType, entityId, {
			reason,
			description,
		});
	}

	return requestCreateComplaint({
		entity_type: entityType,
		entity_id: entityId,
		reason,
		description,
	});
}

export async function complaintAction(
	formState: ComplaintStateType,
	formData: FormData,
): Promise<ComplaintStateType> {
	return processForm(formState, formData, {
		getFormValues: getComplaintFormValues,
		validateForm: validateFormComplaint,
		operationFunction: reportComplaintOperation,
		fallbackErrorKey: 'complaint.report.failed',
		mapApiError: async (error) => {
			switch (error.status) {
				/*
				 * The backend's own wording, and it is worth showing verbatim: a 400 says the
				 * complaint has already been decided on and is no longer the reporter's to
				 * change, a 409 that one was filed while this form was open - neither is
				 * something the form's own copy could distinguish.
				 */
				case 400:
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
