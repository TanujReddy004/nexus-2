import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env.local file."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage:
        typeof window !== "undefined"
          ? window.localStorage
          : undefined,
    },
  }
);

const AUTH_HANDOFF_KEY = "nexus-auth-handoff";

type AuthHandoff = {
  access_token: string;
  refresh_token: string;
};

export function saveAuthHandoff(
  accessToken: string,
  refreshToken: string
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const handoff: AuthHandoff = {
      access_token: accessToken,
      refresh_token: refreshToken,
    };

    window.sessionStorage.setItem(
      AUTH_HANDOFF_KEY,
      JSON.stringify(handoff)
    );
  } catch (error) {
    console.error(
      "[NEXUS-AUTH] Could not save auth handoff:",
      error
    );
  }
}

export function clearAuthHandoff() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(
      AUTH_HANDOFF_KEY
    );
  } catch (error) {
    console.error(
      "[NEXUS-AUTH] Could not clear auth handoff:",
      error
    );
  }
}

export async function restoreAuthHandoff() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        AUTH_HANDOFF_KEY
      );

    if (!raw) {
      return null;
    }

    const handoff = JSON.parse(raw) as AuthHandoff;

    if (
      !handoff.access_token ||
      !handoff.refresh_token
    ) {
      clearAuthHandoff();
      return null;
    }

    console.error(
      "[NEXUS-AUTH] Restoring session from mobile auth handoff."
    );

    const { data, error } =
      await supabase.auth.setSession({
        access_token: handoff.access_token,
        refresh_token: handoff.refresh_token,
      });

    clearAuthHandoff();

    if (error) {
      console.error(
        "[NEXUS-AUTH] Auth handoff restore failed:",
        error.message
      );
      return null;
    }

    return data.session;
  } catch (error) {
    console.error(
      "[NEXUS-AUTH] Auth handoff restore exception:",
      error
    );
    clearAuthHandoff();
    return null;
  }
}
