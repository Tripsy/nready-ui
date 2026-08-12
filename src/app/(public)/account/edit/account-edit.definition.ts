import { z } from 'zod';
import { Configuration } from '@/config/settings.config';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import type { Language } from '@/types/common.type';

// The flow itself is a `WindowForm` (see `_components/account/account.definition.ts`),
// which also owns `getFormValues`; only the validator contract still lives here.
export type AccountEditFormValuesType = {
	name: string | null;
	language: Language;
};

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_name',
	'invalid_language',
] as const;

class AccountEditValidator extends BaseValidator<typeof validatorMessages> {
	accountEdit = z.object({
		name: this.validateString(
			{
				invalid: this.getMessage('invalid_name'),
				min_chars: this.getMessage('name_min', {
					min: Configuration.get('user.nameMinChars'),
				}),
			},
			{
				minChars: Configuration.get('user.nameMinChars'),
			},
		),
		language: this.validateLanguage(this.getMessage('invalid_language')),
	});
}

export async function validateFormAccountEdit(
	values: AccountEditFormValuesType,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'account',
	);

	const validator = new AccountEditValidator(translations);

	return validator.accountEdit.safeParse(values);
}
