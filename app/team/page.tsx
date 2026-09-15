"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "member";

type LocationData = {
  shared: boolean;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
};

type Member = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "inactive";
  created_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  location: LocationData;
 };

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NX"
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isUserActive(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;

  const lastSeenTime = new Date(lastSeenAt).getTime();

  if (Number.isNaN(lastSeenTime)) return false;

  const fiveMinutes = 5 * 60 * 1000;

  return Date.now() - lastSeenTime <= fiveMinutes;
}

function formatLocation(location: LocationData) {
  if (!location.shared) {
    return "Location not shared";
  }

  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number"
  ) {
    return "Location shared";
  }

  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  location_shared: boolean | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_updated_at: string | null;
};

function mapProfile(profile: ProfileRow): Member {
  const lastSeenAt = profile.last_seen_at ?? null;

  return {
    id: profile.id,
    email: profile.email ?? "",
    name:
      profile.full_name ||
      profile.email?.split("@")[0] ||
      "NEXUS member",
    role: profile.role === "admin" ? "admin" : "member",
    status: isUserActive(lastSeenAt) ? "active" : "inactive",
    created_at: profile.created_at ?? null,
    last_login_at: profile.last_login_at ?? null,
    last_seen_at: lastSeenAt,
    location: {
      shared: Boolean(profile.location_shared),
      latitude: profile.location_latitude ?? null,
      longitude: profile.location_longitude ?? null,
      updated_at: profile.location_updated_at ?? null,
    },
  };
}

function emptyLocation(): LocationData {
  return {
    shared: false,
    latitude: null,
    longitude: null,
    updated_at: null,
  };
}

