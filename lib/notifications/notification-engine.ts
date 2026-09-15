import {
    cancelNotification,
    NOTIFICATION_CHANNELS,
    type NexusNotificationChannel,
    sendNotification,
    scheduleNotification,
  } from "@/lib/native/notifications";
  import { getPreferences } from "@/lib/workspace-store";
  import {
    getNotificationKey,
    isNotificationDismissed,
    saveNotificationHistory,
  } from "@/lib/notifications/notification-history";
  
  export type NexusNotificationType =
    | "focus-started"
    | "focus-warning"
    | "focus-complete"
    | "task-reminder"
    | "task-overdue"
    | "project-complete"
    | "system"
    | "test";
  
  export type NexusNotificationPayload = {
    type: NexusNotificationType;
    title: string;
    body: string;
    channelId?: NexusNotificationChannel;
    id?: number;
    scheduleAt?: Date;
    extra?: Record<string, unknown>;
  };
  
  const FOCUS_START_ID = 71001;
  const FOCUS_WARNING_ID = 71002;
  const FOCUS_COMPLETE_ID = 71003;
  
  export const FOCUS_NOTIFICATION_IDS = [
    FOCUS_START_ID,
    FOCUS_WARNING_ID,
    FOCUS_COMPLETE_ID,
  ];
  
  function notificationsEnabled(): boolean {
    return getPreferences().notifications;
  }
  
  function buildFocusContext(
    taskTitle?: string,
    intention?: string
  ): string {
    const context =
      taskTitle?.trim() || intention?.trim();
  
    return context ? ` • ${context}` : "";
  }
  
  function buildHistoryItem(
    payload: NexusNotificationPayload,
    id: number,
    extra: Record<string, unknown>
  ) {
    return {
      id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      scheduledAt:
        payload.scheduleAt?.toISOString(),
      screen:
        typeof extra.screen === "string"
          ? extra.screen
          : undefined,
      extra,
    };
  }
  
  function isDismissed(
    payload: NexusNotificationPayload,
    id: number,
    extra: Record<string, unknown>
  ): boolean {
    return isNotificationDismissed(
      getNotificationKey(
        buildHistoryItem(
          payload,
          id,
          extra
        )
      )
    );
  }
  
  /**
   * Send an immediate NEXUS notification.
   *
   * A notification is only added to the NEXUS inbox after the
   * native/browser delivery call succeeds. A dismissed logical
   * occurrence is never recreated.
   */
  export async function notify(
    payload: NexusNotificationPayload
  ): Promise<boolean> {
    if (!notificationsEnabled()) {
      return false;
    }
  
    const id =
      payload.id ??
      Math.floor(Date.now() % 2147483647);
  
    const extra: Record<string, unknown> = {
      type: payload.type,
      ...payload.extra,
    };
  
    if (
      isDismissed(
        payload,
        id,
        extra
      )
    ) {
      return false;
    }
  
    const sent = await sendNotification({
      id,
      title: payload.title,
      body: payload.body,
      channelId:
        payload.channelId ??
        NOTIFICATION_CHANNELS.default,
      scheduleAt: payload.scheduleAt,
      extra,
    });
  
    if (!sent) {
      return false;
    }
  
    saveNotificationHistory(
      buildHistoryItem(
        payload,
        id,
        extra
      )
    );
  
    return true;
  }
  
  /**
   * Schedule a future NEXUS notification.
   *
   * Android/iOS use the native Local Notifications scheduler,
   * so the app does not need to remain open for delivery.
   */
  export async function scheduleNexusNotification(
    payload: NexusNotificationPayload
  ): Promise<boolean> {
    if (!notificationsEnabled()) {
      return false;
    }
  
    if (!payload.scheduleAt) {
      return notify(payload);
    }
  
    if (
      payload.scheduleAt.getTime() <=
      Date.now()
    ) {
      return notify({
        ...payload,
        scheduleAt: undefined,
      });
    }
  
    const id =
      payload.id ??
      Math.floor(Date.now() % 2147483647);
  
    const extra: Record<string, unknown> = {
      type: payload.type,
      ...payload.extra,
    };
  
    /*
     * This is the critical persistence guard.
     * If the user dismissed this logical occurrence, startup
     * reconciliation can safely run again without resurrecting it.
     */
    if (
      isDismissed(
        payload,
        id,
        extra
      )
    ) {
      return false;
    }
  
    const scheduled =
      await scheduleNotification({
        id,
        title: payload.title,
        body: payload.body,
        channelId:
          payload.channelId ??
          NOTIFICATION_CHANNELS.default,
        scheduleAt: payload.scheduleAt,
        extra,
      });
  
    if (!scheduled) {
      return false;
    }
  
    saveNotificationHistory(
      buildHistoryItem(
        payload,
        id,
        extra
      )
    );
  
    return true;
  }
  
  /**
   * Schedule the complete Focus notification sequence.
   *
   * Start
   *   ↓
   * 5 minutes remaining
   *   ↓
   * Complete
   */
  export async function scheduleFocusNotifications({
    remainingSeconds,
    taskTitle,
    intention,
    resumed = false,
  }: {
    remainingSeconds: number;
    taskTitle?: string;
    intention?: string;
    resumed?: boolean;
  }): Promise<void> {
    if (!notificationsEnabled()) {
      return;
    }
  
    const safeRemaining = Math.max(
      1,
      Math.round(remainingSeconds)
    );
  
    await cancelFocusNotifications();
  
    const context = buildFocusContext(
      taskTitle,
      intention
    );
  
    /*
     * Each call represents a new Focus occurrence.
     * Stable native IDs are still used so pause/resume can
     * replace native schedules, while the logical key prevents
     * a dismissal from blocking a later Focus session.
     */
    const focusSessionKey =
      `focus:${Date.now()}`;
  
    await notify({
      type: "focus-started",
      id: FOCUS_START_ID,
      title: resumed
        ? "Focus resumed"
        : "Focus started",
      body: resumed
        ? `Back to deep work${context}.`
        : `Your ${Math.ceil(
            safeRemaining / 60
          )}-minute focus session has started${context}.`,
      channelId:
        NOTIFICATION_CHANNELS.focus,
      extra: {
        screen: "/focus",
        event: resumed
          ? "FOCUS_RESUMED"
          : "FOCUS_STARTED",
        notificationKey:
          focusSessionKey,
      },
    });
  
    const completionAt = new Date(
      Date.now() +
        safeRemaining * 1000
    );
  
    await scheduleNexusNotification({
      type: "focus-complete",
      id: FOCUS_COMPLETE_ID,
      title: "Focus complete",
      body:
        `Your focus session is complete${context}. Nice work.`,
      channelId:
        NOTIFICATION_CHANNELS.focus,
      scheduleAt: completionAt,
      extra: {
        screen: "/focus",
        event: "FOCUS_COMPLETED",
        notificationKey:
          `${focusSessionKey}:complete`,
      },
    });
  
    const warningSeconds =
      safeRemaining - 5 * 60;
  
    if (warningSeconds > 0) {
      await scheduleNexusNotification({
        type: "focus-warning",
        id: FOCUS_WARNING_ID,
        title: "5 minutes left",
        body:
          `Your focus session has 5 minutes remaining${context}.`,
        channelId:
          NOTIFICATION_CHANNELS.focus,
        scheduleAt: new Date(
          Date.now() +
            warningSeconds * 1000
        ),
        extra: {
          screen: "/focus",
          event: "FOCUS_WARNING",
          notificationKey:
            `${focusSessionKey}:warning`,
        },
      });
    }
  }
  
  export async function cancelFocusNotifications(): Promise<void> {
    await Promise.all(
      FOCUS_NOTIFICATION_IDS.map((id) =>
        cancelNotification(id)
      )
    );
  }
  
  export async function notifyFocusComplete(
    taskTitle?: string,
    intention?: string
  ): Promise<boolean> {
    const context = buildFocusContext(
      taskTitle,
      intention
    );
  
    return notify({
      type: "focus-complete",
      title: "Focus complete",
      body:
        `Your focus session is complete${context}. Nice work.`,
      channelId:
        NOTIFICATION_CHANNELS.focus,
      extra: {
        screen: "/focus",
        event: "FOCUS_COMPLETED",
      },
    });
  }
  
  export async function notifyFocusWarning(
    remainingMinutes = 5
  ): Promise<boolean> {
    return notify({
      type: "focus-warning",
      title: `${remainingMinutes} minutes left`,
      body:
        `Stay with it. Your focus session has ${remainingMinutes} minutes remaining.`,
      channelId:
        NOTIFICATION_CHANNELS.focus,
      extra: {
        screen: "/focus",
        event: "FOCUS_WARNING",
      },
    });
  }
  
  export async function notifyTaskReminder(
    taskTitle: string,
    minutesUntilDue?: number
  ): Promise<boolean> {
    const body =
      minutesUntilDue !== undefined
        ? `“${taskTitle}” is due in ${minutesUntilDue} minutes.`
        : `“${taskTitle}” needs your attention.`;
  
    return notify({
      type: "task-reminder",
      title: "Task reminder",
      body,
      channelId:
        NOTIFICATION_CHANNELS.tasks,
      extra: {
        screen: "/projects",
        event: "TASK_DUE_SOON",
        taskTitle,
      },
    });
  }
  
  export async function notifyTaskOverdue(
    taskTitle: string
  ): Promise<boolean> {
    return notify({
      type: "task-overdue",
      title: "Task overdue",
      body:
        `“${taskTitle}” is overdue.`,
      channelId:
        NOTIFICATION_CHANNELS.tasks,
      extra: {
        screen: "/projects",
        event: "TASK_OVERDUE",
        taskTitle,
      },
    });
  }
  
  export async function notifyProjectComplete(
    projectTitle: string
  ): Promise<boolean> {
    return notify({
      type: "project-complete",
      title: "Project completed",
      body:
        `“${projectTitle}” is complete.`,
      channelId:
        NOTIFICATION_CHANNELS.default,
      extra: {
        screen: "/projects",
        event: "PROJECT_COMPLETED",
        projectTitle,
      },
    });
  }
  
  export async function notifySystem(
    title: string,
    body: string,
    extra?: Record<string, unknown>
  ): Promise<boolean> {
    return notify({
      type: "system",
      title,
      body,
      channelId:
        NOTIFICATION_CHANNELS.default,
      extra,
    });
  }
  
  export async function sendTestNotification(): Promise<boolean> {
    return notify({
      type: "test",
      id: Math.floor(
        Date.now() % 2147483647
      ),
      title: "NEXUS is working",
      body:
        "Notifications are connected successfully.",
      channelId:
        NOTIFICATION_CHANNELS.default,
      extra: {
        screen: "/settings",
        event: "NOTIFICATION_TEST",
      },
    });
  }
  
  export async function scheduleTestTaskReminder(
    taskTitle = "NEXUS notification test"
  ): Promise<boolean> {
    const testId = 72001;
    const scheduleAt = new Date(
      Date.now() + 60 * 1000
    );
  
    await cancelNotification(testId);
  
    return scheduleNexusNotification({
      type: "task-reminder",
      id: testId,
      title: "Task reminder test",
      body:
        `“${taskTitle}” reminder fires now.`,
      channelId:
        NOTIFICATION_CHANNELS.tasks,
      scheduleAt,
      extra: {
        screen: "/projects",
        event: "TASK_REMINDER_TEST",
        taskId: "notification-test-task",
        notificationKey:
          `test-task-reminder:${scheduleAt.getTime()}`,
      },
    });
  }
  
  export async function clearNexusNotifications(): Promise<void> {
    await cancelFocusNotifications();
  }
  
  export async function cancelNexusNotification(
    id: number
  ): Promise<boolean> {
    return cancelNotification(id);
  }
  