import type React from 'react';
import type { ModalSizeType } from '@/components/ui/modal';
import type {
	ActionEventType,
	DisplayEntryLabelFnType,
	EntriesSelectionType,
	OperationFunctionType,
	PrepareEntryFnType,
	ReloadEntryFnType,
} from '@/types/action.type';
import type {
	GetFormStateFnType,
	GetFormValuesFnType,
	ValidateFormFnType,
} from '@/types/form.type';
import type { ButtonAppearanceType } from '@/types/html.type';

export type WindowEntryType = Record<string, unknown>;
export type WindowConfigPropsType = {
	title?: string;
	size?: ModalSizeType;
	className?: string;
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
	allowMinimize?: boolean; // Default true; false hides the minimize control and blocks `minimize()` (window must be submitted or closed)
};
export type WindowSectionType = 'dashboard' | 'public';
export type WindowType<T extends EntriesSelectionType> = T extends 'free'
	? 'form' | 'other' | 'link'
	: T extends 'single'
		? 'view' | 'action' | 'other'
		: T extends 'multiple'
			? 'view' | 'action' | 'other'
			: never;

export type WindowDefinition = {
	entriesSelection: EntriesSelectionType;
	windowType?: string;
	windowTitle?: string;
	windowComponent?: WindowComponent;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	operationFunction?: OperationFunctionType<any, any>;
	button?: ButtonAppearanceType;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	validateForm?: ValidateFormFnType<any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	getFormValues?: GetFormValuesFnType<any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	getFormState?: GetFormStateFnType<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	displayEntryLabel?: DisplayEntryLabelFnType<any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	reloadEntry?: ReloadEntryFnType<any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	prepareEntry?: PrepareEntryFnType<any>;
};

// biome-ignore lint/suspicious/noExplicitAny: It's fine
export type WindowComponent = React.ComponentType<any>;

export type WindowConfig = {
	uid: string;
	section: WindowSectionType;
	dataSource: string;
	action: string;
	minimized: boolean;
	definition: WindowDefinition;
	data?: {
		entries?: WindowEntryType[];
		prefillEntry?: Partial<WindowEntryType>;
	};
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	events?: Record<string, ActionEventType<any>>;
	props?: WindowConfigPropsType;
};

export type WindowCreateConfig = Omit<WindowConfig, 'uid' | 'definition'> & {
	uid?: string;
	definition?: Partial<WindowDefinition>;
};
