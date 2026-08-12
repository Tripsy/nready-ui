'use client';

import { useState } from 'react';
import type { PasswordUpdateFormValuesType } from '@/app/(public)/account/password-update/password-update.definition';
import { FormComponentPassword } from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'account.field.password_current',
	'account.field.password_current_placeholder',
	'account.field.password_new',
	'account.field.password_new_placeholder',
	'account.field.password_confirm',
	'account.field.password_confirm_placeholder',
] as const;

export function FormManagePasswordUpdate() {
	const [showPassword, setShowPassword] = useState(false);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<PasswordUpdateFormValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const elementIds = useElementIds([
		'passwordCurrent',
		'passwordNew',
		'passwordConfirm',
	] as const);

	return (
		<>
			<FormComponentPassword<PasswordUpdateFormValuesType>
				labelText={translations['account.field.password_current']}
				id={elementIds.passwordCurrent}
				fieldName="password_current"
				fieldValue={formValues.password_current ?? ''}
				placeholderText={
					translations['account.field.password_current_placeholder']
				}
				autoComplete="current-password"
				disabled={pending}
				onChange={(e) =>
					handleChange('password_current', e.target.value)
				}
				error={errors.password_current}
				showPassword={showPassword}
				setShowPassword={setShowPassword}
			/>

			<FormComponentPassword<PasswordUpdateFormValuesType>
				labelText={translations['account.field.password_new']}
				id={elementIds.passwordNew}
				fieldName="password_new"
				fieldValue={formValues.password_new ?? ''}
				placeholderText={
					translations['account.field.password_new_placeholder']
				}
				disabled={pending}
				onChange={(e) => handleChange('password_new', e.target.value)}
				error={errors.password_new}
				showPassword={showPassword}
			/>

			<FormComponentPassword<PasswordUpdateFormValuesType>
				labelText={translations['account.field.password_confirm']}
				id={elementIds.passwordConfirm}
				fieldName="password_confirm"
				fieldValue={formValues.password_confirm ?? ''}
				placeholderText={
					translations['account.field.password_confirm_placeholder']
				}
				disabled={pending}
				onChange={(e) =>
					handleChange('password_confirm', e.target.value)
				}
				error={errors.password_confirm}
				showPassword={showPassword}
			/>
		</>
	);
}
