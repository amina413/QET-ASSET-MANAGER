import { ok, unauthorized } from '@/lib/api';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session.user) return unauthorized();
  return ok(session.user);
}
