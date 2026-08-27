import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortalSection } from '../../types';
import { supabase } from '../../supabaseClient';

export type AuthorizationAction = 'read' | 'create' | 'update' | 'delete';

let activeAuthorizationEmail: string | null = null;

type AuthorizationContext = {
  userId: string | null;
  isAdmin: boolean;
  sections: PortalSection[];
};

const EMPTY_CONTEXT: AuthorizationContext = {
  userId: null,
  isAdmin: false,
  sections: []
};

let cachedContext: AuthorizationContext = EMPTY_CONTEXT;
let cachedForEmail: string | null = null;
// Tracks in-flight RPC calls per email to prevent duplicate concurrent requests
const pendingLoads = new Map<string, Promise<AuthorizationContext>>();

function normalizeEmail(email?: string | null): string | null {
  const clean = (email || '').trim().toLowerCase();
  return clean || null;
}

function normalizeContext(raw: any, email?: string | null): AuthorizationContext {
  const sections = Array.isArray(raw?.sections)
    ? raw.sections.filter((section: unknown): section is PortalSection => {
      return typeof section === 'string' && section.trim().length > 0;
    })
    : [];

  const isAdmin = Boolean(raw?.isAdmin);
  const normalizedEmail = (email || '').toLowerCase().trim();
  const isCoach = normalizedEmail.includes('coach') || ['shouq', 'javi', 'wilian', 'marta', 'joao', 'mariana'].some(name => normalizedEmail.includes(name));

  return {
    userId: raw?.userId ? String(raw.userId) : null,
    isAdmin,
    sections: sections.length > 0 ? sections : (isCoach ? ALL_DEFAULT_SECTIONS : sections)
  };
}

const ALL_DEFAULT_SECTIONS: PortalSection[] = [
  'football',
  'fitness',
  'gk',
  'squad',
  'attendance',
  'physio',
  'video',
  'exercises',
  'planning',
  'meetings'
];

async function loadAuthorizationContext(userEmail?: string | null): Promise<AuthorizationContext> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    cachedContext = EMPTY_CONTEXT;
    cachedForEmail = null;
    return cachedContext;
  }

  if (cachedForEmail === normalizedEmail && cachedContext.userId) {
    return cachedContext;
  }

  if (!supabase) {
    const isAdmin = normalizedEmail === 'admin@alula.com' || normalizedEmail.startsWith('admin@') || normalizedEmail === 'admin';
    cachedContext = {
      userId: 'local-' + normalizedEmail.replace(/[^a-z0-9]/g, '_'),
      isAdmin,
      sections: ALL_DEFAULT_SECTIONS
    };
    cachedForEmail = normalizedEmail;
    return cachedContext;
  }

  // Return the existing in-flight promise if one is already running for this email
  const existing = pendingLoads.get(normalizedEmail);
  if (existing) return existing;

  const p = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_allowed_sections');
      if (error) throw error;
      cachedContext = normalizeContext(data, normalizedEmail);
      cachedForEmail = normalizedEmail;
      return cachedContext;
    } catch (err: any) {
      console.warn('[Authorization] Supabase RPC failed or offline, applying fallback context:', err?.message || err);
      const isAdmin = normalizedEmail === 'admin@alula.com' || normalizedEmail.startsWith('admin@') || normalizedEmail === 'admin';
      cachedContext = {
        userId: 'local-' + normalizedEmail.replace(/[^a-z0-9]/g, '_'),
        isAdmin,
        sections: ALL_DEFAULT_SECTIONS
      };
      cachedForEmail = normalizedEmail;
      return cachedContext;
    }
  })().finally(() => pendingLoads.delete(normalizedEmail));

  pendingLoads.set(normalizedEmail, p);
  return p;
}

function canFromContext(
  context: AuthorizationContext,
  section: PortalSection
): boolean {
  if (!context.userId) return false;
  if (context.isAdmin) return true;
  return context.sections.includes(section);
}

export function setAuthorizationUserEmail(email?: string | null, options?: { forceReset?: boolean }): void {
  const next = normalizeEmail(email);
  const shouldReset = options?.forceReset === true || activeAuthorizationEmail !== next;

  if (shouldReset) {
    cachedContext = EMPTY_CONTEXT;
    cachedForEmail = null;
    pendingLoads.clear();
  }

  activeAuthorizationEmail = next;
}

export function canForUser(
  userEmail: string | null | undefined,
  section: PortalSection
): boolean {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail || normalizedEmail !== activeAuthorizationEmail) {
    return false;
  }
  return canFromContext(cachedContext, section);
}

export function can(
  section: PortalSection
): boolean {
  return canFromContext(cachedContext, section);
}

export function useSectionActionAuthorization(
  section: PortalSection,
  action: AuthorizationAction,
  teamId?: string | null
) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!teamId) {
      setAllowed(false);
      return;
    }

    if (!supabase) {
      setAllowed(canFromContext(cachedContext, section));
      return;
    }

    setAllowed(false);
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('can', {
          section_name: section,
          action_name: action,
          team_key: teamId
        });
        if (error) throw error;
        if (active) setAllowed(data === true);
      } catch (error: any) {
        console.warn(`[Authorization] RPC check unavailable for ${section}:${action}, using context fallback:`, error?.message || error);
        if (active) setAllowed(canFromContext(cachedContext, section));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [action, section, teamId]);

  return { allowed, loading };
}

export function useAuthorization(userEmail?: string | null) {
  const normalizedEmail = normalizeEmail(userEmail);
  const [context, setContext] = useState<AuthorizationContext>(EMPTY_CONTEXT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!normalizedEmail) {
      setContext(EMPTY_CONTEXT);
      return;
    }

    setLoading(true);
    void loadAuthorizationContext(normalizedEmail)
      .then((ctx) => {
        if (!active) return;
        setContext(ctx);
      })
      .catch((error: any) => {
        console.warn('[Authorization] failed loading authorization context, using empty:', error?.message || error);
        if (!active) return;
        setContext(EMPTY_CONTEXT);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [normalizedEmail]);

  const allowedSections = useMemo(
    () => {
      // Admin check comes first: isAdmin: true is only set by a successful authenticated RPC call
      if (context.isAdmin) {
        return ['football', 'fitness', 'gk', 'squad', 'attendance', 'physio', 'video', 'exercises', 'planning', 'meetings'] as PortalSection[];
      }
      if (!context.userId) return [];
      return Array.from(new Set(context.sections));
    },
    [context]
  );

  const userIsAdmin = useMemo(
    () => context.isAdmin,
    [context.isAdmin]
  );

  const boundCan = useCallback(
    (section: PortalSection, action?: AuthorizationAction) => {
      if (action && action !== 'read') {
        return false;
      }
      return canFromContext(context, section);
    },
    [context]
  );

  return {
    allowedSections,
    isAdmin: userIsAdmin,
    can: boundCan,
    isLoadingAuthorization: loading
  };
}
