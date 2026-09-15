"use client";

import AppShell from "@/components/app-shell";
import AuthGuard from "@/components/auth-guard";
import {
  Activity,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import {
  getFocusSessions,
  getTasks,
  type FocusSession,
  type Task,
} from "@/lib/workspace-store";

type Range = "daily" | "weekly" | "monthly" | "yearly";
type ChartPoint = {
  label: string;
  focus: number;
  sessions: number;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function startOfYear(date: Date) {
  const d = startOfDay(date);
  d.setMonth(0, 1);
  return d;
}

function addDays(date: Date, amount: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function addMonths(date: Date, amount: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + amount);
  return d;
}

function addYears(date: Date, amount: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + amount);
  return d;
}

function formatFocusTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function periodLabel(range: Range) {
  if (range === "daily") return "Today";
  if (range === "weekly") return "This week";
  if (range === "monthly") return "This month";
  return "This year";
}

function buildChart(
  range: Range,
  sessions: FocusSession[]
): ChartPoint[] {
  const now = new Date();

  if (range === "daily") {
    return Array.from({ length: 12 }, (_, index) => {
      const hour = index * 2;
      const focus = sessions
        .filter((session) => {
          const date = new Date(session.completedAt);
          return (
            date.toDateString() === now.toDateString() &&
            date.getHours() >= hour &&
            date.getHours() < hour + 2
          );
        })
        .reduce((sum, session) => sum + session.duration, 0);

      return {
        label: `${String(hour).padStart(2, "0")}:00`,
        focus,
        sessions: sessions.filter((session) => {
          const date = new Date(session.completedAt);
          return (
            date.toDateString() === now.toDateString() &&
            date.getHours() >= hour &&
            date.getHours() < hour + 2
          );
        }).length,
      };
    });
  }

  if (range === "weekly") {
    const start = startOfWeek(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = date.toDateString();
      const matching = sessions.filter(
        (session) => new Date(session.completedAt).toDateString() === key
      );
      return {
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        focus: matching.reduce((sum, session) => sum + session.duration, 0),
        sessions: matching.length,
      };
    });
  }

  if (range === "monthly") {
    const start = startOfMonth(now);
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = addDays(start, index);
      const key = date.toDateString();
      const matching = sessions.filter(
        (session) => new Date(session.completedAt).toDateString() === key
      );
      return {
        label: String(index + 1),
        focus: matching.reduce((sum, session) => sum + session.duration, 0),
        sessions: matching.length,
      };
    });
  }

  const start = startOfYear(now);
  return Array.from({ length: 12 }, (_, index) => {
    const monthStart = addMonths(start, index);
    const month = monthStart.getMonth();
    const matching = sessions.filter((session) => {
      const date = new Date(session.completedAt);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === month
      );
    });
    return {
      label: monthStart.toLocaleDateString("en-US", { month: "short" }),
      focus: matching.reduce((sum, session) => sum + session.duration, 0),
      sessions: matching.length,
    };
  });
}

function getRangeStart(range: Range, date = new Date()) {
  if (range === "daily") return startOfDay(date);
  if (range === "weekly") return startOfWeek(date);
  if (range === "monthly") return startOfMonth(date);
  return startOfYear(date);
}

function getPreviousRangeStart(range: Range, date = new Date()) {
  if (range === "daily") return addDays(startOfDay(date), -1);
  if (range === "weekly") return addDays(startOfWeek(date), -7);
  if (range === "monthly") return addMonths(startOfMonth(date), -1);
  return addYears(startOfYear(date), -1);
}

