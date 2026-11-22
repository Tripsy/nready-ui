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
import { type ClientModel, ClientTypeEnum } from '@/models/client.model';

const TRANSLATION_KEYS = [
	'client.field.bank_name',
	'client.field.client_type',
	'client.field.company_cui',
	'client.field.company_name',
	'client.field.company_reg_com',
	'client.field.contact_email',
	'client.field.contact_name',
	'client.field.contact_phone',
	'client.field.created_at',
	'client.field.deleted_at',
	'client.field.iban',
	'client.field.id',
	'client.field.person_identification_number',
	'client.field.person_name',
	'client.field.updated_at',
	'client.field.user',
	'client.section.account',
	'client.section.contact_details',
	'client.section.financial_details',
	'client.section.info',
	'client.section.timestamps',
	'client.text.not_linked',
	...enumTranslationKeys('client.enum.type', ClientTypeEnum),
] as const;

export function ViewClient({ entry }: { entry: ClientModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['client.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="user" />
				</div>
			</div>

			<ViewSection title={translations['client.section.info']}>
				<ViewField
					label={translations['client.field.client_type']}
					value={translateEnumLabel(
						translations,
						'client.enum.type',
						entry.client_type,
					)}
				/>
				{entry.client_type === ClientTypeEnum.COMPANY && (
					<>
						<ViewField
							label={translations['client.field.company_name']}
							value={entry.company_name}
						/>
						<ViewField
							label={translations['client.field.company_cui']}
							value={entry.company_cui}
						/>
						<ViewField
							label={translations['client.field.company_reg_com']}
							value={entry.company_reg_com}
						/>
					</>
				)}
				{entry.client_type === ClientTypeEnum.PERSON && (
					<>
						<ViewField
							label={translations['client.field.person_name']}
							value={entry.person_name}
						/>
						{entry.person_identification_number && (
							<ViewField
								label={
									translations[
										'client.field.person_identification_number'
									]
								}
								value={entry.person_identification_number}
							/>
						)}
					</>
				)}
			</ViewSection>

			<ViewSection title={translations['client.section.account']}>
				<ViewField
					label={translations['client.field.user']}
					value={
						entry.user
							? `${entry.user.name} (#${entry.user.id}) - ${entry.user.email}`
							: entry.user_id
								? `#${entry.user_id}`
								: translations['client.text.not_linked']
					}
				/>
			</ViewSection>

			<ViewSection title={translations['client.section.contact_details']}>
				{entry.client_type === ClientTypeEnum.COMPANY && (
					<ViewField
						label={translations['client.field.contact_name']}
						value={entry.contact_name}
					/>
				)}
				<ViewField
					label={translations['client.field.contact_email']}
					value={entry.contact_email}
				/>
				<ViewField
					label={translations['client.field.contact_phone']}
					value={entry.contact_phone}
				/>
			</ViewSection>

			<ViewSection
				title={translations['client.section.financial_details']}
			>
				<ViewField
					label={translations['client.field.iban']}
					value={entry.iban}
				/>
				<ViewField
					label={translations['client.field.bank_name']}
					value={entry.bank_name}
				/>
			</ViewSection>

			<ViewSection title={translations['client.section.timestamps']}>
				<ViewField
					label={translations['client.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['client.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['client.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
