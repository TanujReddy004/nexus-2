"use client";

import AppShell from "@/components/app-shell";
import AuthGuard from "@/components/auth-guard";
import {
  getProductivityStats,
  getTasks,
  type Task,
} from "@/lib/workspace-store";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Flame,
  Play,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remaining}m`;
}

function formatDueDate(date?: string) {
  if (!date) return "No due date";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "completed") {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.dueDate}T00:00:00`);

  return dueDate < today;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";

  return "Good evening.";
}

function getInitials() {
  if (typeof window === "undefined") {
    return "N";
  }

  try {
    const rawUser = localStorage.getItem("nexus-user");

    if (!rawUser) {
      return "N";
    }

    const user = JSON.parse(rawUser);

    const name =
      user?.name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "";

    const parts = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) {
      return "N";
    }

    return parts
      .map((part: string) => part[0])
      .join("")
      .toUpperCase();
  } catch {
    return "N";
  }
}

function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTasks(getTasks());
    setMounted(true);
  }, []);

  const stats = useMemo(() => {
    if (!mounted) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        totalFocusMinutes: 0,
        productivity: 0,
        sessionsCompleted: 0,
      };
    }

    return getProductivityStats();
  }, [mounted]);

  const activeTasks = tasks.filter(
    (task) => task.status !== "completed"
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const inProgressTasks = tasks.filter(
    (task) => task.status === "in-progress"
  );

  const highPriorityTasks = tasks.filter(
    (task) =>
      task.priority === "high" &&
      task.status !== "completed"
  );

  const overdueTasks = tasks.filter(isOverdue);

  const nextTask = useMemo(() => {
    const available = tasks.filter(
      (task) => task.status !== "completed"
    );

    return [...available].sort((a, b) => {
      const priorityWeight = {
        high: 3,
        medium: 2,
        low: 1,
      };

      const priorityDifference =
        priorityWeight[b.priority] -
        priorityWeight[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return b.createdAt.localeCompare(a.createdAt);
    })[0];
  }, [tasks]);

  const todayTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;

    const today = new Date();

    const year = today.getFullYear();

    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      today.getDate()
    ).padStart(2, "0");

    return (
      task.dueDate === `${year}-${month}-${day}` &&
      task.status !== "completed"
    );
  });

  const completionRate =
    tasks.length > 0
      ? Math.round(
          (completedTasks.length / tasks.length) * 100
        )
      : 0;

  const queuedTasks = activeTasks.filter(
    (task) => task.status === "todo"
  );

  return (
    <AuthGuard>
      <AppShell>
        <div className="page min-h-screen pb-28">
          <div className="mx-auto max-w-[1400px]">

          {/* ========================================================= */}
          {/* HERO */}
          {/* ========================================================= */}

          <section className="relative overflow-hidden rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-[0_12px_40px_rgba(99,102,241,0.04)] sm:p-7">

            <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/[0.06] blur-3xl" />

            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-violet-500">

                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />

                  Personal Productivity OS

                </div>

                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--nexus-text)] sm:text-4xl">
                  {getGreeting()}
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--nexus-muted)]">
                  Your workspace is ready. Focus on the next
                  meaningful action and let momentum compound.
                </p>

              </div>

              <div className="flex items-center gap-3">

                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-500/15 bg-violet-500/10 text-sm font-semibold text-violet-600">
                  {getInitials()}
                </div>

                <div>

                  <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--nexus-muted)]">
                    Workspace
                  </p>

                  <p className="mt-1 text-xs font-medium text-[var(--nexus-text)]">
                    NEXUS Command Center
                  </p>

                </div>

              </div>

            </div>

          </section>


          {/* ========================================================= */}
          {/* COMMAND CENTER */}
          {/* ========================================================= */}

          <section className="mt-6 overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.10] via-[var(--nexus-surface)] to-[var(--nexus-bg)] shadow-[0_16px_50px_rgba(139,92,246,0.06)]">

            <div className="grid lg:grid-cols-[1fr_340px]">

              <div className="p-5 sm:p-7">

                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-violet-500">

                  <Zap size={13} />

                  Today&apos;s command center

                </div>

                {nextTask ? (
                  <>
                    <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight text-[var(--nexus-text)] sm:text-3xl">
                      Make progress on what matters most.
                    </h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--nexus-muted)]">
                      Your next best action is{" "}
                      <span className="font-medium text-[var(--nexus-text)]">
                        “{nextTask.title}”
                      </span>
                      .
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">

                      <Link
                        href="/projects"
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <Play size={16} />
                        Start task
                      </Link>

                      <Link
                        href="/focus"
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <Target size={16} />
                        Deep Focus
                      </Link>

                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 text-2xl font-semibold text-[var(--nexus-text)] sm:text-3xl">
                      Your workspace is clear.
                    </h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--nexus-muted)]">
                      Capture something new and turn your next
                      idea into momentum.
                    </p>

                    <div className="mt-6">

                      <Link
                        href="/projects"
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        Create your next task
                        <ArrowRight size={16} />
                      </Link>

                    </div>
                  </>
                )}

              </div>


              {/* MOMENTUM */}

              <div className="border-t border-[var(--nexus-border)] bg-black/[0.02] p-5 lg:border-l lg:border-t-0 sm:p-7">

                <div className="flex items-center gap-2">

                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
                    <TrendingUp size={16} />
                  </span>

                  <div>

                    <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--nexus-muted)]">
                      Momentum
                    </p>

                    <p className="mt-0.5 text-sm font-medium text-[var(--nexus-text)]">
                      {stats.productivity >= 70
                        ? "Strong"
                        : stats.productivity >= 40
                          ? "Building"
                          : "Starting"}
                    </p>

                  </div>

                </div>


                <div className="mt-6 flex items-center gap-5">

                  <div
                    className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(#8b5cf6 ${stats.productivity}%, var(--nexus-surface-3) ${stats.productivity}% 100%)`,
                    }}
                  >

                    <div className="grid h-[94px] w-[94px] place-items-center rounded-full bg-[var(--nexus-surface)]">

                      <div className="text-center">

                        <p className="text-2xl font-semibold tabular-nums text-[var(--nexus-text)]">
                          {stats.productivity}
                        </p>

                        <p className="text-[8px] uppercase tracking-[0.16em] text-[var(--nexus-muted)]">
                          score
                        </p>

                      </div>

                    </div>

                  </div>


                  <div>

                    <p className="text-xs leading-5 text-[var(--nexus-muted)]">
                      Based on your current task completion
                      and focus activity.
                    </p>

                    <div className="mt-4 flex items-center gap-2">

                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />

                      <span className="text-[10px] text-[var(--nexus-muted)]">
                        Keep the streak alive
                      </span>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </section>


          {/* ========================================================= */}
          {/* METRICS */}
          {/* ========================================================= */}

          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">

            {/* ACTIVE */}

            <div className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-4 shadow-sm sm:p-5">

              <div className="flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--nexus-muted)]">
                  Active
                </span>

                <Circle
                  size={14}
                  className="text-violet-500"
                />

              </div>

              <p className="mt-4 text-2xl font-semibold tabular-nums text-[var(--nexus-text)]">
                {activeTasks.length}
              </p>

              <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                tasks remaining
              </p>

            </div>


            {/* COMPLETED */}

            <div className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-4 shadow-sm sm:p-5">

              <div className="flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--nexus-muted)]">
                  Completed
                </span>

                <CheckCircle2
                  size={14}
                  className="text-emerald-500"
                />

              </div>

              <p className="mt-4 text-2xl font-semibold tabular-nums text-[var(--nexus-text)]">
                {completedTasks.length}
              </p>

              <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                {completionRate}% completion rate
              </p>

            </div>


            {/* FOCUS */}

            <div className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-4 shadow-sm sm:p-5">

              <div className="flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--nexus-muted)]">
                  Focus
                </span>

                <Clock3
                  size={14}
                  className="text-sky-500"
                />

              </div>

              <p className="mt-4 text-2xl font-semibold tabular-nums text-[var(--nexus-text)]">
                {formatMinutes(stats.totalFocusMinutes)}
              </p>

              <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                {stats.sessionsCompleted} sessions
              </p>

            </div>


            {/* ATTENTION */}

            <div className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-4 shadow-sm sm:p-5">

              <div className="flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--nexus-muted)]">
                  Attention
                </span>

                <Flame
                  size={14}
                  className={
                    overdueTasks.length > 0
                      ? "text-rose-500"
                      : "text-amber-500"
                  }
                />

              </div>

              <p
                className={`mt-4 text-2xl font-semibold tabular-nums ${
                  overdueTasks.length > 0
                    ? "text-rose-500"
                    : "text-[var(--nexus-text)]"
                }`}
              >
                {overdueTasks.length}
              </p>

              <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                overdue tasks
              </p>

            </div>

          </section>


          {/* ========================================================= */}
          {/* MAIN GRID */}
          {/* ========================================================= */}

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">

            {/* PRIORITY WORK */}

            <div className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] shadow-sm">

              <div className="flex items-center justify-between border-b border-[var(--nexus-border)] p-5">

                <div>

                  <div className="flex items-center gap-2">

                    <Target
                      size={15}
                      className="text-violet-500"
                    />

                    <h2 className="text-sm font-semibold text-[var(--nexus-text)]">
                      Priority work
                    </h2>

                  </div>


                </div>

                <Link
                  href="/projects"
                  className="text-[10px] font-medium text-violet-500 transition hover:text-violet-600"
                >
                  View all
                </Link>

              </div>


              <div className="divide-y divide-[var(--nexus-border)]">

                {highPriorityTasks.length > 0 ? (
                  highPriorityTasks
                    .slice(0, 5)
                    .map((task) => (
                      <Link
                        href="/projects"
                        key={task.id}
                        className="flex items-center gap-4 p-5 transition hover:bg-violet-500/[0.025]"
                      >

                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500">

                          {task.status === "in-progress" ? (
                            <Zap size={15} />
                          ) : (
                            <Circle size={15} />
                          )}

                        </div>


                        <div className="min-w-0 flex-1">

                          <p className="truncate text-xs font-medium text-[var(--nexus-text)]">
                            {task.title}
                          </p>

                          <div className="mt-2 flex items-center gap-3">

                            <span className="text-[9px] text-[var(--nexus-muted)]">
                              {task.status ===
                              "in-progress"
                                ? "In progress"
                                : "To do"}
                            </span>

                            {task.dueDate && (
                              <span
                                className={`flex items-center gap-1 text-[9px] ${
                                  isOverdue(task)
                                    ? "text-rose-500"
                                    : "text-[var(--nexus-muted)]"
                                }`}
                              >
                                <CalendarDays size={10} />

                                {formatDueDate(
                                  task.dueDate
                                )}
                              </span>
                            )}

                          </div>

                        </div>


                        <ArrowRight
                          size={15}
                          className="shrink-0 text-[var(--nexus-muted)]"
                        />

                      </Link>
                    ))
                ) : (
                  <div className="p-8 text-center">

                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 size={17} />
                    </div>

                    <p className="mt-3 text-xs font-medium text-[var(--nexus-text)]">
                      Priority queue is clear
                    </p>

                    <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                      Nice work. Keep the momentum going.
                    </p>

                  </div>
                )}

              </div>

            </div>


            {/* TODAY */}

            <div className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] shadow-sm">

              <div className="border-b border-[var(--nexus-border)] p-5">

                <div className="flex items-center gap-2">

                  <CalendarDays
                    size={15}
                    className="text-[var(--nexus-muted)]"
                  />

                  <h2 className="text-sm font-semibold text-[var(--nexus-text)]">
                    Today
                  </h2>

                </div>

                <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                  Your immediate execution list
                </p>

              </div>


              <div className="p-4">

                {todayTasks.length > 0 ? (
                  <div className="space-y-2">

                    {todayTasks.map((task) => (
                      <Link
                        key={task.id}
                        href="/projects"
                        className="flex items-center gap-3 rounded-xl border border-[var(--nexus-border)] bg-[var(--nexus-bg)] p-3 transition hover:border-violet-500/20 hover:bg-violet-500/[0.025]"
                      >

                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-500">
                          <Circle size={13} />
                        </span>

                        <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--nexus-text)]">
                          {task.title}
                        </span>

                        <ArrowRight
                          size={13}
                          className="shrink-0 text-[var(--nexus-muted)]"
                        />

                      </Link>
                    ))}

                  </div>
                ) : (
                  <div className="py-7 text-center">

                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[var(--nexus-bg)] text-[var(--nexus-muted)]">
                      <CalendarDays size={16} />
                    </div>

                    <p className="mt-3 text-xs text-[var(--nexus-text)]">
                      Nothing due today
                    </p>

                    <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                      A clean schedule is a good schedule.
                    </p>

                  </div>
                )}


                <Link
                  href="/projects"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--nexus-border)] py-2.5 text-[10px] font-medium text-[var(--nexus-muted)] transition hover:border-violet-500/20 hover:bg-violet-500/[0.025] hover:text-violet-500"
                >
                  Open workspace
                  <ArrowRight size={13} />
                </Link>

              </div>

            </div>

          </section>


          {/* ========================================================= */}
          {/* EXECUTION STATUS */}
          {/* ========================================================= */}

          <section className="mt-6 rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm sm:p-6">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <TrendingUp
                    size={15}
                    className="text-violet-500"
                  />

                  <h2 className="text-sm font-semibold text-[var(--nexus-text)]">
                    Execution status
                  </h2>

                </div>

                <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">
                  Your current distribution of work
                </p>

              </div>


              <div className="flex items-center gap-5 text-[10px]">

                <span className="flex items-center gap-2 text-[var(--nexus-muted)]">

                  <span className="h-2 w-2 rounded-full bg-zinc-500" />

                  {queuedTasks.length} queued

                </span>


                <span className="flex items-center gap-2 text-[var(--nexus-muted)]">

                  <span className="h-2 w-2 rounded-full bg-violet-500" />

                  {inProgressTasks.length} active

                </span>


                <span className="flex items-center gap-2 text-[var(--nexus-muted)]">

                  <span className="h-2 w-2 rounded-full bg-emerald-500" />

                  {completedTasks.length} done

                </span>

              </div>

            </div>


            <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--nexus-surface-3)]">

              <div className="flex h-full">

                <div
                  className="bg-zinc-500 transition-all"
                  style={{
                    width:
                      tasks.length > 0
                        ? `${
                            (queuedTasks.length /
                              tasks.length) *
                            100
                          }%`
                        : "0%",
                  }}
                />

                <div
                  className="bg-violet-500 transition-all"
                  style={{
                    width:
                      tasks.length > 0
                        ? `${
                            (inProgressTasks.length /
                              tasks.length) *
                            100
                          }%`
                        : "0%",
                  }}
                />

                <div
                  className="bg-emerald-500 transition-all"
                  style={{
                    width:
                      tasks.length > 0
                        ? `${
                            (completedTasks.length /
                              tasks.length) *
                            100
                          }%`
                        : "0%",
                  }}
                />

              </div>

            </div>

          </section>


          {/* ========================================================= */}
          {/* QUICK ACTIONS */}
          {/* ========================================================= */}

          <section className="mt-6 grid gap-3 sm:grid-cols-3">

            <Link
              href="/projects"
              className="group rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500/20 hover:shadow-md"
            >

              <div className="flex items-center justify-between">

                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
                  <Target size={16} />
                </span>

                <ArrowRight
                  size={15}
                  className="text-[var(--nexus-muted)] transition group-hover:translate-x-0.5 group-hover:text-violet-500"
                />

              </div>

              <h3 className="mt-4 text-xs font-semibold text-[var(--nexus-text)]">
                Manage tasks
              </h3>

              <p className="mt-1 text-[10px] leading-5 text-[var(--nexus-muted)]">
                Organize priorities and move work forward.
              </p>

            </Link>


            <Link
              href="/focus"
              className="group rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500/20 hover:shadow-md"
            >

              <div className="flex items-center justify-between">

                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
                  <Clock3 size={16} />
                </span>

                <ArrowRight
                  size={15}
                  className="text-[var(--nexus-muted)] transition group-hover:translate-x-0.5 group-hover:text-violet-500"
                />

              </div>

              <h3 className="mt-4 text-xs font-semibold text-[var(--nexus-text)]">
                Start deep work
              </h3>

              <p className="mt-1 text-[10px] leading-5 text-[var(--nexus-muted)]">
                Protect a focused block and execute without noise.
              </p>

            </Link>


            <Link
              href="/analytics"
              className="group rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500/20 hover:shadow-md"
            >

              <div className="flex items-center justify-between">

                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <TrendingUp size={16} />
                </span>

                <ArrowRight
                  size={15}
                  className="text-[var(--nexus-muted)] transition group-hover:translate-x-0.5 group-hover:text-violet-500"
                />

              </div>

              <h3 className="mt-4 text-xs font-semibold text-[var(--nexus-text)]">
                Review analytics
              </h3>

              <p className="mt-1 text-[10px] leading-5 text-[var(--nexus-muted)]">
                Understand where your time and momentum are going.
              </p>

            </Link>

          </section>

          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export default Dashboard;