import ValueError from '@/exceptions/value.error';
import type {
	PermissionEntityType,
	PermissionOperationType,
} from '@/models/permission.model';

export const RouteAuthEnum = {
	PUBLIC: 'public',
	UNAUTHENTICATED: 'unauthenticated',
	AUTHENTICATED: 'authenticated',
	PROTECTED: 'protected', // `admin` OR `operator` OR `member`
} as const;

export type RouteAuth = (typeof RouteAuthEnum)[keyof typeof RouteAuthEnum];

type RouteProps = {
	type?: string;
	auth?: RouteAuth;
	permissionEntity?: PermissionEntityType;
	permissionOperation?: PermissionOperationType;
};

type RoutesData = {
	[key: string]: { path: string } & RouteProps;
};

export type RouteMatch = {
	name: string;
	props: RouteProps;
} | null;

class RouteBuilder {
	constructor(
		private readonly parent: RoutesCollection,
		private readonly type: string,
		private _routeAuth?: RouteAuth,
	) {}

	public auth(routeAuth: RouteAuth): this {
		this._routeAuth = routeAuth;

		return this;
	}

	public add(
		name: string,
		path: string,
		props: Partial<RouteProps> = {},
	): this {
		this.parent.add(name, path, {
			type: this.type,
			auth: props.auth ?? this._routeAuth ?? RouteAuthEnum.PUBLIC,
			...props,
		});
		return this;
	}
}

class RoutesCollection {
	private data: RoutesData = {};

	public add(name: string, path: string, props?: RouteProps): this {
		if (!name || !path) {
			throw new ValueError('Route name and path are required');
		}

		props = {
			...props,
			auth: props?.auth ?? RouteAuthEnum.PUBLIC,
		};

		this.data[name] = { path, ...props };

		return this;
	}

	// Start a scoped group
	public group(name: string): RouteBuilder {
		return new RouteBuilder(this, name);
	}

	public get(
		name: string,
		args?: Record<string, string | number | string[]>,
	): string {
		if (!this.data[name]) {
			throw new ValueError(`Route not defined for: ${name}`);
		}

		const [basePath, query] = this.data[name].path.split('?');
		const replacedPath = this.replacePathParams(basePath, args);

		return query ? `${replacedPath}?${query}` : replacedPath;
	}

	private replacePathParams(
		path: string,
		args?: Record<string, string | number | string[]>,
	): string {
		if (!args) {
			return path;
		}

		let result = path;

		for (const [key, value] of Object.entries(args)) {
			if (Array.isArray(value)) {
				result = result.replace(
					`:${key}*`,
					value.map(encodeURIComponent).join('/'),
				);
			} else {
				result = result.replace(
					`:${key}`,
					encodeURIComponent(String(value)),
				);
			}
		}

		return result;
	}

	public match(pathname: string): RouteMatch {
		for (const [name, props] of Object.entries(this.data)) {
			const pattern = this.convertPathToRegex(props.path);
			const match = pathname.match(pattern);

			if (match) {
				return {
					name: name,
					props: props,
				};
			}
		}

		return null;
	}

	private convertPathToRegex(path: string): RegExp {
		// Convert :param to named capture group
		// Convert :param* to wildcard match
		const pattern = path
			.replace(/\/:(\w+)(\*)?/g, (_, param, wildcard) =>
				wildcard
					? `/(?<${param}>[^/]+(?:/[^/]+)*)`
					: `/(?<${param}>[^/]+)`,
			)
			.replace(/\*/g, '.*');

		return new RegExp(`^${pattern}(?:\\?.*)?$`); // Include optional query string
	}

	public getRoutes(): RoutesData {
		return this.data;
	}
}

const Routes = new RoutesCollection();

Routes.add('home', '/');
Routes.add('api-docs', '/api-docs');
Routes.add('api-docs-feature', '/api-docs/:feature');
Routes.add('page', '/page/:label');
Routes.add('products', '/products');
Routes.add('products-categories', '/products/categories');
Routes.add('articles', '/articles');
Routes.add('articles-categories', '/articles/categories');
// Added after `articles-categories` on purpose: `match` returns the first pattern that fits,
// and `/articles/:category` fits that path too. Next resolves the file-system routes by the
// same precedence, static segment before dynamic.
Routes.add('articles-category', '/articles/:category');
Routes.add('article-view', '/articles/:category/:slug');
// The permalink a notification email links a comment by. It resolves the comment's target and
// redirects, so a link in an old inbox survives the article being re-slugged or re-filed.
Routes.add('comment-link', '/comments/:id');
// The unsubscribe landing an emailed notification links to. Public and tokenized: a guest
// subscriber has no account, and requiring one to stop unsolicited email would be requiring an
// account to withdraw consent.
Routes.add('comment-unsubscribe', '/comments/unsubscribe/:token');
Routes.add('status', '/status/:type');

// API
Routes.group('api')
	.add('proxy', '/api/proxy/:path*')
	.add('csrf', '/api/csrf')
	.add('auth-session', '/api/auth/session')
	// The OAuth equivalent: verifies `state`, redeems the code, writes the session.
	.add('auth-oauth-session', '/api/auth/oauth/:provider')
	.add('oauth-start', '/api/oauth/:provider')
	.add('language', '/api/language')
	.add('api-image', '/api/image', {
		auth: RouteAuthEnum.PUBLIC,
	});

