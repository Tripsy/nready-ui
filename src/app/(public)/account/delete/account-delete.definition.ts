import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsString } from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';

// The flow itself is a `WindowForm` (see `_components/account/account.definition.ts`);
// only the validator and form-values contract still live here.
export type AccountDeleteFormValuesType = {
	password_current: string | null;
};

const validatorMessages = ['invalid_password_current'] as const;

class AccountDeleteValidator extends BaseValidator<typeof validatorMessages> {
	/*
	 * Optional at the schema level because a social sign-in account has no password to
	 * confirm with — the form hides the field entirely in that case. The backend still
	 * requires it whenever the account does have one, and it is the only side that can
	 * know, so this schema deliberately does not try to.
	 */
	accountDelete = z.object({
		password_current: this.validateString(
			this.getMessage('invalid_password_current'),
			{ required: false },
		),
	});
}

export async function validateFormAccountDelete(
	values: AccountDeleteFormValuesType,
) {
	const translations = await translateBatch(
		validatorMessages,
		'account.validation',
	);

	const validator = new AccountDeleteValidator(translations);

	return validator.accountDelete.safeParse(values);
}

export function getAccountDeleteFormValues(
	formData: FormData,
): AccountDeleteFormValuesType {
	return {
		password_current: getFormDataAsString(formData, 'password_current'),
	};
}
