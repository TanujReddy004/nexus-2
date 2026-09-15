"use client";

import { useEffect, useState } from "react";
import { restoreAuthHandoff, supabase } from "@/lib/supabase";
import {
  getDummyUserByEmail,
  type DummyUserStatus,
} from "@/lib/data/dummy-users";

const ADMIN_EMAIL = "tanujreddyy004@gmail.com";

type CurrentNexusUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  status: DummyUserStatus;
  canViewAllUsers: boolean;
  canViewAllUserData: boolean;
  canViewUserLocations: boolean;
};

function resolveNexusUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): CurrentNexusUser {
  const email = sessionUser.email?.toLowerCase().trim() ?? "";

  if (email === ADMIN_EMAIL) {
    return {
      id: sessionUser.id,
      email,
      name: "Tanuj Reddy",
      role: "admin",
      status: "active",
      canViewAllUsers: true,
      canViewAllUserData: true,
      canViewUserLocations: true,
    };
  }

  const dummyUser = getDummyUserByEmail(email);

  if (dummyUser) {
    return {
      id: sessionUser.id,
      email,
      name: dummyUser.name,
      role: dummyUser.role,
      status: dummyUser.status,
      canViewAllUsers: dummyUser.role === "admin",
      canViewAllUserData: dummyUser.role === "admin",
      canViewUserLocations: dummyUser.role === "admin",
    };
  }

  return {
    id: sessionUser.id,
    email,
    name:
      typeof sessionUser.user_metadata?.full_name === "string"
        ? sessionUser.user_metadata.full_name
        : email.split("@")[0] || "NEXUS User",
    role: "member",
    status: "active",
    canViewAllUsers: false,
    canViewAllUserData: false,
    canViewUserLocations: false,
  };
}

function saveCurrentNexusUser(user: CurrentNexusUser) {
  window.localStorage.setItem("nexus-current-user", JSON.stringify(user));

  window.dispatchEvent(
    new CustomEvent("nexus-current-user-changed", {
      detail: user,
    })
  );
}

function clearCurrentNexusUser() {
  window.localStorage.removeItem("nexus-current-user");

  window.dispatchEvent(
    new CustomEvent("nexus-current-user-changed", {
      detail: null,
    })
  );
}

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        console.debug("[NEXUS-AUTH] GUARD: checking persisted session.");

        let {
          data: { session },
        } = await supabase.auth.getSession();

        console.debug("[NEXUS-AUTH] GUARD: getSession result.", {
          session: session ? "YES" : "NO",
          user: session?.user?.email ?? "NONE",
        });

        if (!session) {
          session = await restoreAuthHandoff();

          console.debug("[NEXUS-AUTH] GUARD: handoff restore result.", {
            session: session ? "YES" : "NO",
            user: session?.user?.email ?? "NONE",
          });
        }

        if (!mounted) {
          return;
        }

        if (!session) {
          clearCurrentNexusUser();
          window.location.replace("/");
          return;
        }

        const currentNexusUser = resolveNexusUser(session.user);

        saveCurrentNexusUser(currentNexusUser);

        console.debug("[NEXUS-AUTH] GUARD: session accepted.", {
          email: currentNexusUser.email,
          name: currentNexusUser.name,
          role: currentNexusUser.role,
          status: currentNexusUser.status,
          canViewAllUsers: currentNexusUser.canViewAllUsers,
          canViewAllUserData: currentNexusUser.canViewAllUserData,
          canViewUserLocations: currentNexusUser.canViewUserLocations,
        });

        setChecking(false);
      } catch (error) {
        console.error(
          "[NEXUS-AUTH] GUARD: session check failed:",
          error
        );

        clearCurrentNexusUser();

        if (mounted) {
          window.location.replace("/");
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#09090b] text-sm text-zinc-500">
        Securing your workspace...
      </div>
    );
  }

  return <>{children}</>;
}