const profileSelect = `
  id,
  email,
  full_name,
  role,
  created_at,
  last_login_at,
  last_seen_at,
  location_shared,
  location_latitude,
  location_longitude,
  location_updated_at
`;

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [workspaceMemberId, setWorkspaceMemberId] = useState<string | null>(null);
  const [locationUpdating, setLocationUpdating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  async function loadTeam() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMessage("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const { data: ownProfile, error: ownProfileError } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", user.id)
      .maybeSingle();

    if (ownProfileError) {
      setErrorMessage(ownProfileError.message);
      setLoading(false);
      return;
    }

    const me: Member = ownProfile
      ? mapProfile(ownProfile)
      : {
          id: user.id,
          email: user.email ?? "",
          name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "NEXUS member",
          role: "member",
          status: "active",
          created_at: null,
          last_login_at: null,
          last_seen_at: new Date().toISOString(),
          location: emptyLocation(),
        };

    setCurrentUser(me);

    if (me.role === "admin") {
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from("profiles")
        .select(profileSelect)
        .order("created_at", { ascending: false });

      if (allProfilesError) {
        setErrorMessage(allProfilesError.message);
        setLoading(false);
        return;
      }

      const mappedMembers = (allProfiles ?? []).map(mapProfile);

      setMembers(mappedMembers);
      setSelectedUserId(mappedMembers[0]?.id ?? me.id);
    } else {
      setMembers([me]);
      setSelectedUserId(me.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadTeam();

    const interval = window.setInterval(() => {
      void loadTeam();
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const selectedMember =
    members.find((member) => member.id === selectedUserId) ?? currentUser;
  const workspaceMember =
    members.find((member) => member.id === workspaceMemberId) ?? null;

  async function shareMyLocation() {
    if (!currentUser) return;

    if (!navigator.geolocation) {
      setLocationMessage(
        "Location services are not supported by this browser."
      );
      return;
    }

    setLocationUpdating(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const updatedAt = new Date().toISOString();

        const { error } = await supabase
          .from("profiles")
          .update({
            location_shared: true,
            location_latitude: latitude,
            location_longitude: longitude,
            location_updated_at: updatedAt,
          })
          .eq("id", currentUser.id);

        if (error) {
          setLocationMessage(error.message);
          setLocationUpdating(false);
          return;
        }

        setCurrentUser((previous) =>
          previous
            ? {
                ...previous,
                location: {
                  shared: true,
                  latitude,
                  longitude,
                  updated_at: updatedAt,
                },
              }
            : previous
        );

        setMembers((previous) =>
          previous.map((member) =>
            member.id === currentUser.id
              ? {
                  ...member,
                  location: {
                    shared: true,
                    latitude,
                    longitude,
                    updated_at: updatedAt,
                  },
                }
              : member
          )
        );

        setLocationMessage("Your location was shared successfully.");
        setLocationUpdating(false);
      },
      (locationError) => {
        setLocationMessage(
          locationError.message || "Unable to access your location."
        );
        setLocationUpdating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  async function stopSharingLocation() {
    if (!currentUser) return;

    setLocationUpdating(true);
    setLocationMessage("");

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({
        location_shared: false,
        location_latitude: null,
        location_longitude: null,
        location_updated_at: updatedAt,
      })
      .eq("id", currentUser.id);

    if (error) {
      setLocationMessage(error.message);
      setLocationUpdating(false);
      return;
    }

    setCurrentUser((previous) =>
      previous
        ? {
            ...previous,
            location: {
              shared: false,
              latitude: null,
              longitude: null,
              updated_at: updatedAt,
            },
          }
        : previous
    );

    setMembers((previous) =>
      previous.map((member) =>
        member.id === currentUser.id
          ? {
              ...member,
              location: {
                shared: false,
                latitude: null,
                longitude: null,
                updated_at: updatedAt,
              },
            }
          : member
      )
    );

    setLocationMessage("Your location is no longer shared.");
    setLocationUpdating(false);
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="grid min-h-screen place-items-center text-sm text-zinc-500">
          Loading team workspace...
        </div>
      </AuthGuard>
    );
  }

  if (errorMessage) {
    return (
      <AuthGuard>
        <AppShell>
          <section className="mx-auto w-full max-w-5xl min-w-0 px-3 py-8 sm:px-4 md:px-8 md:py-10">
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-500">
              {errorMessage}
            </div>
          </section>
        </AppShell>
      </AuthGuard>
    );
  }

  if (!currentUser || !selectedMember) {
    return null;
  }

  const isAdmin = currentUser.role === "admin";

  if (isAdmin && workspaceMember) {
    const workspaceModules = [
      {
        name: "Overview",
        description: "Workspace summary, recent activity, and account status.",
        href: "/dashboard",
      },
      {
        name: "Projects",
        description: "Projects, project progress, and assigned work.",
        href: "/projects",
      },
      {
        name: "Focus",
        description: "Focus sessions, timers, and productivity history.",
        href: "/focus",
      },
      {
        name: "Analytics",
        description: "Productivity metrics and performance insights.",
        href: "/analytics",
      },
      {
        name: "Team",
        description: "Team membership and collaboration information.",
        href: "/team",
      },
      {
        name: "Activity",
        description: "Recent recorded actions for this member.",
        href: "/team",
      },
    ];

    return (
      <AuthGuard>
        <AppShell>
          <section className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden px-3 py-5 sm:px-4 md:px-8 md:py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                setWorkspaceMemberId(null);
                              }}
                className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-violet-500/10"
              >
                ← Back to Team
              </button>

              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-500">
                Admin view · Read only
              </span>
            </div>

            <div className="mb-8 rounded-3xl border border-violet-500/30 bg-violet-500/5 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white">
                  {getInitials(workspaceMember.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500">
                    Viewing member workspace
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                    {workspaceMember.name}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-500">
                    {workspaceMember.email}
                  </p>
                </div>
                <div className="ml-auto text-right text-xs text-zinc-500">
                  <p className="capitalize">{workspaceMember.role}</p>
                  <p className="mt-1">
                    {workspaceMember.status === "active" ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border p-5">
                <p className="text-xs text-zinc-500">Account created</p>
                <p className="mt-2 text-sm font-semibold">
                  {formatDate(workspaceMember.created_at)}
                </p>
              </div>
              <div className="rounded-3xl border p-5">
                <p className="text-xs text-zinc-500">Last login</p>
                <p className="mt-2 text-sm font-semibold">
                  {formatDate(workspaceMember.last_login_at)}
                </p>
              </div>
              <div className="rounded-3xl border p-5">
                <p className="text-xs text-zinc-500">Last activity</p>
                <p className="mt-2 text-sm font-semibold">
                  {formatDate(workspaceMember.last_seen_at)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <h2 className="text-lg font-semibold">Workspace modules</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Select a module to open the corresponding workspace area for this member.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workspaceModules.map((module) => (
                <button
                  key={module.name}
                  type="button"
                  onClick={() => {
                    router.push(`${module.href}?viewAs=${encodeURIComponent(workspaceMember.id)}`);
                  }}
                  className="rounded-3xl border p-5 text-left transition hover:border-violet-500/50 hover:bg-violet-500/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{module.name}</h3>
                    <span className="text-violet-500">↗</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {module.description}
                  </p>
                  <p className="mt-5 text-xs font-semibold text-violet-500">
                    Open module
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-zinc-500">
              This is an administrator preview. The selected member’s data must be
              authorized by Supabase policies before displaying or editing private records.
            </div>
          </section>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <section className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden px-3 py-5 sm:px-4 md:px-8 md:py-10">
          <div className="mb-6 flex min-w-0 flex-col justify-between gap-4 sm:mb-8 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-500">
                NEXUS TEAM
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {isAdmin ? "Team management" : "My team profile"}
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                {isAdmin
                  ? "View users, roles, login activity, online status, and voluntarily shared locations."
                  : "Manage your profile and location sharing preferences."}
              </p>
            </div>

            <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm sm:px-4 sm:py-3">
              <ShieldCheck size={17} className="text-violet-500" />
              <span className="text-zinc-500">Access:</span>
              <span className="font-semibold capitalize">
                {currentUser.role}
              </span>
            </div>
          </div>

          {isAdmin && (
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border p-5">
                <div className="flex items-center gap-3">
                  <Users className="text-violet-500" size={18} />
                  <div>
                    <p className="text-xs text-zinc-500">Total users</p>
                    <p className="text-2xl font-semibold">{members.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-500" size={18} />
                  <div>
                    <p className="text-xs text-zinc-500">Currently online</p>
                    <p className="text-2xl font-semibold">
                      {
                        members.filter(
                          (member) => member.status === "active"
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border p-5">
                <div className="flex items-center gap-3">
                  <MapPin className="text-cyan-500" size={18} />
                  <div>
                    <p className="text-xs text-zinc-500">Shared locations</p>
                    <p className="text-2xl font-semibold">
                      {
                        members.filter(
                          (member) => member.location.shared
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className={
              isAdmin
                ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
                : "grid gap-6"
            }
          >
            <div className="min-w-0 overflow-hidden rounded-3xl border p-4 sm:p-5 md:p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">
                  {isAdmin ? "Workspace members" : "Your profile"}
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  {isAdmin
                    ? "Select a member to inspect their profile."
                    : "Your account information is shown below."}
                </p>
              </div>

              <div className="space-y-3">
                {members.map((member) => {
                  const selected = selectedMember.id === member.id;

                  return (
                    <div
                      key={member.id}
                      role="group"
                      tabIndex={0}
                      onClick={() => setSelectedUserId(member.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedUserId(member.id);
                        }
                      }}
                      className="flex w-full min-w-0 flex-col items-stretch gap-3 rounded-2xl border p-3 text-left transition sm:flex-row sm:items-center sm:p-4"
                      style={{
                        borderColor: selected
                          ? "rgba(139,92,246,.55)"
                          : "var(--nexus-border)",
                        background: selected
                          ? "rgba(139,92,246,.08)"
                          : "transparent",
                      }}
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-bold text-white">
                        {getInitials(member.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-semibold">
                            {member.name}
                          </p>

                          {member.role === "admin" && (
                            <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-500">
                              Admin
                            </span>
                          )}
                        </div>

                        <p className="mt-1 break-all text-xs text-zinc-500">
                          {member.email}
                        </p>

                        {isAdmin && (
                          <p className="mt-1 text-[10px] text-zinc-500">
                            Last login: {formatDate(member.last_login_at)}
                          </p>
                        )}
                      </div>

                      <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:ml-auto sm:w-auto sm:justify-end">
                        <div className="text-left sm:text-right">
                          <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${
                            member.status === "active"
                              ? "text-emerald-500"
                              : "text-zinc-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              member.status === "active"
                                ? "bg-emerald-500"
                                : "bg-zinc-400"
                            }`}
                          />

                          {member.status === "active"
                            ? "Active"
                            : "Offline"}
                        </span>

                          <p className="mt-1 text-[10px] capitalize text-zinc-500">
                            {member.role}
                          </p>
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedUserId(member.id);
                              setWorkspaceMemberId(member.id);
                                                          }}
                            className="rounded-xl border border-violet-500/40 px-3 py-2 text-xs font-semibold text-violet-500 transition hover:bg-violet-500/10"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && (
              <aside className="min-w-0 overflow-hidden rounded-3xl border p-4 sm:p-5 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white">
                    {getInitials(selectedMember.name)}
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold">
                      {selectedMember.name}
                    </h2>

                    <p className="truncate text-xs text-zinc-500">
                      {selectedMember.email}
                    </p>
                  </div>
                </div>

                <div className="my-5 h-px bg-[var(--nexus-border)]" />

                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      Account status
                    </p>

                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2
                        size={15}
                        className={
                          selectedMember.status === "active"
                            ? "text-emerald-500"
                            : "text-zinc-400"
                        }
                      />

                      {selectedMember.status === "active"
                        ? "Active"
                        : "Offline"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      Role
                    </p>

                    <p className="mt-1 text-sm font-medium capitalize">
                      {selectedMember.role}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      Last login
                    </p>

                    <p className="mt-1 flex items-start gap-2 text-sm">
                      <Clock3
                        size={15}
                        className="mt-0.5 shrink-0 text-cyan-500"
                      />

                      {formatDate(selectedMember.last_login_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      Last activity
                    </p>

                    <p className="mt-1 flex items-start gap-2 text-sm">
                      <Activity
                        size={15}
                        className="mt-0.5 shrink-0 text-violet-500"
                      />

                      {formatDate(selectedMember.last_seen_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      Account created
                    </p>

                    <p className="mt-1 text-sm">
                      {formatDate(selectedMember.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      Location
                    </p>

                    <p className="mt-1 flex items-start gap-2 text-sm">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-500"
                      />

                      {formatLocation(selectedMember.location)}
                    </p>

                    {selectedMember.location.updated_at && (
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Updated:{" "}
                        {formatDate(selectedMember.location.updated_at)}
                      </p>
                    )}
                  </div>

                  {selectedMember.location.shared &&
                    selectedMember.location.latitude !== null &&
                    selectedMember.location.longitude !== null && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                          Coordinates
                        </p>

                        <p className="mt-1 break-all text-sm">
                          {selectedMember.location.latitude.toFixed(6)},{" "}
                          {selectedMember.location.longitude.toFixed(6)}
                        </p>

                        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--nexus-border)]">
                          <iframe
                            title={`Location map for ${selectedMember.name}`}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                              selectedMember.location.longitude - 0.01
                            }%2C${
                              selectedMember.location.latitude - 0.01
                            }%2C${
                              selectedMember.location.longitude + 0.01
                            }%2C${
                              selectedMember.location.latitude + 0.01
                            }&layer=mapnik&marker=${
                              selectedMember.location.latitude
                            }%2C${selectedMember.location.longitude}`}
                            className="h-48 w-full border-0 sm:h-64"
                            loading="lazy"
                          />
                        </div>

                        <a
                          href={`https://www.openstreetmap.org/?mlat=${selectedMember.location.latitude}&mlon=${selectedMember.location.longitude}#map=16/${selectedMember.location.latitude}/${selectedMember.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs font-medium text-violet-500 hover:underline"
                        >
                          Open full map
                        </a>
                      </div>
                    )}
                </div>
              </aside>
            )}
          </div>

          <div className="mt-4 min-w-0 overflow-hidden rounded-3xl border p-4 sm:mt-6 sm:p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                <MapPin size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">Your location sharing</h2>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      currentUser.location.shared
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-zinc-500/10 text-zinc-500"
                    }`}
                  >
                    {currentUser.location.shared ? "ON" : "OFF"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  Location sharing is optional. You can share or stop sharing
                  your own location at any time.
                </p>

                {currentUser.location.shared && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Your location is currently shared with the administrator.
                  </p>
                )}

                {locationMessage && (
                  <p className="mt-3 text-sm text-zinc-500">
                    {locationMessage}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={shareMyLocation}
                    disabled={locationUpdating}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      size={15}
                      className={locationUpdating ? "animate-spin" : ""}
                    />

                    {locationUpdating
                      ? "Updating..."
                      : currentUser.location.shared
                        ? "Update my location"
                        : "Share my location"}
                  </button>

                  <button
                    type="button"
                    onClick={stopSharingLocation}
                    disabled={
                      locationUpdating || !currentUser.location.shared
                    }
                    className="rounded-xl border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Stop sharing
                  </button>
                </div>

                {currentUser.location.shared && (
                  <p className="mt-4 text-xs text-zinc-500">
                    Last updated:{" "}
                    {formatDate(currentUser.location.updated_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    </AuthGuard>
  );
}