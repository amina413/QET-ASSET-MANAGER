# QET Asset Management System

Enterprise asset tracking, depreciation management, and lifecycle reporting for Quantum Edge Technologies Ltd.

---

## Architecture

```
QET-ASSET-MANAGER/
├── src/
│   ├── app/                        # Next.js App Router (routing layer)
│   │   ├── api/                    # REST API routes
│   │   │   ├── auth/               # login / logout / me / csrf
│   │   │   ├── assets/             # CRUD + bulk import + clear
│   │   │   ├── assets/[id]/        # GET, DELETE, improvement, history, condition, image
│   │   │   ├── transfers/          # list / initiate / approve / reject
│   │   │   ├── users/              # CRUD
│   │   │   ├── settings/           # departments / locations / categories / custodians /
│   │   │   │                       #   asset-types / asset-classes
│   │   │   └── ai/                 # Gemini AI assistant
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/                 # React UI components
│   │   ├── AppClient.tsx           # Root authenticated shell
│   │   ├── Dashboard.tsx
│   │   ├── AssetForm.tsx           # Register / bulk import
│   │   ├── AssetLookup.tsx         # Browse, filter, export, print tags
│   │   ├── Reports.tsx             # Depreciation & inventory reports
│   │   ├── AdminSettings.tsx       # Lookup tables CRUD
│   │   ├── UserManagement.tsx
│   │   ├── WipManagement.tsx
│   │   ├── Audit.tsx
│   │   ├── GeminiAssistant.tsx
│   │   ├── ErrorBoundary.tsx       # React error boundary
│   │   └── Toast.tsx               # Toast notification system
│   │
│   ├── lib/                        # Server-side utilities
│   │   ├── prisma.ts               # Prisma client singleton
│   │   ├── session.ts              # iron-session config (AES-256, HttpOnly)
│   │   ├── auth-helpers.ts         # requireAuth() / requirePermission()
│   │   ├── permissions.ts          # RBAC permission map
│   │   ├── view-access.ts          # View-level access control
│   │   ├── api.ts                  # ok() / err() / handleError() helpers
│   │   ├── logger.ts               # Structured JSON logging
│   │   ├── asset-image-storage.ts  # S3-compatible image upload URLs
│   │   ├── validation.ts           # Zod schemas for all API inputs
│   │   └── env.ts                  # Startup env-var validation
│   │
│   ├── services/                   # Client-side API callers
│   │   ├── api-client.ts           # Typed fetch wrapper (ApiResult<T>)
│   │   ├── assets.ts
│   │   ├── auth.ts
│   │   ├── settings.ts
│   │   ├── transfers.ts
│   │   └── users.ts
│   │
│   ├── utils/                      # Pure utility functions
│   │   ├── csv.ts                  # CSV parse / export helpers
│   │   ├── dates.ts                # formatDate, formatDateTime, fiscalYearLabel
│   │   ├── depreciation.ts         # Straight-line / reducing balance / SYD
│   │   └── reportData.ts           # Report aggregation helpers
│   │
│   ├── types.ts                    # Shared TypeScript types (Asset, User, etc.)
│   ├── constants.ts                # Static lookup data
│   ├── middleware.ts               # API rate limiting, session auth, CSRF checks
│   └── instrumentation.ts          # Next.js startup hook (env validation)
│
├── prisma/
│   ├── schema.prisma               # PostgreSQL schema
│   ├── migrations/                 # Migration history
│   └── seed.js                     # Seed users, departments, locations, categories
│
├── next.config.ts                  # Security headers + image config
└── tsconfig.json                   # Strict TypeScript (strict, noImplicitReturns, etc.)
```

### Request flow

```
Browser → Next.js App Router
        → src/middleware.ts  (rate limit 60 req/60s · session check)
        → /api/... route handler
              requirePermission(permission)
              Zod.parse(body)
              Prisma query
              ok(data) | err(message, status)
```

### Session

`iron-session` stores a signed AES-256-GCM encrypted cookie (`qet_session`). The cookie is `HttpOnly`, `SameSite: lax`, and `Secure` in production. Sessions expire after 8 hours.

### Roles and permissions

| Permission            | System Admin | Asset Manager | Custodian | Auditor |
|-----------------------|:---:|:---:|:---:|:---:|
| register_asset        | ✓   | ✓   |     |     |
| edit_asset            | ✓   | ✓   | ✓   |     |
| delete_asset          | ✓   |     |     |     |
| approve_transfer      | ✓   | ✓   |     |     |
| initiate_transfer     | ✓   | ✓   | ✓   |     |
| system_settings       | ✓   |     |     |     |
| manage_users          | ✓   | ✓   |     |     |
| edit_users            | ✓   | ✓   |     |     |
| delete_users          | ✓   |     |     |     |
| start_audit           |     |     |     | ✓   |
| record_audit          |     |     |     | ✓   |
| view_all_reports      | ✓   | ✓   |     | ✓   |
| view_scoped_reports   |     |     | ✓   |     |

