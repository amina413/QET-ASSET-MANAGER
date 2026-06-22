export type DisplayStatus = 'Active' | 'Disposed' | 'Maintenance' | 'Pending Transfer';

// Shared mapping from Prisma enum values to display strings.
// Used by assets/route.ts, assets/[id]/route.ts, and assets/[id]/history/route.ts.
export const STATUS_MAP: Record<string, DisplayStatus> = {
  ACTIVE: 'Active',
  DISPOSED: 'Disposed',
  MAINTENANCE: 'Maintenance',
  PENDING_TRANSFER: 'Pending Transfer',
};

// Reverse map: display string → Prisma enum value
export const STATUS_MAP_REVERSE: Record<string, string> = {
  Active: 'ACTIVE',
  Maintenance: 'MAINTENANCE',
  Disposed: 'DISPOSED',
};
