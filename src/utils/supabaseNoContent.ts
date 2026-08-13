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

export function isNoContentSuccess(error: unknown): boolean {
  const code = toErrorCode(error);
  const message = toErrorMessage(error).toLowerCase();
  return code === 'PGRST204' || message.includes('no content');
}
