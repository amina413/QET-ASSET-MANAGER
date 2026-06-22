import { ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  return ok(user);
}