// Account
Routes.group('account')
	.auth(RouteAuthEnum.UNAUTHENTICATED)
	.add('login', '/account/login')
	.add('logout', '/account/logout', { auth: RouteAuthEnum.AUTHENTICATED })
	.add('register', '/account/register')
	.add('password-recover', '/account/password-recover')
	.add('password-recover-change', '/account/password-recover-change/:token')
	.add('email-confirm', '/account/email-confirm/:token', {
		auth: RouteAuthEnum.PUBLIC,
	})
	.add('email-confirm-send', '/account/email-confirm-send')
	// Where the provider returns the browser; must match `getOAuthRedirectUri`.
	.add('oauth-callback', '/account/oauth/:provider')
	.add('account-me', '/account/me', { auth: RouteAuthEnum.AUTHENTICATED });

// Dashboard
Routes.group('dashboard')
	.auth(RouteAuthEnum.PROTECTED)
	.add('dashboard', '/dashboard', {
		permissionEntity: 'dashboard',
	})
	.add('template', '/dashboard/template', {
		permissionEntity: 'template',
	})
	.add('client', '/dashboard/client', {
		permissionEntity: 'client',
	})
	.add('address', '/dashboard/address', {
		permissionEntity: 'address',
	})
	.add('place', '/dashboard/place', {
		permissionEntity: 'place',
	})
	.add('brand', '/dashboard/brand', {
		permissionEntity: 'brand',
	})
	.add('brand-order', '/dashboard/brand/order', {
		permissionEntity: 'brand',
		permissionOperation: 'update',
	})
	.add('category', '/dashboard/category', {
		permissionEntity: 'category',
	})
	.add('category-order', '/dashboard/category/order', {
		permissionEntity: 'category',
		permissionOperation: 'update',
	})
	.add('category-tree', '/dashboard/category/tree', {
		permissionEntity: 'category',
	})
	.add('cash-flow', '/dashboard/cash-flow', {
		permissionEntity: 'cash-flow',
	})
	.add('discount', '/dashboard/discount', {
		permissionEntity: 'discount',
	})
	.add('log-data', '/dashboard/log-data', {
		permissionEntity: 'log-data',
	})
	.add('log-history', '/dashboard/log-history', {
		permissionEntity: 'log-history',
	})
	.add('cron-history', '/dashboard/cron-history', {
		permissionEntity: 'cron-history',
	})
	.add('document-series', '/dashboard/document-series', {
		permissionEntity: 'document-series',
	})
	.add('exchange-rate', '/dashboard/exchange-rate', {
		permissionEntity: 'exchange-rate',
	})
	.add('image', '/dashboard/image', {
		permissionEntity: 'image',
	})
	.add('image-order', '/dashboard/image/order', {
		permissionEntity: 'image',
		permissionOperation: 'update',
	})
	.add('mail-queue', '/dashboard/mail-queue', {
		permissionEntity: 'mail-queue',
	})
	.add('user', '/dashboard/user', {
		permissionEntity: 'user',
	})
	.add('permission', '/dashboard/permission', {
		permissionEntity: 'permission',
	})
	.add('vendor', '/dashboard/vendor', {
		permissionEntity: 'vendor',
	})
	.add('carrier', '/dashboard/carrier', {
		permissionEntity: 'carrier',
	})
	.add('term', '/dashboard/term', {
		permissionEntity: 'term',
	})
	.add('article', '/dashboard/article', {
		permissionEntity: 'article',
	})
	.add('article-order', '/dashboard/article/order', {
		permissionEntity: 'article',
		permissionOperation: 'update',
	})
	.add('rating', '/dashboard/rating', {
		permissionEntity: 'rating',
	})
	.add('comment', '/dashboard/comment', {
		permissionEntity: 'comment',
	})
	.add('complaint', '/dashboard/complaint', {
		permissionEntity: 'complaint',
	});

/**
 * Routes a signed-in user must never be sent back to.
 *
 * Held as route *names*, not paths: `Routes.get('email-confirm')` returns the pattern
 * `/account/email-confirm/:token` verbatim, which no real pathname ever equals — so a
 * path-based list silently failed to exclude every parameterised route in it.
 */
const EXCLUDED_ROUTE_NAMES: ReadonlySet<string> = new Set([
	'login',
	'logout',
	'register',
	'password-recover',
	'password-recover-change',
	'email-confirm',
	'email-confirm-send',
	'oauth-callback',
]);

/**
 * Check if the given path is an excluded route (usually auth related routes)
 * On successful login it doesn't redirect back to excluded routes
 *
 * Resolves the pathname to a route first, so `/account/email-confirm/abc123` is recognized
 * as `email-confirm` rather than compared as a literal string.
 *
 * @param pathname - a pathname without its query string
 */
export function isExcludedRoute(pathname: string) {
	const route = Routes.match(pathname);

	return route !== null && EXCLUDED_ROUTE_NAMES.has(route.name);
}

/**
 * Check if the given route is protected
 *
 * @param auth
 */
export function isProtectedRoute(
	auth: RouteAuth,
): auth is 'authenticated' | 'protected' {
	return (
		auth === RouteAuthEnum.AUTHENTICATED || auth === RouteAuthEnum.PROTECTED
	);
}

export default Routes;
