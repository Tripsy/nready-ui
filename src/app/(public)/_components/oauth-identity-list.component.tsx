'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icons } from '@/components/icon.component';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/helpers/date.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useToast } from '@/providers/toast.provider';
import {
	requestGetOAuthIdentities,
	requestUnlinkOAuth,
} from '@/services/account.service';
import {
	getEnabledOAuthProviders,
	OAUTH_PROVIDER_LABEL,
	type OAuthIdentityType,
	type OAuthProvider,
} from '@/types/oauth.type';

const TRANSLATION_KEYS = [
	'app.success.title',
	'app.error.title',
	'account.section.social',
	'account.label.last_used',
	'account.label.linked',
	'account.label.not_linked',
	'account.button.unlink',
	'account.button.unlink_title',
	'account.message.no_password_hint',
	'oauth.message.unlink_success',
	'oauth.message.unlink_error',
] as const;

/**
 * Linked social sign-in providers, with the ability to link or unlink one.
 *
 * `hasPassword` decides whether unlinking the last provider is offered at all: without a
 * password it would be the account's only credential, and the backend refuses it with a 409.
 * Hiding the button is friendlier than letting the user discover that by pressing it.
 */
export function OAuthIdentityList({ hasPassword }: { hasPassword: boolean }) {
	const { showToast } = useToast();
	const [identities, setIdentities] = useState<OAuthIdentityType[]>([]);
	const [pending, setPending] = useState<OAuthProvider | null>(null);

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const load = useCallback(async () => {
		setIdentities(await requestGetOAuthIdentities());
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const handleUnlink = useCallback(
		async (provider: OAuthProvider) => {
			setPending(provider);

			try {
				const response = await requestUnlinkOAuth(provider);

				showToast({
					severity: response?.success ? 'success' : 'error',
					summary: response?.success
						? translations['app.success.title']
						: translations['app.error.title'],
					detail: response?.success
						? translations['oauth.message.unlink_success']
						: (response?.message ??
							translations['oauth.message.unlink_error']),
				});

				if (response?.success) {
					await load();
				}
			} catch {
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: translations['oauth.message.unlink_error'],
				});
			} finally {
				setPending(null);
			}
		},
		[showToast, translations, load],
	);

	const enabledProviders = getEnabledOAuthProviders();

	if (enabledProviders.length === 0) {
		return null;
	}

	const linkedProviders = new Set(identities.map((i) => i.provider));

	// Unlinking the only credential would lock the user out of their own account.
	const canUnlink = hasPassword || identities.length > 1;

	return (
		<div className="bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4 w-full max-w-md">
			<h2 className="text-lg font-bold flex items-center gap-2">
				<Icons.Security />
				{translations['account.section.social']}
			</h2>

			<div className="space-y-4">
				{enabledProviders.map((provider) => {
					const identity = identities.find(
						(i) => i.provider === provider,
					);

					return (
						<div
							key={provider}
							className="flex justify-between items-center border-b pb-4 last:border-b-0 last:pb-0"
						>
							<div>
								<div className="text-sm font-semibold">
									{OAUTH_PROVIDER_LABEL[provider]}
								</div>

								{identity ? (
									<>
										<p className="text-xs text-muted">
											{identity.email}
										</p>
										{identity.last_login_at && (
											<p className="text-xs italic text-muted">
												{
													translations[
														'account.label.last_used'
													]
												}{' '}
												{formatDate(
													identity.last_login_at,
													undefined,
													{
														customFormat:
															'D MMMM YYYY, h:mm A',
													},
												)}
											</p>
										)}
										<Badge
											variant="success"
											size="sm"
											className="rounded-lg mt-2"
										>
											<Icons.Status.Ok className="w-4 h-4" />
											{
												translations[
													'account.label.linked'
												]
											}
										</Badge>
									</>
								) : (
									/*
									 * No "Link" button on purpose: the backend's
									 * `/account/oauth/:provider` is gated to signed-out
									 * callers, and linking happens implicitly there — signing
									 * in with a provider whose verified email matches this
									 * account attaches it. A button here would only ever 403.
									 */
									<p className="text-xs text-muted">
										{replaceVars(
											translations[
												'account.label.not_linked'
											],
											{
												provider:
													OAUTH_PROVIDER_LABEL[
														provider
													],
											},
										)}
									</p>
								)}
							</div>

							{linkedProviders.has(provider) && canUnlink && (
								<Button
									type="button"
									onClick={() => handleUnlink(provider)}
									title={replaceVars(
										translations[
											'account.button.unlink_title'
										],
										{
											provider:
												OAUTH_PROVIDER_LABEL[provider],
										},
									)}
									variant="outline"
									size="sm"
									disabled={pending === provider}
									className="cursor-pointer"
								>
									<Icons.Action.Delete />{' '}
									{translations['account.button.unlink']}
								</Button>
							)}
						</div>
					);
				})}
			</div>

			{!hasPassword && (
				<p className="text-xs text-muted italic">
					{translations['account.message.no_password_hint']}
				</p>
			)}
		</div>
	);
}
