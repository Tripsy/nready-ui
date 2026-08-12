import {
	Input as AriaInput,
	ComboBox,
	DatePicker,
	Header,
	Label,
	ListBox,
	Select,
} from '@heroui/react';
import { CalendarDate, parseDate } from '@internationalized/date';
import React, { type JSX, useEffect, useRef, useState } from 'react';
import { ActionButtonContent } from '@/components/action-button.component';
import { FormElementError } from '@/components/form/form-element-error.component';
import { Icons } from '@/components/icon.component';
import { LoadingIcon } from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
	Popover,
	PopoverContent,
	PopoverTriggerButton,
} from '@/components/ui/popover';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/helpers/css.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { ButtonAppearanceType } from '@/types/html.type';

export type InputValueType = string | null | undefined;
export type OptionValueType = string | null | undefined;
export type CheckboxValueType = boolean;
export type OptionsType = {
	label: string;
	value: string;
}[];
export type GroupedOptionsType = {
	label: string;
	options: OptionsType;
}[];

/**
 * Id of the `<Label>` that `FormElement` renders for a field.
 *
 * react-aria fields (Select, ComboBox, …) derive their accessible name from a
 * `<Label>` rendered *inside* their own context, or from `aria-label` /
 * `aria-labelledby`. This project's labels live one level up in `FormElement`, so
 * those fields must point back at the label with `aria-labelledby` — otherwise
 * react-aria logs "If you do not provide a visible label, you must specify an
 * aria-label or aria-labelledby attribute for accessibility" and the control ends
 * up with no accessible name.
 */
export const getFieldLabelId = (id: string): string => `${id}-label`;

export const FormElement = ({
	children,
	className,
	label,
	error,
}: {
	children: JSX.Element;
	className?: string;
	label?: { text?: string; for?: string; id?: string; required?: boolean };
	error?: string[];
}): JSX.Element | null => (
	<div className={cn('form-element', className)}>
		{label &&
			(label.for ? (
				// HeroUI's `isRequired` renders the asterisk via `.label--required`,
				// so the marker is not duplicated in markup here.
				<Label
					id={getFieldLabelId(label.for)}
					htmlFor={label.for}
					isRequired={label.required}
				>
					{label.text}
				</Label>
			) : (
				// Group labels (radio) have no single control for `htmlFor` to point
				// at, so the group references this element via `aria-labelledby`.
				<div id={label.id} className="label-placeholder">
					{label.text}
					{label.required && (
						<span className="text-danger ml-1">*</span>
					)}
				</div>
			))}
		<div>
			{children}
			{error && <FormElementError messages={error} />}
		</div>
	</div>
);

export const FormElementWrapper = ({
	children,
	className,
}: {
	children: JSX.Element;
	className?: string;
}): JSX.Element | null => (
	<div className={cn('form-element-wrapper', className)}>{children}</div>
);

export const FormElementIcon = ({
	children,
	className,
	position = 'left',
}: {
	children: JSX.Element;
	className?: string;
	position?: 'left' | 'right';
}): JSX.Element | null => (
	<div
		className={cn(
			'form-element-icon',
			position === 'left'
				? 'form-element-icon-left'
				: 'form-element-icon-right',
			className,
		)}
	>
		{children}
	</div>
);

const stateConfig = {
	default: {
		borderClass: '',
	},
	success: {
		borderClass: 'border border-success focus-visible:ring-success',
	},
	error: {
		borderClass: 'border border-danger focus-visible:ring-danger',
	},
	warning: {
		borderClass: 'border border-warning focus-visible:ring-warning',
	},
};

const useFieldState = ({
	value,
	error,
}: {
	value?: string | number | boolean | null;
	error?: string[];
}) => {
	if (error?.length) {
		return stateConfig.error;
	}

	if (value !== null && value !== undefined && value !== '') {
		return stateConfig.success;
	}

	return stateConfig.default;
};

export type FormComponentProps<Fields, Value> = {
	id: string;
	labelText?: string;
	fieldType?: 'text' | 'password' | 'email' | 'number' | 'time';
	fieldName: keyof Fields & string;
	fieldValue: Value;
	isRequired?: boolean;
	className?: string;
	placeholderText?: string;
	disabled: boolean;
	autoComplete?:
		| 'current-password'
		| 'new-password'
		| 'name'
		| 'email'
		| 'organization';
	onChange: React.ChangeEventHandler<HTMLInputElement>;
	error?: string[];
	icons?: { left?: JSX.Element; right?: JSX.Element };
};

