import {
	type CommentFormValuesType,
	type CommentStateType,
	getCommentFormValues,
	validateFormComment,
} from '@/components/comment/comment.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import type { CommentEntityType } from '@/models/comment.model';
import { requestCreateComment } from '@/services/comment.service';

/**
 * The form's fields are not the request's shape: the guest fields are dropped for a signed-in
 * reader — the backend ignores them anyway, and sending them would be claiming an identity the
 * session already settles.
 */
async function createCommentOperation(values: CommentFormValuesType) {
	return requestCreateComment({
		entity_type: values.entity_type as CommentEntityType,
		entity_id: values.entity_id as number,
		content: values.content as string,
		...(values.parent_id ? { parent_id: values.parent_id } : {}),
		...(values.requires_guest
			? {
					guest_name: values.guest_name ?? undefined,
					guest_email: values.guest_email ?? undefined,
					guest_website: values.guest_website ?? undefined,
				}
			: {}),
	});
}

export async function commentAction(
	formState: CommentStateType,
	formData: FormData,
): Promise<CommentStateType> {
	return processForm(formState, formData, {
		getFormValues: getCommentFormValues,
		validateForm: validateFormComment,
		operationFunction: createCommentOperation,
		fallbackErrorKey: 'comment.form.failed',
		mapApiError: async (error) => {
			switch (error.status) {
				/*
				 * The backend's own wording, and it is worth showing verbatim: a 400 here is
				 * one of three different facts — the guest identity is missing, the parent is
				 * no longer available, or the origin address could not be resolved — and only
				 * the first is something the reader can act on from this form.
				 */
				case 400:
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