### Depreciation methods

| Method | Description |
|--------|-------------|
| Straight-Line | Equal annual charge: `(cost − salvage) / life` |
| Reducing Balance | Fixed rate on net book value each year |
| Sum of Years Digits | Accelerated; proportional to remaining life fraction |

---

## Prerequisites

- **Node.js 20+**
- **PostgreSQL 14+** (local or remote)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```env
# PostgreSQL — must exist before running migrations
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/qet_asset_manager"

# Session encryption key — minimum 32 characters (random string)
SESSION_SECRET="your-random-secret-at-least-32-chars"

# Gemini AI assistant (optional)
GEMINI_API_KEY="AIza..."

# Asset image object storage (S3-compatible; required for image uploads)
ASSET_IMAGE_S3_BUCKET="qet-asset-images"
ASSET_IMAGE_S3_REGION="eu-west-1"
ASSET_IMAGE_S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
ASSET_IMAGE_S3_FORCE_PATH_STYLE="true"
ASSET_IMAGE_S3_ACCESS_KEY_ID="..."
ASSET_IMAGE_S3_SECRET_ACCESS_KEY="..."
ASSET_IMAGE_PUBLIC_BASE_URL="https://assets.example.com"
REQUIRE_ASSET_IMAGES="true"

# Distributed rate limiting and login lockout (recommended in production)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
REQUIRE_DISTRIBUTED_RATE_LIMITS="true"
TRUST_PROXY="true"

# Internal readiness probe token
HEALTH_CHECK_TOKEN="..."

# Non-persistent WIP UI is hidden unless explicitly enabled
NEXT_PUBLIC_ENABLE_WIP="false"

# Seed passwords (optional — defaults to 'ChangeMe123!' if not set)
SEED_DEFAULT_PASSWORD="YourDefaultPassword123!"
SEED_OKALU_PASSWORD="YourOkaluSpecificPassword456!"
ALLOW_PROD_SEED="false"
ALLOW_ASSET_CLEAR="false"
```

### 3. Create the database

```bash
createdb qet_asset_manager
# or via psql:
psql -U postgres -c "CREATE DATABASE qet_asset_manager;"
```

### 4. Run migrations

```bash
npm run db:deploy
```

### 5. Seed initial data

```bash
npm run db:seed
```

Default seeded accounts:

| Email              | Role          |
|--------------------|---------------|
| admin@qet.com      | System Admin  |
| manager@qet.com    | Asset Manager |
| emeka@qet.com      | Custodian     |
| audit@qet.com      | Auditor       |
| okalu@qet.com      | System Admin  |

> **Change all passwords immediately after first login.**

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available scripts

| Script               | Description                                |
|----------------------|--------------------------------------------|
| `npm run dev`        | Start Next.js dev server (port 3000)       |
| `npm run build`      | Prisma generate + production build         |
| `npm run start`      | Start production server                    |
| `npm run lint`       | ESLint check                               |
| `npm run typecheck`  | TypeScript typecheck without emitting files |
| `npm test`           | Run automated tests                        |
| `npm run db:generate`| Generate Prisma client                     |
| `npm run db:migrate` | Create and apply a new Prisma migration    |
| `npm run db:deploy`  | Apply committed migrations in production   |
| `npm run db:seed`    | Seed the database with default data        |
| `npm run db:studio`  | Open Prisma Studio (visual DB browser)     |

---

## API reference