/** Standard form elements **/

export const FormComponentInput = <Fields,>({
	labelText,
	id,
	fieldType = 'text',
	fieldName,
	fieldValue,
	isRequired = false,
	className = 'w-full',
	placeholderText,
	disabled,
	autoComplete,
	onChange,
	error,
	icons,
}: FormComponentProps<Fields, InputValueType | number>) => {
	const { borderClass } = useFieldState({ value: fieldValue, error });

	return (
		<FormElement
			label={{ for: id, text: labelText, required: isRequired }}
			error={error}
		>
			<FormElementWrapper>
				<div>
					{icons?.left && (
						<FormElementIcon position="left">
							{icons.left}
						</FormElementIcon>
					)}

					<Input
						type={fieldType}
						id={id}
						name={fieldName}
						value={fieldValue ?? ''}
						className={cn(borderClass, className)}
						placeholder={placeholderText}
						autoComplete={autoComplete}
						disabled={disabled}
						aria-invalid={!!error}
						onChange={onChange}
					/>

					{icons?.right && (
						<FormElementIcon position="right">
							{icons.right}
						</FormElementIcon>
					)}
				</div>
			</FormElementWrapper>
		</FormElement>
	);
};

type FormComponentTimeProps<Fields> = Omit<
	FormComponentProps<Fields, InputValueType>,
	'fieldType' | 'autoComplete' | 'icons'
> & {
	minTime?: string;
	maxTime?: string;
	minuteInterval?: number;
};

export const FormComponentTime = <Fields,>({
	labelText,
	id,
	fieldName,
	fieldValue,
	isRequired = false,
	className = 'min-w-36',
	placeholderText = '--:--',
	disabled,
	onChange,
	error,
	minTime,
	maxTime,
	minuteInterval = 1,
}: FormComponentTimeProps<Fields>) => {
	const [open, setOpen] = useState(false);
	const { borderClass } = useFieldState({ value: fieldValue, error });

	const hours = Array.from({ length: 24 }, (_, i) =>
		String(i).padStart(2, '0'),
	).filter((h) => {
		if (minTime && `${h}:59` < minTime) {
			return false;
		}

		if (maxTime && `${h}:00` > maxTime) {
			return false;
		}

		return true;
	});

	const getMinutes = (selectedHour: string) => {
		const interval = minuteInterval > 1 ? minuteInterval : 1;
		return Array.from({ length: Math.floor(60 / interval) }, (_, i) =>
			String(i * interval).padStart(2, '0'),
		).filter((m) => {
			const time = `${selectedHour}:${m}`;

			if (minTime && time < minTime) {
				return false;
			}

			if (maxTime && time > maxTime) {
				return false;
			}

			return true;
		});
	};

	const [selectedHour, selectedMinute] = fieldValue
		? fieldValue.split(':')
		: [null, null];

	const handleHourSelect = (hour: string) => {
		const minutes = getMinutes(hour);
		const minute =
			selectedMinute && minutes.includes(selectedMinute)
				? selectedMinute
				: minutes[0];

		const syntheticEvent = {
			target: { value: `${hour}:${minute ?? '00'}`, name: fieldName },
		} as React.ChangeEvent<HTMLInputElement>;

		onChange(syntheticEvent);
	};

	const handleMinuteSelect = (minute: string) => {
		const hour = selectedHour ?? '00';

		const syntheticEvent = {
			target: { value: `${hour}:${minute}`, name: fieldName },
		} as React.ChangeEvent<HTMLInputElement>;

		onChange(syntheticEvent);

		setOpen(false);
	};

	const minutes = selectedHour ? getMinutes(selectedHour) : [];

	return (
		<FormElement
			label={{ for: id, text: labelText, required: isRequired }}
			error={error}
		>
			<div>
				<input
					type="hidden"
					name={fieldName}
					value={fieldValue ?? ''}
				/>
				<Popover isOpen={open} onOpenChange={setOpen}>
					<PopoverTriggerButton
						id={id}
						variant="outline"
						className={cn(
							'justify-start text-left text-sm',
							!fieldValue && 'text-muted',
							borderClass,
							className,
						)}
						disabled={disabled}
					>
						<Icons.Clock className="mr-2 h-4 w-4" />
						{fieldValue ?? <span>{placeholderText}</span>}
					</PopoverTriggerButton>
					<PopoverContent
						className="w-auto p-2"
						placement="bottom start"
					>
						<div className="flex gap-2">
							{/* Hours */}
							<div className="flex flex-col gap-1">
								<p className="text-xs text-muted text-center pb-1">
									HH
								</p>
								<ul className="h-48 overflow-y-auto flex flex-col gap-0.5">
									{hours.map((hour) => (
										<li key={hour}>
											<button
												type="button"
												onClick={() =>
													handleHourSelect(hour)
												}
												className={cn(
													'w-full px-3 py-1 text-sm rounded hover:bg-accent-soft',
													selectedHour === hour &&
														'bg-accent-soft font-semibold',
												)}
											>
												{hour}
											</button>
										</li>
									))}
								</ul>
							</div>

							<div className="w-px bg-border" />

							{/* Minutes */}
							<div className="flex flex-col gap-1">
								<p className="text-xs text-muted text-center pb-1">
									MM
								</p>
								<ul className="h-48 overflow-y-auto flex flex-col gap-0.5">
									{minutes.map((minute) => (
										<li key={minute}>
											<button
												type="button"
												onClick={() =>
													handleMinuteSelect(minute)
												}
												className={cn(
													'w-full px-3 py-1 text-sm rounded hover:bg-accent-soft',
													selectedMinute === minute &&
														'bg-accent-soft font-semibold',
												)}
											>
												{minute}
											</button>
										</li>
									))}
								</ul>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</FormElement>
	);
};

