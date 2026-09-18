import { normalizeDates } from '@/helpers/model.helper';
import type {
	PermissionEntityType,
	PermissionOperationType,
} from '@/models/permission.model';
import { type UserModel, UserRoleEnum } from '@/models/user.model';

export type AccountModelPermissions = Record<
	PermissionEntityType,
	PermissionOperationType[]
>;

export type AccountModel = UserModel<Date> & {
	permissions: AccountModelPermissions;
	/*
	 * False for a social sign-in account that has never set a password. Supplied by the
	 * backend's auth context - the password hash itself is deliberately never sent, so this
	 * boolean is the only signal the UI gets, and it is what decides whether the "change
	 * password" and "confirm with password" affordances make sense at all.
	 *
	 * Optional because a backend predating the field simply omits it. Read it through
	 * `hasPassword()` rather than directly, so that absence is interpreted in one place.
	 */
	has_password?: boolean;
};

export function isAdmin(data: AccountModel | null): boolean {
	return data?.role === UserRoleEnum.ADMIN;
}

export function isOperator(data: AccountModel | null): boolean {
	return data?.role === UserRoleEnum.OPERATOR;
}

export function isMember(data: AccountModel | null): boolean {
	return data?.role === UserRoleEnum.MEMBER;
}

/**
 * Whether the account can sign in with a password.
 *
 * A missing `has_password` counts as `true`, not `false`. The field only arrives from a
 * backend new enough to send it, and reading its absence as "social account" misreports
 * every user whenever the two sides are out of step - a frontend deployed ahead of the API,
 * or a dev server still running pre-change code. That failure is not cosmetic: it hides the
 * change-password action and drops the confirmation step on account delete. Defaulting to
 * "has a password" keeps both guarded, and the backend rejects the request anyway if the
 * account turns out not to have one.
 */
export function hasPassword(auth: AccountModel | null): boolean {
	return auth?.has_password !== false;
}

export function isAuthenticated(auth: AccountModel | null): boolean {
	return auth !== null;
}

export function hasPermission(
	auth: AccountModel | null,
	entity: PermissionEntityType,
	operation?: PermissionOperationType,
): boolean {
	if (!isAuthenticated(auth)) {
		return false;
	}

	if (isAdmin(auth)) {
		return true;
	}

	if (!isMember(auth) && !isOperator(auth)) {
		return false;
	}

	if (!operation) {
		const permissions = auth?.permissions?.[entity];

		return Array.isArray(permissions) && permissions.length > 0;
	}

	return auth?.permissions?.[entity]?.includes(operation) || false;
}

export function prepareAccountModel(data: AccountModel): AccountModel {
	// `password_updated_at` is listed explicitly: it is a user-model field, so it is not in
	// `normalizeDates`' default set, and `/account/me` sends it as a string like the rest.
	return normalizeDates(data, [
		'created_at',
		'updated_at',
		'deleted_at',
		'password_updated_at',
	]) as unknown as AccountModel;
}
