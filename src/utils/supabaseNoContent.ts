function toErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown';
  const withCode = error as { code?: unknown };
  return withCode.code ? String(withCode.code) : 'unknown';
}

function toErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : String(error);
  }

  const withMessage = error as { message?: unknown };
  return withMessage.message ? String(withMessage.message) : 'Unknown Supabase error';
}

// PostgREST reuses code PGRST204 both for a genuine empty-body success and for
// "column/table not found in schema cache" — the latter is a real error and must not be swallowed.
function isSchemaCacheError(message: string): boolean {
  return message.includes('schema cache') || message.includes('could not find');
}

export function isNoContentSuccess(error: unknown): boolean {
  const code = toErrorCode(error);
  const message = toErrorMessage(error).toLowerCase();

  if (isSchemaCacheError(message)) {
    return false;
  }

  return code === 'PGRST204' || message.includes('no content');
}