export const FormComponentTextarea = <Fields,>({
	labelText,
	id,
	fieldName,
	fieldValue,
	isRequired = false,
	className = 'w-full',
	placeholderText,
	disabled,
	onChange,
	error,
	rows,
}: Omit<
	FormComponentProps<Fields, InputValueType>,
	'fieldType' | 'autoComplete' | 'onChange' | 'icons'
> & {
	onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	rows: number;
}) => {
	const { borderClass } = useFieldState({ value: fieldValue, error });

	return (
		<FormElement
			label={{ for: id, text: labelText, required: isRequired }}
			error={error}
		>
			<FormElementWrapper>
				<Textarea
					id={id}
					name={fieldName}
					value={fieldValue ?? ''}
					className={cn(borderClass, className)}
					placeholder={placeholderText}
					disabled={disabled}
					aria-invalid={!!error}
					onChange={onChange}
					rows={rows}
				/>
			</FormElementWrapper>
		</FormElement>
	);
};

export const FormComponentSelect = <Fields,>({
	labelText,
	id,
	fieldName,
	fieldValue,
	isRequired = false,
	className,
	placeholderText = '-select-',
	disabled,
	error,
	options,
	onChange,
	searchable = false,
}: Omit<
	FormComponentProps<Fields, OptionValueType>,
	'autoComplete' | 'icons' | 'onChange'
> & {
	options: OptionsType | GroupedOptionsType;
	onChange: (value: string) => void;
	/** Render a searchable combobox (type-to-filter) instead of a plain select. */
	searchable?: boolean;
}) => {
	const { borderClass } = useFieldState({ value: fieldValue, error });

	const isGrouped = 'options' in options[0];

	// Shared option collection — identical for the Select and ComboBox variants.
	const listBoxItems = isGrouped
		? (options as GroupedOptionsType).map((group) => (
				<ListBox.Section
					key={group.label}
					className="[&:not(:first-child)]:mt-1 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border [&:not(:first-child)]:pt-1"
				>
					<Header className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
						{group.label}
					</Header>

					{group.options.map(({ label, value }) => (
						<ListBox.Item
							key={value}
							id={value}
							textValue={label}
							className="rounded-md"
						>
							{label}
							<ListBox.Item.Indicator />
						</ListBox.Item>
					))}
				</ListBox.Section>
			))
		: (options as OptionsType).map(({ label, value }) => (
				<ListBox.Item
					key={value}
					id={value}
					textValue={label}
					className="rounded-md"
				>
					{label}
					<ListBox.Item.Indicator />
				</ListBox.Item>
			));

	return (
		<FormElement
			label={{ for: id, text: labelText, required: isRequired }}
			error={error}
		>
			<div>
				<input
					type="hidden"
					name={fieldName}
					value={fieldValue ?? ''}
					disabled={disabled}
				/>

				{searchable ? (
					<ComboBox
						fullWidth
						aria-labelledby={getFieldLabelId(id)}
						selectedKey={fieldValue ?? null}
						onSelectionChange={(key) =>
							onChange(key == null ? '' : String(key))
						}
						isDisabled={disabled}
					>
						<ComboBox.InputGroup>
							<AriaInput
								id={id}
								placeholder={placeholderText}
								className={cn(
									'h-10 w-full rounded-md border border-border shadow-none',
									borderClass,
									className,
								)}
							/>
							<ComboBox.Trigger />
						</ComboBox.InputGroup>
						<ComboBox.Popover className="rounded-md">
							<ListBox>{listBoxItems}</ListBox>
						</ComboBox.Popover>
					</ComboBox>
				) : (
					<Select
						fullWidth
						aria-labelledby={getFieldLabelId(id)}
						selectedKey={fieldValue ?? null}
						onSelectionChange={(key) =>
							onChange(key == null ? '' : String(key))
						}
						isDisabled={disabled}
						placeholder={placeholderText}
					>
						<Select.Trigger
							id={id}
							className={cn(
								'items-center rounded-md border border-border shadow-none',
								borderClass,
								className,
							)}
						>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover className="rounded-md">
							<ListBox>{listBoxItems}</ListBox>
						</Select.Popover>
					</Select>
				)}
			</div>
		</FormElement>
	);
};

