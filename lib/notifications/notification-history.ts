export type NexusNotificationHistoryType =
  | "focus-started"
  | "focus-warning"
  | "focus-complete"
  | "task-reminder"
  | "task-overdue"
  | "project-complete"
  | "system"
  | "test";

export type NexusNotificationHistoryItem = {
  id: number;
  type: NexusNotificationHistoryType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  scheduledAt?: string;
  screen?: string;
  extra?: Record<string, unknown>;
};

const STORAGE_KEY = "nexus-notification-history";
const DISMISSED_STORAGE_KEY = "nexus-notification-dismissed";
const CHANGE_EVENT = "nexus-notification-change";
const MAX_ITEMS = 100;
const MAX_DISMISSED = 500;

function isBrowser() {
  return typeof window !== "undefined";
}

function readItems(): NexusNotificationHistoryItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is NexusNotificationHistoryItem =>
        item &&
        typeof item.id === "number" &&
        typeof item.type === "string" &&
        typeof item.title === "string" &&
        typeof item.body === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.read === "boolean"
    );
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to read notification history:",
      error
    );
    return [];
  }
}

function writeItems(items: NexusNotificationHistoryItem[]) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_ITEMS))
    );

    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to save notification history:",
      error
    );
  }
}

function readDismissed(): Record<string, number> {
  if (!isBrowser()) return {};

  try {
    const raw = window.localStorage.getItem(
      DISMISSED_STORAGE_KEY
    );

    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number") {
        result[key] = value;
      }
    }

    return result;
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to read dismissed notifications:",
      error
    );
    return {};
  }
}

function writeDismissed(dismissed: Record<string, number>) {
  if (!isBrowser()) return;

  try {
    const entries = Object.entries(dismissed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_DISMISSED);

    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries))
    );

    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch (error) {
    console.error(
      "[NEXUS-NOTIFICATIONS] Failed to save dismissed notifications:",
      error
    );
  }
}

/**
 * A notification key identifies one logical notification occurrence.
 *
 * Callers should provide extra.notificationKey whenever an event can
 * reuse the same native numeric ID (for example Focus sessions).
 * The fallback includes schedule/title/body so task reminders remain
 * stable across app restarts while a new occurrence can still be shown.
 */
export function getNotificationKey(
  item: Pick<
    NexusNotificationHistoryItem,
    "id" | "type" | "title" | "body" | "scheduledAt" | "extra"
  >
): string {
  const explicitKey = item.extra?.notificationKey;

  if (typeof explicitKey === "string" && explicitKey.trim()) {
    return explicitKey;
  }

  return [
    item.id,
    item.type,
    item.scheduledAt ?? "",
    item.title,
    item.body,
  ].join("|");
}

export function isNotificationDismissed(
  notificationKey: string
): boolean {
  if (!isBrowser()) return false;

  return Object.prototype.hasOwnProperty.call(
    readDismissed(),
    notificationKey
  );
}

export function getNotificationHistory() {
  return readItems().sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );
}

export function getUnreadNotificationCount() {
  return readItems().filter(
    (item) => !item.read
  ).length;
}

export function saveNotificationHistory(
  item: Omit<
    NexusNotificationHistoryItem,
    "createdAt" | "read"
  > & {
    createdAt?: string;
    read?: boolean;
  }
) {
  if (!isBrowser()) return;

  const current = readItems();
  const nextItem: NexusNotificationHistoryItem = {
    ...item,
    createdAt:
      item.createdAt ?? new Date().toISOString(),
    read: item.read ?? false,
  };

  if (
    isNotificationDismissed(
      getNotificationKey(nextItem)
    )
  ) {
    return;
  }

  const withoutExisting = current.filter(
    (existing) => existing.id !== nextItem.id
  );

  writeItems([nextItem, ...withoutExisting]);
}

export function markNotificationRead(id: number) {
  writeItems(
    readItems().map((item) =>
      item.id === id
        ? { ...item, read: true }
        : item
    )
  );
}

export function markAllNotificationsRead() {
  writeItems(
    readItems().map((item) => ({
      ...item,
      read: true,
    }))
  );
}

/**
 * Permanently dismiss one logical notification occurrence.
 * The dismissal survives reloads and prevents the reminder reconciler
 * from recreating the same occurrence.
 */
export function dismissNotificationHistory(
  item: NexusNotificationHistoryItem
) {
  if (!isBrowser()) return;

  const dismissed = readDismissed();
  dismissed[getNotificationKey(item)] = Date.now();
  writeDismissed(dismissed);

  writeItems(
    readItems().filter((entry) => entry.id !== item.id)
  );
}

/**
 * Dismiss every notification currently visible in the center.
 */
export function dismissAllNotificationHistory(
  items: NexusNotificationHistoryItem[] = readItems()
) {
  if (!isBrowser()) return;

  const dismissed = readDismissed();

  for (const item of items) {
    dismissed[getNotificationKey(item)] = Date.now();
  }

  writeDismissed(dismissed);
  writeItems([]);
}

/**
 * Remove history without marking the notification occurrence as dismissed.
 * Kept for internal/admin-style cleanup where the underlying event may
 * legitimately be recreated.
 */
export function removeNotificationHistory(id: number) {
  writeItems(
    readItems().filter((item) => item.id !== id)
  );
}

export function clearNotificationHistory() {
  writeItems([]);
}

export function subscribeToNotificationHistory(
  listener: () => void
): () => void {
  if (!isBrowser()) return () => undefined;

  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
