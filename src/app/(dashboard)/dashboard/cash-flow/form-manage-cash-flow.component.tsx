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
import {
	type CashFlowCategory,
	CashFlowCategoryEnum,
	type CashFlowMethod,
	CashFlowMethodEnum,
	filterGroupedCategories,
	getOperationalRecordOptions,
	type OperationalRecordType,
	OperationalRecordTypeEnum,
} from '@/models/cash-flow.model';
import {
	type ClientModel,
	ClientStatusEnum,
	displayClientLabel,
} from '@/models/client.model';
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

	amount: number | null;
	vat_rate: number | null;
	currency: Currency;

	external_reference: string | null;

	parent_id: number | null;

	notes: string | null;

	operational_records?: {
		[key in OperationalRecordType]?: number | null;
	};
	// display-only fields, not part of validation
	client: string | null;
	vendor: string | null;
};

const groupedCategories = filterGroupedCategories([
	CashFlowCategoryEnum.REFUND,
]);

const methods = toOptionsFromEnum(CashFlowMethodEnum, {
	formatter: formatEnumLabel,
});

const currencies = toOptionsFromEnum(CurrencyEnum, {
	formatter: formatEnumLabel,
});

export function FormManageCashFlow({ action }: { action: string }) {
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

	const operationalRecordErrors = errors.operational_records as
		| FormErrorsType<
				NonNullable<CashFlowFormValuesType['operational_records']>
		  >
		| undefined;

	const handleOperationalRecordChange = useCallback(
		(field: OperationalRecordType, value: number | null) => {
			handleChange('operational_records', {
				...formValues.operational_records,
				[field]: value,
			});
		},
		[handleChange, formValues.operational_records],
	);

	const elementIds = useElementIds([
		'category',
		'method',
		'amount',
		'vatRate',
		'currency',
		'externalReference',
		'notes',
		'client',
		'vendor',
	] as const);

	const [searchClient, setSearchClient] = useState('');

	const { suggestions: clientSuggestions, isFetching: isClientFetching } =
		useRemoteAutocomplete<ClientModel>({
			query: searchClient,
			queryKey: ['s-client'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<ClientModel> | undefined =
					await requestFind('client', {
						filter: {
							term: q,
							status: ClientStatusEnum.ACTIVE,
						},
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

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
				case OperationalRecordTypeEnum.CLIENT:
					if (record.client) {
						updatedOperationalRecords[
							OperationalRecordTypeEnum.CLIENT
						] = record.client.id;
						handleChange(
							'client',
							displayClientLabel(record.client),
						);
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
			{action === 'refund' && (
				<>
					<input
						type="hidden"
						name="parent_id"
						value={formValues.parent_id ?? ''}
					/>
					<input
						type="hidden"
						name="category"
						value={CashFlowCategoryEnum.REFUND}
					/>
				</>
			)}

			{action !== 'refund' && (
				<FormComponentSelect<CashFlowFormValuesType>
					labelText="Category"
					id={elementIds.category}
					fieldName="category"
					fieldValue={formValues.category}
					disabled={pending}
					isRequired={true}
					options={groupedCategories}
					onChange={(value) =>
						handleChange('category', value as CashFlowCategory)
					}
					error={errors.category}
				/>
			)}

			<FormComponentSelect<CashFlowFormValuesType>
				labelText="Method"
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
					labelText="Net Amount"
					id={elementIds.amount}
					fieldName="amount"
					fieldType="number"
					fieldValue={formValues.amount ?? null}
					disabled={pending}
					isRequired={true}
					onChange={(e) =>
						handleChange(
							'amount',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.amount}
				/>

				<FormComponentInput<CashFlowFormValuesType>
					labelText="Vat Rate"
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
				labelText="Currency"
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
				labelText="External Reference"
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

			<FormComponentTextarea<CashFlowFormValuesType>
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

			<div className="font-semibold pb-2 border-b">
				Operational records
			</div>

			{operationalRecordOptions.client && (
				<>
					<input
						type="hidden"
						name="operational_records.client"
						value={formValues.operational_records?.client ?? ''}
					/>

					<FormComponentAutoComplete<
						CashFlowFormValuesType,
						ClientModel
					>
						labelText="Client"
						id={elementIds.client}
						fieldName="client"
						fieldValue={formValues.client ?? ''}
						isRequired={
							operationalRecordOptions.client === 'required'
						}
						className="pl-8"
						disabled={pending}
						error={operationalRecordErrors?.client}
						onInputChange={(value) => {
							handleChange('client', value);
							handleOperationalRecordChange(
								OperationalRecordTypeEnum.CLIENT,
								null,
							);
							setSearchClient(value);
						}}
						autoCompleteProps={{
							suggestions: clientSuggestions,
							isLoading: isClientFetching,
							onSelect: (m) => {
								handleChange('client', displayClientLabel(m));
								handleOperationalRecordChange(
									OperationalRecordTypeEnum.CLIENT,
									m.id,
								);
							},
							getOptionLabel: (m) => displayClientLabel(m),
							getOptionKey: (m) => m.id,
						}}
						icons={{
							left: (
								<Icons.Client className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>
				</>
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
						labelText="Vendor"
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
		</>
	);
}
