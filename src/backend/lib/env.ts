const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
] as const;

const OPTIONAL_ENV_VARS = [
  'API_KEY',
  'GEMINI_API_KEY',
] as const;

export type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];
export type OptionalEnvVar = typeof OPTIONAL_ENV_VARS[number];

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Add them to your .env file and restart the server.',
    );
  }

  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }
}

export function getEnv(key: RequiredEnvVar): string {
  const value = process.env[key];
  if (!value) throw new Error(`Environment variable ${key} is not set.`);
  return value;
}

export function getOptionalEnv(key: OptionalEnvVar): string | undefined {
  return process.env[key];
}
