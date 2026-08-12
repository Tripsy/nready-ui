import { Modal } from '@heroui/react';
import { ActionButton } from '@/components/action-button.component';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { ButtonAppearanceType } from '@/types/html.type';

export type ConfirmationDialogProps = {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	description: string;
	buttonCancel?: ButtonAppearanceType;
	buttonConfirm?: ButtonAppearanceType;
	disabled: boolean;
};

export function ConfirmationDialog({
	isOpen,
	onClose,
	onConfirm,
	title,
	description,
	buttonCancel,
	buttonConfirm,
	disabled = false,
}: ConfirmationDialogProps) {
	const translationsKeys = [
		'app.action.abort.title',
		'app.action.abort.label',
		'app.action.confirm.title',
		'app.action.confirm.label',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<Modal.Backdrop>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>{title}</Modal.Heading>
						</Modal.Header>
						<Modal.Body>{description}</Modal.Body>
						<Modal.Footer>
							<ActionButton
								action="abort"
								buttonAppearance={{
									...buttonCancel,
									variant: buttonCancel?.variant ?? 'outline',
									hover: buttonCancel?.hover ?? 'warning',
									title:
										buttonCancel?.title ??
										translations['app.action.abort.title'],
									icon: buttonCancel?.icon ?? 'abort',
									label:
										buttonCancel?.label ??
										translations['app.action.abort.label'],
								}}
								disabled={disabled}
								command={{
									type: 'action',
									onClick: onClose,
								}}
							/>
							<ActionButton
								action="confirm"
								buttonAppearance={{
									...buttonConfirm,
									variant:
										buttonConfirm?.variant ?? 'default',
									title:
										buttonCancel?.title ??
										translations[
											'app.action.confirm.title'
										],
									icon: buttonCancel?.icon ?? 'confirm',
									label:
										buttonCancel?.label ??
										translations[
											'app.action.confirm.label'
										],
								}}
								disabled={disabled}
								command={{
									type: 'action',
									onClick: onConfirm,
								}}
							/>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