export const FormComponentCheckbox = <Fields,>({
	children,
	id,
	fieldName,
	checked,
	className,
	disabled,
	error,
	onCheckedChange,
}: Omit<
	FormComponentProps<Fields, CheckboxValueType>,
	| 'labelText'
	| 'fieldType'
	| 'fieldValue'
	| 'isRequired'
	| 'placeholderText'
	| 'autoComplete'
	| 'icons'
	| 'onChange'
> & {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	children: JSX.Element | string;
}) => {
	const { borderClass } = useFieldState({ value: checked, error });

	return (
		<FormElement error={error}>
			<Checkbox
				id={id}
				name={fieldName}
				isDisabled={disabled}
				isInvalid={!!error}
				isSelected={checked}
				onChange={onCheckedChange}
				className={className}
				contentClassName="gap-2"
				controlClassName={borderClass}
			>
				{children}
			</Checkbox>
		</FormElement>
	);
};

export const FormComponentRadio = <Fields,>({
	labelText,
	id,
	fieldName,
	fieldValue,
	isRequired,
	className,
	disabled,
	error,
	options,
	onChange,
}: Omit<
	FormComponentProps<Fields, OptionValueType>,
	'fieldType' | 'onChange' | 'placeholderText' | 'autoComplete' | 'icons'
> & {
	options: OptionsType;
	onChange: (value: string) => void;
}) => (
	<FormElement
		label={{
			id: getFieldLabelId(id),
			text: labelText,
			required: isRequired,
		}}
		error={error}
	>
		<div>
			<input
				type="hidden"
				name={fieldName}
				value={fieldValue ?? ''}
				disabled={disabled}
			/>

			{/* `orientation` supplies the horizontal wrapping row (HeroUI's
			    `.radio-group` is `flex flex-col` otherwise), replacing the
			    `flex flex-wrap gap-4` this used to hardcode as a className. */}
			<RadioGroup
				aria-labelledby={getFieldLabelId(id)}
				orientation="horizontal"
				value={fieldValue ?? null}
				onChange={onChange}
				className={className}
				isDisabled={disabled}
			>
				{options.map(({ label, value }) => (
					<Radio
						key={`${id}-${value}`}
						value={value}
						contentClassName="font-normal"
					>
						{label}
					</Radio>
				))}
			</RadioGroup>
		</div>
	</FormElement>
);

