import { Capacitor } from "@capacitor/core";

import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
  type PermissionStatus,
} from "@capacitor/local-notifications";

export type NexusNotificationPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "prompt-with-rationale"
  | "unavailable";

export const NOTIFICATION_CHANNELS = {
  default: "nexus-default",
  focus: "nexus-focus",
  tasks: "nexus-tasks",
} as const;

export type NexusNotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export type NexusNotification = {
  id: number;
  title: string;
  body: string;
  scheduleAt?: Date;
  sound?: string;
  channelId?: NexusNotificationChannel;
  extra?: Record<string, unknown>;
};

export type NexusNotificationListener = (
  notification: ActionPerformed
) => void;

const isBrowser =
  typeof window !== "undefined";

const isNative =
  isBrowser &&
  Capacitor.isNativePlatform();

const isAndroid =
  isNative &&
  Capacitor.getPlatform() === "android";

let channelsInitialization:
  | Promise<void>
  | null = null;

function mapPermission(
  permission: PermissionStatus["display"]
): NexusNotificationPermission {
  if (permission === "granted") {
    return "granted";
  }

  if (permission === "denied") {
    return "denied";
  }

  if (
    permission ===
    "prompt-with-rationale"
  ) {
    return "prompt-with-rationale";
  }

  return "prompt";
}

function webPermission(): NexusNotificationPermission {
  if (
    typeof Notification ===
    "undefined"
  ) {
    return "unavailable";
  }

  return mapPermission(
    Notification.permission ===
      "granted"
      ? "granted"
      : Notification.permission ===
          "denied"
        ? "denied"
        : "prompt"
  );
}

/**
 * Check the current notification permission.
 */
export async function getNotificationPermission(): Promise<NexusNotificationPermission> {
  if (!isBrowser) {
    return "unavailable";
  }

  if (!isNative) {
    return webPermission();
  }

  try {
    const result =
      await LocalNotifications.checkPermissions();

    return mapPermission(
      result.display
    );
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Permission check failed:",
      error
    );

    return "unavailable";
  }
}

/**
 * Request notification permission.
 */
export async function requestNotificationPermission(): Promise<NexusNotificationPermission> {
  if (!isBrowser) {
    return "unavailable";
  }

  /*
   * Browser / Web.
   */
  if (!isNative) {
    if (
      typeof Notification ===
      "undefined"
    ) {
      return "unavailable";
    }

    try {
      const result =
        await Notification.requestPermission();

      return mapPermission(
        result === "granted"
          ? "granted"
          : result === "denied"
            ? "denied"
            : "prompt"
      );
    } catch (error) {
      console.error(
        "[NEXUS-NOTIFICATIONS] Web permission request failed:",
        error
      );

      return "unavailable";
    }
  }

  /*
   * Android / iOS.
   */
  try {
    const result =
      await LocalNotifications.requestPermissions();

    return mapPermission(
      result.display
    );
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Native permission request failed:",
      error
    );

    return "unavailable";
  }
}

/**
 * Make sure notification permission exists.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current =
    await getNotificationPermission();

  if (current === "granted") {
    return true;
  }

  if (
    current === "denied" ||
    current === "unavailable"
  ) {
    return false;
  }

  const requested =
    await requestNotificationPermission();

  return requested === "granted";
}

/**
 * Check whether notifications are enabled.
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const permission =
    await getNotificationPermission();

  return permission === "granted";
}

/**
 * Initialize Android notification channels.
 */
