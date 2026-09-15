export type NexusEventName =
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
  | "PROJECT_COMPLETED"
  | "REMINDER_TRIGGERED"
  | "LOCATION_PERMISSION_GRANTED"
  | "LOCATION_PERMISSION_DENIED"
  | "LOCATION_UPDATED"
  | "LOCATION_TRACKING_STARTED"
  | "LOCATION_TRACKING_STOPPED"
  | "NOTIFICATION_PERMISSION_GRANTED"
  | "NOTIFICATION_PERMISSION_DENIED"
  | "APP_LAUNCHED"
  | "APP_RESUMED"
  | "APP_PAUSED"
  | "APP_BACKGROUNDED"
  | "APP_TERMINATED";

export type NexusEventPayload = {
  event: NexusEventName;
  occurredAt: string;
  entityId?: string;
  entityType?:
    | "task"
    | "project"
    | "focus"
    | "reminder"
    | "location"
    | "system";
  data?: Record<string, unknown>;
};

export type NexusEventListener = (
  payload: NexusEventPayload
) => void;

const EVENT = "nexus-event";

const listeners =
  new Set<NexusEventListener>();

function browser(): boolean {
  return typeof window !== "undefined";
}

export function emitNexusEvent(
  event: NexusEventName,
  data: Omit<
    NexusEventPayload,
    "event" | "occurredAt"
  > = {}
): NexusEventPayload {
  const payload: NexusEventPayload = {
    event,
    occurredAt:
      new Date().toISOString(),
    ...data,
  };

  if (browser()) {
    window.dispatchEvent(
      new CustomEvent<NexusEventPayload>(
        EVENT,
        {
          detail: payload,
        }
      )
    );
  }

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error(
        "[NEXUS-EVENTS] Listener failed:",
        error
      );
    }
  }

  return payload;
}

export function subscribeToNexusEvents(
  listener: NexusEventListener
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function initializeNexusEventBridge(): () => void {
  if (!browser()) {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const payload =
      (
        event as CustomEvent<NexusEventPayload>
      ).detail;

    if (!payload) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        console.error(
          "[NEXUS-EVENTS] Listener failed:",
          error
        );
      }
    }
  };

  window.addEventListener(
    EVENT,
    handler
  );

  return () => {
    window.removeEventListener(
      EVENT,
      handler
    );
  };
}