export const FormComponentCalendarWithoutFormElement = <Fields,>({
	id,
	fieldName,
	fieldValue,
	className = 'min-w-40',
	placeholderText,
	ariaLabel,
	disabled,
	onSelect,
	minDate,
	maxDate,
}: Omit<
	FormComponentProps<Fields, InputValueType>,
	| 'labelText'
	| 'fieldType'
	| 'isRequired'
	| 'autoComplete'
	| 'icons'
	| 'onChange'
> & {
	onSelect: (value: string) => void;
	minDate?: Date;
	maxDate?: Date;
	/**
	 * Accessible name for the picker. Needed because `placeholderText` is optional and,
	 * for filters, arrives a tick late from `useTranslation` — react-aria's DatePicker
	 * warns when it renders with neither a visible label nor an aria-label.
	 */
	ariaLabel?: string;
}) => {
	// The project stores dates as `YYYY-MM-DD`, which is exactly what `parseDate`
	// reads and `CalendarDate.toString()` emits — no timezone conversion is involved
	// in either direction. `minDate`/`maxDate` arrive as JS `Date`s and are read as
	// local calendar parts, matching what the calendar displays.
	const value = fieldValue ? parseDate(fieldValue) : null;

	const toCalendarDate = (date: Date) =>
		new CalendarDate(
			date.getFullYear(),
			date.getMonth() + 1,
			date.getDate(),
		);

	return (
		<>
			<input type="hidden" name={fieldName} value={fieldValue ?? ''} />

			<DatePicker
				value={value}
				onChange={(date) => onSelect(date ? date.toString() : '')}
				minValue={minDate ? toCalendarDate(minDate) : undefined}
				maxValue={maxDate ? toCalendarDate(maxDate) : undefined}
				isDisabled={disabled}
				aria-label={ariaLabel ?? placeholderText}
			>
				<DatePicker.Trigger
					id={id}
					// Also on the trigger, not just the root: react-aria defaults this
					// button's name to "Calendar", so without it every picker in a form
					// reads identically and none says which field it belongs to.
					aria-label={ariaLabel ?? placeholderText}
					className={cn(
						'min-h-9 justify-start gap-2 rounded-md border border-border px-3 py-2 text-left text-base sm:text-sm',
						!fieldValue && 'text-muted',
						className,
					)}
				>
					<DatePicker.TriggerIndicator>
						<Icons.Calendar className="h-4 w-4" />
					</DatePicker.TriggerIndicator>
					{fieldValue || placeholderText}
				</DatePicker.Trigger>
				<DatePicker.Popover className="rounded-md">
					<Calendar />
				</DatePicker.Popover>
			</DatePicker>
		</>
	);
};

export const FormComponentCalendar = <Fields,>({
	labelText,
	id,
	fieldName,
	fieldValue,
	isRequired,
	className,
	placeholderText,
	disabled,
	error,
	onSelect,
	minDate,
	maxDate,
}: Omit<
	FormComponentProps<Fields, InputValueType>,
	'fieldType' | 'autoComplete' | 'icons' | 'onChange'
> & {
	onSelect: (value: string) => void;
	minDate?: Date;
	maxDate?: Date;
}) => {
	return (
		<FormElement
			label={{ for: id, text: labelText, required: isRequired }}
			error={error}
		>
			<FormComponentCalendarWithoutFormElement
				id={id}
				fieldName={fieldName}
				fieldValue={fieldValue}
				className={className}
				placeholderText={placeholderText}
				// The visible <label> is wired via `for`, but react-aria reads props, not
				// the DOM — so the field's label doubles as the picker's accessible name.
				ariaLabel={labelText}
				disabled={disabled}
				onSelect={onSelect}
				minDate={minDate}
				maxDate={maxDate}
			/>
		</FormElement>
	);
};

