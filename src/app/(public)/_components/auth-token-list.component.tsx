import { ArrowDownRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthTokenDestroyModal } from '@/app/(public)/_components/auth-token-destroy.component';
import { Icons } from '@/components/icon.component';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/helpers/date.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { AuthTokenType } from '@/types/auth.type';

const TRANSLATION_KEYS = [
	'account.label.last_used',
	'account.label.active_session',
	'account.button.destroy_session',
] as const;

export const AuthTokenList = ({
	tokens,
	onResult,
}: {
	tokens: AuthTokenType[];
	onResult: (success: boolean, message: string) => void;
}) => {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const [selectedToken, setSelectedToken] = useState<AuthTokenType | null>(
		null,
	);
	const [tokenList, setTokenList] = useState<AuthTokenType[]>(tokens);

	useEffect(() => {
		setTokenList([...tokens]);
	}, [tokens]);

	const handleClose = () => {
		setSelectedToken(null);
	};

	const handleSuccess = () => {
		setTokenList((prev) =>
			prev.filter((token) => token.ident !== selectedToken?.ident),
		);

		onResult(true, 'session_destroy_success');
	};

	const handleError = () => {
		onResult(false, 'session_destroy_error');
	};

	return (
		<>
			{tokenList.map((token: AuthTokenType) => (
				<div key={token.ident} className="pb-4">
					<div className="text-sm">
						<ArrowDownRight className="h-4 w-4" />
						{token.label}
					</div>
					<div className="flex justify-between items-center">
						<div className="text-xs mt-1">
							{translations['account.label.last_used']}{' '}
							{formatDate(token.used_at, 'date-time')}
						</div>
						{token.used_now ? (
							<Badge variant="success" size="sm">
								<Icons.Status.Active className="w-4 h-4" />{' '}
								{translations['account.label.active_session']}
							</Badge>
						) : (
							<Button
								variant="error"
								size="sm"
								onClick={() => setSelectedToken(token)}
							>
								<Icons.Action.Destroy className="w-4 h-4" />{' '}
								{translations['account.button.destroy_session']}
							</Button>
						)}
					</div>
				</div>
			))}

			{selectedToken && (
				<AuthTokenDestroyModal
					token={selectedToken}
					onClose={handleClose}
					onSuccess={handleSuccess}
					onError={handleError}
				/>
			)}
		</>
	);
};
