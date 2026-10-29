// hooks/useAuth.ts
"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { auth, type StoredSession } from "@/lib/api";

/** During server rendering and hydration the session is not known yet. */
const getServerSnapshot = (): string | null | undefined => undefined;

/**
 * Loads the stored session. Missing, expired or pre-token-auth sessions
 * (no access_token) redirect to /login.
 *
 * The session is read with useSyncExternalStore instead of setState inside
 * an effect, so there is no cascading render and no hydration mismatch; the
 * effect below only performs the redirect.
 */
export function useAuth() {
  const router = useRouter();
  const raw = useSyncExternalStore<string | null | undefined>(auth.subscribe, auth.loadRaw, getServerSnapshot);

  const user = useMemo<StoredSession | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }, [raw]);

  const loading = raw === undefined;

  useEffect(() => {
    if (raw === null) router.replace("/login");
  }, [raw, router]);

  return { user, loading };
}
