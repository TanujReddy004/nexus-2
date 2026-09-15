import { Capacitor } from "@capacitor/core";
import { BackgroundGeolocation } from "@capgo/background-geolocation";

export { BackgroundGeolocation };

export type NexusNativeLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  time: number | null;
};

export type NexusBackgroundPermissionStatus = {
  location: string | undefined;
  backgroundLocation: string | undefined;
  notification: string | undefined;
};

export type NexusBackgroundTrackingOptions = {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
  minIntervalMs?: number;
};

export type NexusBackgroundLocationCallback = (
  location: NexusNativeLocation | null,
  error: unknown | null
) => void;

function normalizeLocation(
  location:
    | {
        latitude: number;
        longitude: number;
        accuracy: number;
        time?: number | null;
      }
    | undefined
): NexusNativeLocation | null {
  if (!location) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    time: location.time ?? null,
  };
}

export function supportsNativeBackgroundGeolocation(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    (Capacitor.getPlatform() === "android" ||
      Capacitor.getPlatform() === "ios")
  );
}

export function getNativePlatform(): "android" | "ios" | "web" {
  if (!Capacitor.isNativePlatform()) {
    return "web";
  }

  const platform = Capacitor.getPlatform();

  if (platform === "android") {
    return "android";
  }

  if (platform === "ios") {
    return "ios";
  }

  return "web";
}

export async function checkBackgroundLocationPermissions(): Promise<NexusBackgroundPermissionStatus | null> {
  if (!supportsNativeBackgroundGeolocation()) {
    return null;
  }

  const permissions =
    await BackgroundGeolocation.checkPermissions();

  return {
    location: permissions.location,
    backgroundLocation: permissions.backgroundLocation,
    notification: permissions.notification,
  };
}

export async function requestBackgroundLocationPermissions(
  permissions: Array<
    "location" | "backgroundLocation" | "notification"
  > = [
    "location",
    "backgroundLocation",
    "notification",
  ]
): Promise<NexusBackgroundPermissionStatus | null> {
  if (!supportsNativeBackgroundGeolocation()) {
    return null;
  }

  const result =
    await BackgroundGeolocation.requestPermissions({
      permissions,
    });

  return {
    location: result.location,
    backgroundLocation: result.backgroundLocation,
    notification: result.notification,
  };
}

export async function startBackgroundLocationTracking(
  callback: NexusBackgroundLocationCallback,
  options: NexusBackgroundTrackingOptions = {}
): Promise<void> {
  if (!supportsNativeBackgroundGeolocation()) {
    throw new Error(
      "Native background location is only available on Android and iOS."
    );
  }

  const {
    backgroundMessage =
      "NEXUS is using your location while tracking is enabled.",
    backgroundTitle =
      "NEXUS location tracking",
    requestPermissions = false,
    stale = false,
    distanceFilter = 0,
    minIntervalMs = 30_000,
  } = options;

  await BackgroundGeolocation.start(
    {
      backgroundMessage,
      backgroundTitle,
      requestPermissions,
      stale,
      distanceFilter,
      minIntervalMs,
    },
    (position, error) => {
      if (error) {
        callback(null, error);
        return;
      }

      callback(
        normalizeLocation(position),
        null
      );
    }
  );
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  if (!supportsNativeBackgroundGeolocation()) {
    return;
  }

  await BackgroundGeolocation.stop();
}

export async function openNativeLocationSettings(): Promise<void> {
  if (!supportsNativeBackgroundGeolocation()) {
    return;
  }

  await BackgroundGeolocation.openSettings();
}