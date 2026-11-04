import { useEffect, useRef, useState } from 'react';
import {
	FormComponentEmail,
	FormComponentName,
	FormComponentPassword,
	FormComponentRadio,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { isAdmin } from '@/models/account.model';
import {
	type UserOperatorType,
	UserOperatorTypeEnum,
	type UserRole,
	UserRoleEnum,
} from '@/models/user.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { type Language, LanguageEnum } from '@/types/common.type';

export type UserFormValuesType = {
	name: string | null;
	email: string | null;
	password: string | null;
	password_confirm: string | null;
	language: Language;
	role: UserRole;
	operator_type: UserOperatorType | null;
};

const roles = toOptionsFromEnum(UserRoleEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

const operatorTypes = toOptionsFromEnum(UserOperatorTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageUser() {
	const { formOperation, formValues, errors, handleChange, pending } =
		useWindowForm<UserFormValuesType>();

	// An update keeps the current password unless both fields are filled in (`update` schema)
	const isPasswordRequired = formOperation === 'create';

	// Only an admin may assign a role or operator type (`UserPolicy.canAssignRole` in the API).
	// Anyone else sees them read-only, while hidden inputs post the current values back:
	// a disabled control is left out of `FormData`, and `getFormValues` would then default
	// the role to member, which the API refuses as a role change.
	const { auth } = useAuth();
	const canAssignRole = isAdmin(auth);

	const [showPassword, setShowPassword] = useState(false);

	const prevRoleRef = useRef(formValues.role);

	// Clear operator_type when a role changes away from OPERATOR
	useEffect(() => {
		const prevRole = prevRoleRef.current;
		const currentRole = formValues.role;

		if (
			prevRole === UserRoleEnum.OPERATOR &&
			currentRole !== UserRoleEnum.OPERATOR &&
			formValues.operator_type
		) {
			handleChange('operator_type', null);
		}

		prevRoleRef.current = currentRole;
	}, [formValues.role, formValues.operator_type, handleChange]);

	const elementIds = useElementIds([
		'name',
		'email',
		'password',
		'passwordConfirm',
		'language',
		'role',
		'operatorType',
	] as const);

	return (
		<>
			<FormComponentName<UserFormValuesType>
				labelText="Name"
				id={elementIds.name}
				fieldValue={formValues.name ?? ''}
				disabled={pending}
				onChange={(e) => handleChange('name', e.target.value)}
				error={errors.name}
			/>

			<FormComponentEmail<UserFormValuesType>
				labelText="Email"
				id={elementIds.email}
				fieldValue={formValues.email ?? ''}
				disabled={pending}
				onChange={(e) => handleChange('email', e.target.value)}
				error={errors.email}
			/>

			<FormComponentPassword<UserFormValuesType>
				labelText="Password"
				id={elementIds.password}
				fieldName="password"
				fieldValue={formValues.password ?? ''}
				isRequired={isPasswordRequired}
				disabled={pending}
				onChange={(e) => handleChange('password', e.target.value)}
				error={errors.password}
				showPassword={showPassword}
				setShowPassword={setShowPassword}
			/>

			<FormComponentPassword<UserFormValuesType>
				labelText="Confirm Password"
				id={elementIds.passwordConfirm}
				fieldName="password_confirm"
				fieldValue={formValues.password_confirm ?? ''}
				placeholderText="Password confirmation"
				isRequired={isPasswordRequired}
				disabled={pending}
				onChange={(e) =>
					handleChange('password_confirm', e.target.value)
				}
				error={errors.password_confirm}
				showPassword={showPassword}
			/>

			<FormComponentSelect<UserFormValuesType>
				labelText="Language"
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

			<FormComponentRadio<UserFormValuesType>
				labelText="Role"
				id={elementIds.role}
				fieldName="role"
				fieldValue={formValues.role}
				options={roles}
				disabled={pending || !canAssignRole}
				onChange={(value) => handleChange('role', value as UserRole)}
				error={errors.role}
			/>

			{formValues.role === UserRoleEnum.OPERATOR && (
				<FormComponentSelect<UserFormValuesType>
					labelText="Operator Type"
					id={elementIds.operatorType}
					fieldName="operator_type"
					fieldValue={formValues.operator_type ?? ''}
					options={operatorTypes}
					disabled={pending || !canAssignRole}
					onChange={(value) =>
						handleChange(
							'operator_type',
							value as UserOperatorType | null,
						)
					}
					error={errors.operator_type}
				/>
			)}

			{!canAssignRole && (
				<>
					<input type="hidden" name="role" value={formValues.role} />
					{formValues.operator_type && (
						<input
							type="hidden"
							name="operator_type"
							value={formValues.operator_type}
						/>
					)}
				</>
			)}
		</>
	);
}