export const FormComponentAutoComplete = <Fields, T>({
	labelText,
	id,
	fieldName,
	fieldValue,
	isRequired = false,
	className = 'w-full',
	placeholderText,
	disabled,
	error,
	icons,
	onInputChange,
	autoCompleteProps,
}: Omit<
	FormComponentProps<Fields, InputValueType>,
	'fieldType' | 'autoComplete' | 'onChange' | 'icons'
> & {
	icons?: { left?: JSX.Element };
	onInputChange?: (value: string) => void;
	autoCompleteProps: {
		suggestions: readonly T[];
		onSelect?: (item: T) => void;

		getOptionLabel: (item: T) => string;
		getOptionKey?: (item: T) => string | number;

		maxSuggestions?: number;

		isLoading?: boolean;
		emptyMessage?: string;
		loadingMessage?: string;

		allowCreate?: boolean;
		onCreate?: (value: string) => void;
		createLabel?: (value: string) => string;
	};
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [inputValue, setInputValue] = useState(fieldValue ?? '');
	const [highlightedIndex, setHighlightedIndex] = useState(-1);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Sync external value
	useEffect(() => {
		setInputValue(fieldValue ?? '');
	}, [fieldValue]);

	// Click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;

		setInputValue(newValue);
		onInputChange?.(newValue);

		setIsOpen(true);
		setHighlightedIndex(-1);
	};

	const handleSuggestionClick = (item: T) => {
		const label = autoCompleteProps.getOptionLabel(item);

		setInputValue(label);
		autoCompleteProps.onSelect?.(item);

		setIsOpen(false);
		setHighlightedIndex(-1);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!isOpen) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				setIsOpen(true);
			}
			return;
		}

		const suggestionsList = autoCompleteProps.suggestions.slice(
			0,
			autoCompleteProps.maxSuggestions || 99,
		);

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev < suggestionsList.length - 1 ? prev + 1 : prev,
				);
				break;

			case 'ArrowUp':
				e.preventDefault();
				setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;

			case 'Enter':
				e.preventDefault();
				if (
					highlightedIndex >= 0 &&
					highlightedIndex < suggestionsList.length
				) {
					handleSuggestionClick(suggestionsList[highlightedIndex]);
				}
				break;

			case 'Escape':
			case 'Tab':
				setIsOpen(false);
				setHighlightedIndex(-1);
				break;
		}
	};

	const handleClear = () => {
		setInputValue('');
		onInputChange?.('');
		inputRef.current?.focus();
	};

	const shouldShowDropdown = isOpen && !disabled && inputValue.length > 0;

	const displayedSuggestions = autoCompleteProps.suggestions.slice(
		0,
		autoCompleteProps.maxSuggestions || 99,
	);

	const { borderClass } = useFieldState({ value: fieldValue, error });

	const isLoading = autoCompleteProps.isLoading;
	const isEmpty =
		!isLoading &&
		displayedSuggestions.length === 0 &&
		!autoCompleteProps.allowCreate;

	const canCreate =
		autoCompleteProps.allowCreate &&
		!isLoading &&
		inputValue.trim().length > 0 &&
		displayedSuggestions.length === 0;

	return (
		<FormElement
			label={{ for: id, text: labelText, required: isRequired }}
			error={error}
		>
			<div ref={wrapperRef} className="relative w-full">
				<FormElementWrapper>
					<div>
						{icons?.left && (
							<FormElementIcon position="left">
								{icons.left}
							</FormElementIcon>
						)}

						<Input
							ref={inputRef}
							type="text"
							id={id}
							name={fieldName}
							value={inputValue}
							className={cn(borderClass, 'pr-8', className)}
							placeholder={placeholderText}
							disabled={disabled}
							aria-invalid={!!error}
							onChange={handleOnChange}
							onKeyDown={handleKeyDown}
						/>

						{inputValue && !disabled && (
							<FormElementIcon position="right">
								<button
									type="button"
									onClick={handleClear}
									className="cursor-pointer"
								>
									<Icons.Clear className="h-4.5 w-4.5 text-muted hover:text-foreground" />
								</button>
							</FormElementIcon>
						)}
					</div>
				</FormElementWrapper>

				{shouldShowDropdown && (
					<ul className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-overlay border border-border rounded-md shadow-lg">
						{/* Loading */}
						{isLoading && (
							<li className="px-3 py-2 text-sm text-muted">
								{autoCompleteProps.loadingMessage ??
									'Searching...'}
							</li>
						)}

						{/* Empty */}
						{isEmpty && (
							<li className="px-3 py-2 text-sm text-muted">
								{autoCompleteProps.emptyMessage ?? 'No results'}
							</li>
						)}

						{canCreate && (
							<li className="list-none">
								<button
									type="button"
									onClick={() => {
										autoCompleteProps.onCreate?.(
											inputValue,
										);
										setIsOpen(false);
									}}
									className="w-full px-3 py-2 text-sm text-left text-accent hover:bg-accent-soft"
								>
									{autoCompleteProps.createLabel?.(
										inputValue,
									) ?? `Create "${inputValue}"`}
								</button>
							</li>
						)}

						{/* Results */}
						{!isLoading &&
							displayedSuggestions.map((item, index) => {
								const label =
									autoCompleteProps.getOptionLabel(item);
								const key =
									autoCompleteProps.getOptionKey?.(item) ??
									label;

								const isHighlighted =
									index === highlightedIndex;

								return (
									<li key={key} className="list-none">
										<button
											type="button"
											onClick={() =>
												handleSuggestionClick(item)
											}
											onMouseEnter={() =>
												setHighlightedIndex(index)
											}
											className={cn(
												'w-full px-3 py-2 text-sm text-left',
												'hover:bg-accent-soft hover:text-accent-soft-foreground',
												'focus:bg-accent-soft focus:text-accent-soft-foreground',
												isHighlighted &&
													'bg-accent-soft text-accent-soft-foreground',
											)}
										>
											{label}
										</button>
									</li>
								);
							})}
					</ul>
				)}
			</div>
		</FormElement>
	);
};

