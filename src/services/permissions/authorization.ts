import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortalSection } from '../../types';
import { supabase } from '../../supabaseClient';

export type AuthorizationAction = 'read';

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

function normalizeEmail(email?: string | null): string | null {
  const clean = (email || '').trim().toLowerCase();
  return clean || null;
}

function normalizeContext(raw: any): AuthorizationContext {
  const sections = Array.isArray(raw?.sections)
    ? raw.sections.filter((section: unknown): section is PortalSection => {
      return typeof section === 'string' && section.trim().length > 0;
    })
    : [];

  return {
    userId: raw?.userId ? String(raw.userId) : null,
    isAdmin: Boolean(raw?.isAdmin),
    sections
  };
}

async function loadAuthorizationContext(userEmail?: string | null): Promise<AuthorizationContext> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail || !supabase) {
    cachedContext = EMPTY_CONTEXT;
    cachedForEmail = normalizedEmail;
    return cachedContext;
  }

  if (cachedForEmail === normalizedEmail && cachedContext.userId) {
    return cachedContext;
  }

  const { data, error } = await supabase.rpc('get_my_allowed_sections');
  if (error) throw error;

  cachedContext = normalizeContext(data);
  cachedForEmail = normalizedEmail;
  return cachedContext;
}

function canFromContext(
  context: AuthorizationContext,
  section: PortalSection
): boolean {
  if (!context.userId) return false;
  if (context.isAdmin) return true;
  return context.sections.includes(section);
}

export function setAuthorizationUserEmail(email?: string | null): void {
  const next = normalizeEmail(email);
  if (activeAuthorizationEmail !== next) {
    cachedContext = EMPTY_CONTEXT;
    cachedForEmail = null;
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
      .catch((error) => {
        console.error('[Authorization] failed loading authorization context', error);
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
      if (!context.userId) return [];
      if (context.isAdmin) {
        return ['football', 'fitness', 'gk', 'squad', 'attendance', 'physio', 'video', 'exercises', 'planning', 'meetings'] as PortalSection[];
      }

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
