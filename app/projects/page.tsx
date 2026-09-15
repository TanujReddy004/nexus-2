"use client";

import AppShell from "@/components/app-shell";
import AuthGuard from "@/components/auth-guard";
import { useSearchParams } from "next/navigation";


import {
  addTask,
  deleteTask,
  getTasks,
  updateTask,
  type Priority,
  type Task,
} from "@/lib/workspace-store";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Target,
  X,
  Zap,
} from "lucide-react";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

type Filter = "all" | Priority;

const columns: {
  status: Task["status"];
  label: string;
  description: string;
}[] = [
  {
    status: "todo",
    label: "To Do",
    description: "Queued for execution",
  },
  {
    status: "in-progress",
    label: "In Progress",
    description: "Currently being worked on",
  },
  {
    status: "completed",
    label: "Completed",
    description: "Finished work",
  },
];

function priorityLabel(
  priority: Priority
) {
  return (
    priority.charAt(0).toUpperCase() +
    priority.slice(1)
  );
}

function formatDate(
  date?: string
) {
  if (!date) {
    return "No due date";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  ).format(parsed);
}

function isOverdue(
  date?: string
) {
  if (!date) {
    return false;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const due =
    new Date(date);

  due.setHours(
    0,
    0,
    0,
    0
  );

  return (
    due < today
  );
}

function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  const styles = {
    high: {
      background:
        "rgba(244,63,94,.10)",
      borderColor:
        "rgba(244,63,94,.22)",
      color:
        "#fb7185",
    },

    medium: {
      background:
        "rgba(245,158,11,.10)",
      borderColor:
        "rgba(245,158,11,.22)",
      color:
        "#fbbf24",
    },

    low: {
      background:
        "rgba(34,211,153,.10)",
      borderColor:
        "rgba(34,211,153,.22)",
      color:
        "#34d399",
    },
  };

  const style =
    styles[priority];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
      style={style}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background:
            style.color,
        }}
      />

      {priorityLabel(
        priority
      )}
    </span>
  );
}