/** Common form elements **/

export const FormComponentSubmit = ({
	pending,
	submitted,
	error,
	button,
}: {
	pending: boolean;
	submitted: boolean;
	error: boolean;
	button?: ButtonAppearanceType;
}) => {
	const translationsKeys = [
		'app.action.loading.label',
		'app.action.submit.label',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const buttonLabel =
		button?.label || translations['app.action.submit.label'];

	return (
		<Button
			type="submit"
			variant={button?.variant || 'default'}
			className={button?.className}
			disabled={pending || (submitted && error)}
			aria-busy={pending}
		>
			{pending ? (
				<span className="flex items-center gap-1.5">
					<LoadingIcon />
					{translations['app.action.loading.label']}
				</span>
			) : submitted && error ? (
				<span className="flex items-center gap-1.5">
					<Icons.Status.Error className="animate-pulse" />
					{buttonLabel}
				</span>
			) : (
				<span className="flex items-center gap-1.5">
					<ActionButtonContent
						icon={button?.icon}
						action="submit"
						label={buttonLabel}
					/>
				</span>
			)}
		</Button>
	);
};

export const FormComponentName = <Fields,>(
	props: Omit<
		FormComponentProps<Fields, InputValueType>,
		'fieldName' | 'fieldType' | 'autoComplete' | 'icons'
	>,
) => (
	<FormComponentInput
		{...props}
		fieldName="name"
		isRequired={props.isRequired ?? true}
		className={cn('pl-8', props.className)}
		autoComplete="name"
		placeholderText="eg: John Doe"
		icons={{
			left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
		}}
	/>
);

export const FormComponentEmail = <Fields,>(
	props: Omit<
		FormComponentProps<Fields, InputValueType>,
		'fieldName' | 'fieldType' | 'autoComplete' | 'icons'
	> & {
		fieldName?: 'email' | 'email_new';
	},
) => (
	<FormComponentInput
		{...props}
		fieldName={props.fieldName || 'email'}
		isRequired={props.isRequired ?? true}
		className={cn('pl-8', props.className)}
		autoComplete="email"
		placeholderText="eg: example@domain.com"
		icons={{ left: <Icons.Email className="opacity-40 h-4.5 w-4.5" /> }}
	/>
);

export const FormComponentPassword = <Fields,>({
	showPassword,
	setShowPassword,
	...props
}: FormComponentProps<Fields, InputValueType> & {
	showPassword: boolean;
	setShowPassword?: (showPassword: boolean) => void;
}) => (
	<FormComponentInput
		{...props}
		fieldType={showPassword ? 'text' : 'password'}
		fieldName={props.fieldName ?? 'password'}
		isRequired={props.isRequired ?? true}
		className={cn('px-8', props.className)}
		autoComplete={props.autoComplete ?? 'new-password'}
		placeholderText={props.placeholderText ?? 'Password'}
		icons={{
			left: <Icons.Password className="opacity-40 h-4.5 w-4.5" />,
			right: setShowPassword && (
				<button
					type="button"
					onClick={() => setShowPassword(!showPassword)}
					className="focus:outline-none hover:opacity-100 transition-opacity"
				>
					{showPassword ? (
						<Icons.Obscured className="opacity-60 hover:opacity-100 h-4.5 w-4.5" />
					) : (
						<Icons.Visible className="opacity-60 hover:opacity-100 h-4.5 w-4.5" />
					)}
				</button>
			),
		}}
	/>
);
