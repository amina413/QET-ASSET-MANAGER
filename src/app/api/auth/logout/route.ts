import { ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/session';

export async function POST() {
  const session = await getSession();
  session.destroy();
  return ok({ message: 'Logged out' });
}
