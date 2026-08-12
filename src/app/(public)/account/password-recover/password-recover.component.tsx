'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { passwordRecoverAction } from '@/app/(public)/account/password-recover/password-recover.action';
import {
	type PasswordRecoverFormValuesType,
	type PasswordRecoverSituationType,
	PasswordRecoverState,
	type PasswordRecoverTranslations,
	validateFormPasswordRecover,
} from '@/app/(public)/account/password-recover/password-recover.definition';
import {
	FormComponentEmail,
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

type PasswordRecoverProps = {
	translations: PasswordRecoverTranslations;
};

export default function PasswordRecover({
	translations,
}: PasswordRecoverProps) {
	const [state, action, pending] = useActionState(
		passwordRecoverAction,
		PasswordRecoverState,
	);

	const [formValues, setFormValues] =
		useFormValues<PasswordRecoverFormValuesType>(state.values);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		PasswordRecoverFormValuesType,
		PasswordRecoverSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormPasswordRecover,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds(['email'] as const);

	if (formSituation === 'csrfError') {
		return (
			<ErrorComponent
				title={translations['password-recover.form.title']}
				description={formMessage as string}
			/>
		);
	}

	if (formSituation === 'success') {
		return (
			<SuccessComponent
				title={translations['password-recover.form.title']}
				description={
					translations['password-recover.form.success_description']
				}
			>
				<div className="text-center mt-6">
					{translations['password-recover.link.back_home_prompt']}{' '}
					<Link
						href={Routes.get('home')}
						className="text-accent font-medium hover:underline"
					>
						{translations['password-recover.link.back_home']}
					</Link>
				</div>
			</SuccessComponent>
		);
	}

	return (
		<FormWrapperComponent
			title={translations['password-recover.form.title']}
			description={translations['password-recover.form.description']}
		>
			<form
				action={action}
				onSubmit={markSubmit}
				className="form-section"
			>
				<FormComponentEmail<PasswordRecoverFormValuesType>
					labelText={translations['password-recover.field.email']}
					id={elementIds.email}
					fieldValue={formValues.email ?? ''}
					disabled={pending}
					onChange={(e) => handleChange('email', e.target.value)}
					error={errors.email}
				/>

				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{
						label: translations['password-recover.action.submit'],
					}}
				/>

				<FormError
					formSituation={formSituation}
					formMessage={formMessage}
				/>

				<div className="text-center space-y-2">
					<p className="text-sm text-muted">
						{translations['password-recover.link.not_registered']}{' '}
						<Link
							href={Routes.get('register')}
							className="text-accent font-medium hover:underline"
						>
							{
								translations[
									'password-recover.link.create_account'
								]
							}
						</Link>
					</p>
				</div>
			</form>
		</FormWrapperComponent>
	);
}
