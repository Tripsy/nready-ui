import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useLocationReload(condition: boolean) {
	const router = useRouter();

	useEffect(() => {
		if (condition) {
			router.refresh();
		}
	}, [condition, router]);
}
