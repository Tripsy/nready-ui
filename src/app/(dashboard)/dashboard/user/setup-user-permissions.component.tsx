'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Checkbox } from '@/components/ui/checkbox';
import { requestFind } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { PermissionModel } from '@/models/permission.model';
import type { UserModel } from '@/models/user.model';
import { useToast } from '@/providers/toast.provider';
import {
	createUserPermissions,
	deleteUserPermission,
	getUserPermissions,
} from '@/services/user.service';

export function SetupUserPermissions({ entries }: { entries: UserModel[] }) {
	const entry = entries[0];

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'user.error.no_permissions_defined',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);
	const { showToast } = useToast();

	const {
		data: permissionsData,
		isLoading: isLoadingPermissions,
		error: permissionsError,
	} = useQuery({
		queryKey: [
			'permissions',
			{ order_by: 'id', direction: 'ASC', limit: 999 },
		],
		queryFn: () =>
			requestFind<PermissionModel>('permission', {
				order_by: 'id',
				direction: 'ASC',
				limit: 999,
			}),
	});

	const {
		data: userPermissionsData,
		isLoading: isLoadingUserPermissions,
		error: userPermissionsError,
	} = useQuery({
		queryKey: ['s-user-permission', entry.id],
		queryFn: () =>
			getUserPermissions(entry.id, {
				order_by: 'permission_id',
				direction: 'ASC',
				limit: 999,
			}),
		enabled: !!entry.id,
	});

	const isLoading =
		isTranslationLoading ||
		isLoadingPermissions ||
		isLoadingUserPermissions;
	const permissions = permissionsData?.entries ?? [];

	const [userPermissions, setUserPermissions] = useState<number[]>([]);

	useEffect(() => {
		if (userPermissionsData?.entries) {
			setUserPermissions([
				...new Set(
					userPermissionsData.entries.map((p) =>
						Number(p.permission_id),
					),
				),
			]);
		}
	}, [userPermissionsData]);

	useEffect(() => {
		const error = permissionsError ?? userPermissionsError;

		if (error) {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: (error as Error).message,
			});
		}
	}, [permissionsError, userPermissionsError, showToast, translations]);

	const listPermissions = useMemo(
		() =>
			permissions.reduce<Record<string, PermissionModel[]>>((acc, p) => {
				if (!acc[p.entity]) acc[p.entity] = [];
				acc[p.entity].push(p);
				return acc;
			}, {}),
		[permissions],
	);

	const sortedPermissions = useMemo(
		() =>
			Object.entries(listPermissions).sort(([a], [b]) =>
				a.localeCompare(b),
			),
		[listPermissions],
	);

	const handleToggleEntity = useCallback(
		async (entity: string, checked: boolean) => {
			if (!entry.id) {
				return;
			}

			const entityPerms = listPermissions[entity];
			const entityPermIds = entityPerms.map((p) => Number(p.id));

			setUserPermissions((prev) =>
				checked
					? [...new Set([...prev, ...entityPermIds])]
					: prev.filter((id) => !entityPermIds.includes(id)),
			);

			try {
				if (checked) {
					await createUserPermissions(entry.id, entityPermIds);

					showToast({
						severity: 'success',
						summary: translations['app.success.title'],
						detail: `All '${entity}' permissions granted`,
					});
				} else {
					await Promise.all(
						entityPermIds.map((id) =>
							deleteUserPermission(entry.id, id),
						),
					);
					showToast({
						severity: 'info',
						summary: translations['app.success.title'],
						detail: `All '${entity}' permissions revoked`,
					});
				}
			} catch (err) {
				setUserPermissions((prev) =>
					checked
						? prev.filter((id) => !entityPermIds.includes(id))
						: [...new Set([...prev, ...entityPermIds])],
				);
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: (err as Error).message,
				});
			}
		},
		[entry.id, listPermissions, showToast, translations],
	);

	const handleTogglePermission = useCallback(
		async (permission_id: number, checked: boolean, label: string) => {
			if (!entry.id) {
				return;
			}

			const numericId = Number(permission_id);

			setUserPermissions((prev) =>
				checked
					? [...new Set([...prev, numericId])]
					: prev.filter((id) => id !== numericId),
			);

			try {
				if (checked) {
					await createUserPermissions(entry.id, [numericId]);

					showToast({
						severity: 'success',
						summary: translations['app.success.title'],
						detail: `'${label}' granted`,
					});
				} else {
					await deleteUserPermission(entry.id, numericId);

					showToast({
						severity: 'info',
						summary: translations['app.success.title'],
						detail: `'${label}' revoked`,
					});
				}
			} catch (err) {
				setUserPermissions((prev) =>
					checked
						? prev.filter((id) => id !== numericId)
						: [...new Set([...prev, numericId])],
				);
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: (err as Error).message,
				});
			}
		},
		[entry.id, showToast, translations],
	);

	if (isLoading) {
		return <LoadingComponent />;
	}

	if (!permissions.length) {
		return (
			<ErrorComponent
				description={translations['user.error.no_permissions_defined']}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{sortedPermissions.map(([entity, perms]) => {
				const allChecked = perms.every((perm) =>
					userPermissions.includes(Number(perm.id)),
				);

				return (
					<div
						key={entity}
						className="bg-base-200 p-4 border-b border-line last:border-b-0"
					>
						<div className="flex items-center gap-2 font-semibold text-lg mb-1">
							<button
								type="button"
								className="capitalize"
								onClick={() =>
									handleToggleEntity(entity, !allChecked)
								}
							>
								{entity}
							</button>
							<div className="text-sm">
								(
								{
									perms.filter((perm) =>
										userPermissions.includes(
											Number(perm.id),
										),
									).length
								}
								/{perms.length})
							</div>
						</div>

						<div className="flex flex-wrap gap-2">
							{perms.map((perm) => {
								const checked = userPermissions.includes(
									Number(perm.id),
								);

								return (
									<Checkbox
										key={perm.id}
										id={`permission-${perm.id}`}
										isSelected={checked}
										onChange={(checked) =>
											handleTogglePermission(
												Number(perm.id),
												checked,
												`${entity}.${perm.operation}`,
											)
										}
										contentClassName="gap-2 p-2 hover:rounded-md hover:bg-base-300"
									>
										<span className="capitalize">
											{perm.operation}
										</span>
									</Checkbox>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
