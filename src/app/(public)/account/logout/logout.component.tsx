'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { logoutAction } from '@/app/(public)/account/logout/logout.action';
import {
	LogoutDefaultState,
	type LogoutTranslations,
} from '@/app/(public)/account/logout/logout.definition';
import {
	ErrorComponent,
	LoadingComponent,
	SuccessComponent,
} from '@/components/status.component';
import Routes from '@/config/routes.setup';
import { logRejection } from '@/helpers/logger.helper';
import { useAuth } from '@/providers/auth.provider';
import { clearWindowStore } from '@/stores/window.store';

type LogoutProps = {
	translations: LogoutTranslations;
};

export default function Logout({ translations }: LogoutProps) {
	const [state, setState] = useState(LogoutDefaultState);
	const { setAuth, setAuthStatus } = useAuth();

	const hasExecuted = useRef(false);

	useEffect(() => {
		if (hasExecuted.current) {
			return;
		}

		hasExecuted.current = true;

		(async () => {
			const result = await logoutAction();

			setState(result);
		})();
	}, []);

	useEffect(() => {
		if (state.situation === 'success') {
			setAuth(null); // Clear auth state immediately after successful logout
			setAuthStatus('unauthenticated');

			// Open windows hold entry data from the session just ended
			clearWindowStore().catch(
				logRejection('Clearing the window store on logout failed'),
			);
		}
	}, [setAuth, setAuthStatus, state.situation]);

	if (state.situation === null) {
		return (
			<LoadingComponent
				title={translations['logout.form.title']}
				description={translations['logout.message.loading_description']}
			/>
		);
	}

	if (state.situation === 'error') {
		return (
			<ErrorComponent
				title={translations['logout.form.title']}
				description={
					state.message ||
					translations['logout.message.error_description']
				}
			/>
		);
	}

	if (state.situation === 'success') {
		return (
			<SuccessComponent
				title={translations['logout.form.title']}
				description={
					state.message ||
					translations['logout.message.success_description']
				}
			>
				<div className="text-center mt-6">
					{translations['logout.link.what_next']} <br />
					{translations['logout.link.go_back_prompt']}{' '}
					<Link
						href={Routes.get('login')}
						className="text-accent font-medium hover:underline"
					>
						{translations['logout.link.login']}
					</Link>{' '}
					{translations['logout.link.or_navigate']}{' '}
					<Link
						href={Routes.get('home')}
						className="text-accent font-medium hover:underline"
					>
						{translations['logout.link.home']}
					</Link>
				</div>
			</SuccessComponent>
		);
	}
}
