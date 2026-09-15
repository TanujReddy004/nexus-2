import type { Task, FocusSession } from "@/lib/workspace-store";

export type IntelligenceSignal = {
  type: "focus" | "priority" | "progress" | "overdue" | "momentum";
  title: string;
  message: string;
  action?: string;
  score: number;
};

export type NexusIntelligence = {
  score: number;
  status: "excellent" | "strong" | "balanced" | "attention";
  headline: string;
  summary: string;
  signals: IntelligenceSignal[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDaysDifference(date: string) {
  const target = new Date(`${date}T23:59:59`);
  const now = new Date();

  return Math.ceil(
    (target.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export function getIntelligence(
  tasks: Task[],
  sessions: FocusSession[]
): NexusIntelligence {
  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return {
      score: 0,
      status: "attention",
      headline: "Workspace is waiting.",
      summary:
        "Create your first task and NEXUS will begin learning your execution pattern.",
      signals: [
        {
          type: "momentum",
          title: "Start your workspace",
          message:
            "Add a meaningful task to begin building your productivity signal.",
          action: "Create task",
          score: 0,
        },
      ],
    };
  }

  const completed = tasks.filter(
    (task) => task.status === "completed"
  );

  const active = tasks.filter(
    (task) => task.status === "in-progress"
  );

  const highPriorityOpen = tasks.filter(
    (task) =>
      task.priority === "high" &&
      task.status !== "completed"
  );

  const overdue = tasks.filter((task) => {
    if (!task.dueDate || task.status === "completed") {
      return false;
    }

    return getDaysDifference(task.dueDate) < 0;
  });

  const averageProgress =
    tasks.reduce(
      (sum, task) => sum + clamp(task.progress || 0, 0, 100),
      0
    ) / totalTasks;

  const completionRate =
    (completed.length / totalTasks) * 100;

  const focusMinutes = sessions.reduce(
    (sum, session) => sum + session.duration,
    0
  );

  const recentSessions = sessions.filter((session) => {
    const date = new Date(session.completedAt);
    const now = new Date();

    return (
      now.getTime() - date.getTime() <=
      7 * 24 * 60 * 60 * 1000
    );
  });

  const recentFocusMinutes = recentSessions.reduce(
    (sum, session) => sum + session.duration,
    0
  );

  /*
   * NEXUS EXECUTION SCORE
   *
   * The score combines:
   * - completed work
   * - task progress
   * - active execution
   * - focus consistency
   * - overdue pressure
   * - unresolved high priority work
   */

  let score = 0;

  score += completionRate * 0.35;
  score += averageProgress * 0.25;

  if (active.length > 0) {
    score += 10;
  }

  if (recentFocusMinutes >= 180) {
    score += 15;
  } else if (recentFocusMinutes >= 90) {
    score += 10;
  } else if (recentFocusMinutes >= 30) {
    score += 5;
  }

  if (overdue.length > 0) {
    score -= Math.min(overdue.length * 8, 24);
  }

  if (highPriorityOpen.length > 2) {
    score -= 8;
  }

  score = Math.round(clamp(score, 0, 100));

  let status: NexusIntelligence["status"];

  if (score >= 85) {
    status = "excellent";
  } else if (score >= 70) {
    status = "strong";
  } else if (score >= 50) {
    status = "balanced";
  } else {
    status = "attention";
  }

  const signals: IntelligenceSignal[] = [];

  if (overdue.length > 0) {
    signals.push({
      type: "overdue",
      title: `${overdue.length} overdue ${
        overdue.length === 1 ? "task" : "tasks"
      }`,
      message:
        "Your execution queue contains work that has passed its due date.",
      action: "Review overdue work",
      score: 90,
    });
  }

  if (highPriorityOpen.length > 0) {
    signals.push({
      type: "priority",
      title: `${highPriorityOpen.length} high-priority ${
        highPriorityOpen.length === 1
          ? "task needs"
          : "tasks need"
      } attention`,
      message:
        "High-impact work is still sitting in your execution queue.",
      action: "Focus on priority work",
      score: 85,
    });
  }

  if (
    recentFocusMinutes >= 90
  ) {
    signals.push({
      type: "focus",
      title: "Strong focus momentum",
      message: `You've completed ${recentFocusMinutes} minutes of focused work in the last 7 days.`,
      action: "Protect the momentum",
      score: 80,
    });
  } else {
    signals.push({
      type: "focus",
      title: "Focus opportunity detected",
      message:
        "Your recent focus time is low. A dedicated session could improve execution.",
      action: "Start a focus session",
      score: 60,
    });
  }

  if (averageProgress >= 70) {
    signals.push({
      type: "progress",
      title: "Execution is moving",
      message: `Your workspace is averaging ${Math.round(
        averageProgress
      )}% task progress.`,
      action: "Keep executing",
      score: 75,
    });
  } else {
    signals.push({
      type: "progress",
      title: "Execution needs momentum",
      message: `Average task progress is currently ${Math.round(
        averageProgress
      )}%.`,
      action: "Move one task forward",
      score: 55,
    });
  }

  if (
    completed.length > 0 &&
    completed.length >= active.length
  ) {
    signals.push({
      type: "momentum",
      title: "Completion momentum",
      message:
        "You're closing work faster than you're accumulating active work.",
      action: "Maintain the pace",
      score: 82,
    });
  }

  signals.sort((a, b) => b.score - a.score);

  let headline = "Your workspace is balanced.";

  if (status === "excellent") {
    headline = "You're operating at full momentum.";
  } else if (status === "strong") {
    headline = "Your execution system is performing strongly.";
  } else if (status === "attention") {
    headline = "Your workspace needs attention.";
  }

  let summary = `NEXUS is tracking ${totalTasks} ${
    totalTasks === 1 ? "task" : "tasks"
  }, ${completed.length} completed and ${
    active.length
  } currently active.`;

  if (focusMinutes > 0) {
    summary += ` You've accumulated ${focusMinutes} minutes of focus time.`;
  }

  return {
    score,
    status,
    headline,
    summary,
    signals: signals.slice(0, 5),
  };
}