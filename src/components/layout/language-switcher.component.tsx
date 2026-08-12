'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import Routes from '@/config/routes.setup';
import { CSRF_HEADER, getCsrfToken } from '@/helpers/csrf.helper';
import type { LayoutTranslations } from '@/types/layout.type';

type LanguageSwitcherProps = {
	currentLanguage: string;
	supportedLanguages: string[];
	translations: LayoutTranslations;
};

export function LanguageSwitcher({
	currentLanguage,
	supportedLanguages,
	translations,
}: LanguageSwitcherProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const switchLanguage = (language: string) => {
		if (language === currentLanguage || isPending) {
			return;
		}

		startTransition(async () => {
			const response = await fetch(Routes.get('language'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Raw fetch rather than ApiRequest, so the CSRF header the middleware
					// requires on mutating /api/* requests has to be set by hand.
					[CSRF_HEADER]: await getCsrfToken(),
				},
				body: JSON.stringify({ language }),
				credentials: 'include',
			});

			if (response.ok) {
				router.refresh();
			}
		});
	};

	// The switch toggles between the first two supported languages (e.g. en / ro).
	if (supportedLanguages.length < 2) {
		return null;
	}

	const [langOff, langOn] = supportedLanguages;
	const isOn = currentLanguage === langOn;

	return (
		<Switch
			size="lg"
			isSelected={isOn}
			isDisabled={isPending}
			onChange={(selected) => switchLanguage(selected ? langOn : langOff)}
			aria-label={translations['layout.aria.switch_language']}
			thumbIcon={
				<span className="text-xs font-bold uppercase">
					{isOn ? langOn : langOff}
				</span>
			}
		/>
	);
}
