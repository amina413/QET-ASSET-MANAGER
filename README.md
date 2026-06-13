# QET Asset Management System

Enterprise asset tracking, depreciation management, and lifecycle reporting for Quantum Edge Technologies Ltd.

---

## Architecture

```
QET-ASSET-MANAGER/
├── src/
│   ├── app/                        # Next.js App Router (routing layer)
│   │   ├── api/                    # REST API routes
│   │   │   ├── auth/               # login / logout / me
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
│   ├── frontend/                   # React UI (client components)
│   │   ├── components/
│   │   │   ├── AppClient.tsx       # Root authenticated shell
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AssetForm.tsx       # Register / bulk import
│   │   │   ├── AssetLookup.tsx     # Browse, filter, export, print tags
│   │   │   ├── Reports.tsx         # Depreciation & inventory reports
│   │   │   ├── Settings.tsx        # Lookup tables CRUD
│   │   │   ├── UserManagement.tsx
│   │   │   ├── WipManagement.tsx
│   │   │   ├── Audit.tsx
│   │   │   ├── GeminiAssistant.tsx
│   │   │   ├── ErrorBoundary.tsx   # React error boundary
│   │   │   └── Toast.tsx           # Toast notification system
│   │   ├── services/
│   │   │   └── api-client.ts       # Typed fetch wrapper (ApiResult<T>)
│   │   └── constants/              # Static lookup data
│   │
│   ├── backend/                    # Server-only code
│   │   └── lib/
│   │       ├── prisma.ts           # Prisma client singleton
│   │       ├── session.ts          # iron-session config (AES-256, HttpOnly)
│   │       ├── auth-helpers.ts     # requireAuth() / requirePermission()
│   │       ├── permissions.ts      # RBAC permission map
│   │       ├── api.ts              # ok() / err() / handleError() helpers
│   │       ├── validation.ts       # Zod schemas for all API inputs
│   │       └── env.ts              # Startup env-var validation
│   │
│   ├── shared/                     # Isomorphic code (frontend + backend)
│   │   ├── types/                  # TypeScript types (Asset, User, etc.)
│   │   └── utils/
│   │       ├── depreciation.ts     # Straight-line / reducing balance / SYD
│   │       ├── dates.ts            # formatDate, formatDateTime, fiscalYearLabel
│   │       └── reportData.ts       # Report aggregation helpers
│   │
│   └── middleware.ts               # Session auth + rate limiting (60 req/60s per IP)
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
| manage_users          | ✓   | ✓   | ✓   | ✓   |
| edit_users            | ✓   | ✓   |     |     |
| delete_users          | ✓   |     |     |     |
| start_audit           |     |     |     | ✓   |
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

# Seed passwords (optional — defaults to 'ChangeMe123!' if not set)
SEED_DEFAULT_PASSWORD="YourDefaultPassword123!"
SEED_OKALU_PASSWORD="YourOkaluSpecificPassword456!"
```

### 3. Create the database

```bash
createdb qet_asset_manager
# or via psql:
psql -U postgres -c "CREATE DATABASE qet_asset_manager;"
```

### 4. Run migrations

```bash
npx prisma migrate deploy
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
| `npm run build`      | Production build                           |
| `npm run start`      | Start production server                    |
| `npm run lint`       | ESLint check                               |
| `npm run db:migrate` | Create and apply a new Prisma migration    |
| `npm run db:seed`    | Seed the database with default data        |
| `npm run db:studio`  | Open Prisma Studio (visual DB browser)     |

---

## API reference

All responses follow this envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human-readable message", "details": { ... } }
```

Every `/api/*` route requires an authenticated session cookie **except** `POST /api/auth/login`.

### Authentication

| Method | Path               | Body / Notes                     |
|--------|--------------------|----------------------------------|
| POST   | `/api/auth/login`  | `{ email, password }` → sets cookie |
| POST   | `/api/auth/logout` | Clears session                   |
| GET    | `/api/auth/me`     | Returns session user             |

### Assets

| Method | Path                               | Permission        |
|--------|------------------------------------|-------------------|
| GET    | `/api/assets`                      | any auth          |
| POST   | `/api/assets`                      | register_asset    |
| GET    | `/api/assets/[id]`                 | any auth          |
| DELETE | `/api/assets/[id]`                 | delete_asset      |
| POST   | `/api/assets/[id]/improvement`     | edit_asset        |
| POST   | `/api/assets/[id]/history`         | any auth          |
| POST   | `/api/assets/[id]/condition`       | any auth          |
| POST   | `/api/assets/[id]/image`           | any auth          |
| POST   | `/api/assets/bulk`                 | register_asset    |
| DELETE | `/api/assets/clear`                | system_settings   |

**Bulk import** returns `{ createdIds[], createdProductIds[], warnings[] }` — warnings are issued when a custodian ID is not found and the uploader is assigned instead.

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
| GET    | `/api/users/[id]`  | any auth     |
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
4. Deploy

Recommended PostgreSQL provider: **Neon** (serverless, free tier, automatic TLS).

### Self-hosted (VPS / on-premise)

```bash
npm run build
npm run start        # default port 3000
```

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

---

## Next steps

### Immediate

- **Wire up Toast notifications** — add `<ToastProvider>` to `AppClient.tsx` and replace the remaining `alert()` / `prompt()` calls in components with `useToast()`
- **Wire up ErrorBoundary** — wrap major sections in `AppClient.tsx` with `<ErrorBoundary>`
- **Change all seed passwords** — run `npm run db:seed` with `SEED_DEFAULT_PASSWORD` and `SEED_OKALU_PASSWORD` set in `.env`, then change passwords via the UI

### Short-term

- **Multi-instance rate limiting** — replace the in-memory rate limiter in `middleware.ts` with a Redis-backed store (Upstash) when deploying more than one server instance
- **Pagination** — `GET /api/assets` returns all rows; add `limit` / `cursor` query params for large inventories
- **Soft-delete for assets** — add `isActive` flag instead of hard-delete to preserve audit trail
- **CSRF double-submit token** — add explicit CSRF protection for state-mutating routes (currently mitigated by `SameSite: lax`)

### Medium-term

- **Email notifications** — notify approvers on new transfer requests; notify custodians on approval (Resend / Nodemailer)
- **File storage** — move asset images from base64 in the database to object storage (S3 / Cloudflare R2) with presigned URLs
- **Audit trail completeness** — capture field-level diffs on all asset updates via Prisma middleware
- **Automated depreciation run** — scheduled job to record annual depreciation charges at fiscal year-end

### Long-term

- **Mobile app** — React Native with the existing API; QR/barcode scanning is already implemented in the web UI
- **ERP integration** — export to SAP / Sage; IFRS-compliant depreciation schedules