export async function initializeNotificationChannels(): Promise<void> {
  if (!isAndroid) {
    return;
  }

  if (channelsInitialization) {
    return channelsInitialization;
  }

  channelsInitialization =
    (async () => {
      try {
        console.log(
          "[NEXUS-NOTIFICATIONS] Initializing Android notification channels..."
        );

        await LocalNotifications.createChannel({
          id: NOTIFICATION_CHANNELS.default,

          name: "NEXUS",

          description:
            "NEXUS productivity notifications",

          importance: 4,

          visibility: 1,

          sound: "default",
        });

        await LocalNotifications.createChannel({
          id: NOTIFICATION_CHANNELS.focus,

          name: "Focus",

          description:
            "NEXUS Focus session notifications",

          importance: 4,

          visibility: 1,

          sound: "default",
        });

        await LocalNotifications.createChannel({
          id: NOTIFICATION_CHANNELS.tasks,

          name: "Tasks",

          description:
            "NEXUS task reminders and updates",

          importance: 3,

          visibility: 1,

          sound: "default",
        });

        console.log(
          "[NEXUS-NOTIFICATIONS] Notification channels initialized."
        );
      } catch (error) {
        console.error(
          "[NEXUS-NOTIFICATIONS] Channel initialization failed:",
          error
        );

        channelsInitialization = null;

        throw error;
      }
    })();

  return channelsInitialization;
}

/**
 * Prepare the native notification system.
 */
async function prepareNativeNotifications(): Promise<boolean> {
  if (!isNative) {
    return true;
  }

  const allowed =
    await ensureNotificationPermission();

  if (!allowed) {
    console.warn(
      "[NEXUS-NOTIFICATIONS] Notification permission is not granted."
    );

    return false;
  }

  if (isAndroid) {
    try {
      await initializeNotificationChannels();
    } catch (error) {
      console.error(
        "[NEXUS-NOTIFICATIONS] Failed to initialize notification channels:",
        error
      );

      return false;
    }
  }

  return true;
}

/**
 * Send an immediate notification.
 */
export async function sendNotification(
  notification: NexusNotification
): Promise<boolean> {
  if (!isBrowser) {
    return false;
  }

  /*
   * Web notification.
   */
  if (!isNative) {
    const allowed =
      await ensureNotificationPermission();

    if (!allowed) {
      return false;
    }

    try {
      if (
        typeof Notification ===
        "undefined"
      ) {
        return false;
      }

      new Notification(
        notification.title,
        {
          body: notification.body,
          tag: `nexus-${notification.id}`,
        }
      );

      console.log(
        "[NEXUS-NOTIFICATIONS] Web notification sent:",
        notification.title
      );

      return true;
    } catch (error) {
      console.error(
        "[NEXUS-NOTIFICATIONS] Web notification failed:",
        error
      );

      return false;
    }
  }

  /*
   * Native notification.
   */
  const ready =
    await prepareNativeNotifications();

  if (!ready) {
    return false;
  }

  try {
    const payload: LocalNotificationSchema =
      {
        id: notification.id,

        title: notification.title,

        body: notification.body,

        channelId:
          notification.channelId ??
          NOTIFICATION_CHANNELS.default,

        extra:
          notification.extra,

        sound:
          notification.sound,

        autoCancel: true,

        ongoing: false,

        /*
         * Show the notification even when
         * NEXUS is currently open.
         */
        foreground: true,
      };

    console.log(
      "[NEXUS-NOTIFICATIONS] Sending native notification:",
      {
        id: notification.id,
        title: notification.title,
        channelId: payload.channelId,
      }
    );

    await LocalNotifications.schedule({
      notifications: [payload],
    });

    console.log(
      "[NEXUS-NOTIFICATIONS] Native notification sent successfully."
    );

    return true;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Immediate notification failed:",
      error
    );

    return false;
  }
}

/**
 * Schedule a notification for a future date/time.
 *
 * On native platforms, the schedule belongs to the
 * Android/iOS notification system and does not require
 * the NEXUS app to remain open.
 */