function getRangeEnd(range: Range, start: Date) {
  if (range === "daily") return addDays(start, 1);
  if (range === "weekly") return addDays(start, 7);
  if (range === "monthly") return addMonths(start, 1);
  return addYears(start, 1);
}

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [range, setRange] = useState<Range>("weekly");

  useEffect(() => {
    const refresh = () => {
      setTasks(getTasks());
      setSessions(getFocusSessions());
    };

    refresh();
    window.addEventListener("nexus-data-change", refresh);
    return () => window.removeEventListener("nexus-data-change", refresh);
  }, []);

  const analytics = useMemo(() => {
    const now = new Date();
    const start = getRangeStart(range, now);
    const end = getRangeEnd(range, start);
    const previousStart = getPreviousRangeStart(range, now);
    const previousEnd = start;
    const inRange = sessions.filter((session) => {
      const date = new Date(session.completedAt);
      return date >= start && date < end;
    });
    const previous = sessions.filter((session) => {
      const date = new Date(session.completedAt);
      return date >= previousStart && date < previousEnd;
    });

    const focus = inRange.reduce((sum, session) => sum + session.duration, 0);
    const previousFocus = previous.reduce(
      (sum, session) => sum + session.duration,
      0
    );
    const completed = tasks.filter((task) => task.status === "completed");
    const active = tasks.filter((task) => task.status !== "completed");
    const completionRate = tasks.length
      ? Math.round((completed.length / tasks.length) * 100)
      : 0;
    const averageSession = inRange.length
      ? Math.round(focus / inRange.length)
      : 0;
    const averageProgress = tasks.length
      ? Math.round(
          tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length
        )
      : 0;

    const dailyKeys = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(startOfDay(now), -29 + index);
      return date.toDateString();
    });
    const dailyMinutes = dailyKeys.map((key) =>
      sessions
        .filter((session) => new Date(session.completedAt).toDateString() === key)
        .reduce((sum, session) => sum + session.duration, 0)
    );

    let streak = 0;
    for (let index = dailyMinutes.length - 1; index >= 0; index--) {
      if (dailyMinutes[index] > 0) streak += 1;
      else if (index !== dailyMinutes.length - 1) break;
    }

    const peakSession = inRange.reduce<FocusSession | null>(
      (best, session) => (!best || session.duration > best.duration ? session : best),
      null
    );

    const peakHour = inRange.length
      ? inRange.reduce<Record<number, number>>((map, session) => {
          const hour = new Date(session.completedAt).getHours();
          map[hour] = (map[hour] || 0) + session.duration;
          return map;
        }, {})
      : {};
    const bestHour = Object.entries(peakHour).sort((a, b) => b[1] - a[1])[0];

    const consistency = Math.min(
      100,
      Math.round(
        ((inRange.length ? Math.min(inRange.length / 5, 1) : 0) * 50) +
          ((averageSession ? Math.min(averageSession / 45, 1) : 0) * 50)
      )
    );

    const score = Math.min(
      100,
      Math.round(
        completionRate * 0.35 +
          averageProgress * 0.25 +
          Math.min(focus / (range === "daily" ? 60 : range === "weekly" ? 240 : 900), 1) * 100 * 0.25 +
          consistency * 0.15
      )
    );

    return {
      focus,
      previousFocus,
      sessions: inRange.length,
      completed: completed.length,
      active: active.length,
      completionRate,
      averageSession,
      averageProgress,
      streak,
      consistency,
      score,
      peakSession,
      bestHour,
      chart: buildChart(range, sessions),
      focusChange: percentChange(focus, previousFocus),
    };
  }, [range, sessions, tasks]);

  const priorityData = useMemo(
    () =>
      [
        { name: "High", value: tasks.filter((task) => task.priority === "high").length },
        { name: "Medium", value: tasks.filter((task) => task.priority === "medium").length },
        { name: "Low", value: tasks.filter((task) => task.priority === "low").length },
      ].filter((item) => item.value > 0),
    [tasks]
  );

  const topTasks = useMemo(() => {
    const weight = { high: 3, medium: 2, low: 1 };
    return [...tasks]
      .filter((task) => task.status !== "completed")
      .sort(
        (a, b) =>
          weight[b.priority] - weight[a.priority] || b.progress - a.progress
      )
      .slice(0, 4);
  }, [tasks]);

  const insight = useMemo(() => {
    if (analytics.focus === 0) {
      return {
        title: "Build the baseline first.",
        text: "Complete one focused session today. NEXUS will use it to learn your working rhythm.",
      };
    }
    if (analytics.focusChange > 20) {
      return {
        title: "Your momentum is accelerating.",
        text: `Focus time is up ${analytics.focusChange}% versus the previous period. Protect the routine that created this lift.`,
      };
    }
    if (analytics.focusChange < -20) {
      return {
        title: "Your focus dipped.",
        text: `Focus time is down ${Math.abs(analytics.focusChange)}%. Start with one short, distraction-free session to recover momentum.`,
      };
    }
    return {
      title: "Consistency is your advantage.",
      text: `Your average focus session is ${analytics.averageSession} minutes. Keep the rhythm stable before increasing intensity.`,
    };
  }, [analytics]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page min-h-screen pb-28">
          <div className="mx-auto max-w-[1400px]">
            <header className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-600">
                    <BarChart3 size={13} /> Analytics
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                    Your momentum.
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--nexus-muted)]">
                    See how you work, when you focus best, and whether your momentum is improving.
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.08] to-cyan-500/[0.08] p-1.5 shadow-[0_0_35px_rgba(124,58,237,.08)]">
                  <div className="flex flex-wrap gap-1">
                    {(["daily", "weekly", "monthly", "yearly"] as Range[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setRange(item)}
                        className="rounded-xl px-3 py-2 text-[10px] font-semibold capitalize transition"
                        style={{
                          background:
                            range === item ? "linear-gradient(135deg, rgba(124,58,237,.95), rgba(139,92,246,.85))" : "transparent",
                          color: range === item ? "white" : "var(--nexus-muted)",
                          boxShadow: range === item ? "0 6px 18px rgba(124,58,237,.22)" : "none",
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={<Brain size={17} />} iconClass="bg-violet-500/10 text-violet-600" label="Productivity score" value={`${analytics.score}`} suffix="/ 100" detail={`${periodLabel(range)} performance`} accent />
              <MetricCard icon={<Clock3 size={17} />} iconClass="bg-sky-500/10 text-sky-600" label="Focus time" value={formatFocusTime(analytics.focus)} detail={`${analytics.sessions} sessions`} />
              <MetricCard icon={<CheckCircle2 size={17} />} iconClass="bg-emerald-500/10 text-emerald-600" label="Completion" value={`${analytics.completionRate}%`} detail={`${analytics.completed} of ${tasks.length} tasks complete`} />
              <MetricCard icon={<Flame size={17} />} iconClass="bg-amber-500/10 text-amber-600" label="Focus streak" value={`${analytics.streak}`} suffix="days" detail="Recent consecutive focus days" />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
              <section className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-4 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-violet-600"><TrendingUp size={14} /><p className="eyebrow">Focus trend</p></div>
                    <h2 className="mt-2 text-lg font-semibold">{periodLabel(range)} at a glance</h2>
                    <p className="mt-1 text-xs text-[var(--nexus-muted)]">Deep work minutes across the selected view.</p>
                  </div>
                  <div className="rounded-xl border border-[var(--nexus-border)] bg-[var(--nexus-surface-2)] px-3 py-2 text-right">
                    <p className="eyebrow">vs previous</p>
                    <p className={`mt-1 text-xs font-semibold ${analytics.focusChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {analytics.focusChange >= 0 ? "+" : ""}{analytics.focusChange}%
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {range === "daily" || range === "monthly" ? (
                      <BarChart data={analytics.chart} margin={{ top: 5, right: 2, left: -28, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--nexus-border)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--nexus-muted)", fontSize: 9 }} interval={range === "monthly" ? 2 : 0} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--nexus-muted)", fontSize: 8 }} />
                        <Tooltip contentStyle={{ background: "var(--nexus-surface)", border: "1px solid var(--nexus-border-strong)", borderRadius: "10px", color: "var(--nexus-text)", fontSize: "10px" }} formatter={(value) => [`${value} min`, "Focus"]} />
                        <Bar dataKey="focus" fill="#8b5cf6" radius={[5, 5, 2, 2]} maxBarSize={34} />
                      </BarChart>
                    ) : (
                      <LineChart data={analytics.chart} margin={{ top: 5, right: 8, left: -28, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--nexus-border)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--nexus-muted)", fontSize: 9 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--nexus-muted)", fontSize: 8 }} />
                        <Tooltip contentStyle={{ background: "var(--nexus-surface)", border: "1px solid var(--nexus-border-strong)", borderRadius: "10px", color: "var(--nexus-text)", fontSize: "10px" }} formatter={(value) => [`${value} min`, "Focus"]} />
                        <Line type="monotone" dataKey="focus" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2 text-cyan-600"><Gauge size={14} /><p className="eyebrow">Consistency engine</p></div>
                <h2 className="mt-2 text-lg font-semibold">How steady are you?</h2>
                <div className="mt-6 flex items-center justify-center">
                  <div className="relative grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(#06b6d4 ${analytics.consistency}%, var(--nexus-surface-3) ${analytics.consistency}% 100%)` }}>
                    <div className="grid h-[calc(100%-12px)] w-[calc(100%-12px)] place-items-center rounded-full bg-[var(--nexus-surface)]">
                      <div className="text-center"><p className="text-3xl font-semibold">{analytics.consistency}</p><p className="eyebrow mt-1">/ 100</p></div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <InsightRow icon={<Flame size={14} />} label="Streak" value={`${analytics.streak} days`} />
                  <InsightRow icon={<Clock3 size={14} />} label="Average session" value={`${analytics.averageSession}m`} />
                  <InsightRow icon={<Zap size={14} />} label="Best session" value={analytics.peakSession ? `${analytics.peakSession.duration}m` : "—"} />
                </div>
              </section>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-3">
              <section className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm">
                <div className="flex items-center gap-2 text-amber-600"><Trophy size={14} /><p className="eyebrow">Peak performance</p></div>
                <h2 className="mt-2 text-lg font-semibold">Your best focus window</h2>
                <p className="mt-1 text-xs text-[var(--nexus-muted)]">Based on completed sessions in this view.</p>
                <div className="mt-6 rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-4">
                  <p className="text-2xl font-semibold">{analytics.bestHour ? `${String(Number(analytics.bestHour[0])).padStart(2, "0")}:00` : "Not enough data"}</p>
                  <p className="mt-1 text-[10px] text-[var(--nexus-muted)]">Highest accumulated focus hour</p>
                </div>
              </section>

              <section className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600"><Target size={14} /><p className="eyebrow">Workload</p></div>
                <h2 className="mt-2 text-lg font-semibold">Priority mix</h2>
                <div className="mt-3 h-[150px]">
                  {priorityData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} stroke="none">
                        {priorityData.map((item) => <Cell key={item.name} fill={item.name === "High" ? "#ef4444" : item.name === "Medium" ? "#f59e0b" : "#10b981"} />)}
                      </Pie><Tooltip contentStyle={{ background: "var(--nexus-surface)", border: "1px solid var(--nexus-border-strong)", borderRadius: "10px", fontSize: "10px" }} /></PieChart>
                    </ResponsiveContainer>
                  ) : <div className="grid h-full place-items-center text-xs text-[var(--nexus-muted)]">No task data yet.</div>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {priorityData.map((item) => <div key={item.name}><p className="text-lg font-semibold">{item.value}</p><p className="text-[9px] text-[var(--nexus-muted)]">{item.name}</p></div>)}
                </div>
              </section>

              <section className="relative overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.08] to-[var(--nexus-surface)] p-5 shadow-sm">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-violet-600"><Zap size={14} /><p className="eyebrow text-violet-600">NEXUS Insight</p></div>
                  <h2 className="mt-3 text-lg font-semibold">{insight.title}</h2>
                  <p className="mt-3 text-xs leading-6 text-[var(--nexus-muted)]">{insight.text}</p>
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-violet-500/10 bg-violet-500/[0.05] p-3">
                    {analytics.focusChange >= 0 ? <TrendingUp size={15} className="text-emerald-500" /> : <TrendingDown size={15} className="text-rose-500" />}
                    <p className="text-[10px] text-[var(--nexus-muted)]">{analytics.focusChange >= 0 ? "Momentum is moving in the right direction." : "A small recovery session can reset the trend."}</p>
                  </div>
                </div>
              </section>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-sky-600"><Activity size={14} /><p className="eyebrow">Execution</p></div><h2 className="mt-2 text-lg font-semibold">Task progress</h2><p className="mt-1 text-xs text-[var(--nexus-muted)]">Average progress across your workspace.</p></div><span className="text-2xl font-semibold text-sky-600">{analytics.averageProgress}%</span></div>
                <div className="mt-7 h-2.5 overflow-hidden rounded-full bg-[var(--nexus-surface-3)]"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500" style={{ width: `${analytics.averageProgress}%` }} /></div>
                <div className="mt-5 grid grid-cols-3 gap-2"><MiniStat label="Total" value={tasks.length} /><MiniStat label="Active" value={analytics.active} /><MiniStat label="Complete" value={analytics.completed} /></div>
              </section>

              <section className="rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2 text-violet-600"><CalendarDays size={14} /><p className="eyebrow">Selected period</p></div>
                <h2 className="mt-2 text-lg font-semibold">Activity summary</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Focus" value={formatFocusTime(analytics.focus)} />
                  <MiniStat label="Sessions" value={analytics.sessions} />
                  <MiniStat label="Avg" value={`${analytics.averageSession}m`} />
                  <MiniStat label="Score" value={analytics.score} />
                </div>
              </section>
            </section>

            <section className="mt-5 rounded-3xl border border-[var(--nexus-border)] bg-[var(--nexus-surface)] p-4 shadow-sm sm:p-6">
              <div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-violet-600"><Target size={13} /><p className="eyebrow">Execution queue</p></div><h2 className="mt-2 text-lg font-semibold">Where attention should go</h2><p className="mt-1 text-xs text-[var(--nexus-muted)]">Highest-impact active tasks.</p></div><span className="text-[10px] text-[var(--nexus-muted)]">{topTasks.length} recommended</span></div>
              {topTasks.length ? <div className="mt-4 grid gap-2 lg:grid-cols-2">{topTasks.map((task, index) => <div key={task.id} className="rounded-2xl border border-[var(--nexus-border)] bg-[var(--nexus-surface-2)] p-3.5 transition hover:border-violet-500/20"><div className="flex items-start gap-3"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-[9px] font-semibold text-violet-600">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-xs font-medium">{task.title}</p><span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[7px]">{task.priority}</span></div><div className="mt-2.5 flex items-center gap-2"><div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--nexus-surface-3)]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${task.progress}%` }} /></div><span className="text-[8px] text-[var(--nexus-muted)]">{task.progress}%</span></div></div></div></div>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[var(--nexus-border)] py-8 text-center"><CheckCircle2 size={22} className="mx-auto text-emerald-500/60" /><p className="mt-2 text-xs text-[var(--nexus-muted)]">Everything is under control.</p></div>}
            </section>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function MetricCard({ icon, iconClass, label, value, suffix, detail, accent = false }: { icon: React.ReactNode; iconClass: string; label: string; value: string; suffix?: string; detail: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-violet-500/20 bg-violet-500/[0.045]" : "border-[var(--nexus-border)] bg-[var(--nexus-surface)]"}`}><div className={`grid h-9 w-9 place-items-center rounded-xl ${iconClass}`}>{icon}</div><p className="mt-5 eyebrow">{label}</p><div className="mt-1 flex items-end gap-1.5"><span className="text-3xl font-semibold">{value}</span>{suffix && <span className="mb-1 text-xs text-[var(--nexus-muted)]">{suffix}</span>}</div><p className="mt-2 text-[10px] text-[var(--nexus-muted)]">{detail}</p></div>;
}

function InsightRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[var(--nexus-border)] bg-[var(--nexus-surface-2)] p-3"><div className="text-violet-600">{icon}</div><span className="flex-1 text-[10px] text-[var(--nexus-muted)]">{label}</span><span className="text-[10px] font-semibold">{value}</span></div>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-[var(--nexus-border)] bg-[var(--nexus-surface-2)] p-3 text-center"><p className="text-sm font-semibold">{value}</p><p className="mt-1 text-[9px] text-[var(--nexus-muted)]">{label}</p></div>;
}
