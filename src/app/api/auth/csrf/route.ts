import { randomUUID } from 'crypto';
import { ok, handleError, unauthorized } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user) return unauthorized();

    if (!session.csrfToken) {
      session.csrfToken = randomUUID();
      await session.save();
    }
    return ok({ csrfToken: session.csrfToken });
  } catch (error) {
    return handleError(error);
  }
}
