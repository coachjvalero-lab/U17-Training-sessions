import { supabase } from '../../supabaseClient';

type ErrorSummary = {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
  status: number | null;
};

export type SupabaseAuthDiagnostics = {
  sessionExists: boolean;
  userExists: boolean;
  userEmail: string | null;
  userId: string | null;
  sessionError: ErrorSummary | null;
  userError: ErrorSummary | null;
};

function summarize(error: unknown): ErrorSummary {
  if (error && typeof error === 'object') {
    const err = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
    };
    return {
      code: err.code ? String(err.code) : 'unknown',
      message: err.message ? String(err.message) : 'Unknown Supabase error',
      details: err.details ? String(err.details) : null,
      hint: err.hint ? String(err.hint) : null,
      status: typeof err.status === 'number' ? err.status : null
    };
  }

  return {
    code: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    details: null,
    hint: null,
    status: null
  };
}

export async function getSupabaseAuthDiagnostics(): Promise<SupabaseAuthDiagnostics> {
  if (!supabase) {
    return {
      sessionExists: false,
      userExists: false,
      userEmail: null,
      userId: null,
      sessionError: {
        code: 'supabase/not-configured',
        message: 'Supabase client is not configured',
        details: null,
        hint: null,
        status: null
      },
      userError: null
    };
  }

  const [sessionResult, userResult] = await Promise.allSettled([
    supabase.auth.getSession(),
    supabase.auth.getUser()
  ]);

  const sessionData = sessionResult.status === 'fulfilled' ? sessionResult.value.data : null;
  const userData = userResult.status === 'fulfilled' ? userResult.value.data : null;

  const sessionError = sessionResult.status === 'rejected'
    ? summarize(sessionResult.reason)
    : sessionResult.value.error
      ? summarize(sessionResult.value.error)
      : null;

  const userError = userResult.status === 'rejected'
    ? summarize(userResult.reason)
    : userResult.value.error
      ? summarize(userResult.value.error)
      : null;

  const sessionUser = sessionData?.session?.user || null;
  const user = userData?.user || sessionUser;

  return {
    sessionExists: Boolean(sessionData?.session),
    userExists: Boolean(user),
    userEmail: user?.email || null,
    userId: user?.id || null,
    sessionError,
    userError
  };
}