function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  onProgress,
  onStatusChange,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onProgress: (
    progress: number
  ) => void;
  onStatusChange: (
    status: Task["status"]
  ) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const completed =
    task.status ===
    "completed";

  const overdue =
    isOverdue(
      task.dueDate
    ) &&
    !completed;

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        setIsDragging(true);
        onDragStart(task);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      className={`group cursor-grab rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 active:cursor-grabbing ${
        isDragging ? "scale-[.985] opacity-45" : ""
      }`}
      style={{
        borderColor:
          "var(--nexus-border)",
        background:
          "var(--nexus-surface-2)",
        boxShadow:
          isDragging
            ? "0 16px 40px rgba(139,92,246,.16)"
            : "0 8px 30px rgba(0,0,0,.04)",
      }}
    >
      {/* TOP */}

      <div className="flex items-start gap-3">

        <button
          type="button"
          onClick={onToggle}
          aria-label={
            completed
              ? "Mark task incomplete"
              : "Mark task complete"
          }
          className="mt-0.5 shrink-0 rounded-full transition-transform hover:scale-110"
        >
          {completed ? (
            <CheckCircle2
              size={21}
              style={{
                color:
                  "var(--nexus-green)",
              }}
            />
          ) : (
            <Circle
              size={21}
              style={{
                color:
                  "var(--nexus-muted)",
              }}
            />
          )}
        </button>

        <div className="min-w-0 flex-1">

          <button
            type="button"
            onClick={onEdit}
            className="block w-full text-left"
          >
            <h3
              className="text-sm font-semibold leading-5"
              style={{
                color:
                  "var(--nexus-text)",
              }}
            >
              {task.title}
            </h3>
          </button>

          {task.description && (
            <p
              className="mt-2 line-clamp-2 text-xs leading-5"
              style={{
                color:
                  "var(--nexus-muted)",
              }}
            >
              {task.description}
            </p>
          )}

        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">

          <span
            title="Drag to move task"
            aria-label="Drag to move task"
            className="grid h-7 w-7 cursor-grab place-items-center rounded-lg text-[var(--nexus-muted)]"
          >
            <GripVertical size={15} />
          </span>

          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit task"
            className="grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-[var(--nexus-surface-3)]"
            style={{
              color:
                "var(--nexus-muted)",
            }}
          >
            <MoreHorizontal
              size={16}
            />
          </button>

        </div>

      </div>

      {/* META */}

      <div className="mt-4 flex flex-wrap items-center gap-2">

        <PriorityBadge
          priority={
            task.priority
          }
        />

        {task.dueDate && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]"
            style={{
              borderColor:
                overdue
                  ? "rgba(244,63,94,.22)"
                  : "var(--nexus-border)",

              background:
                overdue
                  ? "rgba(244,63,94,.08)"
                  : "var(--nexus-surface-3)",

              color:
                overdue
                  ? "#fb7185"
                  : "var(--nexus-muted)",
            }}
          >
            <CalendarDays
              size={11}
            />

            {formatDate(
              task.dueDate
            )}
          </span>
        )}

      </div>

      {/* STATUS */}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span
            className="text-[9px] uppercase tracking-[.16em]"
            style={{
              color:
                "var(--nexus-muted)",
            }}
          >
            Status
          </span>

          <span
            className="text-[10px]"
            style={{
              color:
                "var(--nexus-muted)",
            }}
          >
            Move task
          </span>
        </div>

        <select
          value={task.status}
          onChange={(event) =>
            onStatusChange(
              event.target.value as Task["status"]
            )
          }
          aria-label={`Change status for ${task.title}`}
          className="w-full cursor-pointer rounded-xl border px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-violet-500/50"
          style={{
            borderColor:
              "var(--nexus-border)",
            background:
              "var(--nexus-surface-3)",
            color:
              "var(--nexus-text)",
          }}
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* PROGRESS */}

      {!completed && (
        <div className="mt-4">

          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[9px] uppercase tracking-[.16em]"
              style={{
                color:
                  "var(--nexus-muted)",
              }}
            >
              Progress
            </span>

            <span
              className="text-[10px]"
              style={{
                color:
                  "var(--nexus-muted)",
              }}
            >
              {task.progress}%
            </span>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{
              background:
                "var(--nexus-surface-3)",
            }}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    task.progress
                  )
                )}%`,
              }}
            />
          </div>

          <div className="mt-3 flex gap-1.5">
            {[25, 50, 75, 100].map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    onProgress(
                      value
                    )
                  }
                  className="rounded-lg border px-2 py-1 text-[9px] transition-colors hover:border-violet-500/40 hover:text-violet-400"
                  style={{
                    borderColor:
                      "var(--nexus-border)",
                    color:
                      "var(--nexus-muted)",
                    background:
                      "var(--nexus-surface-3)",
                  }}
                >
                  {value}%
                </button>
              )
            )}
          </div>

        </div>
      )}

      {/* COMPLETED */}

      {completed && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px]"
          style={{
            borderColor:
              "rgba(52,211,153,.18)",
            background:
              "rgba(52,211,153,.06)",
            color:
              "var(--nexus-green)",
          }}
        >
          <Check
            size={13}
          />

          Completed · 100%
        </div>
      )}

      {/* DELETE */}

      <button
        type="button"
        onClick={onDelete}
        className="mt-3 text-[10px] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
        style={{
          color:
            "var(--nexus-muted)",
        }}
      >
        Delete task
      </button>
    </article>
  );
}

function TaskModal({
  task,
  onClose,
  onSave,
}: {
  task?: Task | null;
  onClose: () => void;
  onSave: (
    data: {
      title: string;
      description: string;
      priority: Priority;
      dueDate: string;
    }
  ) => void;
}) {
  const [title, setTitle] =
    useState(
      task?.title ?? ""
    );

  const [
    description,
    setDescription,
  ] = useState(
    task?.description ?? ""
  );

  const [
    priority,
    setPriority,
  ] = useState<Priority>(
    task?.priority ??
      "medium"
  );

  const [
    dueDate,
    setDueDate,
  ] = useState(
    task?.dueDate ?? ""
  );

  const submit = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    onSave({
      title:
        title.trim(),
      description:
        description.trim(),
      priority,
      dueDate,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      style={{
        background:
          "rgba(0,0,0,.55)",
        backdropFilter:
          "blur(10px)",
      }}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl"
        style={{
          borderColor:
            "var(--nexus-border-strong)",
          background:
            "var(--nexus-surface)",
          color:
            "var(--nexus-text)",
        }}
      >

        <div className="flex items-center justify-between">

          <div>
            <p className="eyebrow">
              WORKSPACE
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              {task
                ? "Edit task"
                : "Create task"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl transition-colors hover:bg-[var(--nexus-surface-3)]"
          >
            <X
              size={17}
            />
          </button>

        </div>

        <div className="mt-6 space-y-4">

          {/* TITLE */}

          <div>
            <label
              htmlFor="task-title"
              className="mb-2 block text-xs font-medium"
            >
              Task name
            </label>

            <input
              id="task-title"
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="What needs to be done?"
              autoFocus
              className="nexus-input w-full"
            />
          </div>

          {/* DESCRIPTION */}

          <div>
            <label
              htmlFor="task-description"
              className="mb-2 block text-xs font-medium"
            >
              Description
            </label>

            <textarea
              id="task-description"
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Add context or notes..."
              rows={3}
              className="nexus-input w-full resize-none"
            />
          </div>

          {/* PRIORITY */}

          <div>
            <label className="mb-2 block text-xs font-medium">
              Priority
            </label>

            <div className="grid grid-cols-3 gap-2">

              {(
                [
                  "high",
                  "medium",
                  "low",
                ] as Priority[]
              ).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setPriority(
                        value
                      )
                    }
                    className="rounded-xl border px-3 py-3 text-xs font-medium transition-all"
                    style={{
                      borderColor:
                        priority ===
                        value
                          ? "var(--nexus-purple)"
                          : "var(--nexus-border)",

                      background:
                        priority ===
                        value
                          ? "rgba(139,92,246,.10)"
                          : "var(--nexus-surface-2)",

                      color:
                        priority ===
                        value
                          ? "var(--nexus-purple)"
                          : "var(--nexus-muted)",
                    }}
                  >
                    {priorityLabel(
                      value
                    )}
                  </button>
                )
              )}

            </div>
          </div>

          {/* DUE DATE */}

          <div>
            <label
              htmlFor="task-due-date"
              className="mb-2 block text-xs font-medium"
            >
              Due date
            </label>

            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(event) =>
                setDueDate(
                  event.target.value
                )
              }
              className="nexus-input w-full"
            />
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-2">

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
          >
            <Check
              size={16}
            />

            {task
              ? "Save changes"
              : "Create task"}
          </button>

        </div>

      </form>
    </div>
  );
}

function ProjectsPageContent() {
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs") || undefined;
  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<Filter>(
    "all"
  );

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingTask,
    setEditingTask,
  ] = useState<Task | null>(
    null
  );

  const [draggedTaskId, setDraggedTaskId] =
    useState<string | null>(null);

  const [dragOverStatus, setDragOverStatus] =
    useState<Task["status"] | null>(null);

  useEffect(() => {
    setTasks(
      getTasks(viewAs)
    );
  }, [viewAs]);

  const visibleTasks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return tasks.filter(
        (task) => {
          const matchesSearch =
            !query ||
            task.title
              .toLowerCase()
              .includes(query) ||
            task.description
              ?.toLowerCase()
              .includes(query);

          const matchesFilter =
            filter === "all" ||
            task.priority ===
              filter;

          return (
            matchesSearch &&
            matchesFilter
          );
        }
      );
    },
  [
    tasks,
    search,
    filter,
  ]);

  const todoCount =
    tasks.filter(
      (task) =>
        task.status ===
        "todo"
    ).length;

  const activeCount =
    tasks.filter(
      (task) =>
        task.status ===
        "in-progress"
    ).length;

  const completedCount =
    tasks.filter(
      (task) =>
        task.status ===
        "completed"
    ).length;

  const overdueCount =
    tasks.filter(
      (task) =>
        task.status !==
          "completed" &&
        isOverdue(
          task.dueDate
        )
    ).length;

  const workspaceProgress =
    tasks.length === 0
      ? 0
      : Math.round(
          tasks.reduce(
            (
              total,
              task
            ) =>
              total +
              task.progress,
            0
          ) /
            tasks.length
        );

  const highPriority =
    tasks.filter(
      (task) =>
        task.priority ===
          "high" &&
        task.status !==
          "completed"
    ).length;

  const openCreate =
    () => {
      setEditingTask(
        null
      );
      setModalOpen(
        true
      );
    };

  const openEdit = (
    task: Task
  ) => {
    setEditingTask(
      task
    );
    setModalOpen(
      true
    );
  };

  const saveTask = (
    data: {
      title: string;
      description: string;
      priority: Priority;
      dueDate: string;
    }
  ) => {
    if (
      editingTask
    ) {
      const updated =
        updateTask(
          editingTask.id,
          data
        );

      setTasks(
        updated
      );
    } else {
      const newTask =
        addTask({
          ...data,
          status:
            "todo",
          progress: 0,
        });

      setTasks(
        getTasks(viewAs)
      );

      if (!newTask) {
        setTasks(
          getTasks(viewAs)
        );
      }
    }

    setModalOpen(
      false
    );

    setEditingTask(
      null
    );
  };

  const toggleTask = (
    task: Task
  ) => {
    const completed =
      task.status ===
      "completed";

    const updated =
      updateTask(
        task.id,
        completed
          ? {
              status:
                "in-progress",
              progress:
                Math.max(
                  1,
                  task.progress
                ),
            }
          : {
              status:
                "completed",
              progress: 100,
            }
      );

    setTasks(
      updated
    );

    navigator.vibrate?.(
      20
    );
  };

  const changeProgress = (
    task: Task,
    progress: number
  ) => {
    const nextStatus: Task["status"] =
      progress >= 100
        ? "completed"
        : progress > 0
          ? "in-progress"
          : "todo";

    const updated =
      updateTask(
        task.id,
        {
          progress,
          status:
            nextStatus,
        }
      );

    setTasks(
      updated
    );
  };

  const changeStatus = (
    task: Task,
    status: Task["status"]
  ) => {
    const nextProgress =
      status === "completed"
        ? 100
        : status === "todo"
          ? 0
          : Math.max(1, task.progress);

    const updated =
      updateTask(
        task.id,
        {
          status,
          progress:
            nextProgress,
        }
      );

    setTasks(
      updated
    );

    navigator.vibrate?.(12);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const handleDrop = (status: Task["status"]) => {
    if (!draggedTaskId) {
      return;
    }

    const task = tasks.find(
      (item) => item.id === draggedTaskId
    );

    if (task && task.status !== status) {
      changeStatus(task, status);
    }

    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const removeTask = (
    task: Task
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${task.title}"?`
      );

    if (!confirmed) {
      return;
    }

    const updated =
      deleteTask(
        task.id
      );

    setTasks(
      updated
    );
  };

  return (
    <AuthGuard>
      <AppShell>

        <div className="page">

          <div className="mx-auto max-w-[1400px]">

            {/* ==================================================
                HERO
            ================================================== */}

            <section
              className="overflow-hidden rounded-[28px] border p-6 sm:p-8 lg:p-10"
              style={{
                borderColor:
                  "var(--nexus-border)",
                background:
                  "linear-gradient(135deg, var(--nexus-surface) 0%, var(--nexus-surface-2) 65%, rgba(139,92,246,.08) 100%)",
              }}
            >

              <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">

                <div className="max-w-2xl">

                  <div className="flex items-center gap-2">
                    <Target
                      size={14}
                      style={{
                        color:
                          "var(--nexus-purple)",
                      }}
                    />

                    <span className="eyebrow">
                      WORKSPACE
                    </span>
                  </div>

                  <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
                    NEXUS Platform
                  </h1>

                  <p
                    className="mt-3 max-w-xl text-sm leading-6"
                    style={{
                      color:
                        "var(--nexus-muted)",
                    }}
                  >
                    Turn plans into visible
                    progress. Organize the work,
                    focus on the right thing,
                    and keep momentum moving.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={
                    openCreate
                  }
                  className="btn-primary flex shrink-0 items-center justify-center gap-2"
                >
                  <Plus
                    size={17}
                  />

                  New task
                </button>

              </div>

              {/* METRICS */}

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor:
                      "var(--nexus-border)",
                    background:
                      "var(--nexus-surface-2)",
                  }}
                >

                  <div className="flex items-center justify-between">
                    <span className="eyebrow">
                      Workspace progress
                    </span>

                    <Target
                      size={16}
                      style={{
                        color:
                          "var(--nexus-purple)",
                      }}
                    />
                  </div>

                  <div className="mt-5 flex items-end justify-between">

                    <strong className="text-2xl">
                      {workspaceProgress}%
                    </strong>

                    <span
                      className="text-[10px]"
                      style={{
                        color:
                          "var(--nexus-muted)",
                      }}
                    >
                      {tasks.length} tasks
                    </span>

                  </div>

                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full"
                    style={{
                      background:
                        "var(--nexus-surface-3)",
                    }}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500"
                      style={{
                        width: `${workspaceProgress}%`,
                      }}
                    />
                  </div>

                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor:
                      "var(--nexus-border)",
                    background:
                      "var(--nexus-surface-2)",
                  }}
                >

                  <span className="eyebrow">
                    Active
                  </span>

                  <div className="mt-5 flex items-end justify-between">

                    <strong className="text-2xl">
                      {activeCount}
                    </strong>

                    <span
                      className="text-[10px]"
                      style={{
                        color:
                          "var(--nexus-muted)",
                      }}
                    >
                      in progress
                    </span>

                  </div>

                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor:
                      "var(--nexus-border)",
                    background:
                      "var(--nexus-surface-2)",
                  }}
                >

                  <span className="eyebrow">
                    Completed
                  </span>

                  <div className="mt-5 flex items-end justify-between">

                    <strong
                      className="text-2xl"
                      style={{
                        color:
                          "var(--nexus-green)",
                      }}
                    >
                      {completedCount}
                    </strong>

                    <span
                      className="text-[10px]"
                      style={{
                        color:
                          "var(--nexus-muted)",
                      }}
                    >
                      shipped
                    </span>

                  </div>

                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor:
                      overdueCount > 0
                        ? "rgba(244,63,94,.22)"
                        : "var(--nexus-border)",

                    background:
                      overdueCount > 0
                        ? "rgba(244,63,94,.05)"
                        : "var(--nexus-surface-2)",
                  }}
                >

                  <span className="eyebrow">
                    Attention
                  </span>

                  <div className="mt-5 flex items-end justify-between">

                    <strong
                      className="text-2xl"
                      style={{
                        color:
                          overdueCount >
                          0
                            ? "#fb7185"
                            : "var(--nexus-text)",
                      }}
                    >
                      {overdueCount}
                    </strong>

                    <span
                      className="text-[10px]"
                      style={{
                        color:
                          "var(--nexus-muted)",
                      }}
                    >
                      overdue
                    </span>

                  </div>

                </div>

              </div>

            </section>

            {/* ==================================================
                SEARCH + FILTERS
            ================================================== */}

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              {/* SEARCH */}

              <div className="relative w-full lg:max-w-xl">

                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2"
                  style={{
                    color:
                      "var(--nexus-muted)",
                  }}
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                  className="nexus-input h-12 w-full rounded-2xl pl-11 pr-4"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch(
                        ""
                      )
                    }
                    className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg transition-colors hover:bg-[var(--nexus-surface-3)]"
                    style={{
                      color:
                        "var(--nexus-muted)",
                    }}
                    aria-label="Clear search"
                  >
                    <X
                      size={14}
                    />
                  </button>
                )}

              </div>

              {/* FILTER */}

              <div className="flex items-center gap-2 overflow-x-auto pb-1">

                <div
                  className="mr-1 hidden items-center gap-2 text-[10px] uppercase tracking-[.15em] sm:flex"
                  style={{
                    color:
                      "var(--nexus-muted)",
                  }}
                >
                  <Zap
                    size={13}
                  />

                  Filter
                </div>

                {(
                  [
                    "all",
                    "high",
                    "medium",
                    "low",
                  ] as Filter[]
                ).map(
                  (value) => {
                    const selected =
                      filter ===
                      value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setFilter(
                            value
                          )
                        }
                        className="shrink-0 rounded-xl border px-4 py-2 text-xs font-medium transition-all"
                        style={{
                          borderColor:
                            selected
                              ? "rgba(139,92,246,.45)"
                              : "var(--nexus-border)",

                          background:
                            selected
                              ? "rgba(139,92,246,.10)"
                              : "var(--nexus-surface-2)",

                          color:
                            selected
                              ? "var(--nexus-purple)"
                              : "var(--nexus-muted)",
                        }}
                      >
                        {value ===
                        "all"
                          ? "All"
                          : priorityLabel(
                              value
                            )}
                      </button>
                    );
                  }
                )}

              </div>

            </div>

            {/* ==================================================
                BOARD HEADER
            ================================================== */}

            <div
              className="mt-8 border-t pt-10 pl-6 select-none"
              aria-label="Execution board"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className="inline-flex h-8 items-center gap-2 rounded-full border px-3.5 select-none"
                      style={{
                        borderColor:
                          "rgba(139,92,246,.32)",
                        background:
                          "linear-gradient(135deg, rgba(139,92,246,.10), rgba(34,211,238,.05))",
                        color:
                          "var(--nexus-purple)",
                        boxShadow:
                          "0 0 0 1px rgba(139,92,246,.04), 0 6px 20px rgba(139,92,246,.08)",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            "var(--nexus-purple)",
                          boxShadow:
                            "0 0 8px rgba(139,92,246,.65)",
                        }}
                      />
                      <Target size={12} />
                      <span className="text-[9px] font-semibold uppercase tracking-[.18em]">
                        Execution board
                      </span>
                    </div>

                    <span
                      className="rounded-full border px-2.5 py-1 text-[10px]"
                      style={{
                        borderColor:
                          "var(--nexus-border)",
                        background:
                          "var(--nexus-surface-2)",
                        color:
                          "var(--nexus-muted)",
                      }}
                    >
                      {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}
                    </span>
                  </div>

                  <h2 className="mt-3 text-lg font-semibold tracking-[-.02em]">
                    Move work through your execution flow
                  </h2>

                  <p
                    className="mt-1 text-xs leading-5"
                    style={{
                      color:
                        "var(--nexus-muted)",
                    }}
                  >
                    Drag tasks between To Do, In Progress, and Completed.
                  </p>
                </div>

                {highPriority >
                  0 && (
                  <div
                    className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-medium"
                    style={{
                      borderColor:
                        "rgba(244,63,94,.20)",
                      background:
                        "rgba(244,63,94,.06)",
                      color:
                        "#fb7185",
                    }}
                  >
                    <AlertCircle
                      size={13}
                    />

                    {highPriority} high priority
                  </div>
                )}

              </div>
            </div>

            {/* ==================================================
                BOARD
            ================================================== */}

            <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">

              {columns.map(
                (column) => {
                  const columnTasks =
                    visibleTasks.filter(
                      (task) =>
                        task.status ===
                        column.status
                    );

                  return (
                    <section
                      key={
                        column.status
                      }
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverStatus(column.status);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop(column.status);
                      }}
                      className={`min-w-0 rounded-2xl border p-3 transition-all duration-200 ${
                        dragOverStatus === column.status && draggedTaskId
                          ? "-translate-y-0.5"
                          : ""
                      }`}
                      style={{
                        borderColor:
                          dragOverStatus === column.status && draggedTaskId
                            ? "rgba(139,92,246,.58)"
                            : "var(--nexus-border)",
                        background:
                          dragOverStatus === column.status && draggedTaskId
                            ? "rgba(139,92,246,.045)"
                            : "var(--nexus-surface)",
                        boxShadow:
                          dragOverStatus === column.status && draggedTaskId
                            ? "0 0 0 2px rgba(139,92,246,.08), 0 16px 36px rgba(139,92,246,.10)"
                            : "none",
                      }}
                    >

                      {/* COLUMN HEADER */}

                      <div className="mb-3 flex items-start justify-between px-1 py-2">

                        <div>

                          <div className="flex items-center gap-2">

                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                background:
                                  column.status ===
                                  "todo"
                                    ? "var(--nexus-muted)"
                                    : column.status ===
                                        "in-progress"
                                      ? "var(--nexus-purple)"
                                      : "var(--nexus-green)",
                              }}
                            />

                            <h3 className="text-sm font-semibold">
                              {column.label}
                            </h3>

                            <span
                              className="rounded-full px-2 py-0.5 text-[9px]"
                              style={{
                                background:
                                  "var(--nexus-surface-3)",
                                color:
                                  "var(--nexus-muted)",
                              }}
                            >
                              {
                                columnTasks.length
                              }
                            </span>

                          </div>

                          <p
                            className="mt-1 pl-4 text-[10px]"
                            style={{
                              color:
                                "var(--nexus-muted)",
                            }}
                          >
                            {
                              column.description
                            }
                          </p>

                        </div>

                      </div>

                      {/* TASKS */}

                      <div className="space-y-3">

                        {columnTasks.map(
                          (task) => (
                            <TaskCard
                              key={
                                task.id
                              }
                              task={
                                task
                              }
                              onToggle={() =>
                                toggleTask(
                                  task
                                )
                              }
                              onEdit={() =>
                                openEdit(
                                  task
                                )
                              }
                              onDelete={() =>
                                removeTask(
                                  task
                                )
                              }
                              onProgress={(
                                progress
                              ) =>
                                changeProgress(
                                  task,
                                  progress
                                )
                              }
                              onStatusChange={(
                                status
                              ) =>
                                changeStatus(
                                  task,
                                  status
                                )
                              }
                              onDragStart={
                                handleDragStart
                              }
                              onDragEnd={
                                handleDragEnd
                              }
                            />
                          )
                        )}

                        {columnTasks.length ===
                          0 && (
                          <div
                            className="rounded-2xl border border-dashed p-8 text-center"
                            style={{
                              borderColor:
                                "var(--nexus-border)",
                            }}
                          >
                            <div
                              className="mx-auto grid h-9 w-9 place-items-center rounded-xl"
                              style={{
                                background:
                                  "var(--nexus-surface-3)",
                                color:
                                  "var(--nexus-muted)",
                              }}
                            >
                              <Circle
                                size={16}
                              />
                            </div>

                            <p
                              className="mt-3 text-xs"
                              style={{
                                color:
                                  "var(--nexus-muted)",
                              }}
                            >
                              No tasks here
                            </p>
                          </div>
                        )}

                      </div>

                    </section>
                  );
                }
              )}

            </div>

            {/* ==================================================
                INSIGHTS
            ================================================== */}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">

              <section
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    "var(--nexus-border)",
                  background:
                    "var(--nexus-surface)",
                }}
              >

                <div className="flex items-center gap-3">

                  <div
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{
                      background:
                        "rgba(139,92,246,.10)",
                      color:
                        "var(--nexus-purple)",
                    }}
                  >
                    <Zap
                      size={16}
                    />
                  </div>

                  <div>
                    <p className="eyebrow">
                      NEXUS Insight
                    </p>

                    <h3 className="mt-1 text-sm font-semibold">
                      Execution signal
                    </h3>
                  </div>

                </div>

                <p
                  className="mt-4 text-xs leading-6"
                  style={{
                    color:
                      "var(--nexus-muted)",
                  }}
                >
                  {highPriority >
                  0
                    ? `You have ${highPriority} high-priority ${
                        highPriority ===
                        1
                          ? "task"
                          : "tasks"
                      } that still need attention.`
                    : "Your priority queue is clear. Protect time for meaningful work."}
                </p>

                {highPriority >
                  0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilter(
                        "high"
                      )
                    }
                    className="mt-4 text-xs font-medium text-violet-400 hover:text-violet-300"
                  >
                    Show high-priority work →
                  </button>
                )}

              </section>

              <section
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    "var(--nexus-border)",
                  background:
                    "var(--nexus-surface)",
                }}
              >

                <div className="flex items-center gap-3">

                  <div
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{
                      background:
                        "rgba(34,211,238,.08)",
                      color:
                        "var(--nexus-cyan)",
                    }}
                  >
                    <Clock3
                      size={16}
                    />
                  </div>

                  <div>
                    <p className="eyebrow">
                      Workspace pulse
                    </p>

                    <h3 className="mt-1 text-sm font-semibold">
                      Task distribution
                    </h3>
                  </div>

                </div>

                <div className="mt-5 space-y-4">

                  {[
                    {
                      label:
                        "To Do",
                      count:
                        todoCount,
                      value:
                        tasks.length
                          ? Math.round(
                              (todoCount /
                                tasks.length) *
                                100
                            )
                          : 0,
                      className:
                        "var(--nexus-muted)",
                    },
                    {
                      label:
                        "In Progress",
                      count:
                        activeCount,
                      value:
                        tasks.length
                          ? Math.round(
                              (activeCount /
                                tasks.length) *
                                100
                            )
                          : 0,
                      className:
                        "var(--nexus-purple)",
                    },
                    {
                      label:
                        "Completed",
                      count:
                        completedCount,
                      value:
                        tasks.length
                          ? Math.round(
                              (completedCount /
                                tasks.length) *
                                100
                            )
                          : 0,
                      className:
                        "var(--nexus-green)",
                    },
                  ].map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                      >

                        <div className="mb-2 flex items-center justify-between">

                          <span
                            className="text-[10px]"
                            style={{
                              color:
                                "var(--nexus-muted)",
                            }}
                          >
                            {
                              item.label
                            }
                          </span>

                          <span
                            className="text-[10px]"
                            style={{
                              color:
                                "var(--nexus-muted)",
                            }}
                          >
                            {
                              item.count
                            }
                          </span>

                        </div>

                        <div
                          className="h-1.5 overflow-hidden rounded-full"
                          style={{
                            background:
                              "var(--nexus-surface-3)",
                          }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${item.value}%`,
                              background:
                                item.className,
                            }}
                          />
                        </div>

                      </div>
                    )
                  )}

                </div>

              </section>

            </div>

            {/* DESKTOP BOTTOM SPACE
                Keeps the final insight cards comfortably above the viewport edge
                on the web app, matching the clean spacing used by Analytics.
                Mobile spacing remains unchanged.
            */}

            <div className="hidden h-24 md:block" />

            {/* MOBILE SPACE */}

            <div className="h-6 md:hidden" />

          </div>

        </div>

        {/* MODAL */}

        {modalOpen && (
          <TaskModal
            task={
              editingTask
            }
            onClose={() => {
              setModalOpen(
                false
              );
              setEditingTask(
                null
              );
            }}
            onSave={
              saveTask
            }
          />
        )}

      </AppShell>
    </AuthGuard>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageContent />
    </Suspense>
  );
}
