import { createContext, type ReactNode, useContext } from 'react';
import type { FormComponentType, FormValuesType } from '@/types/form.type';

export type WindowFormContextValue<FormValues extends FormValuesType> =
	FormComponentType<FormValues>;

const WindowFormContext =
	createContext<WindowFormContextValue<FormValuesType> | null>(null);

function WindowFormProvider<FormValues extends FormValuesType>({
	value,
	children,
}: {
	value: FormComponentType<FormValues>;
	children: ReactNode;
}) {
	return (
		<WindowFormContext.Provider
			value={value as unknown as WindowFormContextValue<FormValuesType>}
		>
			{children}
		</WindowFormContext.Provider>
	);
}

function useWindowForm<
	FormValues extends FormValuesType,
>(): WindowFormContextValue<FormValues> {
	const context = useContext(WindowFormContext);

	if (!context) {
		throw new Error('useWindowForm must be used inside <WindowForm>');
	}

	return context as unknown as WindowFormContextValue<FormValues>;
}

export { useWindowForm, WindowFormProvider };
