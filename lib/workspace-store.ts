export type TaskStatus = "todo" | "in-progress" | "completed";
export type Priority = "low" | "medium" | "high";
export type Theme = "dark" | "light" | "system";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  progress: number;
  estimatedMinutes?: number;
  createdAt: string;
};

export type FocusSession = {
  id: string;
  duration: number;
  completedAt: string;
  intention: string;
  taskId?: string;
};

export type NexusPreferences = {
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
  reducedMotion: boolean;
};

const TASKS_KEY = "nexus-tasks";
const FOCUS_SESSIONS_KEY = "nexus-focus-sessions";
const THEME_KEY = "nexus-theme";
const PREFERENCES_KEY = "nexus-preferences";

const defaultTasks: Task[] = [
  {
    id: "task-1",
    title: "Design NEXUS workspace architecture",
    description:
      "Define the information architecture for the productivity system.",
    status: "in-progress",
    priority: "high",
    dueDate: "2026-09-10",
    progress: 70,
    createdAt: "2026-09-09T06:00:00.000Z",
  },
  {
    id: "task-2",
    title: "Build advanced project workflow",
    description:
      "Create a simple, connected workflow for moving work forward.",
    status: "todo",
    priority: "high",
    dueDate: "2026-09-12",
    progress: 0,
    createdAt: "2026-09-09T06:00:00.000Z",
  },
  {
    id: "task-3",
    title: "Improve mobile experience",
    description:
      "Optimize navigation and workspace responsiveness.",
    status: "todo",
    priority: "medium",
    dueDate: "2026-09-14",
    progress: 0,
    createdAt: "2026-09-09T06:00:00.000Z",
  },
  {
    id: "task-4",
    title: "Configure authentication",
    description:
      "Set up Supabase authentication flow.",
    status: "completed",
    priority: "medium",
    dueDate: "2026-09-08",
    progress: 100,
    createdAt: "2026-09-08T06:00:00.000Z",
  },
  {
    id: "task-5",
    title: "Create analytics dashboard",
    description:
      "Visualize focus sessions and productivity trends.",
    status: "in-progress",
    priority: "medium",
    dueDate: "2026-09-15",
    progress: 45,
    createdAt: "2026-09-09T06:00:00.000Z",
  },
];

const defaultPreferences: NexusPreferences = {
  notifications: true,
  sound: true,
  vibration: true,
  reducedMotion: false,
};

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored =
    window.localStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function write<T>(
  key: string,
  value: T
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    key,
    JSON.stringify(value)
  );

  window.dispatchEvent(
    new CustomEvent(
      "nexus-data-change",
      {
        detail: key,
      }
    )
  );
}

/* =========================================================
   TASKS
========================================================= */

export function getTasks(_viewAs?: string): Task[] {
  void _viewAs;
  if (typeof window === "undefined") {
    return defaultTasks;
  }

  const stored =
    window.localStorage.getItem(
      TASKS_KEY
    );

  if (!stored) {
    window.localStorage.setItem(
      TASKS_KEY,
      JSON.stringify(defaultTasks)
    );

    return defaultTasks;
  }

  try {
    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed
      : defaultTasks;
  } catch {
    return defaultTasks;
  }
}

export function saveTasks(
  tasks: Task[]
) {
  write(TASKS_KEY, tasks);
}

export function addTask(
  task: Omit<
    Task,
    "id" | "createdAt"
  >
): Task {
  const newTask: Task = {
    ...task,
    id: crypto.randomUUID(),
    createdAt:
      new Date().toISOString(),
  };

  saveTasks([
    newTask,
    ...getTasks(),
  ]);

  return newTask;
}

export function updateTask(
  id: string,
  updates: Partial<Task>,
  _viewAs?: string
): Task[] {
  void _viewAs;
  const updated =
    getTasks().map((task) =>
      task.id === id
        ? {
            ...task,
            ...updates,
          }
        : task
    );

  saveTasks(updated);

  return updated;
}

export function deleteTask(
  id: string
): Task[] {
  const updated =
    getTasks().filter(
      (task) => task.id !== id
    );

  saveTasks(updated);

  return updated;
}

/* =========================================================
   FOCUS
========================================================= */

export function getFocusSessions(_viewAs?: string): FocusSession[] {
  void _viewAs;
  if (typeof window === "undefined") {
    return [];
  }

  return readArray<FocusSession>(
    FOCUS_SESSIONS_KEY
  );
}

export function saveFocusSession(
  duration: number,
  intention: string,
  taskId?: string,
  _viewAs?: string
) {
  void _viewAs;
  if (typeof window === "undefined") {
    return;
  }

  const session: FocusSession = {
    id: crypto.randomUUID(),
    duration,
    completedAt:
      new Date().toISOString(),
    intention,
    taskId,
  };

  write(
    FOCUS_SESSIONS_KEY,
    [
      session,
      ...getFocusSessions(),
    ]
  );

  return session;
}

/* =========================================================
   THEME ENGINE
========================================================= */

let systemMediaQuery:
  MediaQueryList | null = null;

let systemListener:
  ((event: MediaQueryListEvent) => void) | null =
  null;

