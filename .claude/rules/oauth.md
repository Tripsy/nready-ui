---
paths:
  - "src/app/api/oauth/**"
  - "src/app/(public)/account/oauth/**"
  - "src/app/(public)/_components/oauth-*"
  - "src/types/oauth.type.ts"
  - "src/services/account.service.ts"
---

# Social login (OAuth)

Authorization-code flow split across two legs, both on this origin.

1. *Start* — `src/app/api/oauth/[provider]/route.ts` (route `oauth-start`, `/api/oauth/:provider`).
   A GET route handler, not a server action, because the browser has to **navigate** to the
   provider; `OAuthProviders` (`(public)/_components/oauth-providers.component.tsx`) renders plain
   `<a>` links for that reason. It mints a `state` uuid, stores `{ state, from }` in the httpOnly
   `oauth-state` cookie (`sameSite: 'lax'` — a strict cookie would not survive the cross-site
   return), and redirects to the provider.
2. *Callback* — the page is `(public)/account/oauth/[provider]/` (route `oauth-callback`,
   `/account/oauth/:provider`, must match `getOAuthRedirectUri`), but the work happens in the
   `POST /api/auth/oauth/:provider` route handler it calls through `requestOAuthCallback`. That
   handler consumes the cookie (single-use — deleted whether or not the check passes), compares
   `state`, then `requestOAuthLogin` → `writeSessionCookie`. The component redeems once behind a
   `useRef` guard, since Strict Mode would otherwise spend the single-use `code` twice.
   A route handler, not a server action: an action's response would re-render the callback page
   and reset both that guard and the `useState` holding the result.
- **`state` is the entire CSRF defence for the provider round trip** and only this app can
  enforce it — the backend never sees the browser leave. The middleware's `x-csrf-token` gate
  cannot stand in for it: the start leg is a GET, so it is exempt. (The callback leg does pass
  that gate, being a mutating `/api/` request, but it protects this origin's endpoint, not the
  trip through the provider.) Don't "simplify" either leg into the other's shape.
- The `from` return target rides in the cookie, never through the provider's `state`, and is
  validated against `isSafeReturnPath` / `isExcludedRoute` — a target that round-trips through a
  third party is one an attacker can rewrite.
- Providers are declared in `src/types/oauth.type.ts` (`OAuthProviderEnum`, label map, per-provider
  authorize-URL builder). A provider is offered only when its `NEXT_PUBLIC_OAUTH_*_CLIENT_ID` is
  set; the backend holds the secret and answers 501 if it is not configured there too, so the two
  configs must agree. Adding a provider means a new enum entry, label, `buildOAuthAuthorizeUrl`
  case, `settings.config.ts` client id, and the matching backend `OAUTH_*` config.
- Account-level linking/unlinking is separate from sign-in: `requestGetOAuthIdentities` /
  `requestUnlinkOAuth` (`account.service.ts`) behind `oauth-identity-list.component.tsx` on
  `/account/me`.
