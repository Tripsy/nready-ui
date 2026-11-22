'use client';

import { useMemo } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useLocalAutocomplete } from '@/hooks/use-local-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	PermissionEntitiesSuggestions,
	type PermissionEntityType,
	type PermissionOperationType,
	permissionOperationsFor,
} from '@/models/permission.model';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'permission.field.entity',
	'permission.field.operation',
] as const;

export type PermissionFormValuesType = {
	entity: string | null;
	operation: string | null;
};

export function FormManagePermission() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<PermissionFormValuesType>();

	const elementIds = useElementIds(['entity', 'operation'] as const);

	const entityAutocomplete = useLocalAutocomplete<PermissionEntityType>({
		source: PermissionEntitiesSuggestions,
		filter: (item, query) =>
			item.toLowerCase().startsWith(query.toLowerCase()),
		minLength: 1,
	});

	/*
	 * Memoized because `useLocalAutocomplete` keys its suggestions on the array identity - a
	 * fresh one per render would recompute the list on every keystroke in either field.
	 */
	const operationSource = useMemo(
		() => permissionOperationsFor(formValues.entity),
		[formValues.entity],
	);

	const operationAutocomplete = useLocalAutocomplete<PermissionOperationType>(
		{
			source: operationSource,
			filter: (item, query) =>
				item.toLowerCase().startsWith(query.toLowerCase()),
			minLength: 1,
		},
	);

	return (
		<>
			<FormComponentAutoComplete<PermissionFormValuesType, string>
				labelText={translations['permission.field.entity']}
				id={elementIds.entity}
				fieldName="entity"
				fieldValue={formValues.entity}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.entity}
				onInputChange={(value) => {
					handleChange('entity', value);
					entityAutocomplete.setQuery(value);
				}}
				autoCompleteProps={{
					suggestions: entityAutocomplete.suggestions,
					getOptionLabel: (item) => item,
				}}
				icons={{
					left: (
						<Icons.TextSearch className="opacity-40 h-4.5 w-4.5" />
					),
				}}
			/>

			<FormComponentAutoComplete<PermissionFormValuesType, string>
				labelText={translations['permission.field.operation']}
				id={elementIds.operation}
				fieldName="operation"
				fieldValue={formValues.operation}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.operation}
				onInputChange={(value) => {
					handleChange('operation', value);
					operationAutocomplete.setQuery(value);
				}}
				autoCompleteProps={{
					suggestions: operationAutocomplete.suggestions,
					getOptionLabel: (item) => item,
				}}
				icons={{
					left: (
						<Icons.TextSearch className="opacity-40 h-4.5 w-4.5" />
					),
				}}
			/>
		</>
	);
}
