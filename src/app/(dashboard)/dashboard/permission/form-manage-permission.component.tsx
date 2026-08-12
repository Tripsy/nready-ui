import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useLocalAutocomplete } from '@/hooks/use-local-autocomplete';
import {
	PermissionEntitiesSuggestions,
	type PermissionEntityType,
	PermissionOperationSuggestions,
	type PermissionOperationType,
} from '@/models/permission.model';
import { useWindowForm } from '@/providers/window-form.provider';

export type PermissionFormValuesType = {
	entity: string | null;
	operation: string | null;
};

export function FormManagePermission() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<PermissionFormValuesType>();

	const elementIds = useElementIds(['entity', 'operation'] as const);

	const entityAutocomplete = useLocalAutocomplete<PermissionEntityType>({
		source: PermissionEntitiesSuggestions,
		filter: (item, query) =>
			item.toLowerCase().startsWith(query.toLowerCase()),
		minLength: 1,
	});

	const operationAutocomplete = useLocalAutocomplete<PermissionOperationType>(
		{
			source: PermissionOperationSuggestions,
			filter: (item, query) =>
				item.toLowerCase().startsWith(query.toLowerCase()),
			minLength: 1,
		},
	);

	return (
		<>
			<FormComponentAutoComplete<PermissionFormValuesType, string>
				labelText="Entity"
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
				labelText="Operation"
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
