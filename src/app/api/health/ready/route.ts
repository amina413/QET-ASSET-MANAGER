import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/backend/lib/prisma';

export async function GET(req: NextRequest) {
  const expectedToken = process.env.HEALTH_CHECK_TOKEN;
  if (!expectedToken || req.headers.get('x-health-token') !== expectedToken) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        database: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Readiness check failed',
        data: {
          status: 'error',
          database: 'error',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 503 },
    );
  }
}
