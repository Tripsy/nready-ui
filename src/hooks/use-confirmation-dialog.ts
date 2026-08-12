import { useCallback, useState } from 'react';
import type { ConfirmationDialogProps } from '@/components/ui/confirmation-dialog';
import type { ButtonAppearanceType } from '@/types/html.type';

interface DialogConfig {
	title: string;
	description: string;
	onConfirm: () => void | Promise<void>;
	buttonCancel?: ButtonAppearanceType;
	buttonConfirm?: ButtonAppearanceType;
}

export function useConfirmationDialog() {
	const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [disabled, setDisabled] = useState(false);

	const openDialog = useCallback((config: DialogConfig) => {
		setDialogConfig(config);
		setIsOpen(true);
		setDisabled(false); // Reset disabled when opening
	}, []);

	const closeDialog = useCallback(() => {
		setIsOpen(false);
		setDisabled(false);
	}, []);

	const dialogProps: ConfirmationDialogProps = {
		isOpen,
		onClose: closeDialog,
		onConfirm: async () => {
			if (dialogConfig?.onConfirm) {
				setDisabled(true);

				await dialogConfig.onConfirm();

				setDisabled(false);
			}

			closeDialog();
		},
		disabled,
		title: dialogConfig?.title ?? '',
		description: dialogConfig?.description ?? '',
		buttonCancel: dialogConfig?.buttonCancel,
		buttonConfirm: dialogConfig?.buttonConfirm,
	};

	return {
		openDialog,
		closeDialog,
		dialogProps,
		isOpen,
	};
}
