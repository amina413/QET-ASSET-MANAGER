import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string; details?: unknown };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(message: string, status = 400, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export function unauthorized(): NextResponse<ApiError> {
  return err('Unauthorized', 401);
}

export function forbidden(): NextResponse<ApiError> {
  return err('Forbidden: insufficient permissions', 403);
}

export function notFound(resource = 'Resource'): NextResponse<ApiError> {
  return err(`${resource} not found`, 404);
}

export function handleError(error: unknown): NextResponse<ApiError> {
  if (error instanceof ZodError) {
    return err('Validation failed', 422, error.flatten());
  }
  if (error instanceof Error) {
    if (process.env.NODE_ENV !== 'production') {
      return err(error.message, 500);
    }
  }
  return err('Internal server error', 500);
}