All responses follow this envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human-readable message", "details": { ... } }
```

Every `/api/*` route is rate-limited. Most API routes require an authenticated session cookie; public exceptions are `POST /api/auth/login`, `GET /api/auth/csrf`, and `GET /api/health`.

### Authentication

| Method | Path               | Body / Notes                     |
|--------|--------------------|----------------------------------|
| POST   | `/api/auth/login`  | `{ email, password }` → sets cookie |
| POST   | `/api/auth/logout` | Clears session                   |
| GET    | `/api/auth/me`     | Returns session user             |
| GET    | `/api/auth/csrf`   | Returns CSRF token for authenticated sessions |

### Assets

| Method | Path                               | Permission        |
|--------|------------------------------------|-------------------|
| GET    | `/api/assets`                      | any auth          |
| POST   | `/api/assets`                      | register_asset    |
| GET    | `/api/assets/[id]`                 | any auth          |
| DELETE | `/api/assets/[id]`                 | delete_asset      |
| POST   | `/api/assets/[id]/improvement`     | edit_asset        |
| POST   | `/api/assets/[id]/history`         | any auth; status changes require edit_asset |
| PUT    | `/api/assets/[id]/condition`       | update_condition  |
| POST   | `/api/assets/[id]/image/upload-url`| edit_asset        |
| PUT    | `/api/assets/[id]/image`           | edit_asset        |
| POST   | `/api/assets/bulk`                 | register_asset    |
| DELETE | `/api/assets/clear`                | system_settings + typed confirmation |

`GET /api/assets` is scoped server-side. Users with `view_all_reports` can see the active register; scoped users only see assets assigned to them. The endpoint supports `limit` and `skip` with a maximum limit of 500.

**Bulk import** returns `{ createdIds[], createdProductIds[], warnings[] }` — warnings are issued when a custodian ID is not found or inactive and the uploader is assigned instead.

Bulk upload and spreadsheet exports use CSV files. XLSX parsing is intentionally not supported because the previous `xlsx` dependency had unresolved security advisories.

### Transfers

| Method | Path                               | Permission        |
|--------|------------------------------------|-------------------|
| GET    | `/api/transfers`                   | any auth          |
| POST   | `/api/transfers`                   | initiate_transfer |
| POST   | `/api/transfers/[id]/approve`      | approve_transfer  |
| POST   | `/api/transfers/[id]/reject`       | approve_transfer  |

### Users

| Method | Path               | Permission   |
|--------|--------------------|--------------|
| GET    | `/api/users`       | any auth     |
| POST   | `/api/users`       | manage_users |
| PUT    | `/api/users/[id]`  | edit_users   |
| DELETE | `/api/users/[id]`  | delete_users |

### Settings (all require `system_settings`)

```
GET/POST   /api/settings/departments      /api/settings/locations
PUT/DELETE /api/settings/departments/[id] /api/settings/locations/[id]

GET/POST   /api/settings/categories       /api/settings/custodians
PUT/DELETE /api/settings/categories/[id]  /api/settings/custodians/[id]

GET/POST   /api/settings/asset-types      /api/settings/asset-classes
PUT/DELETE /api/settings/asset-types/[id] /api/settings/asset-classes/[id]
```

### AI

| Method | Path     | Body                                             |
|--------|----------|--------------------------------------------------|
| POST   | `/api/ai`| `{ message, assetsSnapshot?, images?, documents? }` |

Images must be base64 data URIs with MIME type `image/jpeg`, `image/png`, `image/gif`, or `image/webp`.

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add environment variables:
   - `DATABASE_URL` — use a pooler connection string (Neon, Supabase, etc.)
   - `SESSION_SECRET` — 32+ character random string
   - `GEMINI_API_KEY` — optional
   - `ASSET_IMAGE_*` variables — required for asset image uploads
   - `UPSTASH_REDIS_REST_*` variables — required for distributed rate limiting
4. Run `npm run db:deploy` against the production database before each release that includes migrations
5. Deploy

Recommended PostgreSQL provider: **Neon** (serverless, free tier, automatic TLS).

### Self-hosted (VPS / on-premise)

```bash
npm ci
npm run db:deploy
npm run build
npm run start        # default port 3000
```

### Docker

```bash
docker build -t qet-asset-manager .
docker run --env-file .env -p 3000:3000 qet-asset-manager
```

The image uses Next.js standalone output. Run `npm run db:deploy` as a release step before starting a new container version.

Terminate TLS with nginx:

```nginx
server {
    listen 443 ssl;
    server_name assets.yourcompany.com;

    ssl_certificate     /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

For production set `NODE_ENV=production` so the session cookie becomes `Secure`.

### Health checks

Use `GET /api/health` or `GET /api/health/live` for public liveness checks. Use `GET /api/health/ready` for database readiness checks; set `HEALTH_CHECK_TOKEN` and send it as `X-Health-Token` from internal probes.

### Backup and restore

Schedule encrypted PostgreSQL backups with a defined retention period before going live. A minimum operational baseline is:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=qet_asset_manager_$(date +%Y%m%d_%H%M%S).dump
pg_restore --clean --if-exists --dbname "$DATABASE_URL" qet_asset_manager_<timestamp>.dump
```

Test restore into a staging database before relying on backups for disaster recovery. Record the target RPO/RTO for the deployment environment.

---

## Next steps

### Before scaling beyond one app instance

- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, then set `REQUIRE_DISTRIBUTED_RATE_LIMITS=true`.
- Add request tracing and error reporting (Sentry, Datadog, or equivalent) around the structured logs.
- Test object-storage CORS for browser `PUT` uploads from the production domain.

### Product hardening backlog

- Persist physical audit sessions and verifications in the database for compliance reporting.
- Replace remaining blocking `alert()` calls with the shared toast/dialog system.
- Add email notifications for transfer approvals and custodian changes.
- Add a scheduled depreciation close process for fiscal year-end.

### Long-term

- **Mobile app** — React Native with the existing API; QR/barcode scanning is already implemented in the web UI
- **ERP integration** — export to SAP / Sage; IFRS-compliant depreciation schedules

