"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckSquare2,
  Focus,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import {
  cancelNotification,
  subscribeToNotificationActions,
} from "@/lib/native/notifications";
import {
  getNotificationHistory,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  dismissNotificationHistory,
  dismissAllNotificationHistory,
  subscribeToNotificationHistory,
  type NexusNotificationHistoryItem,
} from "@/lib/notifications/notification-history";
import {
  addTask,
  getFocusSessions,
  getTasks,
  type Priority,
} from "@/lib/workspace-store";

const nav = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    key: "1",
  },
  {
    href: "/projects",
    label: "Projects",
    icon: CheckSquare2,
    key: "2",
  },
  {
    href: "/focus",
    label: "Focus",
    icon: Focus,
    key: "3",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    key: "4",
  },
];

const teamNavItem = {
  href: "/team",
  label: "Team",
  icon: Users,
  key: "6",
};

const mobileNav = [
  ...nav,
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    key: "5",
  },
];

function initialsFor(name: string) {
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

function isTypingTarget(
  target: EventTarget | null
) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [name, setName] =
    useState("NEXUS User");

  const [email, setEmail] =
    useState("");

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [quickAdd, setQuickAdd] =
    useState(false);

  const [commandOpen, setCommandOpen] =
    useState(false);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [quickTitle, setQuickTitle] =
    useState("");

  const [priority, setPriority] =
    useState<Priority>("medium");

  const [quickDueDate, setQuickDueDate] =
    useState("");

  const [taskCount, setTaskCount] =
    useState(0);

  const [focusToday, setFocusToday] =
    useState(0);

  const [
    notificationItems,
    setNotificationItems,
  ] = useState<
    NexusNotificationHistoryItem[]
  >([]);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  const syncData = () => {
    const tasks = getTasks();

    const sessions =
      getFocusSessions();

    const today =
      new Date().toDateString();

    setTaskCount(
      tasks.filter(
        (task) =>
          task.status !== "completed"
      ).length
    );

    setFocusToday(
      sessions
        .filter(
          (session) =>
            new Date(
              session.completedAt
            ).toDateString() === today
        )
        .reduce(
          (sum, session) =>
            sum + session.duration,
          0
        )
    );
  };

  useEffect(() => {
    const loadUser = async (authUser?: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    } | null) => {
      const user = authUser ?? (await supabase.auth.getUser()).data.user;

      const fullName =
        (typeof user?.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined) ||
        (typeof user?.user_metadata?.name === "string"
          ? user.user_metadata.name
          : undefined) ||
        user?.email?.split("@")[0] ||
        "NEXUS User";

      setName(fullName);
      setEmail(user?.email || "");

      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setIsAdmin(profile?.role === "admin");
    };

    loadUser();
    syncData();

    window.addEventListener(
      "nexus-data-change",
      syncData
    );

    const authSubscription =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!session) {
            router.replace("/login");
            return;
          }

          const user =
            session.user;

          const fullName =
            user.user_metadata
              ?.full_name ||
            user.user_metadata
              ?.name ||
            user.email?.split("@")[0] ||
            "NEXUS User";

          setName(fullName);
          setEmail(user.email || "");
          void loadUser(user);
        }
      );

    return () => {
      window.removeEventListener(
        "nexus-data-change",
        syncData
      );

      authSubscription.data.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const syncNotifications = () => {
      setNotificationItems(
        getNotificationHistory()
      );

      setUnreadNotificationCount(
        getUnreadNotificationCount()
      );
    };

    syncNotifications();

    const unsubscribe =
      subscribeToNotificationHistory(
        syncNotifications
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;

    let subscription:
      | Awaited<
          ReturnType<
            typeof subscribeToNotificationActions
          >
        >
      | null = null;

    const setupNotificationActions =
      async () => {
        const result =
          await subscribeToNotificationActions(
            (action) => {
              const notification =
                action.notification;

              const id =
                typeof notification.id ===
                "number"
                  ? notification.id
                  : undefined;

              if (id !== undefined) {
                markNotificationRead(id);
              }

              const extra =
                notification.extra as
                  | Record<string, unknown>
                  | undefined;

              const screen =
                typeof extra?.screen ===
                "string"
                  ? extra.screen
                  : undefined;

              setNotificationsOpen(
                false
              );

              if (screen) {
                router.push(screen);
              }
            }
          );

        if (!active) {
          void result.remove();
          return;
        }

        subscription = result;
      };

    void setupNotificationActions();

    return () => {
      active = false;

      if (subscription) {
        void subscription.remove();
      }
    };
  }, [router]);

  useEffect(() => {
    const handler = (
      event: KeyboardEvent
    ) => {
      const modifier =
        event.metaKey ||
        event.ctrlKey;

      if (
        modifier &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        setCommandOpen(true);
        setQuickAdd(false);
        setProfileOpen(false);
        setNotificationsOpen(false);

        return;
      }

      if (
        modifier &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();

        setQuickAdd(true);
        setCommandOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);

        return;
      }

      if (
        event.key === "Escape"
      ) {
        setQuickAdd(false);
        setCommandOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);

        return;
      }

      if (
        !modifier &&
        !isTypingTarget(event.target)
      ) {
        const shortcut =
          nav.find(
            (item) =>
              item.key === event.key
          );

        if (shortcut) {
          router.push(
            shortcut.href
          );
        }
      }
    };

    window.addEventListener(
      "keydown",
      handler
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handler
      );
  }, [router]);

  useEffect(() => {
    if (
      quickAdd ||
      commandOpen ||
      profileOpen ||
      notificationsOpen
    ) {
      document.body.style.overflow =
        "hidden";
    } else {
      document.body.style.overflow =
        "";
    }

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [
    quickAdd,
    commandOpen,
    profileOpen,
    notificationsOpen,
  ]);

  const initials = useMemo(
    () => initialsFor(name),
    [name]
  );

  const visibleNav = isAdmin
    ? [...nav, teamNavItem]
    : nav;

  const visibleMobileNav = isAdmin
    ? [...mobileNav.slice(0, -1), teamNavItem, mobileNav[mobileNav.length - 1]]
    : mobileNav;

  const today =
    new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "long",
        month: "short",
        day: "numeric",
      }
    ).format(new Date());

  const closeAll = () => {
    setQuickAdd(false);
    setCommandOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  };

  const createQuickTask = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const title =
      quickTitle.trim();

    if (!title) {
      return;
    }

    addTask({
      title,
      priority,
      status: "todo",
      progress: 0,
      description: undefined,
      dueDate: quickDueDate || undefined,
      estimatedMinutes:
        undefined,
    });

    setQuickTitle("");
    setPriority("medium");
    setQuickDueDate("");
    setQuickAdd(false);

    syncData();
  };

  const cancelNotificationFromCenter = async (
    item: NexusNotificationHistoryItem
  ) => {
    const cancelled = await cancelNotification(item.id);

    if (!cancelled) {
      return;
    }

    /*
     * A dismissal is persistent.
     * The task reminder reconciler will not recreate the same
     * reminder after a reload, so the user is not shown the
     * exact same notification again.
     */
    dismissNotificationHistory(item);
  };

  const clearAllNotificationsFromCenter = async () => {
    const items = getNotificationHistory();

    /* Cancel native scheduled copies first. */
    await Promise.all(
      items.map((item) =>
        cancelNotification(item.id)
      )
    );

    /* Persist the dismissal before clearing the visible inbox. */
    dismissAllNotificationHistory(items);

    setNotificationsOpen(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "var(--nexus-bg)",
        color:
          "var(--nexus-text)",
      }}
    >
      {/* Ambient layer */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="nexus-ambient nexus-ambient-one" />
        <div className="nexus-ambient nexus-ambient-two" />
        <div className="nexus-scanline" />
      </div>

      {/* =====================================================
          DESKTOP SIDEBAR
          ===================================================== */}

      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r p-5 lg:flex"
        style={{
          borderColor:
            "var(--nexus-border)",
          background:
            "color-mix(in srgb, var(--nexus-surface) 96%, transparent)",
        }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-2 py-1"
        >
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-400 text-lg font-black text-white">
            N
          </div>

          <div>
            <b className="tracking-[.16em]">
              NEXUS
            </b>

            <p className="text-[9px] uppercase tracking-[.22em] text-zinc-500">
              Personal OS
            </p>
          </div>
        </Link>

        <div
          className="my-6 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--nexus-purple), transparent)",
            opacity: 0.35,
          }}
        />

        <div className="mb-3 flex items-center justify-between px-2">
          <p className="eyebrow">
            Command
          </p>

          <span className="text-[9px] text-zinc-500">
            ⌘K
          </span>
        </div>

        <nav className="space-y-1">
          {visibleNav.map(
            ({
              href,
              label,
              icon: Icon,
              key,
            }) => {
              const active =
                pathname === href ||
                (
                  href ===
                    "/projects" &&
                  pathname.startsWith(
                    "/projects"
                  )
                );

              return (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition"
                  style={{
                    background: active
                      ? "rgba(124,58,237,.10)"
                      : "transparent",
                    color: active
                      ? "var(--nexus-text)"
                      : "var(--nexus-muted)",
                    boxShadow: active
                      ? "inset 0 0 0 1px rgba(124,58,237,.22)"
                      : "none",
                  }}
                >
                  <Icon
                    size={17}
                    style={{
                      color: active
                        ? "var(--nexus-purple)"
                        : "currentColor",
                    }}
                  />

                  <span className="flex-1">
                    {label}
                  </span>

                  <span className="text-[9px] opacity-60">
                    {key}
                  </span>
                </Link>
              );
            }
          )}
        </nav>

        <div className="mt-auto">
          <div
            className="mb-4 rounded-3xl border p-4"
            style={{
              borderColor:
                "var(--nexus-border)",
              background:
                "var(--nexus-surface-2)",
            }}
          >
            <p className="eyebrow">
              Today
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] uppercase tracking-[.12em] text-zinc-500">
                  Open tasks
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {taskCount}
                </p>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-[.12em] text-zinc-500">
                  Focus
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {focusToday}m
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-zinc-500 transition hover:bg-black/5"
          >
            <Settings size={17} />
            Settings
          </Link>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-500"
          >
            <LogOut size={17} />
            Logout
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileOpen(
                (value) => !value
              );

              setNotificationsOpen(
                false
              );

              setCommandOpen(false);
            }}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition"
            style={{
              borderColor:
                "var(--nexus-border)",
              background:
                "var(--nexus-surface-2)",
            }}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-[10px] font-bold text-white">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {name}
              </p>

              <p className="truncate text-[9px] text-zinc-500">
                {email ||
                  "Local workspace"}
              </p>
            </div>

            <UserRound
              size={14}
              className="text-zinc-500"
            />
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="relative z-10 lg:ml-[272px]">
        <header
          className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b px-4 py-2 backdrop-blur-2xl md:grid md:grid-cols-[minmax(0,1fr)_minmax(420px,560px)_minmax(0,1fr)] md:px-8"
          style={{
            borderColor:
              "var(--nexus-border)",
            background:
              "color-mix(in srgb, var(--nexus-bg) 86%, transparent)",
          }}
        >
          <div className="hidden min-w-0 items-center md:flex">
            <p className="text-[10px] font-medium uppercase tracking-[.22em] text-zinc-400">
              {today}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCommandOpen(true);
              setQuickAdd(false);
              setProfileOpen(false);
              setNotificationsOpen(false);
            }}
            className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 text-left text-xs md:w-full md:flex-none md:justify-self-center"
            style={{
              borderColor:
                "var(--nexus-border)",
              background:
                "var(--nexus-surface)",
              color:
                "var(--nexus-muted)",
            }}
          >
            <Search size={15} />

            <span className="flex-1 truncate">
              Search, jump, or run an action...
            </span>

            <span
              className="hidden rounded-lg border px-1.5 py-1 text-[9px] sm:block"
              style={{
                borderColor:
                  "var(--nexus-border)",
              }}
            >
              ⌘K
            </span>
          </button>

          <div className="flex shrink-0 items-center justify-end gap-2 md:col-start-3 md:row-start-1 md:gap-3">
            <button
              type="button"
              onClick={() => {
                setQuickAdd(true);
              setCommandOpen(false);
              setProfileOpen(false);
              setNotificationsOpen(false);
            }}
            className="btn-primary h-10 shrink-0 px-3 md:px-4"
          >
            <Plus size={16} />

            <span className="hidden sm:inline">
              Quick add
            </span>
          </button>

          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setNotificationsOpen(
                (value) => !value
              );

              setQuickAdd(false);
              setCommandOpen(false);
              setProfileOpen(false);
            }}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border"
            style={{
              borderColor:
                "var(--nexus-border)",
              background:
                "var(--nexus-surface)",
            }}
          >
            <Bell size={16} />

            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-violet-500 px-1.5 py-0.5 text-center text-[8px] font-bold text-white shadow-lg">
                {unreadNotificationCount > 99
                  ? "99+"
                  : unreadNotificationCount}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="Open profile"
            onClick={() => {
              setProfileOpen(
                (value) => !value
              );

              setQuickAdd(false);
              setCommandOpen(false);
              setNotificationsOpen(false);
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-[10px] font-bold text-white shadow-lg"
          >
            {initials}
          </button>
          </div>

        </header>

        {children}

        {/* =====================================================
            MOBILE SCROLL CLEARANCE
            =====================================================

            The mobile navigation is fixed to the viewport.
            This spacer is part of the normal document flow,
            guaranteeing that the final content can scroll
            completely above the navigation bar.

            Desktop: hidden, so desktop layout is untouched.
            ===================================================== */}

        <div
          className="h-[88px] w-full lg:hidden"
          aria-hidden="true"
        />
      </main>

      {notificationsOpen && (
        <button
          type="button"
          aria-label="Close notifications"
          className="fixed inset-0 z-[300] bg-black/10"
          onClick={() => setNotificationsOpen(false)}
        />
      )}

          {/* Notification Center */}

          {notificationsOpen && (
            <section
              className="fixed right-4 top-[72px] z-[320] w-[min(410px,calc(100vw-28px))] overflow-hidden rounded-3xl border shadow-2xl"
              style={{
                borderColor:
                  "var(--nexus-border-strong)",
                background:
                  "var(--nexus-surface)",
                color:
                  "var(--nexus-text)",
              }}
              aria-label="Notification Center"
            >
              <div
                className="flex items-center justify-between border-b px-4 py-4"
                style={{
                  borderColor:
                    "var(--nexus-border)",
                }}
              >
                <div>
                  <p className="eyebrow">
                    NEXUS ALERTS
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <h2 className="text-base font-semibold">
                      Notifications
                    </h2>

                    {unreadNotificationCount >
                      0 && (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-500">
                        {unreadNotificationCount} new
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unreadNotificationCount >
                    0 && (
                    <button
                      type="button"
                      onClick={() =>
                        markAllNotificationsRead()
                      }
                      className="rounded-xl px-2.5 py-2 text-[10px] font-semibold text-violet-500 transition hover:bg-violet-500/10"
                    >
                      Mark all read
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setNotificationsOpen(false)
                    }
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 text-zinc-700 shadow-sm transition hover:bg-violet-500/10 hover:text-violet-600 active:scale-95 dark:text-zinc-200"
                    style={{
                      borderColor:
                        "var(--nexus-border-strong)",
                      background:
                        "var(--nexus-surface)",
                    }}
                    aria-label="Close notifications"
                    title="Close notifications"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="max-h-[min(520px,70vh)] overflow-y-auto p-3">
                {notificationItems.length ===
                0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-500">
                      <Bell size={21} />
                    </div>

                    <p className="mt-4 text-sm font-semibold">
                    you&apos;re
                    </p>

                    <p className="mt-1 max-w-[240px] text-[11px] leading-5 text-zinc-500">
                      NEXUS notifications and reminders will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(
                      [
                        {
                          label: "Today",
                          items:
                            notificationItems.filter(
                              (item) =>
                                new Date(
                                  item.createdAt
                                ).toDateString() ===
                                new Date().toDateString()
                            ),
                        },
                        {
                          label: "Earlier",
                          items:
                            notificationItems.filter(
                              (item) =>
                                new Date(
                                  item.createdAt
                                ).toDateString() !==
                                new Date().toDateString()
                            ),
                        },
                      ] as const
                    ).map((group) =>
                      group.items.length ===
                      0 ? null : (
                        <div key={group.label}>
                          <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[.22em] text-zinc-500">
                            {group.label}
                          </p>

                          <div className="space-y-2">
                            {group.items.map(
                              (item) => (
                                <div
                                  key={item.id}
                                  className="group relative rounded-2xl border transition hover:border-violet-500/30 hover:bg-violet-500/5"
                                  style={{
                                    borderColor:
                                      item.read
                                        ? "var(--nexus-border)"
                                        : "rgba(124,58,237,.28)",
                                    background:
                                      item.read
                                        ? "transparent"
                                        : "rgba(124,58,237,.045)",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      markNotificationRead(
                                        item.id
                                      );

                                      setNotificationsOpen(
                                        false
                                      );

                                      if (
                                        item.screen
                                      ) {
                                        router.push(
                                          item.screen
                                        );
                                      }
                                    }}
                                    className="flex w-full gap-3 rounded-2xl p-3 pr-12 text-left transition"
                                    aria-label={`Open notification: ${item.title}`}
                                  >
                                    <div
                                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                                      style={{
                                        background:
                                          item.type ===
                                          "task-overdue"
                                            ? "rgba(244,63,94,.10)"
                                            : item.type.startsWith(
                                                  "focus"
                                                )
                                              ? "rgba(124,58,237,.10)"
                                              : "rgba(34,211,238,.10)",
                                        color:
                                          item.type ===
                                          "task-overdue"
                                            ? "rgb(244,63,94)"
                                            : item.type.startsWith(
                                                  "focus"
                                                )
                                              ? "rgb(124,58,237)"
                                              : "rgb(6,182,212)",
                                      }}
                                    >
                                      {item.type.startsWith(
                                        "focus"
                                      ) ? (
                                        <Focus
                                          size={16}
                                        />
                                      ) : item.type ===
                                        "task-overdue" ? (
                                        <Bell
                                          size={16}
                                        />
                                      ) : (
                                        <CheckSquare2
                                          size={16}
                                        />
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="truncate text-xs font-semibold">
                                          {item.title}
                                        </p>

                                        {!item.read && (
                                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                                        )}
                                      </div>

                                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-zinc-500">
                                        {item.body}
                                      </p>

                                      <p className="mt-2 text-[9px] text-zinc-500">
                                        {new Intl.DateTimeFormat(
                                          "en-US",
                                          {
                                            hour: "numeric",
                                            minute: "2-digit",
                                          }
                                        ).format(
                                          new Date(
                                            item.createdAt
                                          )
                                        )}
                                      </p>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void cancelNotificationFromCenter(
                                        item
                                      );
                                    }}
                                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                                    aria-label={`Cancel notification: ${item.title}`}
                                    title="Cancel notification"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {notificationItems.length >
                0 && (
                <div
                  className="border-t px-4 py-3"
                  style={{
                    borderColor:
                      "var(--nexus-border)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void clearAllNotificationsFromCenter();
                    }}
                    className="w-full rounded-xl py-2 text-[10px] font-semibold text-zinc-500 transition hover:bg-red-500/5 hover:text-red-500"
                  >
                    Clear notification history
                  </button>
                </div>
              )}
            </section>
          )}

      {/* =====================================================
          MOBILE NAV
          ===================================================== */}

      <nav
        aria-label="Mobile navigation"
        className={`fixed inset-x-0 bottom-0 z-[100] grid border-t ${
          isAdmin ? "grid-cols-6" : "grid-cols-5"
        } px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-2xl lg:hidden`}
        style={{
          minHeight: "76px",
          borderColor:
            "var(--nexus-border)",
          background:
            "color-mix(in srgb, var(--nexus-surface) 96%, transparent)",
        }}
      >
        {visibleMobileNav.map(
          ({
            href,
            label,
            icon: Icon,
          }) => {
            const active =
              pathname === href ||
              (
                href ===
                  "/projects" &&
                pathname.startsWith(
                  "/projects"
                )
              );

            return (
              <Link
                key={href}
                href={href}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[9px] transition"
                style={{
                  color: active
                    ? "var(--nexus-purple)"
                    : "var(--nexus-muted)",
                  background: active
                    ? "rgba(124,58,237,.08)"
                    : "transparent",
                }}
              >
                <Icon size={18} />

                <span className="leading-none">
                  {label}
                </span>
              </Link>
            );
          }
        )}
      </nav>

      {/* =====================================================
          GLOBAL OVERLAY
          ===================================================== */}

      {(profileOpen ||
        commandOpen) && (
        <button
          type="button"
          aria-label="Close overlay"
          className="fixed inset-0 z-[190] bg-black/10"
          onClick={closeAll}
        />
      )}

      {/* =====================================================
          PROFILE
          ===================================================== */}

      {profileOpen && (
        <section
          className="fixed right-4 top-[72px] z-[220] w-[min(410px,calc(100vw-28px))] rounded-[28px] border p-5 shadow-2xl"
          style={{
            borderColor:
              "var(--nexus-border-strong)",
            background:
              "var(--nexus-surface)",
            color:
              "var(--nexus-text)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-bold text-white">
                {initials}
              </div>

              <div className="min-w-0">
                <p className="eyebrow">
                  Identity
                </p>

                <h2 className="truncate text-base font-semibold">
                  {name}
                </h2>

                <p className="truncate text-[10px] text-zinc-500">
                  {email ||
                    "Local workspace"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setProfileOpen(false)
              }
              className="btn-secondary grid h-8 w-8 p-0"
              aria-label="Close profile"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-5">
            <Link
              href="/focus"
              onClick={() =>
                setProfileOpen(false)
              }
              className="btn-primary"
            >
              <Focus size={15} />
              Focus now
            </Link>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold text-rose-500"
            style={{
              borderColor:
                "rgba(244,63,94,.20)",
            }}
          >
            <LogOut size={15} />
            Sign out securely
          </button>
        </section>
      )}

      {/* =====================================================
          COMMAND PALETTE
          ===================================================== */}

      {commandOpen && (
        <div
          className="nexus-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setCommandOpen(false);
            }
          }}
        >
          <div className="nexus-modal">
            <div
              className="flex items-center gap-3 border-b p-4"
              style={{
                borderColor:
                  "var(--nexus-border)",
              }}
            >
              <Search
                size={17}
                className="text-violet-500"
              />

              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="Type a route or action..."
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Escape"
                  ) {
                    setCommandOpen(
                      false
                    );
                  }
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setCommandOpen(false)
                }
                className="btn-secondary grid h-8 w-8 p-0"
                aria-label="Close command palette"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-3">
              {visibleNav.map(
                ({
                  href,
                  label,
                  icon: Icon,
                  key,
                }) => (
                  <button
                    key={href}
                    type="button"
                    onClick={() => {
                      setCommandOpen(
                        false
                      );

                      router.push(
                        href
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition hover:bg-black/5"
                  >
                    <Icon
                      size={17}
                      className="text-violet-500"
                    />

                    <span className="flex-1">
                      Go to {label}
                    </span>

                    <span className="text-[9px] text-zinc-500">
                      {key}
                    </span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => {
                  setCommandOpen(
                    false
                  );

                  setQuickAdd(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition hover:bg-black/5"
              >
                <Plus
                  size={17}
                  className="text-cyan-500"
                />

                <span className="flex-1">
                  Create a task
                </span>

                <span className="text-[9px] text-zinc-500">
                  ⌘N
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          QUICK ADD
          ===================================================== */}

      {quickAdd && (
        <div
          className="nexus-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setQuickAdd(false);
            }
          }}
        >
          <div className="nexus-modal p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">
                  Quick capture
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Add a task. Keep moving.
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  Capture the outcome now and add only the context you need.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setQuickAdd(false)
                }
                className="btn-secondary grid h-11 w-11 shrink-0 p-0"
                aria-label="Close quick add"
              >
                <X
                  size={22}
                  strokeWidth={2.5}
                />
              </button>
            </div>

            <form
              onSubmit={createQuickTask}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="quick-task-title"
                  className="mb-2 block text-sm font-medium"
                >
                  Task name
                  <span className="ml-1 text-violet-500">
                    *
                  </span>
                </label>

                <input
                  id="quick-task-title"
                  autoFocus
                  required
                  maxLength={160}
                  value={quickTitle}
                  onChange={(event) =>
                    setQuickTitle(
                      event.target.value
                    )
                  }
                  placeholder="What is the next meaningful action?"
                  className="input h-14 text-base"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Priority
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      "low",
                      "medium",
                      "high",
                    ] as Priority[]
                  ).map((value) => {
                    const selected =
                      priority === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setPriority(
                            value
                          )
                        }
                        className="rounded-2xl border py-3 text-xs font-semibold capitalize transition"
                        style={{
                          borderColor:
                            selected
                              ? "rgba(124,58,237,.45)"
                              : "var(--nexus-border)",
                          background:
                            selected
                              ? "rgba(124,58,237,.10)"
                              : "var(--nexus-surface-2)",
                          color:
                            "var(--nexus-text)",
                        }}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DUE DATE */}

              <div>
                <label
                  htmlFor="quick-task-due-date"
                  className="mb-2 block text-sm font-medium"
                >
                  Due date
                </label>

                <div
                  className="relative h-12 w-full overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: "var(--nexus-border)",
                    background: "var(--nexus-surface-2)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center gap-3 px-4"
                    aria-hidden="true"
                  >
                    <CalendarDays
                      size={17}
                      className="shrink-0 text-violet-500"
                    />
                    <span
                      className={`text-sm ${
                        quickDueDate ? "" : "text-zinc-500"
                      }`}
                      style={{
                        color: quickDueDate
                          ? "var(--nexus-text)"
                          : undefined,
                      }}
                    >
                      {quickDueDate
                        ? (() => {
                            const [year, month, day] = quickDueDate.split("-");
                            return `${day}/${month}/${year}`;
                          })()
                        : "DD/MM/YYYY"}
                    </span>
                  </div>

                  <input
                    id="quick-task-due-date"
                    type="date"
                    value={quickDueDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(event) => setQuickDueDate(event.target.value)}
                    aria-label="Due date"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onClick={(event) => {
                      const input = event.currentTarget as HTMLInputElement & {
                        showPicker?: () => void;
                      };
                      input.showPicker?.();
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setQuickAdd(false)
                  }
                  className="btn-secondary h-12"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    !quickTitle.trim()
                  }
                  className="btn-primary h-12"
                >
                  Create task
                  <Check size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}