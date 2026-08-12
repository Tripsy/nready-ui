import { z } from 'zod';
import { Configuration } from '@/config/settings.config';
import { getFormDataAsString } from '@/helpers/form.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';

// The flow itself is a `WindowForm` (see `_components/account/account.definition.ts`);
// only the validator and form-values contract still live here.
export type PasswordUpdateFormValuesType = {
	password_current: string | null;
	password_new: string | null;
	password_confirm: string | null;
};

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_password_current',
	'invalid_password_new',
	'password_confirm_required',
] as const;

class PasswordUpdateValidator extends BaseValidator<typeof validatorMessages> {
	passwordUpdate = z
		.object({
			password_current: this.validateString(
				this.getMessage('invalid_password_current'),
			),
			password_new: this.validatePassword(
				{
					invalid_password: this.getMessage('invalid_password_new'),
					password_min: this.getMessage('password_min', {
						min: Configuration.get('user.passwordMinChars'),
					}),
					password_condition_capital_letter: this.getMessage(
						'password_condition_capital_letter',
					),
					password_condition_number: this.getMessage(
						'password_condition_number',
					),
					password_condition_special_character: this.getMessage(
						'password_condition_special_character',
					),
				},
				{
					minLength: Configuration.get('user.passwordMinChars'),
				},
			),
			password_confirm: this.validateString(
				this.getMessage('password_confirm_required'),
			),
		})
		.superRefine(({ password_new, password_confirm }, ctx) => {
			if (password_new !== password_confirm) {
				ctx.addIssue({
					path: ['password_confirm'],
					message: this.getMessage('password_confirm_mismatch'),
					code: 'custom',
				});
			}
		});
}

export async function validateFormPasswordUpdate(
	values: PasswordUpdateFormValuesType,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'account',
	);

	const validator = new PasswordUpdateValidator(translations);

	return validator.passwordUpdate.safeParse(values);
}

export function getPasswordUpdateFormValues(
	formData: FormData,
): PasswordUpdateFormValuesType {
	return {
		password_current: getFormDataAsString(formData, 'password_current'),
		password_new: getFormDataAsString(formData, 'password_new'),
		password_confirm: getFormDataAsString(formData, 'password_confirm'),
	};
}
