const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
] as const;

const OPTIONAL_ENV_VARS = [
  'API_KEY',
  'GEMINI_API_KEY',
  'ASSET_IMAGE_S3_BUCKET',
  'ASSET_IMAGE_S3_REGION',
  'ASSET_IMAGE_S3_ENDPOINT',
  'ASSET_IMAGE_S3_FORCE_PATH_STYLE',
  'ASSET_IMAGE_S3_ACCESS_KEY_ID',
  'ASSET_IMAGE_S3_SECRET_ACCESS_KEY',
  'ASSET_IMAGE_PUBLIC_BASE_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TRUST_PROXY',
  'HEALTH_CHECK_TOKEN',
  'ALLOW_ASSET_CLEAR',
  'ALLOW_PROD_SEED',
  'REQUIRE_ASSET_IMAGES',
  'REQUIRE_DISTRIBUTED_RATE_LIMITS',
] as const;

const ASSET_IMAGE_ENV_VARS = [
  'ASSET_IMAGE_S3_BUCKET',
  'ASSET_IMAGE_S3_REGION',
  'ASSET_IMAGE_S3_ACCESS_KEY_ID',
  'ASSET_IMAGE_S3_SECRET_ACCESS_KEY',
  'ASSET_IMAGE_PUBLIC_BASE_URL',
] as const;

const RATE_LIMIT_ENV_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
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

  if (process.env.NODE_ENV === 'production' && !process.env.HEALTH_CHECK_TOKEN) {
    throw new Error('HEALTH_CHECK_TOKEN must be set in production.');
  }

  const configuredAssetVars = ASSET_IMAGE_ENV_VARS.filter(key => !!process.env[key]);
  if (process.env.REQUIRE_ASSET_IMAGES === 'true' || configuredAssetVars.length > 0) {
    const missingAssetVars = ASSET_IMAGE_ENV_VARS.filter(key => !process.env[key]);
    if (missingAssetVars.length > 0) {
      throw new Error(`Missing asset image storage environment variables: ${missingAssetVars.join(', ')}`);
    }
  }

  if (process.env.REQUIRE_DISTRIBUTED_RATE_LIMITS === 'true') {
    const missingRateLimitVars = RATE_LIMIT_ENV_VARS.filter(key => !process.env[key]);
    if (missingRateLimitVars.length > 0) {
      throw new Error(`Missing distributed rate limit environment variables: ${missingRateLimitVars.join(', ')}`);
    }
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
