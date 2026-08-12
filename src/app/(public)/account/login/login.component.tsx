'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { AuthTokenList } from '@/app/(public)/_components/auth-token-list.component';
import { OAuthProviders } from '@/app/(public)/_components/oauth-providers.component';
import { loginAction } from '@/app/(public)/account/login/login.action';
import {
	isLoginResponseMaxActiveSessions,
	type LoginFormValuesType,
	type LoginSituationType,
	LoginState,
	type LoginTranslations,
	validateFormLogin,
} from '@/app/(public)/account/login/login.definition';
import {
	FormComponentEmail,
	FormComponentPassword,
	FormComponentSubmit,
} from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { FormWrapperComponent } from '@/components/form/form-wrapper';
import { ErrorComponent, ErrorIcon } from '@/components/status.component';
import Routes, { isExcludedRoute } from '@/config/routes.setup';
import { createHandleChange } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';

type LoginProps = {
	translations: LoginTranslations;
};

export default function Login({ translations }: LoginProps) {
	const [showPassword, setShowPassword] = useState(false);
	const { showToast } = useToast();

	const { refreshAuth } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();

	const [state, action, pending] = useActionState(loginAction, LoginState);

	const [formValues, setFormValues] = useFormValues<LoginFormValuesType>(
		state.values,
	);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		LoginFormValuesType,
		LoginSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormLogin,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	useEffect(() => {
		if (formSituation === 'success') {
			/*
			 * Sequenced, not parallel: `refreshAuth` calls the `getAuth` server action, which
			 * Next posts to the *current* URL and answers with a re-rendered tree for it. Started
			 * alongside the navigation, that response lands after it and puts the login page back
			 * on screen — the session is already valid, so only a reload shows it. Awaiting the
			 * action leaves nothing in flight to overwrite the redirect.
			 */
			(async () => {
				await refreshAuth();

				// Get the original destination from query params
				const fromParam = searchParams.get('from');

				let redirectUrl = Routes.get('home');

				if (fromParam) {
					// `get` already percent-decodes, so `fromParam` is the plain path.
					const url = new URL(fromParam, window.location.origin);
					const pathname = url.pathname;

					// Check only the pathname against excluded routes
					if (!isExcludedRoute(pathname)) {
						redirectUrl = url.toString();
					}
				}

				router.replace(redirectUrl);
			})();
		}
	}, [formSituation, router, refreshAuth, searchParams]);

	const elementIds = useElementIds(['email', 'password'] as const);

	if (formSituation === 'csrfError') {
		return (
			<ErrorComponent
				title={translations['login.form.title_status']}
				description={formMessage as string}
			/>
		);
	}

	if (formSituation === 'pendingAccount') {
		return (
			<ErrorComponent
				title={translations['login.form.title_status']}
				description={formMessage as string}
			>
				<div className="text-center mt-6">
					<span className="text-muted">
						{translations['login.link.confirm_email_prompt']}{' '}
					</span>
					<Link
						href={Routes.get('email-confirm-send')}
						className="text-accent font-medium hover:underline"
					>
						{translations['login.link.confirm_email']}
					</Link>
				</div>
			</ErrorComponent>
		);
	}

	const authTokens =
		state.resultData && isLoginResponseMaxActiveSessions(state.resultData)
			? state.resultData.authTokens
			: undefined;

	return (
		<FormWrapperComponent
			title={translations['login.form.title']}
			description={translations['login.form.description']}
		>
			<form
				action={action}
				onSubmit={markSubmit}
				className="form-section"
			>
				<FormComponentEmail<LoginFormValuesType>
					labelText={translations['login.field.email']}
					id={elementIds.email}
					fieldValue={formValues.email ?? ''}
					disabled={pending}
					onChange={(e) => handleChange('email', e.target.value)}
					error={errors.email}
				/>

				<FormComponentPassword<LoginFormValuesType>
					labelText={translations['login.field.password']}
					id={elementIds.password}
					fieldName="password"
					fieldValue={formValues.password ?? ''}
					autoComplete="current-password"
					disabled={pending}
					onChange={(e) => handleChange('password', e.target.value)}
					error={errors.password}
					showPassword={showPassword}
					setShowPassword={setShowPassword}
				/>

				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{
						icon: 'login',
						label: translations['login.action.submit'],
					}}
				/>

				<FormError
					formSituation={formSituation}
					formMessage={formMessage}
				/>

				{formSituation === 'maxActiveSession' && authTokens && (
					<div className="space-y-4">
						<div className="form-error">
							<ErrorIcon />
							<div>{formMessage}</div>
						</div>

						<AuthTokenList
							tokens={authTokens}
							onResult={(success, message) => {
								showToast({
									severity: success ? 'success' : 'error',
									summary: success
										? translations['app.success.title']
										: translations['app.error.title'],
									detail:
										message === 'session_destroy_success'
											? translations[
													'login.message.session_destroy_success'
												]
											: translations[
													`login.message.session_destroy_error`
												],
								});
							}}
						/>
					</div>
				)}

				<OAuthProviders
					label={translations['login.action.oauth']}
					continueWith={translations['oauth.action.continue_with']}
				/>

				<div className="text-center space-y-2">
					<p className="text-sm text-muted">
						{translations['login.link.no_account']}{' '}
						<Link
							href={Routes.get('register')}
							className="text-accent font-medium hover:underline"
						>
							{translations['login.link.create_account']}
						</Link>
					</p>
					<p className="text-sm text-muted">
						{translations['login.link.forgot_password']}{' '}
						<Link
							href={Routes.get('password-recover')}
							className="text-accent font-medium hover:underline"
						>
							{translations['login.link.reset_password']}
						</Link>
					</p>
				</div>
			</form>
		</FormWrapperComponent>
	);
}
