import {
	FormComponentInput,
	FormComponentRadio,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type ClientType, ClientTypeEnum } from '@/models/client.model';
import { useWindowForm } from '@/providers/window-form.provider';

export type ClientFormValuesType = {
	client_type: ClientType;

	company_name?: string | null;
	company_cui?: string | null;
	company_reg_com?: string | null;

	person_name?: string | null;
	person_identification_number?: string | null;

	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;

	notes: string | null;
};

const clientTypes = Object.values(ClientTypeEnum).map((v) => ({
	label: formatEnumLabel(v),
	value: v,
}));

const TRANSLATION_KEYS = [
	'client.field.company_name',
	'client.field.company_cui',
	'client.field.company_reg_com',
	'client.field.person_name',
	'client.field.person_cnp',
	'client.field.contact_name',
	'client.field.contact_email',
	'client.field.contact_phone',
	'client.field.notes',
] as const;

export function FormManageClient() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ClientFormValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const elementIds = useElementIds([
		'clientType',
		'companyName',
		'companyCui',
		'companyRegCom',
		'personName',
		'personCnp',
		'contactName',
		'contactEmail',
		'contactPhone',
		'notes',
	] as const);

	return (
		<>
			<FormComponentRadio<ClientFormValuesType>
				id={elementIds.clientType}
				fieldName="client_type"
				fieldValue={formValues.client_type}
				options={clientTypes}
				disabled={pending}
				onChange={(value) =>
					handleChange('client_type', value as ClientType)
				}
				error={errors.client_type}
			/>

			{formValues.client_type === ClientTypeEnum.COMPANY && (
				<>
					<FormComponentInput<ClientFormValuesType>
						labelText={translations['client.field.company_name']}
						id={elementIds.companyName}
						fieldName="company_name"
						fieldValue={formValues.company_name ?? ''}
						isRequired={true}
						disabled={pending}
						onChange={(e) =>
							handleChange('company_name', e.target.value)
						}
						error={errors.company_name}
					/>

					<div className="grid sm:grid-cols-2 gap-4">
						<FormComponentInput<ClientFormValuesType>
							labelText={translations['client.field.company_cui']}
							id={elementIds.companyCui}
							fieldName="company_cui"
							fieldValue={formValues.company_cui ?? ''}
							isRequired={true}
							disabled={pending}
							onChange={(e) =>
								handleChange('company_cui', e.target.value)
							}
							error={errors.company_cui}
						/>

						<FormComponentInput<ClientFormValuesType>
							labelText={
								translations['client.field.company_reg_com']
							}
							id={elementIds.companyRegCom}
							fieldName="company_reg_com"
							fieldValue={formValues.company_reg_com ?? ''}
							isRequired={false}
							disabled={pending}
							onChange={(e) =>
								handleChange('company_reg_com', e.target.value)
							}
							error={errors.company_reg_com}
						/>
					</div>
				</>
			)}

			{formValues.client_type === ClientTypeEnum.PERSON && (
				<>
					<FormComponentInput<ClientFormValuesType>
						labelText={translations['client.field.person_name']}
						id={elementIds.personName}
						fieldName="person_name"
						fieldValue={formValues.person_name ?? ''}
						isRequired={true}
						disabled={pending}
						onChange={(e) =>
							handleChange('person_name', e.target.value)
						}
						error={errors.person_name}
					/>

					<FormComponentInput<ClientFormValuesType>
						labelText={translations['client.field.person_cnp']}
						id={elementIds.personCnp}
						fieldName="person_identification_number"
						fieldValue={
							formValues.person_identification_number ?? ''
						}
						isRequired={false}
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'person_identification_number',
								e.target.value,
							)
						}
						error={errors.person_identification_number}
					/>
				</>
			)}

			<div className="grid sm:grid-cols-3 gap-4">
				<FormComponentInput<ClientFormValuesType>
					labelText={translations['client.field.contact_name']}
					id={elementIds.contactName}
					fieldName="contact_name"
					fieldValue={formValues.contact_name ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) =>
						handleChange('contact_name', e.target.value)
					}
					error={errors.contact_name}
				/>

				<FormComponentInput<ClientFormValuesType>
					labelText={translations['client.field.contact_email']}
					id={elementIds.contactEmail}
					fieldName="contact_email"
					fieldValue={formValues.contact_email ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) =>
						handleChange('contact_email', e.target.value)
					}
					error={errors.contact_email}
				/>

				<FormComponentInput<ClientFormValuesType>
					labelText={translations['client.field.contact_phone']}
					id={elementIds.contactPhone}
					fieldName="contact_phone"
					fieldValue={formValues.contact_phone ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) =>
						handleChange('contact_phone', e.target.value)
					}
					error={errors.contact_phone}
				/>
			</div>

			<FormComponentTextarea<ClientFormValuesType>
				labelText={translations['client.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				isRequired={false}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
				rows={4}
			/>
		</>
	);
}
