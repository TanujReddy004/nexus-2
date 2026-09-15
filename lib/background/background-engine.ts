"use client";

import {
  getPreferences,
  getTasks,
} from "@/lib/workspace-store";

import {
  syncTaskReminders,
} from "@/lib/notifications/task-reminder-engine";

import {
  initializeAppLifecycle,
  subscribeToAppLifecycle,
  type NexusAppLifecycleEvent,
  type NexusAppLifecycleSnapshot,
} from "@/lib/native/app-lifecycle";

export type NexusBackgroundEngineListener = (
  event: NexusAppLifecycleEvent,
  snapshot: NexusAppLifecycleSnapshot
) => void;

let initialized = false;

let unsubscribeLifecycle:
  (() => void) | null = null;

let reminderSyncPromise:
  Promise<void> | null = null;

let removeDataChangeListener:
  (() => void) | null = null;

let removePreferenceChangeListener:
  (() => void) | null = null;

const listeners =
  new Set<NexusBackgroundEngineListener>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Reconcile all persisted background work.
 *
 * Phase 1 currently coordinates the existing
 * task reminder engine.
 *
 * Later phases can add:
 * - Focus recovery
 * - local notification reconciliation
 * - location triggers
 * - automations
 * - sync recovery
 */
async function reconcileBackgroundWork(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  /*
   * Prevent two reconciliation processes
   * from running simultaneously.
   */
  if (reminderSyncPromise) {
    return reminderSyncPromise;
  }

  reminderSyncPromise =
    (async () => {
      try {
        await syncTaskReminders(
          getTasks(),
          getPreferences()
            .notifications
        );
      } catch (error) {
        console.error(
          "[NEXUS-BACKGROUND] Reminder reconciliation failed:",
          error
        );
      } finally {
        reminderSyncPromise =
          null;
      }
    })();

  return reminderSyncPromise;
}

/**
 * Notify Background Engine subscribers.
 */
function notifyListeners(
  event: NexusAppLifecycleEvent,
  snapshot: NexusAppLifecycleSnapshot
): void {
  for (
    const listener of listeners
  ) {
    try {
      listener(
        event,
        snapshot
      );
    } catch (error) {
      console.error(
        "[NEXUS-BACKGROUND] Listener failed:",
        error
      );
    }
  }
}

/**
 * Handle lifecycle transitions.
 */
async function handleLifecycle(
  event: NexusAppLifecycleEvent,
  snapshot: NexusAppLifecycleSnapshot
): Promise<void> {
  notifyListeners(
    event,
    snapshot
  );

  /*
   * When NEXUS starts or comes back to the
   * foreground, reconcile persisted work.
   *
   * This allows reminder state to recover after:
   *
   * - app launch
   * - app resume
   * - backgrounding
   * - process termination
   * - Android reopening
   */
  if (
    event === "APP_LAUNCHED" ||
    event === "APP_RESUMED"
  ) {
    await reconcileBackgroundWork();
  }
}

/**
 * Initialize the NEXUS Background Engine.
 *
 * This should be called once from the
 * application root.
 */
export async function initializeBackgroundEngine(): Promise<void> {
  if (
    !isBrowser() ||
    initialized
  ) {
    return;
  }

  initialized = true;

  /*
   * Initialize lifecycle first.
   */
  await initializeAppLifecycle();

  /*
   * Subscribe to lifecycle events.
   */
  unsubscribeLifecycle =
    subscribeToAppLifecycle(
      (
        event,
        snapshot
      ) => {
        void handleLifecycle(
          event,
          snapshot
        );
      }
    );

  /*
   * Initial background reconciliation.
   */
  await reconcileBackgroundWork();

  /*
   * Existing task data-change event.
   *
   * We reuse the existing workspace-store
   * event instead of changing the store.
   */
  const handleDataChange = (
    event: Event
  ) => {
    const customEvent =
      event as CustomEvent<string>;

    if (
      customEvent.detail ===
      "nexus-tasks"
    ) {
      void reconcileBackgroundWork();
    }
  };

  /*
   * Existing preferences-change event.
   */
  const handlePreferenceChange =
    () => {
      void reconcileBackgroundWork();
    };

  window.addEventListener(
    "nexus-data-change",
    handleDataChange
  );

  window.addEventListener(
    "nexus-preferences-change",
    handlePreferenceChange
  );

  removeDataChangeListener =
    () => {
      window.removeEventListener(
        "nexus-data-change",
        handleDataChange
      );
    };

  removePreferenceChangeListener =
    () => {
      window.removeEventListener(
        "nexus-preferences-change",
        handlePreferenceChange
      );
    };
}

/**
 * Subscribe to Background Engine events.
 */
export function subscribeToBackgroundEngine(
  listener: NexusBackgroundEngineListener
): () => void {
  listeners.add(
    listener
  );

  return () => {
    listeners.delete(
      listener
    );
  };
}

/**
 * Manually trigger background reconciliation.
 */
export async function reconcileBackgroundEngine(): Promise<void> {
  await reconcileBackgroundWork();
}

/**
 * Check whether the Background Engine
 * has already been initialized.
 */
export function isBackgroundEngineInitialized(): boolean {
  return initialized;
}

/**
 * Cleanup helper.
 */
export function disposeBackgroundEngine(): void {
  removeDataChangeListener?.();

  removePreferenceChangeListener?.();

  unsubscribeLifecycle?.();

  removeDataChangeListener =
    null;

  removePreferenceChangeListener =
    null;

  unsubscribeLifecycle =
    null;

  reminderSyncPromise =
    null;

  listeners.clear();

  initialized = false;
}