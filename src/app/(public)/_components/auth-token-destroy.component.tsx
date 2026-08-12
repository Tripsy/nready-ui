import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useTranslation } from '@/hooks/use-translation.hook';
import { requestRemoveAuthToken } from '@/services/account.service';
import type { AuthTokenType } from '@/types/auth.type';

const TRANSLATION_KEYS = [
	'account.session.destroy_title',
	'account.session.deleting',
	'account.session.confirm_question',
	'app.action.confirm.label',
	'app.action.cancel.label',
] as const;

interface AuthTokenDestroyModalProps {
	token: AuthTokenType;
	onClose: () => void;
	onSuccess: () => void;
	onError: () => void;
}

export const AuthTokenDestroyModal = ({
	token,
	onClose,
	onSuccess,
	onError,
}: AuthTokenDestroyModalProps) => {
	const [loading, setLoading] = useState(false);
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const handleConfirm = async () => {
		if (!token) {
			return;
		}

		try {
			setLoading(true);

			await requestRemoveAuthToken(token.ident);

			onSuccess();
		} catch {
			onError();
		} finally {
			setLoading(false);
			onClose();
		}
	};

	return (
		<Modal
			isOpen={true}
			onClose={onClose}
			title={translations['account.session.destroy_title']}
			footer={
				<>
					<Button
						variant="error"
						size="sm"
						onClick={handleConfirm}
						disabled={loading}
					>
						{loading
							? translations['account.session.deleting']
							: translations['app.action.confirm.label']}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={loading}
					>
						{translations['app.action.cancel.label']}
					</Button>
				</>
			}
		>
			<p className="text-sm semi-bold">
				{translations['account.session.confirm_question']}
			</p>
			<p className="font-mono text-xs wrap-break-word mt-2">
				{token.label}
			</p>
		</Modal>
	);
};
