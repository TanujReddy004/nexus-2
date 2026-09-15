"use client";

import AppShell from "@/components/app-shell";
import AuthGuard from "@/components/auth-guard";
import {
  ArrowRight,
  Inbox,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getTasks,
  type Task,
} from "@/lib/workspace-store";

export default function InboxPage() {
  const [tasks, setTasks] =
    useState<Task[]>([]);

  useEffect(() => {
    const load = () => {
      setTasks(
        getTasks().filter(
          (task) =>
            task.status !==
            "completed"
        )
      );
    };

    load();

    window.addEventListener(
      "nexus-data-change",
      load
    );

    return () =>
      window.removeEventListener(
        "nexus-data-change",
        load
      );
  }, []);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page min-h-screen px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <p className="eyebrow text-violet-500">
                INBOX
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Capture everything.
              </h1>

              <p className="mt-2 text-sm text-[var(--nexus-muted)]">
                Your uncompleted work, ready to
                become execution.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="nexus-settings-card">
                <Inbox
                  size={18}
                  className="text-violet-500"
                />

                <p className="mt-4 text-2xl font-semibold">
                  {tasks.length}
                </p>

                <p className="mt-1 text-xs text-[var(--nexus-muted)]">
                  Active captures
                </p>
              </div>

              <div className="nexus-settings-card">
                <Zap
                  size={18}
                  className="text-cyan-500"
                />

                <p className="mt-4 text-2xl font-semibold">
                  {tasks.filter(
                    (task) =>
                      task.priority ===
                      "high"
                  ).length}
                </p>

                <p className="mt-1 text-xs text-[var(--nexus-muted)]">
                  High priority
                </p>
              </div>

              <div className="nexus-settings-card">
                <Sparkles
                  size={18}
                  className="text-emerald-500"
                />

                <p className="mt-4 text-2xl font-semibold">
                  Ready
                </p>

                <p className="mt-1 text-xs text-[var(--nexus-muted)]">
                  Execution queue online
                </p>
              </div>
            </div>

            <section className="mt-5 overflow-hidden rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)]">
              <div className="border-b border-[var(--nexus-border)] p-5">
                <p className="text-sm font-semibold">
                  Active queue
                </p>

                <p className="mt-1 text-xs text-[var(--nexus-muted)]">
                  Tasks that still need movement.
                </p>
              </div>

              {tasks.length === 0 ? (
                <div className="grid min-h-64 place-items-center p-8 text-center">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-500">
                      <Inbox size={20} />
                    </div>

                    <p className="mt-4 text-sm font-semibold">
                      Inbox zero.
                    </p>

                    <p className="mt-1 text-xs text-[var(--nexus-muted)]">
                      Capture your next meaningful
                      action with Quick Add.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 border-b border-[var(--nexus-border)] p-5 last:border-b-0"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
                        <Zap size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {task.title}
                        </p>

                        <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--nexus-muted)]">
                          <span className="capitalize">
                            {task.priority}
                          </span>

                          <span>
                            {task.progress}%
                          </span>
                        </div>
                      </div>

                      <ArrowRight
                        size={16}
                        className="text-[var(--nexus-muted)]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}