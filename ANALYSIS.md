# QET Asset Manager — Technical Analysis

In-depth audit of the codebase against best practices for Next.js 16 App Router, TypeScript, React 19, Prisma, and PostgreSQL. Issues are categorised by severity and include root cause and recommended fix.

**Severity key**
- 🔴 **Critical** — blocks production deployment or creates a security hole
- 🟠 **High** — causes incorrect behaviour or data loss under normal use
- 🟡 **Medium** — degrades quality, maintainability, or scalability
- 🟢 **Low** — code smell, UX improvement, or polish

---

## Table of Contents

1. [Backend — API Routes](#1-backend--api-routes)
2. [Backend — Library Layer](#2-backend--library-layer)
3. [Frontend — AppClient & State Management](#3-frontend--appclient--state-management)
4. [Frontend — Component Issues](#4-frontend--component-issues)
5. [Frontend — Services Layer](#5-frontend--services-layer)
6. [Database & Prisma](#6-database--prisma)
7. [Security](#7-security)
8. [Architecture & Scalability](#8-architecture--scalability)
9. [TypeScript & Code Quality](#9-typescript--code-quality)
10. [Testing](#10-testing)
11. [Prioritised Fix Roadmap](#11-prioritised-fix-roadmap)

---

## 1. Backend — API Routes

### 1.1 🔴 `POST /api/transfers` does not check for double-initiation

**File:** `src/app/api/transfers/route.ts:32`

```typescript
const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
if (!asset) return handleError(new Error('Asset not found')); // ← wrong helper
// ← no check: what if asset.status === 'PENDING_TRANSFER' already?
```

**Problems:**
- Uses `handleError(new Error(...))` instead of `notFound('Asset')` — logs a spurious server error for a normal client mistake.
- A second transfer can be initiated on an asset already in `PENDING_TRANSFER` state, creating two open transfer requests for the same asset.

**Fix:**
```typescript
if (!asset) return notFound('Asset');
if (asset.status === 'PENDING_TRANSFER') return err('Asset already has a pending transfer', 409);
```

---

### 1.2 🔴 `GET /api/transfers` returns only PENDING — no way to view history

**File:** `src/app/api/transfers/route.ts:12`

```typescript
const transfers = await prisma.transferRequest.findMany({
  where: { status: 'PENDING' },
```

The UI shows resolved transfers (approved/rejected) in the transfer panel, but the API never returns them. This silently shows an incomplete list.

**Fix:** Accept optional `?status=PENDING|APPROVED|REJECTED|ALL` query param, defaulting to `PENDING`.

---

### 1.3 🟠 `POST /api/users` silently crashes on duplicate email

**File:** `src/app/api/users/route.ts:34`

The `User.email` field has a `@unique` constraint in Prisma. If a duplicate email is submitted, Prisma throws a `P2002` error which falls through to `handleError` and returns a generic `500` instead of `409 Conflict`.

**Fix:** Catch `PrismaClientKnownRequestError` with code `P2002`:
```typescript
} catch (e: unknown) {
  if ((e as { code?: string }).code === 'P2002') return err('Email already in use', 409);
  throw e;
}
```

---

### 1.4 🟠 `DELETE /api/users/[id]` is a hard delete — breaks AssetHistory

**File:** `src/app/api/users/[id]/route.ts`

`prisma.user.delete({ where: { id } })` will fail with a foreign key violation if the user has `AssetHistory` records (the `userId` FK has no cascade). Even if a cascade is added, the audit trail is permanently destroyed.

**Fix:** Soft-delete via `isActive: false`. Add `isActive Boolean @default(true)` to the `User` model and filter `{ isActive: true }` in all list queries.

---

### 1.5 🟠 `POST /api/assets/[id]/improvement` — Revaluation type not handled separately

**File:** `src/app/api/assets/[id]/improvement/route.ts:20`

```typescript
const newCost = data.type === 'Addition'
  ? currentCost + data.amount
  : currentCost - data.amount;  // ← Revaluation treated same as Reduction
```

`Revaluation` is a distinct IAS 16 concept — it sets the asset to a new carrying amount (fair value), it does not simply subtract. If `type === 'Revaluation'`, the `amount` field should be the **new absolute cost**, not a delta.

**Fix:** Add a third branch and update `AddImprovementSchema` to validate accordingly:
```typescript
const newCost =
  data.type === 'Addition'    ? currentCost + data.amount :
  data.type === 'Reduction'   ? currentCost - data.amount :
  /* Revaluation */             data.amount; // absolute new value
```

---

### 1.6 🟠 `src/app/api/settings/locations/route.ts` — auto-generated code collision

**File:** `src/app/api/settings/locations/route.ts`

When no `code` is provided, the route generates one from `Date.now().slice(-4)`. Two simultaneous requests within the same millisecond produce the same code and one will fail with an unhandled P2002 error.

**Fix:** Generate codes as `Date.now().toString(36).slice(-6).toUpperCase()` and still catch P2002, or require the client always to provide a code.

---

### 1.7 🟡 Settings routes missing `notFound` guard on all PUT/DELETE handlers

**Files:** `src/app/api/settings/categories/[id]/route.ts`, `asset-types/[id]/route.ts`, `custodians/[id]/route.ts`, `asset-classes/[id]/route.ts`

These routes call `prisma.X.update()` without first checking if the record exists. Prisma throws `P2025` ("Record to update not found") which is handled generically as a 500.

**Fix:** Add `findUnique` check and return `notFound('X')` on all `[id]` routes, as already done for departments and locations.

---

### 1.8 🟡 `GET /api/assets` returns entire dataset with no pagination

**File:** `src/app/api/assets/route.ts`

The route fetches every asset including full depreciation schedules, history, and improvements:

```typescript
const assets = await prisma.asset.findMany({
  include: { custodian: ..., history: ..., improvements: ..., schedules: ... },
});
```

At 500 assets with 20 schedule rows each, this is 10 000+ rows per request. Memory grows linearly with the asset count and the response time is unbounded.

**Fix:** 
1. Add `limit`/`cursor` or `skip`/`take` pagination.
2. Return lightweight summary in the list (no nested history/improvements/schedules).
3. Serve those only via `GET /api/assets/[id]`.

---

### 1.9 🟡 Login does not update `lastLogin` atomically

**File:** `src/app/api/auth/login/route.ts:27`

```typescript
await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
const session = await getSession();
session.user = { ... };
await session.save();
```

If the server crashes between the `update` and `session.save()`, `lastLogin` is updated but the user never receives a session. This is minor but inconsistent.

**Fix:** Wrap both operations in a try-catch so a failed session save doesn't silently update the DB without issuing a cookie.

---

### 1.10 🟡 No `brute-force protection` on login

**File:** `src/app/api/auth/login/route.ts`

An attacker can issue unlimited password-guess attempts. The rate limiter in `middleware.ts` applies at 60 req/60s globally — a determined attacker can still try 60 passwords per minute per IP.

**Fix:** Add a per-email failed-attempt counter (Redis or in-memory) with exponential backoff and a lockout threshold (e.g., 10 failures → 15-minute lockout).

---

## 2. Backend — Library Layer

### 2.1 🔴 Custodian role has `manage_users` permission — over-privileged

**File:** `src/backend/lib/permissions.ts:61`

```typescript
Custodian: [
  "edit_asset",
  "initiate_transfer",
  "assign_custodian",
  "update_condition",
  "view_scoped_reports",
  "export_reports",
  "manage_users",  // ← should not be here
],
```

A Custodian can call `POST /api/users` to create new users of any role (including System Admin). This is a privilege escalation vector.

**Fix:** Remove `manage_users` from Custodian. Also review whether Auditor truly needs `manage_users`.

---

### 2.2 🟠 `dbRoleToDisplay` silently falls back to 'Custodian' for unknown roles

**File:** `src/backend/lib/session.ts:54`

```typescript
export function dbRoleToDisplay(dbRole: string): SessionUser['role'] {
  return ROLE_MAP[dbRole] ?? 'Custodian';
}
```

If the database contains a role string that doesn't exist in `ROLE_MAP` (e.g., a future migration adds a new role), the user silently gets Custodian privileges instead of an error. This is a hidden security bug.

**Fix:** Throw or return an explicit error, and log the unknown role.

---

### 2.3 🟡 `handleError` in `api.ts` logs `error.stack` but not a correlation ID

**File:** `src/backend/lib/api.ts:32`

There is no way to correlate a `500 Internal server error` response the user sees with a specific log line on the server.

**Fix:** Generate a short random ID per request (using `crypto.randomUUID()` sliced), include it in both the log and the error response:
```typescript
const correlationId = crypto.randomUUID().slice(0, 8);
console.error(`[${correlationId}]`, error);
return err(`Internal server error (ref: ${correlationId})`, 500);
```

---

### 2.4 🟡 Zod error details expose field structure to clients

**File:** `src/backend/lib/api.ts:30`

```typescript
return err('Validation failed', 422, error.flatten());
```

`error.flatten()` returns the full field-by-field breakdown. While this is useful for forms, it also tells potential attackers exactly which fields exist and what constraints they have. In production this is acceptable for most forms but should not expose internal DB field names.

**Fix:** Keep `details` in development, but in production obfuscate or strip field names that match internal schema.

---

### 2.5 🟡 `env.ts` validates on import but is never called at startup

**File:** `src/backend/lib/env.ts`

The `validateEnv()` function exists but nothing calls it. The app will boot and fail later when `SESSION_SECRET` is missing (caught by `session.ts`), but `DATABASE_URL` missing won't be caught until the first DB query.

**Fix:** Call `validateEnv()` in `prisma.ts` or in `next.config.ts` via an instrumentation hook:
```typescript
// src/instrumentation.ts (Next.js 15+ built-in)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./backend/lib/env');
    validateEnv();
  }
}
```

---

## 3. Frontend — AppClient & State Management

### 3.1 🔴 WipManagement data lives only in component state — lost on page refresh

**File:** `src/frontend/components/WipManagement.tsx`

WIP projects, cost items, and status are stored in local React state. Refreshing the browser or navigating away silently destroys all data. There is no API or database table for `WipAsset`.

**Fix:** Create a `WipProject` model in Prisma, add API routes (`/api/wip`), and persist all mutations. The `WipAsset` interface in `shared/types.ts` already defines the shape.

---

### 3.2 🔴 Audit sessions are not persisted to database

**File:** `src/frontend/components/Audit.tsx`

`handleCompleteAudit()` updates local state only. Nothing is saved to the database. The `AuditSession` and `AuditVerification` types exist in `shared/types.ts` but there are no corresponding Prisma models.

**Fix:** Add `AuditSession` and `AuditVerification` to `prisma/schema.prisma`, add API routes, and call them from the Audit component.

---

### 3.3 🟠 `userForComponents.lastLogin` is always faked

**File:** `src/frontend/components/AppClient.tsx:137`

```typescript
const userForComponents = {
  ...
  lastLogin: new Date().toISOString(),  // ← always "just now"
};
```

The session stores `id`, `name`, `email`, `department`, and `role` — but not `lastLogin`. So it's faked with the current timestamp. The Profile component then displays this as the user's last login time, which is wrong.

**Fix:** Either add `lastLogin` to `SessionUser` (stored in the cookie) by reading it from the DB at login, or fetch it separately in the Profile component.

---

### 3.4 🟠 `refreshAssets` and `refreshUsers` fail silently

**File:** `src/frontend/components/AppClient.tsx:39-46`

```typescript
const refreshAssets = useCallback(async () => {
  const result = await assetService.getAll();
  if (result.success) setAssets(result.data);
  // ← if !result.success, nothing happens; old data stays; user sees no error
}, []);
```

**Fix:** Add error state and show a toast / error banner when refresh fails:
```typescript
if (!result.success) {
  console.error('Failed to load assets:', result.error);
  // toast('Failed to refresh assets', 'error');
}
```

---

### 3.5 🟠 No `ErrorBoundary` wrapping the main view

**File:** `src/frontend/components/AppClient.tsx:235`

```typescript
renderView()  // ← unguarded; any render error = white screen
```

The `ErrorBoundary` component was created in a prior session but is never used.

**Fix:**
```typescript
import { ErrorBoundary } from './ErrorBoundary';
// ...
<ErrorBoundary key={currentView}>
  {renderView()}
</ErrorBoundary>
```

Using `key={currentView}` resets the boundary when the user navigates, preventing a stuck error state.

---

### 3.6 🟠 GeminiAssistant is always mounted even when collapsed

**File:** `src/frontend/components/AppClient.tsx:237`

```typescript
<GeminiAssistant assets={assets} />
```

The AI assistant is rendered unconditionally. Its `useEffect` hooks, speech synthesis refs, and message state are active at all times even if the user never opens it. This wastes resources and the `assets` prop re-creates the component reference on every asset refresh.

**Fix:** Lazy-mount only when the user opens the panel. Memoize `assets` with `useMemo`.

---

### 3.7 🟡 Prop drilling `currentUser` through 8+ component layers

**File:** Multiple components

`currentUser` is passed as a prop from `AppClient` → `Dashboard` → nested components. Adding any new field to `currentUser` requires updating every prop type along the chain.

**Fix:** Create a `CurrentUserContext` with `React.createContext` and provide it at the `AppClient` level. Components consume it via `useContext(CurrentUserContext)`.

---

### 3.8 🟡 Constants in `constants.ts` are hardcoded and not database-driven

**File:** `src/frontend/constants.ts`

`CATEGORIES`, `LOCATIONS`, `LOCATION_BRANCHES`, `DEPARTMENT_CODES` are static arrays/objects. They diverge from the database whenever an admin adds a new location or department via Settings. The UI then shows stale options in dropdowns.

Also: `ASSET_DISTRIBUTION` and `DEPRECIATION_DATA` (lines 16–31) are fake static chart data, not real database values. The Dashboard uses these for charts instead of actual asset data.

**Fix:**
1. Remove `ASSET_DISTRIBUTION` and `DEPRECIATION_DATA` — replace with calculations from the real `assets` array already passed to Dashboard.
2. Fetch categories, locations, and departments from the API on `AppClient` mount (similar to `refreshAssets`) and pass them down or expose via context.

---

## 4. Frontend — Component Issues

### 4.1 🔴 Audit component uses `prompt()` for notes

**File:** `src/frontend/components/Audit.tsx`

```typescript
const notes = prompt('Enter notes for this asset:');
```

`prompt()` is a blocking browser dialog that cannot be styled, cannot be dismissed without input, and is blocked on many browser security policies (iframes, some mobile browsers). It also has no character limit.

**Fix:** Replace with a `<Modal>` containing a `<textarea>`, a character counter, and confirm/cancel buttons.

---

### 4.2 🔴 UserManagement / AdminSettings use `alert()` and `confirm()`

**Files:** `src/frontend/components/UserManagement.tsx:48`, `src/frontend/components/AdminSettings.tsx:93,149`

Same category of issue. `alert()` has no styling. `confirm()` blocks the thread and cannot be programmatically dismissed for testing.

**Fix:** Replace with modal confirmation dialogs. The `Toast` component created in a prior session should handle success/error feedback. Destructive confirmations need a separate `ConfirmModal` component.

---

### 4.3 🔴 Settings.tsx is non-functional UI scaffolding

**File:** `src/frontend/components/Settings.tsx`

Password change, theme selection, and notification preferences all have UI but do nothing:

```typescript
const handleSaveSettings = () => {
  alert('Settings saved successfully!');  // always succeeds
};
```

Users believe their preferences are saved; they are not.

**Fix:** Either implement fully or remove from the navigation until implemented. A user-visible stub that silently fails damages trust.

---

### 4.4 🟠 Profile.tsx filters activity by user name (string), not user ID

**File:** `src/frontend/components/Profile.tsx:29`

```typescript
const myActivity = assets
  .flatMap(a => a.history ?? [])
  .filter(h => h.user === currentUser.name);
```

`h.user` is the `name` from `AssetHistory` joined with `User`. If two users share a name, activity is incorrectly co-mingled. If the user changes their name, history no longer matches.

**Fix:** Compare `h.userId === currentUser.id`. This requires the API to include `userId` in the history payload (it does — `AssetHistory` has `userId`; the frontend type `AssetHistoryEvent` must expose it).

---

### 4.5 🟠 Dashboard hardcodes "Abuja" for Custodian location filter

**File:** `src/frontend/components/Dashboard.tsx:124`

```typescript
const custodianAssets = role === 'Custodian'
  ? assets.filter(a => a.location === 'Abuja')
  : assets;
```

Every Custodian in every location sees only Abuja assets. This is a functional bug.

**Fix:** Filter by `a.custodianId === currentUser.id` instead of by location. A custodian should see the assets they are responsible for, not all assets in a hardcoded city.

---

### 4.6 🟠 WipManagement generates IDs client-side with `Math.random()`

**File:** `src/frontend/components/WipManagement.tsx:72`

```typescript
const id = `AUC-${locCode}-${catCode}-${year}-${Math.floor(100 + Math.random() * 900)}`;
```

900 possible values per location/category/year combination. Collisions are likely in real use. Even ignoring collisions, since WIP data isn't persisted, the IDs are meaningless.

**Fix:** Once WIP is persisted to the database (see issue 3.1), let the server assign a `cuid()` or sequential number.

---

### 4.7 🟡 Large asset lists not virtualised

**Files:** `src/frontend/components/Audit.tsx`, `AssetLookup.tsx`

All matched assets are rendered into the DOM simultaneously. At 500+ assets, this creates thousands of DOM nodes and causes scroll jank.

**Fix:** Use `@tanstack/react-virtual` (lightweight, no dependency on a grid library). Virtualise the asset list in Audit and AssetLookup.

---

### 4.8 🟡 Read notifications are not persisted

**File:** `src/frontend/components/Dashboard.tsx:115`

```typescript
const [readIds, setReadIds] = useState<Set<string>>(new Set());
```

Dismissed notifications reappear on page refresh. This creates a permanently noisy inbox.

**Fix:** Persist `readIds` to `localStorage` using `useEffect` to sync, or add a backend `notification_reads` table keyed by `(userId, notificationId)`.

---

### 4.9 🟡 GeminiAssistant `messages` array grows without bound

**File:** `src/frontend/components/GeminiAssistant.tsx:22`

Long conversations accumulate all messages in state indefinitely, causing increasing re-render cost and memory usage. The entire array is also sent to the AI as context on every turn.

**Fix:** Cap the displayed messages at the last N (e.g., 50). Summarise or truncate the context sent to the API.

---

### 4.10 🟡 Dark mode toggle doesn't propagate to all components

**Files:** `src/frontend/components/Profile.tsx`, `AppClient.tsx`

Dark mode is toggled by adding/removing a class on `document.documentElement`. However, Tailwind's `darkMode: 'class'` strategy only works if the class is present at page load. The toggle in Profile writes to `localStorage` but on next load, `AppClient.tsx` reads it — the gap between initial HTML paint and `useEffect` running causes a Flash of Unstyled Content (FOUC).

**Fix:** Add a blocking inline `<script>` in `layout.tsx` before any content that reads `localStorage` and applies the class synchronously. This is the standard Next.js dark-mode pattern.

---

### 4.11 🟡 No loading state when individual operations run

Multiple components (UserManagement create/delete, AdminSettings sync, AssetForm submit) show no loading indicator during async operations. The user can click the button multiple times, creating duplicate requests.

**Fix:** Disable buttons with `disabled={isSubmitting}` and show a spinner during all async form submissions.

---

## 5. Frontend — Services Layer

### 5.1 🟠 `api-client.ts` has no request timeout

**File:** `src/frontend/services/api-client.ts`

```typescript
const res = await fetch(path, { ... });
```

`fetch` has no built-in timeout. A slow or hung server will make the UI appear frozen indefinitely.

**Fix:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
try {
  const res = await fetch(path, { ...options, signal: controller.signal });
  clearTimeout(timeoutId);
  // ...
} catch (e) {
  if ((e as Error).name === 'AbortError') return { success: false, error: 'Request timed out' };
  // ...
}
```

---

### 5.2 🟡 No retry logic for transient failures

**File:** `src/frontend/services/api-client.ts`

Network blips (brief disconnection, server restart) cause silent failures with no recovery. This is particularly bad for `refreshAssets` which runs on load.

**Fix:** Implement a simple exponential-backoff retry for GET requests (idempotent): retry up to 3 times with 1s, 2s, 4s delays on network errors or 5xx responses.

---

### 5.3 🟡 Service files re-implement the same fetch pattern inconsistently

Several service files (`auth.ts`, `assets.ts`, `transfers.ts`) call `api.post`, `api.get`, etc., but some inline `fetch()` directly (GeminiAssistant). There's no centralised request interceptor for adding auth headers if the cookie-based auth ever needs augmenting.

**Fix:** All API calls should go through `api-client.ts`. Remove any direct `fetch()` calls in components.

---

## 6. Database & Prisma

### 6.1 🔴 No `WipProject` or `AuditSession` tables exist

**File:** `prisma/schema.prisma`

The `WipAsset` and `AuditSession` interfaces exist in `shared/types.ts`, and both features are built in the UI, but neither is backed by database tables. All data is ephemeral.

**Fix:** Add models to `schema.prisma`:
```prisma
model WipProject {
  id                      String        @id @default(cuid())
  projectName             String
  assetType               String
  projectManager          String
  budgetedCost            Decimal       @db.Decimal(18, 2)
  location                String?
  inceptionDate           DateTime
  estimatedCompletionDate DateTime
  status                  WipStatus     @default(PLANNING)
  finalDepreciationMethod String        @default("STRAIGHT_LINE")
  finalUsefulLife         Int           @default(5)
  relatedAssetId          String?
  createdById             String
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt
  costItems               WipCostItem[]
}
```

---

### 6.2 🟠 Hard deletes on User and Asset destroy audit trail

**File:** `src/app/api/users/[id]/route.ts`, `src/app/api/assets/[id]/route.ts`

Deleting a user fails if they have `AssetHistory` records (FK violation). Deleting an asset cascades and destroys all history, improvements, schedules, and transfer records.

Asset deletion via `DELETE /api/assets/[id]` is used by the UI for removal — but for accounting purposes, assets should be **disposed** (status change to `DISPOSED` with a history entry) rather than deleted.

**Fix:**
1. Add `isActive Boolean @default(true)` to `User` and `Asset`.
2. Change DELETE endpoints to set `isActive = false`.
3. Filter `{ isActive: true }` in all list/lookup queries.
4. Hard delete should be reserved for administrative correction only.

---

### 6.3 🟠 `AssetHistory.userId` foreign key has no `onDelete` behaviour

**File:** `prisma/schema.prisma:103`

```prisma
user  User  @relation(fields: [userId], references: [id])
```

No `onDelete` clause defaults to `RESTRICT`. Deleting a user who has history entries throws a FK violation. But since users can't currently be deleted (issue 6.2), this is latent.

**Fix:** Set `onDelete: Restrict` explicitly (to be clear) or `onDelete: SetNull` with `userId String?` if you want history to survive user deletion.

---

### 6.4 🟡 `Asset.custodianId` is not nullable but Custodians can be deleted

**File:** `prisma/schema.prisma:46`

```prisma
custodianId String
custodian   User @relation("AssetCustodian", fields: [custodianId], references: [id])
```

If a user (custodian) is deleted, all their assets would violate the FK. Currently protected by the FK restriction, but once soft-delete is added, queries will still join on the inactive user.

**Fix:** With soft-delete in place, filters must exclude `isActive: false` users from custodian dropdowns but still resolve joins for existing assets.

---

### 6.5 🟡 `Category.code` is nullable but has no unique constraint

**File:** `prisma/schema.prisma:157`

```prisma
code  String?
```

Multiple categories can have the same code (or all be null). Asset type serial number prefixes depend on category codes being unique and stable.

**Fix:** Add `@unique` to `Category.code` and `AssetType.code`.

---

### 6.6 🟡 Depreciation schedules are fully regenerated on every improvement

**File:** `src/app/api/assets/[id]/improvement/route.ts:48`

```typescript
await tx.depreciationSchedule.deleteMany({ where: { assetId: id } });
await tx.depreciationSchedule.createMany({ data: scheduleData... });
```

For an asset with a 25-year life, this deletes and recreates 25 rows on every improvement. While correct, it doesn't account for past periods — the new schedule overwrites historical entries, meaning a report run today for FY 2022 would use the post-improvement cost rather than the cost that was actually in force in 2022.

**Fix:** Keep historical schedule rows intact. Only regenerate rows from the improvement date forward. This requires tracking improvement dates in the schedule or splitting schedules per improvement period.

---

### 6.7 🟡 No database indexes on common query patterns

**File:** `prisma/schema.prisma`

Missing indexes that will cause full-table scans as data grows:

| Missing index | Query pattern |
|---|---|
| `Asset.name` | Search by name in AssetLookup |
| `Asset.productId` | Tag lookup (already `@unique` — covers this) |
| `AssetHistory.date` | Timeline queries in Profile |
| `TransferRequest.requestedById` | ✅ Added in last session |
| `AssetHistory.userId` | ✅ Added in last session |

---

## 7. Security

### 7.1 🔴 No account lockout after repeated failed logins

As covered in 1.10, the login route accepts unlimited attempts. A rate limit of 60 req/60s at the IP level is insufficient protection.

---

### 7.2 🔴 No CSRF token on state-mutating API routes

`SameSite: lax` cookies are not sent with cross-site POST requests made by `fetch()` with `credentials: 'include'` from a different origin. However, they **are** sent with top-level form submissions and with requests from the same site. For a strict security posture, add a CSRF double-submit token:

1. `GET /api/auth/csrf` returns a random token stored in the session.
2. All POST/PUT/DELETE requests include `X-CSRF-Token: <token>` header.
3. Middleware validates the header matches the session token.

---

### 7.3 🟠 Asset image stored as raw base64 in PostgreSQL

**File:** `src/app/api/assets/[id]/image/route.ts`

Images are stored as base64 strings in the `Asset.imageUrl` column (`VARCHAR` effectively). A single 2 MB image becomes ~2.7 MB of text in the database. At 1000 assets with images, this is ~2.7 GB of image data in the main table, bloating indexes and slowing all queries that include `imageUrl`.

**Fix:** Store images in object storage (Cloudflare R2 is free-tier, S3 is standard). Save only the URL in the database. Use a pre-signed upload URL pattern to avoid the server handling the binary.

---

### 7.4 🟠 `GeminiAssistant` sends full asset snapshots to external API

**File:** `src/frontend/components/GeminiAssistant.tsx`

The AI query includes `assetsSnapshot` — up to 100 asset records sent to Google's Gemini API. Depending on what fields are included, this could include acquisition cost, location, custodian name, and condition — all potentially sensitive business data.

**Fix:** Decide which fields are safe to send externally, strip sensitive fields before constructing the snapshot, and document this in a privacy notice.

---

### 7.5 🟡 XSS: AI chat response rendered without sanitisation

**File:** `src/frontend/components/GeminiAssistant.tsx`

If the AI response contains HTML (e.g., `<script>alert(1)</script>` via a prompt-injection attack on the AI), and the response is rendered via `dangerouslySetInnerHTML` or without escaping, it executes in the browser.

**Verify:** Check how `text` from the AI response is rendered. If using `dangerouslySetInnerHTML`, add `DOMPurify.sanitize(text)` first. If using React text nodes (default), no change needed — React escapes by default.

---

### 7.6 🟡 `SESSION_SECRET` validated at module load — errors at build time in some CI environments

**File:** `src/backend/lib/session.ts:19`

The `throw` at module load time means any CI/CD pipeline that imports this module without `SESSION_SECRET` set will crash immediately. Build steps don't need a valid secret; runtime steps do.

**Fix:** Use `instrumentation.ts` or a server-side startup check rather than module-load-time validation for secrets that are only needed at runtime.

---

## 8. Architecture & Scalability

### 8.1 🔴 Single-process, in-memory rate limiter will not work at scale

**File:** `src/middleware.ts`

```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

This Map lives in one Node.js process. If the app runs on two instances (Vercel, load balancer), each has its own Map and an attacker can get 2× the rate limit by alternating between instances.

**Fix:** Replace with `@upstash/ratelimit` + Redis for any deployment with more than one server instance. Upstash has a free tier and a Next.js middleware adapter.

---

### 8.2 🟠 Report generation is synchronous and blocks the request

**File:** `src/frontend/components/Reports.tsx` + `src/shared/utils/reportData.ts`

The depreciation report is calculated entirely in the browser on the main thread. For 500 assets with 20-year schedules, this is 10 000 iterations of floating-point arithmetic synchronously.

**Fix:** Move report generation to a server-side API route (`GET /api/reports?type=depreciation&year=2025`). Use a `Web Worker` if it must remain client-side. Add caching (Redis with a 1-hour TTL keyed by report params + data hash).

---

### 8.3 🟡 AppClient fetches all assets and all users on every load

**File:** `src/frontend/components/AppClient.tsx:49`

```typescript
await Promise.all([refreshAssets(), refreshUsers()]);
```

This is called once on login. At scale (thousands of assets) this is an expensive full-table load on every session start.

**Fix:** Use SWR or React Query with stale-while-revalidate caching. The libraries also handle background refresh, deduplication, and error retries. Only fetch the view-specific data subset per page.

---

### 8.4 🟡 No structured logging or observability

**File:** All API route files

All server logging is `console.error(...)`. This:
- Doesn't emit structured JSON (hard to query in log aggregators)
- Has no log levels (can't silence debug in prod)
- Has no correlation IDs across a request chain
- Produces no metrics (response time, error rate, DB query time)

**Fix:** Add `pino` as a logger. In production, log as JSON to stdout (consumed by Vercel / Loki / Datadog). Add a timing wrapper to API routes.

---

### 8.5 🟡 No health check endpoint

The app has no `GET /api/health` endpoint. Reverse proxies, load balancers, and uptime monitors have no way to verify the application is running correctly (can connect to DB, session works, etc.).

**Fix:**
```typescript
// src/app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', db: 'ok' });
  } catch {
    return Response.json({ status: 'error', db: 'unreachable' }, { status: 503 });
  }
}
```

---

### 8.6 🟡 `src/frontend/constants.ts` is a circular dependency risk

**File:** `src/frontend/constants.ts`

`ASSET_DISTRIBUTION` and `DEPRECIATION_DATA` are dummy static data used in Dashboard charts. They import types from `@/shared/types`, which itself has no backend imports — safe for now. But the pattern of mixing hardcoded chart data, lookup tables, and utility types in one file will grow into a mess.

**Fix:** Split into:
- `constants/lookup.ts` — categories, locations, condition codes (replace with API calls eventually)
- `constants/chartDefaults.ts` — remove entirely once Dashboard uses real data

---

## 9. TypeScript & Code Quality

### 9.1 🟠 `ChartDataPoint` has `[key: string]: any` — defeats type safety

**File:** `src/shared/types.ts:123`

```typescript
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;  // ← type hole; bypasses all type checking
}
```

**Fix:** Replace with specific typed interfaces for each chart type (the Recharts components that use this already know their data shape).

---

### 9.2 🟠 Role cast with `as Parameters<typeof prisma.user.create>[0]['data']['role']`

**Files:** `src/app/api/users/route.ts:40`, `src/app/api/users/[id]/route.ts`

```typescript
role: data.role as Parameters<typeof prisma.user.create>[0]['data']['role'],
```

This is a fragile workaround. If the Prisma schema changes the Role enum, the cast silently accepts the old values.

**Fix:** Use Prisma's generated enum directly:
```typescript
import { Role } from '@prisma/client';
role: data.role as Role,
```
And validate in Zod:
```typescript
role: z.nativeEnum(Role).default(Role.CUSTODIAN),
```

---

### 9.3 🟡 `Asset.status` frontend type doesn't match backend enum

**File:** `src/shared/types.ts:33`

Frontend:
```typescript
status: 'Active' | 'Disposed' | 'Maintenance' | 'Pending Transfer';
```
Backend enum: `ACTIVE | DISPOSED | MAINTENANCE | PENDING_TRANSFER`

The conversion happens in `src/app/api/assets/route.ts` via `STATUS_MAP`. If a new status is added to the Prisma enum, `STATUS_MAP` must also be updated, but there's nothing enforcing this at compile time.

**Fix:** Import and re-export the Prisma `AssetStatus` enum from shared types rather than maintaining a parallel string literal union. Convert to display strings only at the UI rendering level, not in the API response.

---

### 9.4 🟡 `AssetHistoryEvent.type` missing 'Update' variant

**File:** `src/shared/types.ts:93`

```typescript
type: 'Registration' | 'Transfer' | 'Maintenance' | 'Audit' | 'Issue';
// ← 'Update' missing; used in validation.ts and actual history records
```

**Fix:** Add `'Update'` to the union type.

---

### 9.5 🟡 `shared/types.ts` mixes frontend-UI types (`View`, `ChartDataPoint`) with domain types

The `View` enum (routing state) and `ChartDataPoint` / `DepreciationPoint` (chart data shapes) are UI concerns, not domain types. They live alongside `Asset`, `User`, `TransferRequest` — domain objects that belong in shared code.

**Fix:**
- Move `View` to `src/frontend/types.ts`
- Move chart types to `src/frontend/components/charts/types.ts`
- Keep `shared/types.ts` for domain objects only

---

### 9.6 🟡 Many unused icon imports across component files

Several components import 5–15 icons from lucide-react but use only 2–3. Unused imports inflate the bundle and confuse readers.

**Example:** `AssetLookup.tsx` imports `ScanLine`, `History`, `Briefcase`, `BoxSelect`, `Truck`, `QrCode` — none used.

**Fix:** Remove unused icon imports. Set `noUnusedLocals: true` in `tsconfig.json` once the clean-up is done (currently deferred due to the volume).

---

### 9.7 🟡 `depreciation.ts` — leap year not accounted for in day calculations

**File:** `src/shared/utils/depreciation.ts:71`

```typescript
const daysInYear = 365;
```

For assets registered in a leap year, the pro-rata first-year depreciation is slightly understated (364/365 vs 366/366 of a full year charge). For long-life assets the error is negligible, but for monthly schedules it compounds.

**Fix:** Use `isLeapYear(year) ? 366 : 365` in the day-count calculation.

---

## 10. Testing

### 10.1 🔴 Zero tests in the codebase

There are no test files anywhere in the project. The following critical logic has no automated verification:

| Module | Risk if untested |
|--------|-----------------|
| `depreciation.ts` | Wrong depreciation charges affect financial statements |
| `reportData.ts` | Wrong report totals mislead management decisions |
| `permissions.ts` | Wrong permission → data breach or data loss |
| `validation.ts` | Wrong validation → bad data in DB or security hole |
| API routes | Regressions when refactoring |

**Fix:** Add the following test infrastructure:
- **Unit tests:** Vitest for `depreciation.ts`, `reportData.ts`, `permissions.ts`, `validation.ts`
- **Integration tests:** Vitest + `@prisma/client` test database for API routes
- **Component tests:** Vitest + React Testing Library for Login, AssetForm validation logic

Minimum target: 80% coverage on `shared/utils/` and `backend/lib/`.

---

## 11. Prioritised Fix Roadmap

### Phase 1 — Pre-production blockers (fix before first real user)

| # | Issue | File | Effort |
|---|-------|------|--------|
| 1 | Custodian `manage_users` permission removed | `permissions.ts` | 5 min |
| 2 | Account lockout after N failed logins | `api/auth/login` | 2 hrs |
| 3 | `<ErrorBoundary>` wrapping main view | `AppClient.tsx` | 30 min |
| 4 | `<ToastProvider>` wired + all `alert/confirm/prompt` replaced | All components | 4 hrs |
| 5 | WipManagement persisted to database | Schema + API + component | 1 day |
| 6 | Audit sessions persisted to database | Schema + API + component | 1 day |
| 7 | Settings.tsx implemented or removed | `Settings.tsx` | 2 hrs (remove) |
| 8 | `lastLogin` fixed in AppClient | `AppClient.tsx` | 30 min |
| 9 | Dashboard custodian filter fixed | `Dashboard.tsx:124` | 15 min |
| 10 | Double-transfer initiation blocked | `api/transfers/route.ts` | 30 min |
| 11 | Duplicate email returns 409 in users POST | `api/users/route.ts` | 30 min |
| 12 | Hard delete → soft delete on User and Asset | Schema + API | 3 hrs |
| 13 | `notFound` guard on all settings `[id]` routes | 4 files | 1 hr |

### Phase 2 — Scalability and correctness (within first sprint)

| # | Issue | Effort |
|---|-------|--------|
| 14 | Paginate `GET /api/assets` and `GET /api/users` | 2 hrs |
| 15 | Request timeout + retry in `api-client.ts` | 1 hr |
| 16 | Replace `constants.ts` hardcoded data with API calls | 4 hrs |
| 17 | Move report generation to server API route with caching | 1 day |
| 18 | `GET /api/transfers` accept status filter | 30 min |
| 19 | Revaluation improvement type handled correctly | 1 hr |
| 20 | Add health check endpoint | 30 min |
| 21 | Fix `Profile.tsx` activity filter by ID, not name | 15 min |
| 22 | Implement `CurrentUserContext` (remove prop drilling) | 2 hrs |
| 23 | Virtual scrolling for large asset lists | 2 hrs |
| 24 | `Category.code` unique constraint | Migration 15 min |
| 25 | Fix depreciation schedule: keep historical rows intact | 4 hrs |

### Phase 3 — Quality and observability (second sprint)

| # | Issue | Effort |
|---|-------|--------|
| 26 | Add Vitest + unit tests for `depreciation.ts` and `reportData.ts` | 1 day |
| 27 | Add Pino structured logging with correlation IDs | 4 hrs |
| 28 | Replace in-memory rate limiter with Upstash Redis | 2 hrs |
| 29 | Add CSRF double-submit token | 4 hrs |
| 30 | Asset images → object storage (R2/S3) | 1 day |
| 31 | Remove `[key: string]: any` from `ChartDataPoint` | 30 min |
| 32 | Remove unused icon imports + enable `noUnusedLocals` | 2 hrs |
| 33 | Add `noUnusedLocals: true` to tsconfig | 30 min (after #32) |
| 34 | Add integration tests for auth and permission routes | 1 day |
| 35 | OpenAPI spec generation (zod-to-openapi) | 1 day |
