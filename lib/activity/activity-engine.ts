"use client";

import { supabase } from "@/lib/supabase";

/**
 * NEXUS Activity Engine
 *
 * Central activity history for:
 *
 * - Focus
 * - Tasks
 * - Projects
 * - Reminders
 * - Meaningful location events
 *
 * This engine is intentionally independent from React pages.
 *
 * Future consumers:
 *
 * Activity Engine
 *      ↓
 * Analytics
 *      ↓
 * Timeline
 *      ↓
 * Pattern Engine
 *      ↓
 * Context Engine
 *      ↓
 * Intelligence
 */

const STORAGE_KEY =
  "nexus-activity-history";

const MAX_ACTIVITY_ITEMS = 500;

const EVENT_NAME =
  "nexus-activity-change";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type NexusActivityCategory =
  | "focus"
  | "task"
  | "project"
  | "reminder"
  | "location"
  | "system";

export type NexusActivityType =
  | "FOCUS_STARTED"
  | "FOCUS_PAUSED"
  | "FOCUS_RESUMED"
  | "FOCUS_COMPLETED"
  | "FOCUS_CANCELLED"
  | "TASK_CREATED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_OVERDUE"
  | "PROJECT_CREATED"
  | "PROJECT_COMPLETED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "REMINDER_TRIGGERED"
  | "REMINDER_DISMISSED"
  | "LOCATION_PERMISSION_GRANTED"
  | "LOCATION_PERMISSION_DENIED"
  | "LOCATION_TRACKING_STARTED"
  | "LOCATION_TRACKING_STOPPED"
  | "LOCATION_EVENT"
  | "SYSTEM";

export type NexusActivityItem = {
  /**
   * Globally unique activity ID.
   */
  id: string;

  /**
   * High-level category.
   */
  category: NexusActivityCategory;

  /**
   * Specific event.
   */
  type: NexusActivityType;

  /**
   * Human-readable activity title.
   */
  title: string;

  /**
   * Optional descriptive text.
   */
  description?: string;

  /**
   * When the activity happened.
   */
  createdAt: string;

  /**
   * Related entity ID.
   *
   * Examples:
   *
   * task ID
   * project ID
   * focus session ID
   */
  entityId?: string;

  /**
   * Related entity type.
   */
  entityType?:
    | "task"
    | "project"
    | "focus"
    | "reminder"
    | "location"
    | "system";

  /**
   * Optional duration in minutes.
   *
   * Mainly useful for Focus activities.
   */
  durationMinutes?: number;

  /**
   * Optional metadata.
   */
  metadata?: Record<
    string,
    unknown
  >;

  userId?: string;
};

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function isBrowser(): boolean {
  return (
    typeof window !==
    "undefined"
  );
}

