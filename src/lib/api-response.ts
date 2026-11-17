import { NextResponse } from 'next/server';
import {
  AuthenticationError,
  AuthorizationError,
  TenantAccessError,
} from '@/lib/rbac';
import { ServiceError } from '@/modules/permit/errors';

export function handleApiError(error: unknown) {
  if (
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof TenantAccessError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.statusCode },
    );
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
}
