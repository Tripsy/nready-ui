import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentRadio,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestCreate, requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { resolveWindowEntries } from '@/helpers/window.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type CashFlowCategory,
	type CashFlowMethod,
	CashFlowMethodEnum,
	getOperationalRecordOptions,
	type OperationalRecordType,
	OperationalRecordTypeEnum,
} from '@/models/cash-flow.model';
import {
	displayVendorLabel,
	type VendorModel,
	VendorStatusEnum,
} from '@/models/vendor.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { requestOperationalRecords } from '@/services/cash-flow.service';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import { type Currency, CurrencyEnum } from '@/types/common.type';
import type { FormErrorsType } from '@/types/form.type';

export type CashFlowFormValuesType = {
	category: CashFlowCategory;
	method: CashFlowMethod;

	grossAmount: number | null;
	vat_rate: number | null;
	currency: Currency;

	external_reference: string | null;

	notes: string | null;

	operational_records?: {
		[key in OperationalRecordType]?: number | null;
	};
	// display-only fields, not part of validation
	vendor: string | null;
};

const methods = toOptionsFromEnum(CashFlowMethodEnum, {
	formatter: formatEnumLabel,
});

const currencies = toOptionsFromEnum(CurrencyEnum, {
	formatter: formatEnumLabel,
});

const TRANSLATION_KEYS = [
	'cash-flow.field.method',
	'cash-flow.field.amount',
	'cash-flow.field.vat_rate',
	'cash-flow.field.currency',
	'cash-flow.field.external_reference',
	'cash-flow.field.vendor',
	'cash-flow.field.notes',
] as const;

