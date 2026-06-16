import { ok } from '@/backend/lib/api';
import { requireAuth } from '@/backend/lib/auth-helpers';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  return ok(user);
}
