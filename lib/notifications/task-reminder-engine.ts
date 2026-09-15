import {
    cancelNotification,
    getNotificationPermission,
    getPendingNotifications,
  } from "@/lib/native/notifications";
  
  import {
    isNotificationDismissed,
  } from "@/lib/notifications/notification-history";
  
  import {
    scheduleNexusNotification,
  } from "@/lib/notifications/notification-engine";
  
  import type { Task } from "@/lib/workspace-store";
  
  const TASK_REMINDER_SLOTS = [
    "morning",
    "evening",
    "overdue",
  ] as const;
  
  type TaskReminderSlot =
    (typeof TASK_REMINDER_SLOTS)[number];
  
  type TaskReminderType =
    | "task-reminder"
    | "task-overdue";
  
  /**
   * Generate a stable positive numeric hash.
   *
   * Android notification IDs must be numbers.
   * The same task + reminder slot always produces
   * the same native notification ID.
   */
  function hashId(value: string): number {
    let hash = 2166136261;
  
    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^= value.charCodeAt(index);
  
      hash = Math.imul(
        hash,
        16777619
      );
    }
  
    return Math.abs(hash) % 900000000;
  }
  
  /**
   * Get the stable native notification ID
   * for one task + reminder slot.
   *
   * The due date is intentionally NOT part of the
   * native ID. When the due date changes, the old
   * notification is cancelled and the same native
   * ID is reused for the new schedule.
   */
  function getTaskReminderId(
    taskId: string,
    slot: TaskReminderSlot
  ): number {
    const slotNumber =
      TASK_REMINDER_SLOTS.indexOf(slot) + 1;
  
    return (
      1000000000 +
      hashId(
        `${taskId}:task-reminder:${slot}`
      ) +
      slotNumber
    );
  }
  
  /**
   * Get all native reminder IDs belonging to a task.
   */
  export function getTaskReminderIds(
    taskId: string
  ): number[] {
    return TASK_REMINDER_SLOTS.map(
      (slot) =>
        getTaskReminderId(
          taskId,
          slot
        )
    );
  }
  
  /**
   * Get the logical identity of one reminder occurrence.
   *
   * The due date IS part of this key.
   *
   * Therefore:
   *
   * Sep 11 morning
   *      !=
   * Sep 12 morning
   *
   * This allows a dismissed reminder for an old
   * due date to remain dismissed while a new due
   * date creates a new reminder occurrence.
   */
  function getTaskReminderKey(
    task: Task,
    slot: TaskReminderSlot
  ): string {
    return [
      "task",
      task.id,
      slot,
      task.dueDate,
    ].join(":");
  }
  
  /**
   * Parse YYYY-MM-DD as a local calendar date.
   *
   * We intentionally avoid new Date("YYYY-MM-DD")
   * because that format can be interpreted as UTC.
   */
  function parseLocalDate(
    value: string
  ): Date | null {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        value
      );
  
    if (!match) {
      return null;
    }
  
    const year = Number(
      match[1]
    );
  
    const month = Number(
      match[2]
    );
  
    const day = Number(
      match[3]
    );
  
    const date = new Date(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );
  
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
  
    return date;
  }
  
  /**
   * Apply a local clock time to a date.
   */
  function withTime(
    date: Date,
    hour: number,
    minute: number
  ): Date {
    const result =
      new Date(date);
  
    result.setHours(
      hour,
      minute,
      0,
      0
    );
  
    return result;
  }
  
  /**
   * Cancel every native reminder belonging
   * to one task.
   */
  async function cancelTaskReminderIds(
    taskId: string
  ): Promise<void> {
    await Promise.all(
      getTaskReminderIds(
        taskId
      ).map(
        (id) =>
          cancelNotification(id)
      )
    );
  }
  
  /**
   * Public API for cancelling all reminders
   * belonging to one task.
   *
   * Call this when:
   *
   * - task is completed
   * - task is deleted
   * - reminders are disabled
   * - task due date is changed
   */
  export async function cancelTaskReminders(
    taskId: string
  ): Promise<void> {
    await cancelTaskReminderIds(
      taskId
    );
  }
  
  /**
   * Schedule one task reminder.
   *
   * This function is responsible for:
   *
   * 1. Checking persistent dismissal state.
   * 2. Ignoring expired schedules.
   * 3. Creating a stable native notification.
   * 4. Attaching enough metadata for Notification Center
   *    and future automation.
   */
  async function scheduleReminder(
    task: Task,
    slot: TaskReminderSlot,
    scheduleAt: Date,
    type: TaskReminderType,
    title: string,
    body: string
  ): Promise<void> {
    const notificationKey =
      getTaskReminderKey(
        task,
        slot
      );
  
    /*
     * If the user explicitly dismissed this
     * logical reminder occurrence, NEVER recreate it.
     *
     * This is what makes dismissal survive:
     *
     * - reload
     * - navigation
     * - app restart
     * - Android app reopening
     */
    if (
      isNotificationDismissed(
        notificationKey
      )
    ) {
      return;
    }
  
    /*
     * Never schedule something that is already
     * in the past.
     */
    if (
      scheduleAt.getTime() <=
      Date.now()
    ) {
      return;
    }
  
    const notificationId =
      getTaskReminderId(
        task.id,
        slot
      );
  
    await scheduleNexusNotification({
      type,
  
      id: notificationId,
  
      title,
  
      body,
  
      scheduleAt,
  
      extra: {
        screen: "/projects",
  
        event:
          type === "task-overdue"
            ? "TASK_OVERDUE"
            : "TASK_DUE_SOON",
  
        taskId:
          task.id,
  
        taskTitle:
          task.title,
  
        reminderSlot:
          slot,
  
        notificationKey,
  
        dueDate:
          task.dueDate,
      },
    });
  }
  
  /**
   * Schedule native task reminders.
   *
   * Current Task model stores a date only.
   *
   * NEXUS therefore uses:
   *
   * 09:00 on due date
   *      ↓
   * Task due today
   *
   * 18:00 on due date
   *      ↓
   * Task still due today
   *
   * 09:00 next day
   *      ↓
   * Task overdue
   *
   * Native scheduling works even when
   * the NEXUS application is closed.
   */
  export async function scheduleTaskReminders(
    task: Task,
    enabled = true
  ): Promise<void> {
    /*
     * Disabled notifications mean there must
     * be no native reminders remaining.
     */
    if (!enabled) {
      await cancelTaskReminderIds(
        task.id
      );
  
      return;
    }
  
    /*
     * Completed tasks must never have
     * active reminders.
     */
    if (
      task.status === "completed" ||
      !task.dueDate
    ) {
      await cancelTaskReminderIds(
        task.id
      );
  
      return;
    }
  
    /*
     * Notification permission must already
     * be granted.
     *
     * We intentionally do not request permission
     * automatically while creating a task.
     */
    const permission =
      await getNotificationPermission();
  
    if (
      permission !== "granted"
    ) {
      await cancelTaskReminderIds(
        task.id
      );
  
      return;
    }
  
    const dueDate =
      parseLocalDate(
        task.dueDate
      );
  
    if (!dueDate) {
      await cancelTaskReminderIds(
        task.id
      );
  
      return;
    }
  
    const morning =
      withTime(
        dueDate,
        9,
        0
      );
  
    const evening =
      withTime(
        dueDate,
        18,
        0
      );
  
    const overdueDate =
      new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate() + 1,
        0,
        0,
        0,
        0
      );
  
    const overdue =
      withTime(
        overdueDate,
        9,
        0
      );
  
    /*
     * Cancel old schedules immediately before
     * rebuilding the task's current schedule.
     *
     * This handles:
     *
     * - changed due dates
     * - edited tasks
     * - previously scheduled reminders
     */
    await cancelTaskReminderIds(
      task.id
    );
  
    /*
     * MORNING
     */
    await scheduleReminder(
      task,
      "morning",
      morning,
      "task-reminder",
      "Task due today",
      `“${task.title}” is due today.`
    );
  
    /*
     * EVENING
     */
    await scheduleReminder(
      task,
      "evening",
      evening,
      "task-reminder",
      "Task still due today",
      `“${task.title}” is still waiting for you.`
    );
  
    /*
     * OVERDUE
     */
    await scheduleReminder(
      task,
      "overdue",
      overdue,
      "task-overdue",
      "Task overdue",
      `“${task.title}” is overdue.`
    );
  }
  
  /**
   * Remove native reminders belonging to tasks
   * that no longer exist in the workspace.
   *
   * This handles:
   *
   * User creates task
   *      ↓
   * Reminder scheduled
   *      ↓
   * User deletes task
   *      ↓
   * App starts again
   *      ↓
   * Orphaned native reminder is removed
   */
  async function cancelOrphanedTaskReminders(
    tasks: Task[]
  ): Promise<void> {
    const taskIds =
      new Set(
        tasks.map(
          (task) =>
            task.id
        )
      );
  
    const pending =
      await getPendingNotifications();
  
    if (
      pending.length === 0
    ) {
      return;
    }
  
    const orphanedIds =
      pending
        .filter(
          (notification) => {
            const extra =
              notification.extra as
                | Record<
                    string,
                    unknown
                  >
                | undefined;
  
            const taskId =
              typeof extra?.taskId ===
              "string"
                ? extra.taskId
                : undefined;
  
            /*
             * Only inspect notifications that
             * actually belong to a NEXUS task.
             *
             * Focus/system notifications are ignored.
             */
            return (
              taskId !== undefined &&
              !taskIds.has(taskId)
            );
          }
        )
        .map(
          (notification) =>
            notification.id
        );
  
    if (
      orphanedIds.length === 0
    ) {
      return;
    }
  
    await Promise.all(
      orphanedIds.map(
        (id) =>
          cancelNotification(id)
      )
    );
  }
  
  /**
   * Reconcile the complete task reminder system.
   *
   * Called when:
   *
   * - NEXUS starts
   * - task data changes
   * - notification preference changes
   *
   * The reconciliation process:
   *
   * 1. Remove reminders for deleted tasks.
   * 2. Remove reminders for completed tasks.
   * 3. Remove reminders when notifications are disabled.
   * 4. Cancel old schedules.
   * 5. Recreate only valid current schedules.
   * 6. Skip reminders that the user permanently dismissed.
   */
  export async function syncTaskReminders(
    tasks: Task[],
    enabled = true
  ): Promise<void> {
    /*
     * First remove reminders belonging
     * to tasks that no longer exist.
     */
    await cancelOrphanedTaskReminders(
      tasks
    );
  
    /*
     * Then reconcile every current task.
     */
    await Promise.all(
      tasks.map(
        (task) =>
          scheduleTaskReminders(
            task,
            enabled
          )
      )
    );
  }