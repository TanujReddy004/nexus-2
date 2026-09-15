"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type NexusAppLifecycleState =
  | "active"
  | "inactive"
  | "background"
  | "terminated";

export type NexusAppLifecycleEvent =
  | "APP_LAUNCHED"
  | "APP_RESUMED"
  | "APP_PAUSED"
  | "APP_BACKGROUNDED"
  | "APP_TERMINATED";

export type NexusAppLifecycleSnapshot = {
  state: NexusAppLifecycleState;
  platform: "web" | "android" | "ios" | "unknown";
  isNative: boolean;
  updatedAt: string;
};

export type NexusAppLifecycleListener = (
  event: NexusAppLifecycleEvent,
  snapshot: NexusAppLifecycleSnapshot
) => void;

type ListenerHandle = {
  remove: () => Promise<void>;
};

const listeners = new Set<NexusAppLifecycleListener>();

let initialized = false;

let currentState: NexusAppLifecycleState =
  "active";

let lastEvent: NexusAppLifecycleEvent =
  "APP_LAUNCHED";

let appStateHandle: ListenerHandle | null =
  null;

let pauseHandle: ListenerHandle | null =
  null;

let resumeHandle: ListenerHandle | null =
  null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getPlatform():
  NexusAppLifecycleSnapshot["platform"] {
  if (!isBrowser()) {
    return "unknown";
  }

  const platform =
    Capacitor.getPlatform();

  if (
    platform === "android" ||
    platform === "ios"
  ) {
    return platform;
  }

  return "web";
}

function getSnapshot():
  NexusAppLifecycleSnapshot {
  return {
    state: currentState,

    platform: getPlatform(),

    isNative:
      isBrowser() &&
      Capacitor.isNativePlatform(),

    updatedAt:
      new Date().toISOString(),
  };
}

function emit(
  event: NexusAppLifecycleEvent,
  state: NexusAppLifecycleState
): void {
  currentState = state;

  lastEvent = event;

  const snapshot =
    getSnapshot();

  console.log(
    "[NEXUS-LIFECYCLE]",
    event,
    snapshot
  );

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
        "[NEXUS-LIFECYCLE] Listener failed:",
        error
      );
    }
  }
}

function handleVisibilityChange(): void {
  if (!isBrowser()) {
    return;
  }

  if (
    document.visibilityState ===
    "visible"
  ) {
    emit(
      "APP_RESUMED",
      "active"
    );

    return;
  }

  emit(
    "APP_BACKGROUNDED",
    "background"
  );
}

function handlePageHide(): void {
  emit(
    "APP_BACKGROUNDED",
    "background"
  );
}

function handlePageShow(): void {
  emit(
    "APP_RESUMED",
    "active"
  );
}

/**
 * Initialize the NEXUS lifecycle bridge.
 *
 * Native:
 * - Capacitor App plugin
 *
 * Web:
 * - visibilitychange
 * - pagehide
 * - pageshow
 */
export async function initializeAppLifecycle(): Promise<void> {
  if (
    !isBrowser() ||
    initialized
  ) {
    return;
  }

  initialized = true;

  /*
   * Web lifecycle listeners.
   */
  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.addEventListener(
    "pagehide",
    handlePageHide
  );

  window.addEventListener(
    "pageshow",
    handlePageShow
  );

  /*
   * Application launch.
   */
  emit(
    "APP_LAUNCHED",
    "active"
  );

  /*
   * Browser-only NEXUS.
   */
  if (
    !Capacitor.isNativePlatform()
  ) {
    return;
  }

  try {
    /*
     * Native application state.
     */
    appStateHandle =
      await App.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) {
            emit(
              "APP_RESUMED",
              "active"
            );

            return;
          }

          emit(
            "APP_PAUSED",
            "inactive"
          );

          emit(
            "APP_BACKGROUNDED",
            "background"
          );
        }
      );

    /*
     * Native pause.
     */
    pauseHandle =
      await App.addListener(
        "pause",
        () => {
          emit(
            "APP_PAUSED",
            "inactive"
          );

          emit(
            "APP_BACKGROUNDED",
            "background"
          );
        }
      );

    /*
     * Native resume.
     */
    resumeHandle =
      await App.addListener(
        "resume",
        () => {
          emit(
            "APP_RESUMED",
            "active"
          );
        }
      );
  } catch (error) {
    console.error(
      "[NEXUS-LIFECYCLE] Failed to initialize Capacitor lifecycle listeners:",
      error
    );
  }
}

/**
 * Subscribe to lifecycle events.
 */
export function subscribeToAppLifecycle(
  listener: NexusAppLifecycleListener
): () => void {
  listeners.add(listener);

  /*
   * Immediately provide the current state.
   */
  listener(
    lastEvent,
    getSnapshot()
  );

  return () => {
    listeners.delete(
      listener
    );
  };
}

/**
 * Return the current lifecycle state.
 */
export function getAppLifecycleState():
  NexusAppLifecycleSnapshot {
  return getSnapshot();
}

/**
 * Cleanup helper.
 *
 * Primarily useful for testing or
 * controlled application teardown.
 */
export async function disposeAppLifecycle(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.removeEventListener(
    "pagehide",
    handlePageHide
  );

  window.removeEventListener(
    "pageshow",
    handlePageShow
  );

  await Promise.allSettled([
    appStateHandle?.remove(),
    pauseHandle?.remove(),
    resumeHandle?.remove(),
  ]);

  appStateHandle = null;

  pauseHandle = null;

  resumeHandle = null;

  initialized = false;

  currentState =
    "active";

  lastEvent =
    "APP_LAUNCHED";
}