'use client';

import { usePathname } from 'next/navigation';
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
} from 'react';
import { isLargeScreen } from '@/helpers/css.helper';

type MenuState = 'open' | 'closed';

const SideMenuContext = createContext<
	| {
			menuState: MenuState;
			menuToggle: () => void;
			open: () => void;
			close: () => void;
	  }
	| undefined
>(undefined);

const SideMenuProvider = ({ children }: { children: ReactNode }) => {
	const [menuState, setMenuState] = useState<MenuState>('closed');

	const pathname = usePathname();

	useLayoutEffect(() => {
		if (isLargeScreen()) {
			const saved = localStorage.getItem('side-menu-state') as MenuState;

			setMenuState(saved || 'open');
		} else {
			setMenuState('closed');
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: I do want to run this hook when pathname changes
	useEffect(() => {
		if (!isLargeScreen()) {
			setMenuState('closed');
		}
	}, [pathname]);

	const setAndPersist = (next: MenuState) => {
		setMenuState(next);
		localStorage.setItem('side-menu-state', next);
	};

	const menuToggle = () => {
		setAndPersist(menuState === 'open' ? 'closed' : 'open');
	};

	const open = () => setAndPersist('open');
	const close = () => setAndPersist('closed');

	return (
		<SideMenuContext.Provider
			value={{
				menuState,
				menuToggle,
				open,
				close,
			}}
		>
			{children}
		</SideMenuContext.Provider>
	);
};

function useSideMenu() {
	const context = useContext(SideMenuContext);

	if (context === undefined) {
		throw new Error('useSideMenu must be used within a SideMenuProvider');
	}

	return context;
}

export { SideMenuContext, SideMenuProvider, useSideMenu };
