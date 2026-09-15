"use client";

import AppShell from "@/components/app-shell";
import AuthGuard from "@/components/auth-guard";
import {
  getFocusSessions,
  getTasks,
  saveFocusSession,
  updateTask,
  type Task,
} from "@/lib/workspace-store";
import {
  Check,
  ChevronDown,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

const PRESET_DURATIONS = [25, 50, 90];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function formatFocus(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining > 0
    ? `${hours}h ${remaining}m`
    : `${hours}h`;
}

function playCompletionSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      660,
      context.currentTime
    );

    oscillator.frequency.setValueAtTime(
      880,
      context.currentTime + 0.15
    );

    gain.gain.setValueAtTime(
      0.0001,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.12,
      context.currentTime + 0.03
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.55
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
  } catch {
    // Browser may block audio.
  }
}

function FocusPageContent() {
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs") || undefined;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] =
    useState("");

  const [duration, setDuration] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);

  const [customMode, setCustomMode] =
    useState(false);

  const [customMinutes, setCustomMinutes] =
    useState("45");

  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);

  const [intention, setIntention] = useState("");

  const [taskMenuOpen, setTaskMenuOpen] =
    useState(false);

  const [completed, setCompleted] = useState(false);

  const [focusToday, setFocusToday] = useState(0);
  const [sessionsToday, setSessionsToday] =
    useState(0);

  useEffect(() => {
    const activeTasks = getTasks(viewAs).filter(
      (task) => task.status !== "completed"
    );

    setTasks(activeTasks);

    if (activeTasks.length > 0) {
      setSelectedTaskId(activeTasks[0].id);
      setIntention(
        `Make progress on ${activeTasks[0].title}`
      );
    }

    const today = new Date();

    const todaySessions = getFocusSessions(viewAs).filter(
      (session) => {
        const date = new Date(session.completedAt);

        return (
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        );
      }
    );

    setSessionsToday(todaySessions.length);

    setFocusToday(
      todaySessions.reduce(
        (sum, session) => sum + session.duration,
        0
      )
    );
  }, [viewAs]);

  const selectedTask = useMemo(
    () =>
      tasks.find(
        (task) => task.id === selectedTaskId
      ),
    [tasks, selectedTaskId]
  );

  const totalSeconds = duration * 60;

  const progress =
    totalSeconds > 0
      ? ((totalSeconds - seconds) / totalSeconds) *
        100
      : 0;

  const selectDuration = (minutes: number) => {
    if (running) return;

    setCustomMode(false);
    setDuration(minutes);
    setSeconds(minutes * 60);
    setCompleted(false);
  };

  const applyCustomDuration = () => {
    if (running) return;

    const minutes = Number(customMinutes);

    if (
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      minutes > 240
    ) {
      return;
    }

    setDuration(Math.round(minutes));
    setSeconds(Math.round(minutes) * 60);
    setCustomMode(true);
    setCompleted(false);
  };

  const selectTask = (task: Task) => {
    if (running) return;

    setSelectedTaskId(task.id);

    setIntention(
      `Make progress on ${task.title}`
    );

    setTaskMenuOpen(false);
  };

  const resetTimer = () => {
    setRunning(false);
    setSeconds(duration * 60);
    setCompleted(false);

    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const toggleTimer = () => {
    if (completed) {
      setSeconds(duration * 60);
      setCompleted(false);
    }

    setRunning((current) => !current);

    navigator.vibrate?.(20);
  };

  const finishSession = () => {
    setRunning(false);
    setCompleted(true);

    saveFocusSession(
      duration,
      intention.trim() ||
        selectedTask?.title ||
        "Deep work session",
      undefined,
      viewAs
    );

    setSessionsToday((value) => value + 1);

    setFocusToday(
      (value) => value + duration
    );

    if (selectedTask) {
      const increase = Math.max(
        5,
        Math.round(duration / 5)
      );

      const nextProgress = Math.min(
        100,
        selectedTask.progress + increase
      );

      updateTask(selectedTask.id, {
        progress: nextProgress,
        status:
          nextProgress >= 100
            ? "completed"
            : "in-progress",
      });

      setTasks((current) =>
        current.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                progress: nextProgress,
                status:
                  nextProgress >= 100
                    ? "completed"
                    : "in-progress",
              }
            : task
        )
      );
    }

    if (sound) {
      playCompletionSound();
    }

    navigator.vibrate?.([
      100,
      80,
      150,
      80,
      220,
    ]);
  };

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);

          setTimeout(() => {
            finishSession();
          }, 0);

          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    running,
    duration,
    sound,
    intention,
    selectedTask,
  ]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page min-h-screen px-3 pb-24 sm:px-0 sm:pb-20">
          {/* HEADER */}

          <div className="mx-auto w-full max-w-[1120px]">
            <div className="flex items-start justify-between gap-3 sm:items-end sm:gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-violet-400">
                  DEEP WORK
                </p>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
                  Focus without distractions.
                </h1>

                <p className="mt-2 max-w-[320px] text-xs leading-5 text-zinc-500 sm:max-w-none sm:text-sm sm:leading-normal">
                  Choose what matters, protect the time,
                  and execute.
                </p>
              </div>

              <div className="hidden gap-2 sm:flex">
                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                    Today
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {formatFocus(focusToday)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                    Sessions
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {sessionsToday}
                  </p>
                </div>
              </div>
            </div>

            {/* FOCUS WORKSPACE */}

            <div className="mt-7 overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm sm:mt-8">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_250px]">
                {/* TIMER */}

                <section className="p-5 sm:p-8 lg:px-10 lg:py-8">
                  {/* TASK */}

                  <div className="relative mx-auto max-w-[530px]">
                    <p className="mb-2 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                      Focusing on
                    </p>

                    <button
                      type="button"
                      disabled={running}
                      onClick={() =>
                        setTaskMenuOpen(
                          (value) => !value
                        )
                      }
                      className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 text-left transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-70 sm:h-14 sm:gap-3 sm:rounded-2xl sm:px-4"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-400 sm:h-8 sm:w-8 sm:rounded-xl">
                        <Clock3 size={15} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-zinc-900">
                          {selectedTask?.title ||
                            "Choose a task"}
                        </span>
                      </span>

                      <ChevronDown
                        size={15}
                        className="text-zinc-500"
                      />
                    </button>

                    {taskMenuOpen && (
                      <div className="absolute left-0 right-0 top-[62px] z-20 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
                        {tasks.length === 0 ? (
                          <div className="p-5 text-center">
                            <p className="text-xs text-zinc-500">
                              No active tasks.
                            </p>

                            <Link
                              href="/projects"
                              className="mt-3 inline-block text-xs text-violet-400"
                            >
                              Create a task
                            </Link>
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto p-2">
                            {tasks.map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() =>
                                  selectTask(task)
                                }
                                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-zinc-50"
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    task.priority ===
                                    "high"
                                      ? "bg-rose-400"
                                      : task.priority ===
                                          "medium"
                                        ? "bg-amber-400"
                                        : "bg-zinc-500"
                                  }`}
                                />

                                <span className="flex-1 truncate text-xs text-zinc-400">
                                  {task.title}
                                </span>

                                {task.id ===
                                  selectedTaskId && (
                                  <Check
                                    size={14}
                                    className="text-violet-400"
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* TIMER */}

                  <div className="mt-8 flex min-h-[320px] items-center justify-center text-center sm:mt-10 sm:min-h-[360px]">
                    <div className="relative grid h-[278px] w-[278px] place-items-center sm:h-[306px] sm:w-[306px]">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(from -90deg, #8b5cf6 ${Math.max(0, Math.min(100, progress))}%, #eef0fa ${Math.max(0, Math.min(100, progress))}% 100%)`,
                        }}
                      />
                      <div className="absolute inset-[9px] rounded-full bg-white" />
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="text-[58px] font-light leading-none tracking-[-0.065em] text-zinc-950 tabular-nums sm:text-[76px]">
                          {formatTime(seconds)}
                        </div>

                        <p className="mt-4 text-[9px] uppercase tracking-[0.28em] text-zinc-400">
                          {completed
                            ? "SESSION COMPLETE"
                            : running
                              ? "STAY IN THE MOMENT"
                              : seconds < totalSeconds
                                ? "SESSION PAUSED"
                                : "READY TO FOCUS"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CONTROLS */}

                  <div className="mt-0 flex justify-center gap-3 sm:mt-1">
                    <button
                      type="button"
                      onClick={resetTimer}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 sm:h-11 sm:w-11"
                      aria-label="Reset timer"
                    >
                      <RotateCcw size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={toggleTimer}
                      className="flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-[11px] font-semibold text-white shadow-lg shadow-violet-500/10 transition hover:bg-violet-400 sm:h-11 sm:min-w-[132px] sm:px-5 sm:text-xs"
                    >
                      {running ? (
                        <>
                          <Pause size={16} />
                          Pause
                        </>
                      ) : completed ? (
                        <>
                          <Play size={16} />
                          Start Again
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          {seconds < totalSeconds
                            ? "Resume"
                            : "Start Focus"}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSound((value) => !value)
                      }
                      className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 sm:h-11 sm:w-11"
                      aria-label="Toggle sound"
                    >
                      {sound ? (
                        <Volume2 size={17} />
                      ) : (
                        <VolumeX size={17} />
                      )}
                    </button>
                  </div>

                  {/* INTENTION */}

                  <div className="mx-auto mt-8 max-w-[530px] sm:mt-10">
                    <label
                      htmlFor="intention"
                      className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Current intention
                    </label>

                    <input
                      id="intention"
                      value={intention}
                      onChange={(event) =>
                        setIntention(event.target.value)
                      }
                      disabled={running}
                      placeholder="What do you want to accomplish?"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-500 disabled:opacity-60 sm:h-12 sm:px-4"
                    />
                  </div>
                </section>

                {/* SETTINGS */}

                <aside className="border-t border-zinc-200 p-5 sm:p-6 lg:border-l lg:border-t-0">
                  <div className="flex items-center gap-2">
                    <Clock3
                      size={15}
                      className="text-zinc-500"
                    />

                    <h2 className="text-sm font-medium">
                      Timer
                    </h2>
                  </div>

                  {/* PRESETS */}

                  <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">
                    {PRESET_DURATIONS.map(
                      (minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          disabled={running}
                          onClick={() =>
                            selectDuration(minutes)
                          }
                          className={`rounded-xl border py-3 text-center transition ${
                            !customMode &&
                            duration === minutes
                              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                              : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-400"
                          }`}
                        >
                          <span className="block text-xs font-medium">
                            {minutes}
                          </span>

                          <span className="mt-1 block text-[8px] uppercase tracking-wider text-zinc-400">
                            min
                          </span>
                        </button>
                      )
                    )}
                  </div>

                  {/* CUSTOM TIMER */}

                  <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 sm:mt-5 sm:p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                        Custom
                      </p>

                      {customMode && (
                        <Check
                          size={13}
                          className="text-violet-400"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="240"
                        value={customMinutes}
                        onChange={(event) =>
                          setCustomMinutes(
                            event.target.value
                          )
                        }
                        disabled={running}
                        className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-violet-500"
                      />

                      <button
                        type="button"
                        disabled={running}
                        onClick={applyCustomDuration}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 text-[10px] font-medium text-zinc-400 hover:bg-zinc-100"
                      >
                        Apply
                      </button>
                    </div>

                    <p className="mt-2 text-[9px] text-zinc-400">
                      1–240 minutes
                    </p>
                  </div>

                  {/* TASK PROGRESS */}

                  {selectedTask && (
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 sm:mt-5 sm:p-4">
                      <div className="flex justify-between">
                        <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                          Task progress
                        </span>

                        <span className="text-[9px] text-zinc-500">
                          {selectedTask.progress}%
                        </span>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all"
                          style={{
                            width: `${selectedTask.progress}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TODAY */}

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-[8px] uppercase tracking-[0.14em] text-zinc-400">
                        Focus today
                      </p>

                      <p className="mt-2 text-sm font-semibold">
                        {formatFocus(focusToday)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-[8px] uppercase tracking-[0.14em] text-zinc-400">
                        Sessions
                      </p>

                      <p className="mt-2 text-sm font-semibold">
                        {sessionsToday}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {/* HISTORY */}

            <Link
              href="/analytics"
              className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 transition hover:border-violet-300 sm:mt-5 sm:p-4"
            >
              <div>
                <p className="text-xs font-medium text-zinc-400">
                  Focus history
                </p>

                <p className="mt-1 text-[10px] text-zinc-400">
                  Review how your focus time is turning into
                  progress.
                </p>
              </div>

              <span className="text-[10px] text-zinc-500">
                Analytics →
              </span>
            </Link>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={null}>
      <FocusPageContent />
    </Suspense>
  );
}