function getSystemTheme(): "light" | "dark" {
  if (
    typeof window === "undefined"
  ) {
    return "dark";
  }

  return window.matchMedia(
    "(prefers-color-scheme: light)"
  ).matches
    ? "light"
    : "dark";
}

function updateThemeMeta(
  resolvedTheme: "light" | "dark"
) {
  if (
    typeof document === "undefined"
  ) {
    return;
  }

  document.documentElement.style.colorScheme =
    resolvedTheme;

  const themeColor =
    resolvedTheme === "light"
      ? "#f6f6f8"
      : "#09090b";

  let meta =
    document.querySelector(
      'meta[name="theme-color"]'
    );

  if (!meta) {
    meta =
      document.createElement(
        "meta"
      );

    meta.setAttribute(
      "name",
      "theme-color"
    );

    document.head.appendChild(
      meta
    );
  }

  meta.setAttribute(
    "content",
    themeColor
  );
}

function applyResolvedTheme(
  selectedTheme: Theme
) {
  if (
    typeof document === "undefined"
  ) {
    return;
  }

  const resolvedTheme =
    selectedTheme === "system"
      ? getSystemTheme()
      : selectedTheme;

  const root =
    document.documentElement;

  /*
   * data-theme = user's selected option.
   *
   * data-resolved-theme = the actual
   * visual theme currently being rendered.
   */
  root.setAttribute(
    "data-theme",
    selectedTheme
  );

  root.setAttribute(
    "data-resolved-theme",
    resolvedTheme
  );

  updateThemeMeta(
    resolvedTheme
  );
}

function removeSystemListener() {
  if (
    systemMediaQuery &&
    systemListener
  ) {
    systemMediaQuery.removeEventListener?.(
      "change",
      systemListener
    );
  }

  systemMediaQuery = null;
  systemListener = null;
}

function watchSystemTheme() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  removeSystemListener();

  systemMediaQuery =
    window.matchMedia(
      "(prefers-color-scheme: light)"
    );

  systemListener = () => {
    const selectedTheme =
      getTheme();

    if (
      selectedTheme === "system"
    ) {
      applyResolvedTheme(
        "system"
      );

      window.dispatchEvent(
        new CustomEvent(
          "nexus-theme-change",
          {
            detail: "system",
          }
        )
      );
    }
  };

  systemMediaQuery.addEventListener?.(
    "change",
    systemListener
  );
}

export function getTheme(): Theme {
  if (
    typeof window === "undefined"
  ) {
    return "dark";
  }

  const stored =
    window.localStorage.getItem(
      THEME_KEY
    );

  if (
    stored === "light" ||
    stored === "system"
  ) {
    return stored;
  }

  return "dark";
}

export function setTheme(
  theme: Theme
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.localStorage.setItem(
    THEME_KEY,
    theme
  );

  applyResolvedTheme(theme);

  if (theme === "system") {
    watchSystemTheme();
  } else {
    removeSystemListener();
  }

  window.dispatchEvent(
    new CustomEvent(
      "nexus-theme-change",
      {
        detail: theme,
      }
    )
  );
}

/* =========================================================
   PREFERENCES
========================================================= */

export function getPreferences(): NexusPreferences {
  if (
    typeof window === "undefined"
  ) {
    return defaultPreferences;
  }

  const stored =
    window.localStorage.getItem(
      PREFERENCES_KEY
    );

  if (!stored) {
    return defaultPreferences;
  }

  try {
    const parsed =
      JSON.parse(stored);

    return {
      ...defaultPreferences,
      ...(parsed ?? {}),
    };
  } catch {
    return defaultPreferences;
  }
}

export function setPreferences(
  preferences: NexusPreferences
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify(preferences)
  );

  if (
    preferences.reducedMotion
  ) {
    document.documentElement.setAttribute(
      "data-reduced-motion",
      ""
    );
  } else {
    document.documentElement.removeAttribute(
      "data-reduced-motion"
    );
  }

  window.dispatchEvent(
    new CustomEvent(
      "nexus-preferences-change",
      {
        detail: preferences,
      }
    )
  );
}

/* =========================================================
   SOUND PREFERENCE
========================================================= */

export function getSoundEnabled(): boolean {
  return getPreferences().sound;
}

export function setSoundEnabled(enabled: boolean) {
  const preferences = getPreferences();

  setPreferences({
    ...preferences,
    sound: enabled,
  });
}

/* =========================================================
   PRODUCTIVITY
========================================================= */

export function getProductivityStats() {
  const tasks = getTasks();
  const sessions =
    getFocusSessions();

  const completedTasks =
    tasks.filter(
      (task) =>
        task.status ===
        "completed"
    );

  const totalFocusMinutes =
    sessions.reduce(
      (sum, session) =>
        sum + session.duration,
      0
    );

  return {
    totalTasks:
      tasks.length,

    completedTasks:
      completedTasks.length,

    totalFocusMinutes,

    productivity:
      tasks.length
        ? Math.round(
            (completedTasks.length /
              tasks.length) *
              100
          )
        : 0,

    sessionsCompleted:
      sessions.length,
  };
}