export function FormManageCashFlow() {
	const queryClient = useQueryClient();

	const { getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const { entry } = windowConfig
		? resolveWindowEntries(windowConfig, 'form')
		: {};

	const entryId = entry && 'id' in entry ? (entry.id as number) : undefined;

	const { data: operationalRecords } = useQuery({
		queryKey: ['cash-flow', 'operational-records', entryId],
		// biome-ignore lint/style/noNonNullAssertion: At this point entryId is always defined
		queryFn: () => requestOperationalRecords(entryId!),
		enabled: !!entryId,
	});

	const { formValues, errors, handleChange, pending } =
		useWindowForm<CashFlowFormValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const operationalRecordErrors = errors.operational_records as
		| FormErrorsType<
				NonNullable<CashFlowFormValuesType['operational_records']>
		  >
		| undefined;

	const handleOperationalRecordChange = (
		field: OperationalRecordType,
		value: number | null,
	) => {
		handleChange('operational_records', {
			...formValues.operational_records,
			[field]: value,
		});
	};

	const elementIds = useElementIds([
		'method',
		'grossAmount',
		'vatRate',
		'currency',
		'externalReference',
		'notes',
		'vendor',
	] as const);

	const [searchVendor, setSearchVendor] = useState('');

	const { suggestions: vendorSuggestions, isFetching: isVendorFetching } =
		useRemoteAutocomplete<VendorModel>({
			query: searchVendor,
			queryKey: ['s-vendor'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<VendorModel> | undefined =
					await requestFind('vendor', {
						filter: {
							term: q,
							status: VendorStatusEnum.ACTIVE,
						},
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	const invalidateVendorSuggestions = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['s-vendor'],
			}),
		[queryClient],
	);

	const operationalRecordOptions = getOperationalRecordOptions(
		formValues.category,
	);

	const isProcessedOperationalRecords = useRef(false);

	useEffect(() => {
		// Skip if not update mode, no records, or already initialized
		if (
			!entryId ||
			!operationalRecords?.length ||
			isProcessedOperationalRecords.current
		) {
			return;
		}

		isProcessedOperationalRecords.current = true;

		const updatedOperationalRecords: CashFlowFormValuesType['operational_records'] =
			{};

		for (const record of operationalRecords) {
			switch (record.operational_record_type) {
				case OperationalRecordTypeEnum.EMPLOYEE:
					if (record.employee) {
						updatedOperationalRecords[
							OperationalRecordTypeEnum.EMPLOYEE
						] = record.employee.id;
					}
					break;
				case OperationalRecordTypeEnum.CLIENT:
					if (record.client) {
						updatedOperationalRecords[
							OperationalRecordTypeEnum.CLIENT
						] = record.client.id;
					}
					break;
				case OperationalRecordTypeEnum.VENDOR:
					if (record.vendor) {
						updatedOperationalRecords[
							OperationalRecordTypeEnum.VENDOR
						] = record.vendor.id;
						handleChange(
							'vendor',
							displayVendorLabel(record.vendor),
						);
					}
					break;
				case OperationalRecordTypeEnum.COMPANY_VEHICLE:
					if (record.company_vehicle) {
						updatedOperationalRecords[
							OperationalRecordTypeEnum.COMPANY_VEHICLE
						] = record.company_vehicle.id;
					}
					break;
				case OperationalRecordTypeEnum.CMR:
					if (record.cmr) {
						updatedOperationalRecords[
							OperationalRecordTypeEnum.CMR
						] = record.cmr.id;
					}
					break;
			}
		}

		handleChange('operational_records', updatedOperationalRecords);
	}, [entryId, operationalRecords, handleChange]);

	const createVendorMutation = useMutation({
		mutationFn: async (name: string) => {
			const res: ApiResponseFetch<Partial<VendorModel>> =
				await requestCreate('vendor', {
					name,
				});

			return res?.data;
		},
	});

	return (
		<>
			<input type="hidden" name="category" value={formValues.category} />

			<FormComponentSelect<CashFlowFormValuesType>
				labelText={translations['cash-flow.field.method']}
				id={elementIds.method}
				fieldName="method"
				fieldValue={formValues.method}
				disabled={pending}
				isRequired={true}
				options={methods}
				onChange={(value) =>
					handleChange('method', value as CashFlowMethod)
				}
				error={errors.method}
			/>

			<div className="flex flex-wrap gap-2">
				<FormComponentInput<CashFlowFormValuesType>
					labelText={translations['cash-flow.field.amount']}
					id={elementIds.grossAmount}
					fieldName="grossAmount"
					fieldType="number"
					fieldValue={formValues.grossAmount ?? null}
					disabled={pending}
					isRequired={true}
					onChange={(e) =>
						handleChange(
							'grossAmount',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.grossAmount}
				/>

				<FormComponentInput<CashFlowFormValuesType>
					labelText={translations['cash-flow.field.vat_rate']}
					id={elementIds.vatRate}
					fieldName="vat_rate"
					fieldType="number"
					fieldValue={formValues.vat_rate ?? null}
					disabled={pending}
					isRequired={true}
					onChange={(e) =>
						handleChange(
							'vat_rate',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.vat_rate}
				/>
			</div>

			<FormComponentRadio<CashFlowFormValuesType>
				labelText={translations['cash-flow.field.currency']}
				id={elementIds.currency}
				fieldName="currency"
				fieldValue={formValues.currency}
				disabled={pending}
				options={currencies}
				onChange={(value) =>
					handleChange('currency', value as Currency)
				}
				error={errors.currency}
			/>

			<FormComponentInput<CashFlowFormValuesType>
				labelText={translations['cash-flow.field.external_reference']}
				id={elementIds.externalReference}
				fieldName="external_reference"
				fieldValue={formValues.external_reference ?? ''}
				isRequired={false}
				disabled={pending}
				onChange={(e) =>
					handleChange('external_reference', e.target.value)
				}
				error={errors.external_reference}
			/>

			{operationalRecordOptions.client && (
				<input
					type="hidden"
					name="operational_records.client"
					value={formValues.operational_records?.client ?? ''}
				/>
			)}

			{operationalRecordOptions.employee && (
				<input
					type="hidden"
					name="operational_records.employee"
					value={formValues.operational_records?.employee ?? ''}
				/>
			)}

			{operationalRecordOptions.vendor && (
				<>
					<input
						type="hidden"
						name="operational_records.vendor"
						value={formValues.operational_records?.vendor ?? ''}
					/>

					<FormComponentAutoComplete<
						CashFlowFormValuesType,
						VendorModel
					>
						labelText={translations['cash-flow.field.vendor']}
						id={elementIds.vendor}
						fieldName="vendor"
						fieldValue={formValues.vendor ?? ''}
						isRequired={
							operationalRecordOptions.vendor === 'required'
						}
						className="pl-8"
						disabled={pending}
						error={operationalRecordErrors?.vendor}
						onInputChange={(value) => {
							handleChange('vendor', value);
							handleOperationalRecordChange(
								OperationalRecordTypeEnum.VENDOR,
								null,
							);
							setSearchVendor(value);
						}}
						autoCompleteProps={{
							suggestions: vendorSuggestions,
							isLoading: isVendorFetching,
							onSelect: (m) => {
								handleChange('vendor', displayVendorLabel(m));
								handleOperationalRecordChange(
									OperationalRecordTypeEnum.VENDOR,
									m.id,
								);
							},
							getOptionLabel: (m) => displayVendorLabel(m),
							getOptionKey: (m) => m.id,

							allowCreate: true,

							onCreate: async (value) => {
								const newVendor =
									await createVendorMutation.mutateAsync(
										value,
									);

								if (!newVendor) {
									return;
								}

								handleChange(
									'vendor',
									displayVendorLabel(
										newVendor as VendorModel,
									),
								);
								handleOperationalRecordChange(
									OperationalRecordTypeEnum.VENDOR,
									newVendor.id as number,
								);

								await invalidateVendorSuggestions();
							},

							createLabel: (value) => `Create vendor "${value}"`,
						}}
						icons={{
							left: (
								<Icons.Vendor className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>
				</>
			)}

			{operationalRecordOptions.company_vehicle && (
				<input
					type="hidden"
					name="operational_records.company_vehicle"
					value={
						formValues.operational_records?.company_vehicle ?? ''
					}
				/>
			)}

			{operationalRecordOptions.cmr && (
				<input
					type="hidden"
					name="operational_records.cmr"
					value={formValues.operational_records?.cmr ?? ''}
				/>
			)}

			<FormComponentTextarea<CashFlowFormValuesType>
				labelText={translations['cash-flow.field.notes']}
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
