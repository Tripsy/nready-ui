'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { emailConfirmSendAction } from '@/app/(public)/account/email-confirm-send/email-confirm-send.action';
import {
	type EmailConfirmSendFormValuesType,
	type EmailConfirmSendSituationType,
	EmailConfirmSendState,
	type EmailConfirmSendTranslations,
	validateFormEmailConfirmSend,
} from '@/app/(public)/account/email-confirm-send/email-confirm-send.definition';
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

type EmailConfirmSendProps = {
	translations: EmailConfirmSendTranslations;
};

export default function EmailConfirmSend({
	translations,
}: EmailConfirmSendProps) {
	const [state, action, pending] = useActionState(
		emailConfirmSendAction,
		EmailConfirmSendState,
	);

	const [formValues, setFormValues] =
		useFormValues<EmailConfirmSendFormValuesType>(state.values);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		EmailConfirmSendFormValuesType,
		EmailConfirmSendSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormEmailConfirmSend,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds(['email'] as const);

	if (formSituation === 'csrfError') {
		return (
			<ErrorComponent
				title={translations['email-confirm-send.form.title_status']}
				description={formMessage as string}
			/>
		);
	}

	if (formSituation === 'success') {
		return (
			<SuccessComponent
				title={translations['email-confirm-send.form.title_success']}
				description={
					translations['email-confirm-send.form.success_description']
				}
			>
				<div className="text-center mt-6">
					{translations['email-confirm-send.link.back_home_prompt']}{' '}
					<Link
						href={Routes.get('home')}
						className="text-accent font-medium hover:underline"
					>
						{translations['email-confirm-send.link.back_home']}
					</Link>
				</div>
			</SuccessComponent>
		);
	}

	return (
		<FormWrapperComponent
			title={translations['email-confirm-send.form.title']}
			description={translations['email-confirm-send.form.description']}
		>
			<form
				action={action}
				onSubmit={markSubmit}
				className="form-section"
			>
				<FormComponentEmail<EmailConfirmSendFormValuesType>
					labelText={translations['email-confirm-send.field.email']}
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
						label: translations['email-confirm-send.action.submit'],
					}}
				/>

				<FormError
					formSituation={formSituation}
					formMessage={formMessage}
				/>

				<div className="text-center space-y-2">
					<p className="text-sm text-muted">
						{translations['email-confirm-send.link.not_registered']}{' '}
						<Link
							href={Routes.get('register')}
							className="text-accent font-medium hover:underline"
						>
							{
								translations[
									'email-confirm-send.link.create_account'
								]
							}
						</Link>
					</p>
				</div>
			</form>
		</FormWrapperComponent>
	);
}
