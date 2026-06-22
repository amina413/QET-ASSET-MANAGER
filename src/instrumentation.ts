export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const { validateEnv } = await import('./lib/env');
  validateEnv();
}
