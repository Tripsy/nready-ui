import type { Language } from '@/types/common.type';

export const UserRoleEnum = {
	ADMIN: 'admin',
	DRIVER: 'driver',
	OPERATOR: 'operator',
} as const;

export type UserRole = (typeof UserRoleEnum)[keyof typeof UserRoleEnum];

export const UserStatusEnum = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	PENDING: 'pending',
} as const;

export type UserStatus = (typeof UserStatusEnum)[keyof typeof UserStatusEnum];

export const UserOperatorTypeEnum = {
	SELLER: 'seller',
	PRODUCT_MANAGER: 'product_manager',
	CONTENT_EDITOR: 'content_editor',
};

export type UserOperatorType =
	(typeof UserOperatorTypeEnum)[keyof typeof UserOperatorTypeEnum];

export type UserModel<D = Date | string> = {
	id: number;
	name: string;
	email: string;
	email_verified_at: D;
	password_updated_at: D;
	status: UserStatus;
	language: Language;
	role: UserRole;
	operator_type: UserOperatorType | null;
	created_at: D;
	updated_at: D | null;
	deleted_at: D | null;
};

export const displayUserLabel = (entry: UserModel) => {
	return entry.name;
};
