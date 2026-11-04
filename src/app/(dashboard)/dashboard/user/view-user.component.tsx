'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type UserModel,
	UserOperatorTypeEnum,
	UserRoleEnum,
} from '@/models/user.model';

const TRANSLATION_KEYS = [
	'user.field.created_at',
	'user.field.deleted_at',
	'user.field.email',
	'user.field.id',
	'user.field.language',
	'user.field.name',
	'user.field.role',
	'user.field.status',
	'user.field.updated_at',
	'user.section.account_info',
	'user.section.profile',
	'user.section.timestamps',
	...enumTranslationKeys('user.enum.role', UserRoleEnum),
	...enumTranslationKeys('user.enum.operator_type', UserOperatorTypeEnum),
] as const;

export function ViewUser({ entry }: { entry: UserModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['user.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['user.section.profile']}>
				<ViewField
					label={translations['user.field.name']}
					value={entry.name}
				/>
				<ViewField
					label={translations['user.field.email']}
					value={entry.email}
				/>
			</ViewSection>

			<ViewSection>
				<ViewField
					label={translations['user.field.language']}
					value={entry.language}
				/>
			</ViewSection>

			<ViewSection title={translations['user.section.account_info']}>
				<ViewField
					label={translations['user.field.role']}
					value={
						<>
							{translateEnumLabel(
								translations,
								'user.enum.role',
								entry.role,
							)}
							{entry.role === UserRoleEnum.OPERATOR &&
								entry.operator_type && (
									<span>
										{' '}
										/{' '}
										{translateEnumLabel(
											translations,
											'user.enum.operator_type',
											entry.operator_type,
										)}
									</span>
								)}
						</>
					}
				/>
				<ViewField
					label={translations['user.field.status']}
					value={
						<div className="max-w-60">
							<DisplayStatus
								status={entry.status}
								dataSource="user"
							/>
						</div>
					}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['user.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>

			<ViewSection title={translations['user.section.timestamps']}>
				<ViewField
					label={translations['user.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['user.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
