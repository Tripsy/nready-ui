'use client';

import { useState } from 'react';
import type { AccountDeleteFormValuesType } from '@/app/(public)/account/delete/account-delete.definition';
import { FormComponentPassword } from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPassword } from '@/models/auth.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'account.message.delete_warning',
	'account.field.password_current',
	'account.field.password_current_placeholder',
] as const;

export function FormManageAccountDelete() {
	const [showPassword, setShowPassword] = useState(false);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<AccountDeleteFormValuesType>();
	const { auth } = useAuth();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const elementIds = useElementIds(['passwordCurrent'] as const);

	// A social sign-in account has no password to type. The session cookie is the only
	// credential it has, and it is the same bar every other `/account/me` action clears.
	const accountHasPassword = hasPassword(auth);

	return (
		<>
			<p className="text-sm text-muted">
				{translations['account.message.delete_warning']}
			</p>

			{accountHasPassword && (
				<FormComponentPassword<AccountDeleteFormValuesType>
					labelText={translations['account.field.password_current']}
					id={elementIds.passwordCurrent}
					fieldName="password_current"
					fieldValue={formValues.password_current ?? ''}
					placeholderText={
						translations[
							'account.field.password_current_placeholder'
						]
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
			)}
		</>
	);
}