export async function scheduleNotification(
  notification: NexusNotification
): Promise<boolean> {
  if (!isBrowser) {
    return false;
  }

  /*
   * No schedule time means send immediately.
   */
  if (!notification.scheduleAt) {
    return sendNotification(
      notification
    );
  }

  /*
   * Web fallback.
   *
   * Browser notifications do not provide
   * reliable native background scheduling.
   */
  if (!isNative) {
    const allowed =
      await ensureNotificationPermission();

    if (!allowed) {
      return false;
    }

    const delay =
      notification.scheduleAt.getTime() -
      Date.now();

    if (delay <= 0) {
      return sendNotification(
        notification
      );
    }

    window.setTimeout(() => {
      void sendNotification(
        notification
      );
    }, delay);

    console.log(
      "[NEXUS-NOTIFICATIONS] Web notification scheduled:",
      {
        id: notification.id,
        at: notification.scheduleAt,
      }
    );

    return true;
  }

  /*
   * Native scheduling.
   */
  const ready =
    await prepareNativeNotifications();

  if (!ready) {
    return false;
  }

  try {
    const payload: LocalNotificationSchema =
      {
        id: notification.id,

        title: notification.title,

        body: notification.body,

        channelId:
          notification.channelId ??
          NOTIFICATION_CHANNELS.default,

        extra:
          notification.extra,

        sound:
          notification.sound,

        autoCancel: true,

        ongoing: false,

        /*
         * Also show scheduled notifications
         * while NEXUS is open.
         */
        foreground: true,

        schedule: {
          at: notification.scheduleAt,

          /*
           * Allow Android to deliver the reminder
           * while the device is idle.
           */
          allowWhileIdle: true,
        },
      };

    console.log(
      "[NEXUS-NOTIFICATIONS] Scheduling native notification:",
      {
        id: notification.id,
        title: notification.title,
        channelId: payload.channelId,
        at: notification.scheduleAt,
      }
    );

    await LocalNotifications.schedule({
      notifications: [payload],
    });

    console.log(
      "[NEXUS-NOTIFICATIONS] Scheduled notification successfully."
    );

    return true;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Schedule failed:",
      error
    );

    return false;
  }
}

/**
 * Cancel one scheduled notification.
 */
export async function cancelNotification(
  id: number
): Promise<boolean> {
  if (!isBrowser) {
    return false;
  }

  if (!isNative) {
    return true;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [
        {
          id,
        },
      ],
    });

    console.log(
      "[NEXUS-NOTIFICATIONS] Cancelled notification:",
      id
    );

    return true;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Cancel failed:",
      error
    );

    return false;
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<boolean> {
  if (!isBrowser) {
    return false;
  }

  if (!isNative) {
    return true;
  }

  try {
    await LocalNotifications.cancelAll();

    console.log(
      "[NEXUS-NOTIFICATIONS] Cancelled all scheduled notifications."
    );

    return true;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Cancel all failed:",
      error
    );

    return false;
  }
}

/**
 * Get pending native notifications.
 */
export async function getPendingNotifications() {
  if (!isBrowser || !isNative) {
    return [];
  }

  try {
    const result =
      await LocalNotifications.getPending();

    return result.notifications;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to get pending notifications:",
      error
    );

    return [];
  }
}

/**
 * Get notifications currently shown
 * in the native notification center.
 */
export async function getDeliveredNotifications() {
  if (!isBrowser || !isNative) {
    return [];
  }

  try {
    const result =
      await LocalNotifications.getDeliveredNotifications();

    return result.notifications;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to get delivered notifications:",
      error
    );

    return [];
  }
}

/**
 * Remove all delivered notifications.
 */
export async function clearDeliveredNotifications(): Promise<boolean> {
  if (!isBrowser || !isNative) {
    return true;
  }

  try {
    await LocalNotifications.removeAllDeliveredNotifications();

    return true;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to clear delivered notifications:",
      error
    );

    return false;
  }
}

/**
 * Listen for a notification being tapped.
 */
export async function subscribeToNotificationActions(
  listener: NexusNotificationListener
) {
  if (!isBrowser || !isNative) {
    return {
      remove: async () => undefined,
    };
  }

  return LocalNotifications.addListener(
    "localNotificationActionPerformed",
    listener
  );
}

/**
 * Listen for notifications received
 * while the app is running.
 */
export async function subscribeToNotificationReceived(
  listener: (
    notification: LocalNotificationSchema
  ) => void
) {
  if (!isBrowser || !isNative) {
    return {
      remove: async () => undefined,
    };
  }

  return LocalNotifications.addListener(
    "localNotificationReceived",
    listener
  );
}