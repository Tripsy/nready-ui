'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthTokenList } from '@/app/(public)/_components/auth-token-list.component';
import { OAuthIdentityList } from '@/app/(public)/_components/oauth-identity-list.component';
import { Icons } from '@/components/icon.component';
import { LoadingComponent } from '@/components/status.component';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { formatDate } from '@/helpers/date.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPassword } from '@/models/auth.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import { requestGetSessions } from '@/services/account.service';
import { useModalStore } from '@/stores/window.store';
import type { AuthTokenType } from '@/types/auth.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export default function AccountMe() {
	const { auth, authStatus, refreshAuth } = useAuth();
	// Read through the helper: a backend that predates `has_password` omits it, and treating
	// that as "social account" would mislabel every user during a version skew.
	const accountHasPassword = hasPassword(auth);
	const { showToast } = useToast();
	const open = useModalStore((s) => s.open);
	const [sessions, setSessions] = useState<AuthTokenType[]>([]);

	const translationsKeys = [
		'app.success.title',
		'app.error.title',
		'account.section.personal',
		'account.section.security',
		'account.section.sessions',
		'account.label.full_name',
		'account.label.email',
		'account.label.language',
		'account.label.member_since',
		'account.label.password',
		'account.label.verified',
		'account.label.not_verified',
		'account.label.last_updated',
		'account.label.password_not_set',
		'account.button.edit',
		'account.button.edit_title',
		'account.button.change',
		'account.button.email_title',
		'account.button.password_title',
		'account.button.set_password',
		'account.button.delete',
		'account.button.delete_title',
		'account.message.session_destroy_success',
		'account.message.session_destroy_error',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	useEffect(() => {
		if (authStatus === 'authenticated') {
			(async () => {
				setSessions(await requestGetSessions());
			})();
		}
	}, [authStatus]);

	const router = useRouter();

	// Account self-service flows open as windows (WindowForm handles the submit,
	// success toast and close). Post-submit side effects go through events.success.
	const openAccountEdit = useCallback(() => {
		if (!auth) {
			return;
		}

		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'account',
			action: 'edit',
			data: { entries: [auth] },
			events: {
				success: async () => {
					await refreshAuth();
				},
			},
		});
	}, [open, auth, refreshAuth]);

	const openEmailUpdate = useCallback(() => {
		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'account',
			action: 'emailUpdate',
		});
	}, [open]);

	const openPasswordUpdate = useCallback(() => {
		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'account',
			action: 'passwordUpdate',
			events: {
				// Refresh so the "password last updated" timestamp reflects the change.
				success: async () => {
					await refreshAuth();
				},
			},
		});
	}, [open, refreshAuth]);

	const openAccountDelete = useCallback(() => {
		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'account',
			action: 'deleteAccount',
			events: {
				// Access is revoked immediately — send the user to the status
				// page. `info` (not `error`): deletion succeeded, and the copy
				// already lives at `app.info.account_delete`.
				success: () => {
					router.replace(
						`${Routes.get('status', { type: 'info' })}?r=account_delete`,
					);
				},
			},
		});
	}, [open, router]);

	if (authStatus === 'loading') {
		return <LoadingComponent />;
	}

	if (!auth) {
		router.replace(Routes.get('login'));
		return null;
	}

	return (
		<div className="min-h-[calc(80vh-4rem)] px-4 py-12">
			<div className="text-center mb-8">
				<h1 className="text-2xl font-bold mb-2">My Account</h1>
			</div>

			<div className="flex flex-wrap justify-center gap-8">
				{/* Personal Information */}
				<div className="bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4 w-full max-w-md">
					<div className="flex justify-between items-center">
						<h2 className="text-lg font-bold flex items-center gap-2">
							<Icons.User />
							{translations['account.section.personal']}
						</h2>
						<Button
							type="button"
							onClick={openAccountEdit}
							title={translations['account.button.edit_title']}
							variant="outline"
							size="sm"
							className="cursor-pointer"
						>
							<Icons.Action.Update />{' '}
							{translations['account.button.edit']}
						</Button>
					</div>

					<div className="border-b pb-4">
						<div className="text-sm text-muted font-semibold">
							{translations['account.label.full_name']}
						</div>
						<p>{auth.name}</p>
					</div>

					<div className="border-b pb-4">
						<div className="flex justify-between">
							<div>
								<div className="text-sm text-muted font-semibold">
									{translations['account.label.email']}
								</div>
								<p>{auth.email}</p>
								{auth.email_verified_at ? (
									<Badge
										variant="success"
										size="sm"
										className="rounded-lg mt-2"
									>
										<Icons.Status.Ok className="w-4 h-4" />
										{translations['account.label.verified']}
									</Badge>
								) : (
									<Badge
										variant="error"
										size="sm"
										className="rounded-lg mt-2"
									>
										<Icons.Status.Warning className="w-4 h-4" />
										{
											translations[
												'account.label.not_verified'
											]
										}
									</Badge>
								)}
							</div>
							<Button
								type="button"
								onClick={openEmailUpdate}
								title={
									translations['account.button.email_title']
								}
								variant="outline"
								size="sm"
								className="cursor-pointer"
							>
								<Icons.Action.Update />{' '}
								{translations['account.button.change']}
							</Button>
						</div>
					</div>

					<div className="border-b pb-4">
						<div className="text-sm text-muted font-semibold">
							{translations['account.label.language']}
						</div>
						<p>{auth.language}</p>
					</div>

					<div>
						<div className="text-sm text-muted font-semibold">
							{translations['account.label.member_since']}
						</div>
						<p>
							{formatDate(auth.created_at, undefined, {
								customFormat: 'MMMM D, YYYY',
							})}
						</p>
					</div>
				</div>

				{/* Security & Account */}
				<div className="bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4 w-full max-w-md">
					<h2 className="text-lg font-bold flex items-center gap-2">
						<Icons.Security />
						{translations['account.section.security']}
					</h2>

					<div className="border-b pb-4">
						<div className="flex justify-between">
							<div>
								<div className="text-sm text-muted font-semibold">
									{translations['account.label.password']}
								</div>
								{/*
								 * A social sign-in account has no password, so there is
								 * nothing to change and no meaningful "last updated" —
								 * `password_updated_at` is stamped at creation regardless.
								 * Setting a first one goes through password recovery, which
								 * proves ownership by email instead of by current password.
								 */}
								{accountHasPassword ? (
									<p className="text-xs italic">
										{
											translations[
												'account.label.last_updated'
											]
										}{' '}
										{formatDate(
											auth.password_updated_at,
											undefined,
											{
												customFormat:
													'D MMMM YYYY, h:mm A',
											},
										)}
									</p>
								) : (
									<p className="text-xs italic">
										{
											translations[
												'account.label.password_not_set'
											]
										}
									</p>
								)}
							</div>
							{accountHasPassword ? (
								<Button
									type="button"
									onClick={openPasswordUpdate}
									title={
										translations[
											'account.button.password_title'
										]
									}
									variant="outline"
									size="sm"
									className="cursor-pointer"
								>
									<Icons.Password />{' '}
									{translations['account.button.change']}
								</Button>
							) : (
								/*
								 * Styled as a button to match the sibling "Change"
								 * action, but kept an anchor: it navigates to password
								 * recovery, so middle-click and open-in-new-tab should
								 * keep working.
								 */
								<Link
									href={Routes.get('password-recover')}
									variant="outline"
									size="sm"
									className="cursor-pointer self-center"
								>
									<Icons.Password />{' '}
									{
										translations[
											'account.button.set_password'
										]
									}
								</Link>
							)}
						</div>
					</div>

					<div className="flex justify-end mt-6">
						<Button
							type="button"
							onClick={openAccountDelete}
							title={translations['account.button.delete_title']}
							variant="error"
							size="sm"
							className="cursor-pointer"
						>
							<Icons.Action.Delete />{' '}
							{translations['account.button.delete']}
						</Button>
					</div>
				</div>

				<OAuthIdentityList hasPassword={accountHasPassword} />

				{/* Sessions Management */}
				<div className="bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4 w-full max-w-md">
					<h2 className="text-lg font-bold flex items-center gap-2">
						<Icons.Sessions />
						{translations['account.section.sessions']}
					</h2>

					<div className="py-2 space-y-4">
						<AuthTokenList
							tokens={sessions}
							onResult={(success, message) => {
								showToast({
									severity: success ? 'success' : 'error',
									summary: success
										? translations['app.success.title']
										: translations['app.error.title'],
									detail:
										message === 'session_destroy_success'
											? translations[
													'account.message.session_destroy_success'
												]
											: translations[
													'account.message.session_destroy_error'
												],
								});
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
