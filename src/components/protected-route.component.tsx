'use client';

import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import Routes, {
	isProtectedRoute,
	type RouteAuth,
	RouteAuthEnum,
} from '@/config/routes.setup';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/auth.model';
import type {
	PermissionEntityType,
	PermissionOperationType,
} from '@/models/permission.model';
import { useAuth } from '@/providers/auth.provider';

type ProtectedRouteProps = {
	children: React.ReactNode;
	routeAuth: RouteAuth;
	routePermissionEntity?: PermissionEntityType;
	routePermissionOperation?: PermissionOperationType;
	className?: string;
	fallback?: React.ReactNode;
};

const ProtectedRouteWrapper = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return <div className={className}>{children}</div>;
};

export default function ProtectedRoute({
	children,
	routeAuth,
	routePermissionEntity,
	routePermissionOperation,
	className,
	fallback,
}: ProtectedRouteProps) {
	const { authStatus, auth } = useAuth();

	const router = useRouter();
	const pathname = usePathname();

	// Redirect to the login page if not authenticated, and route is protected or authenticated
	useEffect(() => {
		if (isProtectedRoute(routeAuth) && authStatus === 'unauthenticated') {
			router.push(
				`${Routes.get('login')}?from=${encodeURIComponent(pathname)}`,
			);
		}
	}, [authStatus, pathname, routeAuth, router]);

	const translationsKeys = [
		'app.action.loading.title',
		'app.action.loading.label',
		'auth.message.already_logged_in',
		'auth.message.unauthorized',
	] as const;

	const { translations, isTranslationLoading } =
		useTranslation(translationsKeys);

	const { permissionEntity, permissionOperation } = useMemo(() => {
		// Explicit props always take priority
		if (routePermissionEntity) {
			return {
				permissionEntity: routePermissionEntity,
				permissionOperation: routePermissionOperation,
			};
		}

		// Only derive from route when authenticated and protected
		if (
			routeAuth !== RouteAuthEnum.PROTECTED ||
			authStatus !== 'authenticated'
		) {
			return {
				permissionEntity: undefined,
				permissionOperation: undefined,
			};
		}

		const routeProps = Routes.match(pathname)?.props;

		return {
			permissionEntity: routeProps?.permissionEntity,
			permissionOperation: routeProps?.permissionOperation,
		};
	}, [
		routePermissionEntity,
		routePermissionOperation,
		routeAuth,
		authStatus,
		pathname,
	]);

	// Loading
	if (isTranslationLoading) {
		return <LoadingComponent />;
	}

	// Is a public route so return content
	if (routeAuth === RouteAuthEnum.PUBLIC) {
		return <>{children}</>;
	}

	// Loading
	if (authStatus === 'loading') {
		return (
			<LoadingComponent
				title={translations['app.action.loading.title']}
				description={translations['app.action.loading.label']}
			/>
		);
	}

	if (authStatus === 'authenticated') {
		if (routeAuth === RouteAuthEnum.UNAUTHENTICATED) {
			return (
				<ProtectedRouteWrapper className={className}>
					<ErrorComponent
						description={
							translations['auth.message.already_logged_in']
						}
					>
						{fallback}
					</ErrorComponent>
				</ProtectedRouteWrapper>
			);
		}

		if (
			routeAuth === RouteAuthEnum.PROTECTED &&
			(!permissionEntity ||
				!hasPermission(auth, permissionEntity, permissionOperation))
		) {
			return (
				<ProtectedRouteWrapper className={className}>
					<ErrorComponent
						description={translations['auth.message.unauthorized']}
					>
						{fallback}
					</ErrorComponent>
				</ProtectedRouteWrapper>
			);
		}
	}

	if (
		authStatus === 'unauthenticated' &&
		routeAuth === RouteAuthEnum.PROTECTED
	) {
		return null; // useEffect handles the redirect
	}

	return <>{children}</>;
}
