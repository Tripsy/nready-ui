# NReady Dashboard

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![React](https://img.shields.io/badge/React-19.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/License-MIT-green)

# 📄 Description

(NReady UI) is a demo frontend implementation using [NReady](https://github.com/Tripsy/nready-api) as a backend API.

This boilerplate provides an authentication system (login, register, recover password, account pages, etc.)
and includes an administration dashboard.

This project is still a work in progress, and the next goals are:
- Include additional [NReady](https://github.com/Tripsy/nready-api) features in the administration dashboard

Meanwhile, we're open to suggestions / feedback, and if you find this project useful, please consider giving it a star ⭐

# 🚀 Tech Stack

## Core
- Language: TypeScript 5.9
- Runtime Environment: Node.js 22
- Runtime: React 19.2
- Framework: Next.js 16.2

## Code Quality
- Linting & Formatting: Biome (also checks circular dependencies)
- Validation: Zod 4.3

## Infrastructure
- Containerization: Docker
- Security: rate limiting, input validation

# ⚙️ Characteristics

- [x] Dashboard: Administration panel with CRUD operations for user, permission, template, logs, etc.
- [x] Auth system: Login, register, logout, forgot password, reset password, email confirmation, etc.
- [x] Best Practices: Clean architecture, TypeScript, error handling, async patterns, DRY, SOLID, KISS
- [x] Security: rate limiting, input validation
- [x] Request validation (powered by Zod)
- [x] Language files
- [x] Providers included: Auth, Theme, Toast, QueryClient
- [x] Docker development environment
- [x] Responsive design

# ✨ Features

### Public site

- [x] Auth system: login, register, logout, password recover / reset, email confirmation, email change
- [x] Social login (OAuth authorization-code flow) with per-provider client ids; linking / unlinking
    handled from the account page
- [x] Account self-service (`/account/me`): profile edit, password update, email update, account
    delete, active session (auth token) list with per-session revoke
- [x] Articles: listing, category listing and article page (`/articles/:category/:slug`)
- [x] Comments, ratings and complaint (report) widgets on public content, with comment permalinks
    (`/comments/:id`) and tokenized email unsubscribe - no account required
- [x] Products: category listing (the catalog listing itself is a placeholder until the backend
    exposes a public endpoint)

### Dashboard

Every entity below is a full CRUD list view - filters, sorting, pagination, row actions and a
detail/edit window - gated per user by the backend permission map.

- [x] Financial: client, cash-flow, discount, vendor
- [x] Content: place, brand, category (incl. tree + manual ordering), term, image (upload / order,
    local or S3 storage)
- [x] Logistics: address, carrier
- [x] Publishing: article (incl. ordering), rating, comment, complaint
- [x] Settings: template, document-series
- [x] Logs: log-data, log-history, cron-history, mail-queue
- [x] User management: user, permission

### Cross-cutting

- [x] Route access declared centrally 
- [x] CSRF gate on every mutating `/api/*` request; httpOnly session cookie
- [x] i18n (en, ro) with per-language locale files
- [x] Light / dark theme, responsive layout
- [x] Sentry error reporting (client, server and edge runtimes) behind a single DSN switch

# 🛠 Setup

### 1. Add `hosts` record

sudo nano /private/etc/hosts

For configuration refer to this guide:  
[How to Edit the Host File on macOS](https://phoenixnap.com/kb/mac-hosts-file)

### 2. Initialize Docker container
Start the Docker container using the following command:

```
docker compose up
```

### 3. Connect to the Docker container
Once the container is running, connect to it with:

```
docker exec -it nready-ui.test /bin/bash
```

### 4. Install dependencies inside the container
Run the following command to install project dependencies:

```
$ pnpm install
```

### 5. Configure environment variables

Copy the `.env.example` file to `.env` and update the variables:
```bash
cp .env.example .env
```

### 6. Run the application

> **Note**
> Dashboard uses NReady as backend, so you need to run it first.

```
$ pnpm run dev
```

# 🖥️ Commands

```bash
pnpm run biome    # Lint, format and check for circular dependencies
pnpm run dev      # Start development server
pnpm run build    # Production build
pnpm run clean    # Delete .next (see below)
```

### When the dev server dies with nothing in the log

That is the container's OOM killer, not a crash. `Turbopack` persistent cache in
`.next/dev/cache` grows across sessions - left alone it reached 4.0G, which put startup memory
at 2.5G before a single request and pushed the process into the 4g `mem_limit` set in
`docker-compose.yml`. Because `tty: true` keeps the container up, it just looks like the dev
server quitting silently. Confirm with:

```bash
docker inspect nready-ui.test --format '{{.State.OOMKilled}}'
```

Run `pnpm run clean` and restart. `experimental.turbopackMemoryLimit` in `next.config.ts` caps
`Turbopack` own memory, but not what the cache grows to on disk.

Also avoid running `pnpm run build` or `tsc` while the dev server is up - there is not enough
room in the container for both, and it is usually the dev server that gets killed.

# 📁 Structure

```
├── docker/
├── public/
├── src/
│   ├── app/    
│   │   ├── (dashboard)/   # Dashboard related routes  
│   │   ├── (public)/      # Public routes
│   │   │   ├── account/ 
│   │   │   ├── docs/ 
│   │   │   ├── page/ 
│   │   │   ├── status/ 
│   │   │   ├── layout.tsx # Public specific layout
│   │   │   ├── page.tsx
│   │   ├── api/  
│   │   │   ├── csrf/ 
│   │   │   ├── language/ 
│   │   │   ├── proxy/ 
│   │   ├── error.tsx 
│   │   ├── favicon.ico
│   │   ├── global.css
│   │   ├── layout.css  # Base layout
│   │   ├── providers.tsx # Base providers
│   ├── components/        # Common components
│   │   ├── form/          # Form related components
│   │   ├── layout/        # Layout components
│   │   │   ├── footer.default.tsx
│   │   │   ├── header.default.tsx
│   │   │   ├── logo.default.tsx
│   │   │   ├── toggle-theme.tsx
│   │   │   ├── user-menu.component.tsx
│   │   ├── ui/
│   │   ├── window/
│   │   ├── icon.component.tsx
│   │   ├── protected-route.component.tsx
│   │   ├── status.component.tsx
│   ├── config/            # Configuration files
│   │   ├── data-source.config.ts
│   │   ├── data-source.register.ts
│   │   ├── daysjs.config.ts 
│   │   ├── init-redis.config.ts 
│   │   ├── nunjucks.config.ts 
│   │   ├── routes.setup.ts
│   │   ├── settings.config.ts 
│   │   ├── translate.setup.ts 
│   ├── exceptions/        # Custom error classes
│   ├── helpers/           # Utilities (date, string, object, etc.)
│   ├── hooks/             # Custom hooks
│   ├── locales/           # Language files
│   ├── models/            # Models (entities)
│   ├── providers/           
│   │   ├── auth.provider.tsx 
│   │   ├── query-client.provider.tsx 
│   │   ├── theme.provider.tsx 
│   │   ├── toast.provider.tsx 
│   ├── services/          # Back-end (eg: NReady) services
│   │   ├── account.service.ts
│   │   ├── auth.service.ts
│   │   ├── ...
│   ├── stores/
│   │   ├── data-table.store.ts
│   │   ├── window.store.ts
│   ├── types/            
│   └── proxy.ts           
├── .env
├── biome.json
├── docker-compose.yml
├── next.config.ts
└── tsconfig.json
```

# 🔗 Dependencies

- [next](https://nextjs.org/)
- [react](https://reactjs.org/)
- [zustand](https://zustand.docs.pmnd.rs/)
- [@heroui/react](https://www.heroui.com/) - component library (React Aria based); the dashboard data table is built on its `Table` + `Pagination`
- [immer](https://immerjs.github.io/immer/)
- [zod](https://zod.dev) - TypeScript-first schema validation with static type inference
- [ioredis](https://github.com/luin/ioredis) - Robust Redis client for Node.js
- [dayjs](https://day.js.org/) - Parses, validates, manipulates, and displays dates and times
- [TanStack  Query](https://tanstack.com/query/latest) - Powerful asynchronous state management, server-state utilities and data fetching

Dev only:

- [typescript](https://www.typescriptlang.org/)
- [tailwindcss](https://tailwindcss.com/)
- [biome](https://biomejs.dev/) - Biome is a fast formatter for JavaScript, TypeScript, JSX, TSX, JSON, HTML, CSS and GraphQL - its `noImportCycles` rule also covers circular dependencies

# 🚢 Deployment

The production image is `docker/Dockerfile.prod` (Next's standalone output). Every
`NEXT_PUBLIC_*` value is inlined into the client bundle by `next build`, so it goes in as a
`--build-arg` and the image is tied to one environment. Everything the server reads per request -
`REMOTE_API_URL`, `SESSION_TOKEN`, `REDIS_*`, `AWS_*` - is a runtime variable and must not be a
build arg: build args are recorded in the image history.

### Image storage - private S3 bucket behind CloudFront

Development stores uploads on disk (`IMAGE_STORAGE=local`, served off `/public/uploads`).
Production uses a **private** bucket, with two ways in:

| Images | Served by | Access |
|---|---|---|
| Public sections - `product`, `product_variant`, `article` (`PUBLIC_IMAGE_SECTIONS`) | CloudFront, stable URL, cached for a year | anyone |
| Every other section (`brand`, `category`, ...) | `/api/image/view` -> presigned S3 URL, 5 minutes | `read` permission on the section |

Keys are `<section>/<entity_id>/<uuid>.<ext>`, so the section is the first path segment - which is
what both the bucket policy below and `showImage()` key on.

**1. Bucket.** Create it with *Block all public access* on, no static website hosting. Nothing
reaches it anonymously.

**2. App permissions.** The UI uploads, deletes and signs reads itself. Give its instance role (or
the user behind `AWS_ACCESS_KEY_ID`) `s3:PutObject`, `s3:DeleteObject` and `s3:GetObject` on
`arn:aws:s3:::<bucket>/*`. With an instance role, leave both `AWS_*_KEY` variables empty.

**3. CloudFront distribution.**
- Origin: the bucket's REST endpoint (`<bucket>.s3.<region>.amazonaws.com`), not a website endpoint
- Origin access: **Origin Access Control**, signing requests always
- Viewer protocol policy: redirect HTTP to HTTPS; allowed methods `GET, HEAD`
- Cache policy: `CachingOptimized`; compression on

**4. Bucket policy** - CloudFront may read the public prefixes and nothing else, so a guessed
CloudFront URL for a private section answers 403:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontReadsPublicImages",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::<bucket>/product/*",
        "arn:aws:s3:::<bucket>/product_variant/*",
        "arn:aws:s3:::<bucket>/article/*"
      ],
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
        }
      }
    }
  ]
}
```

**5. Configuration.**
- Runtime: `IMAGE_STORAGE=s3`, `AWS_S3_BUCKET`, `AWS_REGION`
- Build arg: `NEXT_PUBLIC_IMAGES_CDN_URL=https://<distribution>.cloudfront.net` (no trailing slash).
  `next.config.ts` turns it into `images.remotePatterns`, so `next/image` resizes and converts
  public images; left empty, every S3 image falls back to the signed route. In CI it comes from
  the repository variable `NEXT_PUBLIC_IMAGES_CDN_URL` (`.github/workflows/deploy.yml`), so set it
  there and redeploy - the image has to be rebuilt to pick it up

**6. Verify** after the first deploy:
- a product image URL on the storefront points at the distribution and answers `200` signed out
- the same distribution answers `403` for a private section's key (`/brand/...`)
- a brand or category image in the dashboard still loads through `/api/image/view`

Notes:
- Uploads carry `Cache-Control: public, max-age=31536000, immutable` - a key is never rewritten,
  a replaced image is a new key. A deleted image can stay in CloudFront's cache until it expires;
  invalidate `/<key>` if it must disappear at once
- **Making another section public** means adding it to `PUBLIC_IMAGE_SECTIONS`
  (`src/models/image.model.ts`) *and* its prefix to the bucket policy - either alone serves 403s
