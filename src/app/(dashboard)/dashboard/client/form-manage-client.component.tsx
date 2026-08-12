import {
	FormComponentInput,
	FormComponentRadio,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { type ClientType, ClientTypeEnum } from '@/models/client.model';
import { useWindowForm } from '@/providers/window-form.provider';

export type ClientFormValuesType = {
	client_type: ClientType;

	company_name?: string | null;
	company_cui?: string | null;
	company_reg_com?: string | null;

	person_name?: string | null;
	person_identification_number?: string | null;

	iban: string | null;
	bank_name: string | null;

	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;

	notes: string | null;
};

const clientTypes = Object.values(ClientTypeEnum).map((v) => ({
	label: formatEnumLabel(v),
	value: v,
}));

export function FormManageClient() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ClientFormValuesType>();

	const elementIds = useElementIds([
		'clientType',
		'companyName',
		'companyCui',
		'companyRegCom',
		'personName',
		'personCnp',
		'iban',
		'bankName',
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
						labelText="Company - Name"
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
							labelText="Company - CUI"
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
							labelText="Company - Reg. Com"
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
						labelText="Person - Name"
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
						labelText="Person - CNP"
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

			<div className="grid sm:grid-cols-2 gap-4">
				<FormComponentInput<ClientFormValuesType>
					labelText="IBAN"
					id={elementIds.iban}
					fieldName="iban"
					fieldValue={formValues.iban ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) => handleChange('iban', e.target.value)}
					error={errors.iban}
				/>

				<FormComponentInput<ClientFormValuesType>
					labelText="Bank Name"
					id={elementIds.bankName}
					fieldName="bank_name"
					fieldValue={formValues.bank_name ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) => handleChange('bank_name', e.target.value)}
					error={errors.bank_name}
				/>
			</div>

			<div className="grid sm:grid-cols-3 gap-4">
				<FormComponentInput<ClientFormValuesType>
					labelText="Contact - Name"
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
					labelText="Contact - Email"
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
					labelText="Contact - Phone"
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
				labelText="Notes"
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
