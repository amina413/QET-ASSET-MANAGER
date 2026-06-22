import type { NextConfig } from "next";

function originFromEnv(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const assetImageOrigin = originFromEnv(process.env.ASSET_IMAGE_PUBLIC_BASE_URL);
const assetUploadOrigin = originFromEnv(process.env.ASSET_IMAGE_S3_ENDPOINT);
const isProduction = process.env.NODE_ENV === 'production';
const connectSrc = [
  "'self'",
  assetImageOrigin,
  assetUploadOrigin,
  ...(!isProduction ? ["ws://localhost:*", "http://localhost:*"] : []),
].filter(Boolean).join(' ');
const imgSrc = ["'self'", "data:", "blob:", assetImageOrigin].filter(Boolean).join(' ');
const scriptSrc = ["'self'", "'unsafe-inline'", ...(!isProduction ? ["'unsafe-eval'"] : [])].join(' ');

const securityHeaders = [
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src ${imgSrc}`,
      `connect-src ${connectSrc}`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
