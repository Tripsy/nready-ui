# NReady Dashboard

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![React](https://img.shields.io/badge/React-19.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/License-MIT-green)

# 📄 Description

(Dashboard) is a demo frontend implementation using [NReady](https://github.com/Tripsy/nready-api) as a backend API.

This boilerplate provides an authentication system (login, register, recover password, account pages, etc.)
and includes an administration dashboard (user, cron-history, log-history, log-data, mail-queue, permission, 
template, client, address, place, brand, category, cash-flow, etc.)

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

### Core features

- [x] (Public) 
    - Auth system: login, register, logout, forgot password, reset password, email confirmation, etc.
- [x] (Dashboard) 
    - cron-history, log-data, log-history, mail-queue, permission, template, user
    - brand, category, cash-flow, address, client, place
    - // TODO 

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

That is the container's OOM killer, not a crash. Turbopack's persistent cache in
`.next/dev/cache` grows across sessions — left alone it reached 4.0G, which put startup memory
at 2.5G before a single request and pushed the process into the 4g `mem_limit` set in
`docker-compose.yml`. Because `tty: true` keeps the container up, it just looks like the dev
server quitting silently. Confirm with:

```bash
docker inspect nready-ui.test --format '{{.State.OOMKilled}}'
```

Run `pnpm run clean` and restart. `experimental.turbopackMemoryLimit` in `next.config.ts` caps
Turbopack's own memory, but not what the cache grows to on disk.

Also avoid running `pnpm run build` or `tsc` while the dev server is up — there is not enough
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

# 💡 How to

## Adding new model for `dashboard` (ex: `cars`)

1. Create `models/car.model.ts` from `models/user.model.ts`
2. Duplicate `src/(dashboard)/dashboard/user` > `src/(dashboard)/dashboard/car` & rename files
    - data-table-filters-car.component.tsx
    - data-table-car.component.tsx    
    - form-manage-car.component.tsx
    - page.tsx
    - car.definition.ts
    - view-car.component.ts 
3. Update `src/types/data-source.key.ts`
4. Add `cars.json` to `src/locales/[language]` & update src/locales/en/index.ts
5. Update `src/models/permission.model.ts`
6. Update `src/models/log-history.model.ts`
7. Update `src/app/(dashboard)/_components/side-menu.component.tsx`
8. Update `Routes.group('dashboard')` in `src/config/routes.setup.ts`

# 📌 TODO

1. Go to old branch before-star and get the footer additions
2. /articles, /articles/categories, /articles/{article-slug}
3. `stats` feature on the backend — the dashboard home widgets (expenses, revenues,
   recent activity) call `/stats/*`, which nready-api does not serve yet
   - show recent activity - log history
   - show a resume of previous day (new entries): users, addresses, clients
   - show expenses and revenues as in star-ui
   - show errors (log data, mail queue, cron-history) from last 24 hours
   - other stats: user activity in last 24 hours (if is relevant)  
4. Dashboard docs should be specific per feature and provide flow info           
5. nready-native 
6. Dashboard entities for the nready-only features: product, order, order-shipping, invoice, grn, warehouse, subscription
7. Hero UI -> theme
8. Add demo instructions
9. Setup Sentry on UI

# 🔗 Dependencies

- [next](https://nextjs.org/)
- [react](https://reactjs.org/)
- [zustand](https://zustand.docs.pmnd.rs/)
- [@heroui/react](https://www.heroui.com/) — component library (React Aria based); the dashboard data table is built on its `Table` + `Pagination`
- [immer](https://immerjs.github.io/immer/)
- [zod](https://zod.dev) — TypeScript-first schema validation with static type inference
- [ioredis](https://github.com/luin/ioredis) — Robust Redis client for Node.js
- [dayjs](https://day.js.org/) — Parses, validates, manipulates, and displays dates and times
- [TanStack  Query](https://tanstack.com/query/latest) — Powerful asynchronous state management, server-state utilities and data fetching

Dev only:

- [typescript](https://www.typescriptlang.org/)
- [tailwindcss](https://tailwindcss.com/)
- [biome](https://biomejs.dev/) — Biome is a fast formatter for JavaScript, TypeScript, JSX, TSX, JSON, HTML, CSS and GraphQL — its `noImportCycles` rule also covers circular dependencies
