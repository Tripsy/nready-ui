import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsString } from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';

// The flow itself is a `WindowForm` (see `_components/account/account.definition.ts`);
// only the validator and form-values contract still live here.
export type EmailUpdateFormValuesType = {
	email_new: string | null;
};

const validatorMessages = ['invalid_email'] as const;

class EmailUpdateValidator extends BaseValidator<typeof validatorMessages> {
	emailUpdate = z.object({
		email_new: this.validateEmail(this.getMessage('invalid_email')),
	});
}

export async function validateFormEmailUpdate(
	values: EmailUpdateFormValuesType,
) {
	const translations = await translateBatch(
		validatorMessages,
		'account.validation',
	);

	const validator = new EmailUpdateValidator(translations);

	return validator.emailUpdate.safeParse(values);
}

export function getEmailUpdateFormValues(
	formData: FormData,
): EmailUpdateFormValuesType {
	return {
		email_new: getFormDataAsString(formData, 'email_new'),
	};
}