function createActivityId(): string {
  return `activity-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function dispatchActivityChange(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      EVENT_NAME
    )
  );
}

/**
 * Safely read activity history.
 */
function readActivities(): NexusActivityItem[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    return parsed.filter(
      (
        item
      ): item is NexusActivityItem =>
        Boolean(
          item &&
          typeof item ===
            "object" &&
          typeof item.id ===
            "string" &&
          typeof item.category ===
            "string" &&
          typeof item.type ===
            "string" &&
          typeof item.title ===
            "string" &&
          typeof item.createdAt ===
            "string"
        )
    );
  } catch (error) {
    console.error(
      "[NEXUS-ACTIVITY] Failed to read activity history:",
      error
    );

    return [];
  }
}

/**
 * Persist activity history.
 */
function writeActivities(
  activities: NexusActivityItem[]
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    const trimmed =
      activities
        .sort(
          (
            a,
            b
          ) =>
            new Date(
              b.createdAt
            ).getTime() -
            new Date(
              a.createdAt
            ).getTime()
        )
        .slice(
          0,
          MAX_ACTIVITY_ITEMS
        );

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        trimmed
      )
    );

    dispatchActivityChange();
  } catch (error) {
    console.error(
      "[NEXUS-ACTIVITY] Failed to write activity history:",
      error
    );
  }
}

/**
 * Normalize invalid dates before storing them.
 */
function normalizeDate(
  value?: string | Date
): string {
  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  if (value) {
    const parsed =
      new Date(value);

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

async function persistActivityToSupabase(item: NexusActivityItem): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("activity_logs").insert({
      id: crypto.randomUUID(),
      user_id: item.userId ?? user.id,
      category: item.category,
      type: item.type,
      title: item.title,
      description: item.description ?? null,
      entity_id: item.entityId ?? null,
      entity_type: item.entityType ?? null,
      duration_minutes: item.durationMinutes ?? null,
      metadata: item.metadata ?? {},
      created_at: item.createdAt,
    });
    if (error) console.error("[NEXUS-ACTIVITY] Supabase insert failed:", error);
  } catch (error) {
    console.error("[NEXUS-ACTIVITY] Supabase persistence failed:", error);
  }
}

export async function getSupabaseActivitiesForUser(userId: string, limit = 100): Promise<NexusActivityItem[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  const { data, error } = await supabase.from("activity_logs")
    .select("id, user_id, category, type, title, description, entity_id, entity_type, duration_minutes, metadata, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(safeLimit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id, userId: row.user_id, category: row.category, type: row.type, title: row.title,
    description: row.description ?? undefined, entityId: row.entity_id ?? undefined,
    entityType: row.entity_type ?? undefined, durationMinutes: row.duration_minutes ?? undefined,
    metadata: row.metadata ?? {}, createdAt: row.created_at,
  })) as NexusActivityItem[];
}

/* -------------------------------------------------------------------------- */
/* Core API                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Record one activity.
 *
 * This is the main API that future Event Engine
 * integrations should use.
 */
export function recordActivity(
  activity: Omit<
    NexusActivityItem,
    "id" | "createdAt"
  > & {
    id?: string;
    createdAt?: string | Date;
  }
): NexusActivityItem | null {
  if (!isBrowser()) {
    return null;
  }

  const item: NexusActivityItem =
    {
      id:
        activity.id ??
        createActivityId(),

      category:
        activity.category,

      type:
        activity.type,

      title:
        activity.title,

      description:
        activity.description,

      createdAt:
        normalizeDate(
          activity.createdAt
        ),

      entityId:
        activity.entityId,

      entityType:
        activity.entityType,

      durationMinutes:
        activity.durationMinutes,

      metadata:
        activity.metadata,

      userId:
        activity.userId,
    };

  const activities =
    readActivities();

  activities.unshift(
    item
  );

  writeActivities(
    activities
  );

  void persistActivityToSupabase(item);

  return item;
}

/**
 * Return all activities.
 */
export function getActivities(): NexusActivityItem[] {
  return readActivities().sort(
    (
      a,
      b
    ) =>
      new Date(
        b.createdAt
      ).getTime() -
      new Date(
        a.createdAt
      ).getTime()
  );
}

/**
 * Get activities for one category.
 */
export function getActivitiesByCategory(
  category: NexusActivityCategory
): NexusActivityItem[] {
  return getActivities().filter(
    (activity) =>
      activity.category ===
      category
  );
}

/**
 * Get activities for one event type.
 */
export function getActivitiesByType(
  type: NexusActivityType
): NexusActivityItem[] {
  return getActivities().filter(
    (activity) =>
      activity.type ===
      type
  );
}

/**
 * Get activities belonging to one entity.
 */
export function getActivitiesForEntity(
  entityId: string
): NexusActivityItem[] {
  return getActivities().filter(
    (activity) =>
      activity.entityId ===
      entityId
  );
}

/**
 * Get activities within a date range.
 */
export function getActivitiesBetween(
  start: Date,
  end: Date
): NexusActivityItem[] {
  const startTime =
    start.getTime();

  const endTime =
    end.getTime();

  return getActivities().filter(
    (activity) => {
      const time =
        new Date(
          activity.createdAt
        ).getTime();

      return (
        time >= startTime &&
        time <= endTime
      );
    }
  );
}

/**
 * Get today's activities.
 */
export function getTodayActivities(): NexusActivityItem[] {
  const now =
    new Date();

  const start =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

  const end =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

  return getActivitiesBetween(
    start,
    end
  );
}

/**
 * Get activities from the previous N days.
 */
export function getRecentActivities(
  days = 7
): NexusActivityItem[] {
  const safeDays =
    Math.max(
      1,
      Math.floor(days)
    );

  const end =
    new Date();

  const start =
    new Date(
      end.getTime() -
        safeDays *
          24 *
          60 *
          60 *
          1000
    );

  return getActivitiesBetween(
    start,
    end
  );
}

/**
 * Find an activity by ID.
 */
export function getActivityById(
  id: string
): NexusActivityItem | null {
  return (
    getActivities().find(
      (activity) =>
        activity.id ===
        id
    ) ?? null
  );
}

/**
 * Remove one activity.
 */
export function removeActivity(
  id: string
): boolean {
  if (!isBrowser()) {
    return false;
  }

  const activities =
    readActivities();

  const filtered =
    activities.filter(
      (activity) =>
        activity.id !== id
    );

  if (
    filtered.length ===
    activities.length
  ) {
    return false;
  }

  writeActivities(
    filtered
  );

  return true;
}

/**
 * Clear complete activity history.
 */
export function clearActivityHistory(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(
      STORAGE_KEY
    );

    dispatchActivityChange();
  } catch (error) {
    console.error(
      "[NEXUS-ACTIVITY] Failed to clear activity history:",
      error
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Focus                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record Focus started.
 */
export function recordFocusStarted(
  options?: {
    focusId?: string;
    taskId?: string;
    taskTitle?: string;
    durationMinutes?: number;
    intention?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "focus",

    type:
      "FOCUS_STARTED",

    title:
      "Focus started",

    description:
      options?.taskTitle
        ? `Started a focus session for “${options.taskTitle}”.`
        : options?.intention
          ? options.intention
          : "Started a focus session.",

    entityId:
      options?.focusId,

    entityType:
      "focus",

    durationMinutes:
      options?.durationMinutes,

    metadata: {
      taskId:
        options?.taskId,

      taskTitle:
        options?.taskTitle,

      intention:
        options?.intention,
    },
  });
}

/**
 * Record Focus paused.
 */
export function recordFocusPaused(
  options?: {
    focusId?: string;
    elapsedMinutes?: number;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "focus",

    type:
      "FOCUS_PAUSED",

    title:
      "Focus paused",

    description:
      "Focus session was paused.",

    entityId:
      options?.focusId,

    entityType:
      "focus",

    durationMinutes:
      options?.elapsedMinutes,
  });
}

/**
 * Record Focus resumed.
 */
export function recordFocusResumed(
  options?: {
    focusId?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "focus",

    type:
      "FOCUS_RESUMED",

    title:
      "Focus resumed",

    description:
      "Focus session was resumed.",

    entityId:
      options?.focusId,

    entityType:
      "focus",
  });
}

/**
 * Record Focus completed.
 */
export function recordFocusCompleted(
  options?: {
    focusId?: string;
    taskId?: string;
    taskTitle?: string;
    durationMinutes?: number;
    intention?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "focus",

    type:
      "FOCUS_COMPLETED",

    title:
      "Focus completed",

    description:
      options?.taskTitle
        ? `Completed a focus session for “${options.taskTitle}”.`
        : "Completed a focus session.",

    entityId:
      options?.focusId,

    entityType:
      "focus",

    durationMinutes:
      options?.durationMinutes,

    metadata: {
      taskId:
        options?.taskId,

      taskTitle:
        options?.taskTitle,

      intention:
        options?.intention,
    },
  });
}

/**
 * Record Focus cancellation.
 */
export function recordFocusCancelled(
  options?: {
    focusId?: string;
    elapsedMinutes?: number;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "focus",

    type:
      "FOCUS_CANCELLED",

    title:
      "Focus cancelled",

    description:
      "Focus session was cancelled.",

    entityId:
      options?.focusId,

    entityType:
      "focus",

    durationMinutes:
      options?.elapsedMinutes,
  });
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record task creation.
 */
export function recordTaskCreated(
  options: {
    taskId: string;
    taskTitle: string;
    priority?: string;
    dueDate?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "task",

    type:
      "TASK_CREATED",

    title:
      "Task created",

    description:
      `Created “${options.taskTitle}”.`,

    entityId:
      options.taskId,

    entityType:
      "task",

    metadata: {
      taskTitle:
        options.taskTitle,

      priority:
        options.priority,

      dueDate:
        options.dueDate,
    },
  });
}

/**
 * Record task started.
 */
export function recordTaskStarted(
  options: {
    taskId: string;
    taskTitle: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "task",

    type:
      "TASK_STARTED",

    title:
      "Task started",

    description:
      `Started working on “${options.taskTitle}”.`,

    entityId:
      options.taskId,

    entityType:
      "task",

    metadata: {
      taskTitle:
        options.taskTitle,
    },
  });
}

/**
 * Record task completion.
 */
export function recordTaskCompleted(
  options: {
    taskId: string;
    taskTitle: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "task",

    type:
      "TASK_COMPLETED",

    title:
      "Task completed",

    description:
      `Completed “${options.taskTitle}”.`,

    entityId:
      options.taskId,

    entityType:
      "task",

    metadata: {
      taskTitle:
        options.taskTitle,
    },
  });
}

/**
 * Record task update.
 */
export function recordTaskUpdated(
  options: {
    taskId: string;
    taskTitle: string;
    changes?: Record<
      string,
      unknown
    >;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "task",

    type:
      "TASK_UPDATED",

    title:
      "Task updated",

    description:
      `Updated “${options.taskTitle}”.`,

    entityId:
      options.taskId,

    entityType:
      "task",

    metadata: {
      taskTitle:
        options.taskTitle,

      changes:
        options.changes,
    },
  });
}

/**
 * Record task deletion.
 */
export function recordTaskDeleted(
  options: {
    taskId: string;
    taskTitle: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "task",

    type:
      "TASK_DELETED",

    title:
      "Task deleted",

    description:
      `Deleted “${options.taskTitle}”.`,

    entityId:
      options.taskId,

    entityType:
      "task",

    metadata: {
      taskTitle:
        options.taskTitle,
    },
  });
}

/**
 * Record task overdue.
 */
export function recordTaskOverdue(
  options: {
    taskId: string;
    taskTitle: string;
    dueDate?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "task",

    type:
      "TASK_OVERDUE",

    title:
      "Task overdue",

    description:
      `“${options.taskTitle}” is overdue.`,

    entityId:
      options.taskId,

    entityType:
      "task",

    metadata: {
      taskTitle:
        options.taskTitle,

      dueDate:
        options.dueDate,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Record project creation.
 */
export function recordProjectCreated(
  options: {
    projectId: string;
    projectTitle: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "project",

    type:
      "PROJECT_CREATED",

    title:
      "Project created",

    description:
      `Created project “${options.projectTitle}”.`,

    entityId:
      options.projectId,

    entityType:
      "project",

    metadata: {
      projectTitle:
        options.projectTitle,
    },
  });
}

/**
 * Record project completion.
 */
export function recordProjectCompleted(
  options: {
    projectId: string;
    projectTitle: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "project",

    type:
      "PROJECT_COMPLETED",

    title:
      "Project completed",

    description:
      `Completed project “${options.projectTitle}”.`,

    entityId:
      options.projectId,

    entityType:
      "project",

    metadata: {
      projectTitle:
        options.projectTitle,
    },
  });
}

/**
 * Record project update.
 */
export function recordProjectUpdated(
  options: {
    projectId: string;
    projectTitle: string;
    changes?: Record<
      string,
      unknown
    >;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "project",

    type:
      "PROJECT_UPDATED",

    title:
      "Project updated",

    description:
      `Updated project “${options.projectTitle}”.`,

    entityId:
      options.projectId,

    entityType:
      "project",

    metadata: {
      projectTitle:
        options.projectTitle,

      changes:
        options.changes,
    },
  });
}

/**
 * Record project deletion.
 */
export function recordProjectDeleted(
  options: {
    projectId: string;
    projectTitle: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "project",

    type:
      "PROJECT_DELETED",

    title:
      "Project deleted",

    description:
      `Deleted project “${options.projectTitle}”.`,

    entityId:
      options.projectId,

    entityType:
      "project",

    metadata: {
      projectTitle:
        options.projectTitle,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Reminders                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Record reminder triggered.
 */
export function recordReminderTriggered(
  options: {
    reminderId?: string;
    taskId?: string;
    taskTitle?: string;
    reminderType?: string;
    notificationId?: number;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "reminder",

    type:
      "REMINDER_TRIGGERED",

    title:
      "Reminder triggered",

    description:
      options?.taskTitle
        ? `Reminder for “${options.taskTitle}”.`
        : "A reminder was triggered.",

    entityId:
      options.reminderId,

    entityType:
      "reminder",

    metadata: {
      taskId:
        options.taskId,

      taskTitle:
        options.taskTitle,

      reminderType:
        options.reminderType,

      notificationId:
        options.notificationId,
    },
  });
}

/**
 * Record reminder dismissal.
 */
export function recordReminderDismissed(
  options: {
    reminderId?: string;
    taskId?: string;
    taskTitle?: string;
    reminderType?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "reminder",

    type:
      "REMINDER_DISMISSED",

    title:
      "Reminder dismissed",

    description:
      options?.taskTitle
        ? `Dismissed reminder for “${options.taskTitle}”.`
        : "A reminder was dismissed.",

    entityId:
      options.reminderId,

    entityType:
      "reminder",

    metadata: {
      taskId:
        options.taskId,

      taskTitle:
        options.taskTitle,

      reminderType:
        options.reminderType,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Location                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Record location permission granted.
 */
export function recordLocationPermissionGranted(): NexusActivityItem | null {
  return recordActivity({
    category:
      "location",

    type:
      "LOCATION_PERMISSION_GRANTED",

    title:
      "Location access granted",

    description:
      "NEXUS received permission to use location.",

    entityType:
      "location",
  });
}

/**
 * Record location permission denied.
 */
export function recordLocationPermissionDenied(): NexusActivityItem | null {
  return recordActivity({
    category:
      "location",

    type:
      "LOCATION_PERMISSION_DENIED",

    title:
      "Location access denied",

    description:
      "Location access was denied.",

    entityType:
      "location",
  });
}

/**
 * Record location tracking started.
 */
export function recordLocationTrackingStarted(): NexusActivityItem | null {
  return recordActivity({
    category:
      "location",

    type:
      "LOCATION_TRACKING_STARTED",

    title:
      "Location tracking started",

    description:
      "NEXUS started location tracking.",

    entityType:
      "location",
  });
}

/**
 * Record location tracking stopped.
 */
export function recordLocationTrackingStopped(): NexusActivityItem | null {
  return recordActivity({
    category:
      "location",

    type:
      "LOCATION_TRACKING_STOPPED",

    title:
      "Location tracking stopped",

    description:
      "NEXUS stopped location tracking.",

    entityType:
      "location",
  });
}

/**
 * Record a meaningful location event.
 *
 * This does NOT mean recording every GPS sample.
 * Only meaningful user-facing location events
 * should enter activity history.
 */
export function recordLocationEvent(
  options: {
    title: string;
    description?: string;
    locationLabel?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    eventType?: string;
  }
): NexusActivityItem | null {
  return recordActivity({
    category:
      "location",

    type:
      "LOCATION_EVENT",

    title:
      options.title,

    description:
      options.description,

    entityType:
      "location",

    metadata: {
      locationLabel:
        options.locationLabel,

      latitude:
        options.latitude,

      longitude:
        options.longitude,

      accuracy:
        options.accuracy,

      eventType:
        options.eventType,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Analytics helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Count activities by category.
 */
export function getActivityCounts(): Record<
  NexusActivityCategory,
  number
> {
  const counts: Record<
    NexusActivityCategory,
    number
  > = {
    focus: 0,
    task: 0,
    project: 0,
    reminder: 0,
    location: 0,
    system: 0,
  };

  for (
    const activity of getActivities()
  ) {
    counts[
      activity.category
    ] += 1;
  }

  return counts;
}

/**
 * Count activities by event type.
 */
export function getActivityTypeCounts(): Partial<
  Record<
    NexusActivityType,
    number
  >
> {
  const counts: Partial<
    Record<
      NexusActivityType,
      number
    >
  > = {};

  for (
    const activity of getActivities()
  ) {
    counts[activity.type] =
      (counts[
        activity.type
      ] ?? 0) + 1;
  }

  return counts;
}

/**
 * Calculate total completed Focus minutes
 * from activity history.
 */
export function getCompletedFocusMinutes(
  activities:
    NexusActivityItem[] =
      getActivities()
): number {
  return activities
    .filter(
      (activity) =>
        activity.type ===
        "FOCUS_COMPLETED"
    )
    .reduce(
      (
        total,
        activity
      ) =>
        total +
        (activity.durationMinutes ??
          0),
      0
    );
}

/**
 * Calculate completed Focus sessions.
 */
export function getCompletedFocusSessions(
  activities:
    NexusActivityItem[] =
      getActivities()
): number {
  return activities.filter(
    (activity) =>
      activity.type ===
      "FOCUS_COMPLETED"
  ).length;
}

/**
 * Calculate completed tasks.
 */
export function getCompletedTaskCount(
  activities:
    NexusActivityItem[] =
      getActivities()
): number {
  return activities.filter(
    (activity) =>
      activity.type ===
      "TASK_COMPLETED"
  ).length;
}

/**
 * Calculate completed projects.
 */
export function getCompletedProjectCount(
  activities:
    NexusActivityItem[] =
      getActivities()
): number {
  return activities.filter(
    (activity) =>
      activity.type ===
      "PROJECT_COMPLETED"
  ).length;
}

/**
 * Get a simple productivity summary.
 */
export function getActivitySummary(
  activities:
    NexusActivityItem[] =
      getTodayActivities()
) {
  return {
    totalActivities:
      activities.length,

    focusSessions:
      getCompletedFocusSessions(
        activities
      ),

    focusMinutes:
      getCompletedFocusMinutes(
        activities
      ),

    completedTasks:
      getCompletedTaskCount(
        activities
      ),

    completedProjects:
      getCompletedProjectCount(
        activities
      ),

    remindersTriggered:
      activities.filter(
        (activity) =>
          activity.type ===
          "REMINDER_TRIGGERED"
      ).length,

    remindersDismissed:
      activities.filter(
        (activity) =>
          activity.type ===
          "REMINDER_DISMISSED"
      ).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Subscription                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Subscribe to activity changes.
 *
 * Useful for:
 *
 * - Analytics
 * - Dashboard
 * - Timeline
 * - Activity UI
 */
export function subscribeToActivityHistory(
  listener: () => void
): () => void {
  if (!isBrowser()) {
    return () =>
      undefined;
  }

  const handleChange =
    () => {
      listener();
    };

  window.addEventListener(
    EVENT_NAME,
    handleChange
  );

  window.addEventListener(
    "storage",
    handleChange
  );

  return () => {
    window.removeEventListener(
      EVENT_NAME,
      handleChange
    );

    window.removeEventListener(
      "storage",
      handleChange
    );
  };
}

/* -------------------------------------------------------------------------- */
/* Maintenance                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Remove activities older than the
 * specified number of days.
 *
 * Default: 90 days.
 *
 * This is intentionally local retention only.
 * Sync/remote retention belongs to the future
 * Offline + Sync and Privacy layers.
 */
export function pruneActivityHistory(
  retentionDays = 90
): number {
  if (!isBrowser()) {
    return 0;
  }

  const cutoff =
    Date.now() -
    Math.max(
      1,
      retentionDays
    ) *
      24 *
      60 *
      60 *
      1000;

  const activities =
    readActivities();

  const retained =
    activities.filter(
      (activity) =>
        new Date(
          activity.createdAt
        ).getTime() >=
        cutoff
    );

  const removed =
    activities.length -
    retained.length;

  if (removed > 0) {
    writeActivities(
      retained
    );
  }

  return removed;
}

/**
 * Get storage information.
 */
export function getActivityStorageInfo() {
  const activities =
    getActivities();

  return {
    count:
      activities.length,

    maxItems:
      MAX_ACTIVITY_ITEMS,

    storageKey:
      STORAGE_KEY,

    oldest:
      activities.length > 0
        ? activities[
            activities.length -
              1
          ].createdAt
        : null,

    newest:
      activities.length > 0
        ? activities[0]
            .createdAt
        : null,
  };
}