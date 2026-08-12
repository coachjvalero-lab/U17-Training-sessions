export type SupabaseErrorKind =
  | 'auth'
  | 'authorization'
  | 'foreign_key'
  | 'validation'
  | 'unique'
  | 'missing_required'
  | 'network'
  | 'timeout'
  | 'unknown';

export type ClassifiedSupabaseError = {
  kind: SupabaseErrorKind;
  code: string | null;
  message: string;
  userMessage: string;
};

function toCode(error: any): string | null {
  if (!error) return null;
  if (typeof error.code === 'string') return error.code;
  if (typeof error.status === 'number') return String(error.status);
  return null;
}

function toMessage(error: any): string {
  if (!error) return 'Unknown database error';
  if (typeof error.message === 'string' && error.message.trim().length > 0) return error.message;
  return String(error);
}

export function classifySupabaseError(error: unknown): ClassifiedSupabaseError {
  const err = error as any;
  const code = toCode(err);
  const message = toMessage(err);
  const messageLower = message.toLowerCase();

  if (code === '42501') {
    return {
      kind: 'authorization',
      code,
      message,
      userMessage: 'Authorization denied (RLS). Your account is not allowed to perform this action.'
    };
  }

  if (code === '23503') {
    return {
      kind: 'foreign_key',
      code,
      message,
      userMessage: 'Related data is missing or invalid (foreign key constraint).'
    };
  }

  if (code === '23505') {
    return {
      kind: 'unique',
      code,
      message,
      userMessage: 'This record already exists (unique constraint).'
    };
  }

  if (code === '23514' || code === '22023') {
    return {
      kind: 'validation',
      code,
      message,
      userMessage: 'Invalid value. Please review the input and try again.'
    };
  }

  if (code === '23502') {
    return {
      kind: 'missing_required',
      code,
      message,
      userMessage: 'A required field is missing.'
    };
  }

  if (code === '57014' || code === '504') {
    return {
      kind: 'timeout',
      code,
      message,
      userMessage: 'The request timed out. Please retry.'
    };
  }

  if (code === '401' || code === '403' || messageLower.includes('jwt') || messageLower.includes('auth')) {
    return {
      kind: 'auth',
      code,
      message,
      userMessage: 'Authentication failed. Please sign in again.'
    };
  }

  if (
    messageLower.includes('fetch failed')
    || messageLower.includes('network')
    || messageLower.includes('failed to fetch')
    || messageLower.includes('connection')
    || messageLower.includes('cors')
    || messageLower.includes('cross-origin')
  ) {
    return {
      kind: 'network',
      code,
      message,
      userMessage: 'Network error. Check your connection and retry.'
    };
  }

  return {
    kind: 'unknown',
    code,
    message,
    userMessage: 'Unexpected database error. Please retry or contact an admin.'
  };
}
