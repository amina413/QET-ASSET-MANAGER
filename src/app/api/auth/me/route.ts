import { ok, unauthorized } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session.user) return unauthorized();
  return ok(session.user);
}
