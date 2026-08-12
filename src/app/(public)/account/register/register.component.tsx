'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { OAuthProviders } from '@/app/(public)/_components/oauth-providers.component';
import { registerAction } from '@/app/(public)/account/register/register.action';
import {
	type RegisterFormValuesType,
	type RegisterSituationType,
	RegisterState,
	type RegisterTranslations,
	validateFormRegister,
} from '@/app/(public)/account/register/register.definition';
import {
	FormComponentCheckbox,
	FormComponentEmail,
	FormComponentName,
	FormComponentPassword,
	FormComponentRadio,
	FormComponentSubmit,
} from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { FormWrapperComponent } from '@/components/form/form-wrapper';
import {
	ErrorComponent,
	SuccessComponent,
} from '@/components/status.component';
import Routes from '@/config/routes.setup';
import { createHandleChange, toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';
import { type Language, LanguageEnum } from '@/types/common.type';

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

type RegisterProps = {
	translations: RegisterTranslations;
};

export default function Register({ translations }: RegisterProps) {
	const [showPassword, setShowPassword] = useState(false);

	const [state, action, pending] = useActionState(
		registerAction,
		RegisterState,
	);

	const [formValues, setFormValues] = useFormValues<RegisterFormValuesType>(
		state.values,
	);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		RegisterFormValuesType,
		RegisterSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormRegister,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds([
		'name',
		'email',
		'password',
		'passwordConfirm',
		'language',
		'terms',
	] as const);

	if (formSituation === 'csrfError') {
		return (
			<ErrorComponent
				title={translations['register.form.title_status']}
				description={formMessage as string}
			/>
		);
	}

	if (formSituation === 'pendingAccount') {
		return (
			<ErrorComponent
				title={translations['register.form.title_status']}
				description={formMessage as string}
			>
				<div className="text-center mt-6">
					<span className="text-muted">
						{
							translations['register.link.confirm_email_prompt']
						}{' '}
					</span>
					<Link
						href={Routes.get('email-confirm-send')}
						className="text-accent font-medium hover:underline"
					>
						{translations['register.link.confirm_email']}
					</Link>
				</div>
			</ErrorComponent>
		);
	}

	if (formSituation === 'success') {
		return (
			<SuccessComponent
				title={translations['register.form.title_status']}
				description={translations['register.form.success_description']}
			>
				<div className="text-center mt-6">
					<p>
						{translations['register.link.verification_sent']}{' '}
						<span className="font-semibold">
							{' '}
							{formValues.email}
						</span>
					</p>
					<p>{translations['register.link.verification_check']}</p>
				</div>
				<div className="text-center mt-6">
					{translations['register.link.back_home_prompt']}{' '}
					<Link
						href={Routes.get('home')}
						className="text-accent font-medium hover:underline"
					>
						{translations['register.link.back_home']}
					</Link>
				</div>
			</SuccessComponent>
		);
	}

	return (
		<FormWrapperComponent
			title={translations['register.form.title']}
			description={translations['register.form.description']}
		>
			<form
				action={action}
				onSubmit={markSubmit}
				className="form-section"
			>
				<FormComponentName<RegisterFormValuesType>
					labelText={translations['register.field.name']}
					id={elementIds.name}
					fieldValue={formValues.name ?? ''}
					disabled={pending}
					onChange={(e) => handleChange('name', e.target.value)}
					error={errors.name}
				/>

				<FormComponentEmail<RegisterFormValuesType>
					labelText={translations['register.field.email']}
					id={elementIds.email}
					fieldValue={formValues.email ?? ''}
					disabled={pending}
					onChange={(e) => handleChange('email', e.target.value)}
					error={errors.email}
				/>

				<FormComponentPassword<RegisterFormValuesType>
					labelText={translations['register.field.password']}
					id={elementIds.password}
					fieldName="password"
					fieldValue={formValues.password ?? ''}
					disabled={pending}
					onChange={(e) => handleChange('password', e.target.value)}
					error={errors.password}
					showPassword={showPassword}
					setShowPassword={setShowPassword}
				/>

				<FormComponentPassword<RegisterFormValuesType>
					labelText={translations['register.field.password_confirm']}
					id={elementIds.passwordConfirm}
					fieldName="password_confirm"
					fieldValue={formValues.password_confirm ?? ''}
					placeholderText={
						translations[
							'register.field.password_confirm_placeholder'
						]
					}
					disabled={pending}
					onChange={(e) =>
						handleChange('password_confirm', e.target.value)
					}
					error={errors.password_confirm}
					showPassword={showPassword}
				/>

				<FormComponentRadio<RegisterFormValuesType>
					labelText={translations['register.field.language']}
					id={elementIds.language}
					fieldName="language"
					fieldValue={formValues.language}
					disabled={pending}
					options={languages}
					onChange={(value) =>
						handleChange('language', value as Language)
					}
					error={errors.language}
				/>

				<FormComponentCheckbox<RegisterFormValuesType>
					id={elementIds.terms}
					onCheckedChange={(checked) =>
						handleChange('terms', checked)
					}
					fieldName="terms"
					checked={formValues.terms}
					disabled={pending}
					error={errors.terms}
				>
					<div>
						<span className="cursor-pointer text-sm text-muted">
							{translations['register.link.terms_prompt']}{' '}
							<Link
								href={Routes.get('page', {
									label: 'terms-and-conditions',
								})}
								className="text-accent font-medium hover:underline"
								target="_blank"
								title={
									translations['register.link.terms_title']
								}
							>
								{translations['register.link.terms_of_service']}
							</Link>{' '}
							{translations['register.link.terms_separator']}{' '}
							<Link
								href={Routes.get('page', {
									label: 'privacy-policy',
								})}
								className="text-accent font-medium hover:underline"
								target="_blank"
								title={
									translations['register.link.privacy_title']
								}
							>
								{translations['register.link.privacy_policy']}
							</Link>
							.
						</span>
					</div>
				</FormComponentCheckbox>

				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{
						label: translations['register.action.submit'],
					}}
				/>

				<FormError
					formSituation={formSituation}
					formMessage={formMessage}
				/>

				<OAuthProviders
					label={translations['register.action.oauth']}
					continueWith={translations['oauth.action.continue_with']}
				/>

				<div className="text-center space-y-2">
					<p className="text-sm text-muted">
						{translations['register.link.already_registered']}{' '}
						<Link
							href={Routes.get('login')}
							className="text-accent font-medium hover:underline"
						>
							{translations['register.link.sign_in']}
						</Link>
					</p>
				</div>
			</form>
		</FormWrapperComponent>
	);
}
