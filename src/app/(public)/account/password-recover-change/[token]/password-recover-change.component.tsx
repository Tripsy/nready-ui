'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useActionState, useState } from 'react';
import { passwordRecoverChangeAction } from '@/app/(public)/account/password-recover-change/[token]/password-recover-change.action';
import {
	type PasswordRecoverChangeFormValuesType,
	type PasswordRecoverChangeSituationType,
	PasswordRecoverChangeState,
	type PasswordRecoverChangeTranslations,
	validateFormPasswordRecoverChange,
} from '@/app/(public)/account/password-recover-change/[token]/password-recover-change.definition';
import {
	FormComponentPassword,
	FormComponentSubmit,
} from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { FormWrapperComponent } from '@/components/form/form-wrapper';
import {
	ErrorComponent,
	SuccessComponent,
} from '@/components/status.component';
import Routes from '@/config/routes.setup';
import { createHandleChange } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';

type PasswordRecoverChangeProps = {
	translations: PasswordRecoverChangeTranslations;
};

export default function PasswordRecoverChange({
	translations,
}: PasswordRecoverChangeProps) {
	const [showPassword, setShowPassword] = useState(false);

	const params = useParams<{ token: string }>();

	const token = params.token;

	const [state, action, pending] = useActionState(
		passwordRecoverChangeAction,
		{
			...PasswordRecoverChangeState,
			token,
		},
	);

	const [formValues, setFormValues] =
		useFormValues<PasswordRecoverChangeFormValuesType>(state.values);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		PasswordRecoverChangeFormValuesType,
		PasswordRecoverChangeSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormPasswordRecoverChange,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds(['password', 'passwordConfirm'] as const);

	if (formSituation === 'csrfError') {
		return (
			<ErrorComponent
				title={translations['password-recover-change.form.title']}
				description={formMessage as string}
			/>
		);
	}

	if (formSituation === 'success') {
		return (
			<SuccessComponent
				title={translations['password-recover-change.form.title']}
				description={
					translations[
						'password-recover-change.form.success_description'
					]
				}
			>
				<div className="text-center mt-6">
					{
						translations[
							'password-recover-change.link.sign_in_prompt'
						]
					}{' '}
					<Link
						href={Routes.get('login')}
						className="text-accent font-medium hover:underline"
					>
						{translations['password-recover-change.link.sign_in']}
					</Link>{' '}
					{
						translations[
							'password-recover-change.link.sign_in_suffix'
						]
					}
				</div>
			</SuccessComponent>
		);
	}

	return (
		<FormWrapperComponent
			title={translations['password-recover-change.form.title']}
			description={
				translations['password-recover-change.form.description']
			}
		>
			<form
				action={action}
				onSubmit={markSubmit}
				className="form-section"
			>
				<FormComponentPassword<PasswordRecoverChangeFormValuesType>
					labelText={
						translations['password-recover-change.field.password']
					}
					id={elementIds.password}
					fieldName="password"
					fieldValue={formValues.password ?? ''}
					disabled={pending}
					onChange={(e) => handleChange('password', e.target.value)}
					error={errors.password}
					showPassword={showPassword}
					setShowPassword={setShowPassword}
				/>

				<FormComponentPassword<PasswordRecoverChangeFormValuesType>
					labelText={
						translations[
							'password-recover-change.field.password_confirm'
						]
					}
					id={elementIds.passwordConfirm}
					fieldName="password_confirm"
					fieldValue={formValues.password_confirm ?? ''}
					placeholderText={
						translations[
							'password-recover-change.field.password_confirm_placeholder'
						]
					}
					disabled={pending}
					onChange={(e) =>
						handleChange('password_confirm', e.target.value)
					}
					error={errors.password_confirm}
					showPassword={showPassword}
				/>

				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{
						label: translations[
							'password-recover-change.action.submit'
						],
					}}
				/>

				<FormError
					formSituation={formSituation}
					formMessage={formMessage}
				/>
			</form>
		</FormWrapperComponent>
	);
}
