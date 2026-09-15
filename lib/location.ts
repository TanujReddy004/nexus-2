import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import {
  ActivityAction,
  IntentLauncher,
} from "@capgo/capacitor-intent-launcher";

export type NexusLocationPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "prompt-with-rationale"
  | "unavailable";

export type NexusLocationTrackingStatus =
  | "active"
  | "inactive"
  | "unavailable";

export type NexusLocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type NexusLocationPolicy = {
  enabled: boolean;
  foreground: boolean;
  background: boolean;
  enableHighAccuracy: boolean;
  samplingInterval: number;
  maximumAge: number;
  timeout: number;
  retentionDays: number;
  userVisible: boolean;
};

/**
 * NEXUS location policy.
 *
 * Important:
 * - Tracking is disabled by default.
 * - High accuracy is disabled by default.
 * - Background tracking is disabled for this phase.
 * - The user must explicitly start tracking.
 */
const DEFAULT_LOCATION_POLICY: NexusLocationPolicy = {
  enabled: false,
  foreground: true,
  background: false,
  enableHighAccuracy: false,
  samplingInterval: 30_000,
  maximumAge: 30_000,
  timeout: 20_000,
  retentionDays: 7,
  userVisible: true,
};

const LOCATION_POLICY_STORAGE_KEY =
  "nexus-location-policy";

const LAST_LOCATION_STORAGE_KEY =
  "nexus-last-known-location";

let trackingWatchId: string | number | null = null;

let trackingStatus: NexusLocationTrackingStatus =
  "inactive";

let lastKnownLocation: NexusLocationResult | null =
  null;

type LocationTrackingListener = (
  status: NexusLocationTrackingStatus,
  location: NexusLocationResult | null
) => void;

const trackingListeners: LocationTrackingListener[] =
  [];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isBrowserGeolocationAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "geolocation" in navigator
  );
}

function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

function normalizePermission(
  permission: string
): NexusLocationPermission {
  if (
    permission === "granted" ||
    permission === "denied" ||
    permission === "prompt" ||
    permission === "prompt-with-rationale"
  ) {
    return permission;
  }

  return "unavailable";
}

function getStoredPolicy(): NexusLocationPolicy {
  if (typeof window === "undefined") {
    return DEFAULT_LOCATION_POLICY;
  }

  try {
    const stored = window.localStorage.getItem(
      LOCATION_POLICY_STORAGE_KEY
    );

    if (!stored) {
      return DEFAULT_LOCATION_POLICY;
    }

    const parsed = JSON.parse(
      stored
    ) as Partial<NexusLocationPolicy>;

    return {
      ...DEFAULT_LOCATION_POLICY,
      ...parsed,
    };
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to read location policy:",
      error
    );

    return DEFAULT_LOCATION_POLICY;
  }
}

function savePolicy(
  policy: NexusLocationPolicy
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LOCATION_POLICY_STORAGE_KEY,
      JSON.stringify(policy)
    );
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to save location policy:",
      error
    );
  }
}

function saveLastKnownLocation(
  location: NexusLocationResult
): void {
  lastKnownLocation = location;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LAST_LOCATION_STORAGE_KEY,
      JSON.stringify(location)
    );
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to save last known location:",
      error
    );
  }
}

function loadLastKnownLocation(): NexusLocationResult | null {
  if (lastKnownLocation) {
    return lastKnownLocation;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(
      LAST_LOCATION_STORAGE_KEY
    );

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(
      stored
    ) as NexusLocationResult;

    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number" ||
      typeof parsed.accuracy !== "number"
    ) {
      return null;
    }

    lastKnownLocation = parsed;

    return parsed;
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to load last known location:",
      error
    );

    return null;
  }
}

function notifyTrackingListeners(
  location: NexusLocationResult | null =
    lastKnownLocation
): void {
  trackingListeners.forEach(
    (listener) => {
      try {
        listener(
          trackingStatus,
          location
        );
      } catch (error) {
        console.error(
          "[NEXUS-LOCATION] Tracking listener failed:",
          error
        );
      }
    }
  );
}

function createLocationResult(
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp?: number
): NexusLocationResult {
  return {
    latitude,
    longitude,
    accuracy,
    timestamp:
      timestamp && timestamp > 0
        ? timestamp
        : Date.now(),
  };
}

function getLocationErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

function getBrowserGeolocationErrorMessage(
  error: GeolocationPositionError
): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied.";
    case error.POSITION_UNAVAILABLE:
      return "Device location is currently unavailable. Turn on Location/GPS and try again.";
    case error.TIMEOUT:
      return "Location request timed out. Make sure Location/GPS is available and try again.";
    default:
      return "Unable to determine the current location.";
  }
}

/* -------------------------------------------------------------------------- */
/* Location Policy                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns the current NEXUS location policy.
 */
export function getLocationPolicy(): NexusLocationPolicy {
  return getStoredPolicy();
}

/**
 * Updates the NEXUS location policy.
 *
 * This function does NOT start tracking.
 * Tracking requires an explicit call to
 * startLocationTracking().
 */
export function setLocationPolicy(
  updates: Partial<NexusLocationPolicy>
): NexusLocationPolicy {
  const nextPolicy: NexusLocationPolicy = {
    ...getStoredPolicy(),
    ...updates,
  };

  savePolicy(nextPolicy);

  return nextPolicy;
}

/* -------------------------------------------------------------------------- */
/* Permission                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Check the current location permission.
 *
 * Does not trigger a permission request.
 */
export async function getLocationPermission(): Promise<NexusLocationPermission> {
  try {
    if (isNativePlatform()) {
      const permissions =
        await Geolocation.checkPermissions();

      return normalizePermission(
        permissions.location
      );
    }

    if (isBrowserGeolocationAvailable()) {
      /**
       * Browser APIs do not expose the exact permission
       * state consistently across all supported browsers.
       *
       * The actual request is therefore performed only
       * when the user explicitly chooses Allow Location.
       */
      if (
        typeof navigator !== "undefined" &&
        "permissions" in navigator
      ) {
        try {
          const permissionStatus =
            await navigator.permissions.query({
              name: "geolocation" as PermissionName,
            });

          return normalizePermission(
            permissionStatus.state
          );
        } catch {
          return "prompt";
        }
      }

      return "prompt";
    }

    return "unavailable";
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to check permission:",
      error
    );

    return "unavailable";
  }
}

/**
 * Explicitly request location permission.
 *
 * This function never runs automatically.
 */
export async function requestLocationPermission(): Promise<NexusLocationPermission> {
  try {
    if (isNativePlatform()) {
      const permissions =
        await Geolocation.requestPermissions({
          permissions: ["location"],
        });

      const result =
        normalizePermission(
          permissions.location
        );

      if (result === "granted") {
        notifyTrackingListeners();
        return result;
      }

      /*
       * Android may return `denied` without showing another
       * permission dialog after the user has previously denied
       * location access. In that state, send the user directly
       * to the native location settings screen so they can enable
       * NEXUS location access manually.
       */
      if (result === "denied") {
        try {
          await IntentLauncher.startActivityAsync({
            action: ActivityAction.APPLICATION_DETAILS_SETTINGS,
            data: "package:com.nexus.productivity",
          });
        } catch (settingsError) {
          console.warn(
            "[NEXUS-LOCATION] Unable to open NEXUS app settings:",
            settingsError
          );
        }
      }

      return result;
    }

    if (isBrowserGeolocationAvailable()) {
      return new Promise(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              resolve("granted");
            },
            (error) => {
              console.warn(
                "[NEXUS-LOCATION] Browser permission request did not succeed:",
                getBrowserGeolocationErrorMessage(error)
              );

              resolve(
                error.code === error.PERMISSION_DENIED
                  ? "denied"
                  : "prompt"
              );
            },
            {
              enableHighAccuracy: false,
              timeout: 15_000,
              maximumAge: 0,
            }
          );
        }
      );
    }

    return "unavailable";
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to request permission:",
      error
    );

    return "denied";
  }
}

/* -------------------------------------------------------------------------- */
/* Current Location                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Gets the current device location once.
 *
 * This does NOT start continuous tracking.
 */
export async function getCurrentNexusLocation(): Promise<NexusLocationResult> {
  const policy =
    getLocationPolicy();

  if (isNativePlatform()) {
    const position =
      await Geolocation.getCurrentPosition({
        enableHighAccuracy:
          policy.enableHighAccuracy,
        timeout:
          policy.timeout,
        maximumAge:
          policy.maximumAge,
        enableLocationFallback: true,
      });

    const location =
      createLocationResult(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
        position.timestamp
      );

    saveLastKnownLocation(
      location
    );

    notifyTrackingListeners(
      location
    );

    return location;
  }

  if (isBrowserGeolocationAvailable()) {
    return new Promise(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location =
              createLocationResult(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                position.timestamp
              );

            saveLastKnownLocation(
              location
            );

            notifyTrackingListeners(
              location
            );

            resolve(location);
          },
          (error) => {
            reject(
              new Error(
                getBrowserGeolocationErrorMessage(error)
              )
            );
          },
          {
            enableHighAccuracy:
              policy.enableHighAccuracy,
            timeout:
              policy.timeout,
            maximumAge:
              policy.maximumAge,
          }
        );
      }
    );
  }

  throw new Error(
    "Location services are not available on this device."
  );
}

/* -------------------------------------------------------------------------- */
/* Tracking                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Start foreground location tracking.
 *
 * Important:
 * - Permission must already be granted.
 * - This does not enable background tracking.
 * - Tracking is explicitly started by the caller.
 */
export async function startLocationTracking(): Promise<NexusLocationTrackingStatus> {
  if (
    trackingStatus === "active"
  ) {
    return trackingStatus;
  }

  const permission =
    await getLocationPermission();

  if (permission !== "granted") {
    trackingStatus =
      "inactive";

    notifyTrackingListeners();

    throw new Error(
      "Location permission is required before tracking can start."
    );
  }

  const policy =
    getLocationPolicy();

  setLocationPolicy({
    enabled: true,
    foreground: true,
    background: false,
  });

  try {
    if (isNativePlatform()) {
      /**
       * Capacitor Geolocation 8 supports the interval
       * option for Android watch updates.
       *
       * We deliberately use a moderate interval instead
       * of continuous high-frequency GPS.
       */
      const watchId =
        await Geolocation.watchPosition(
          {
            enableHighAccuracy:
              policy.enableHighAccuracy,
            timeout:
              policy.timeout,
            maximumAge:
              policy.maximumAge,
            interval:
              policy.samplingInterval,
          },
          (position, error) => {
            if (error) {
              console.error(
                "[NEXUS-LOCATION] Native tracking error:",
                error
              );

              trackingWatchId =
                null;

              trackingStatus =
                "inactive";

              setLocationPolicy({
                enabled: false,
              });

              notifyTrackingListeners();

              return;
            }

            if (!position) {
              return;
            }

            const location =
              createLocationResult(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                position.timestamp
              );

            saveLastKnownLocation(
              location
            );

            trackingStatus =
              "active";

            notifyTrackingListeners(
              location
            );
          }
        );

      trackingWatchId =
        watchId;

      trackingStatus =
        "active";

      notifyTrackingListeners();

      return trackingStatus;
    }

    if (isBrowserGeolocationAvailable()) {
      const browserWatchId =
        navigator.geolocation.watchPosition(
          (position) => {
            const location =
              createLocationResult(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                position.timestamp
              );

            saveLastKnownLocation(
              location
            );

            trackingStatus =
              "active";

            notifyTrackingListeners(
              location
            );
          },
          (error) => {
            console.error(
              "[NEXUS-LOCATION] Browser tracking error:",
              error
            );

            trackingWatchId =
              null;

            trackingStatus =
              "inactive";

            setLocationPolicy({
              enabled: false,
            });

            notifyTrackingListeners();
          },
          {
            enableHighAccuracy:
              policy.enableHighAccuracy,
            timeout:
              policy.timeout,
            maximumAge:
              policy.maximumAge,
          }
        );

      trackingWatchId =
        browserWatchId;

      trackingStatus =
        "active";

      notifyTrackingListeners();

      return trackingStatus;
    }

    trackingStatus =
      "unavailable";

    notifyTrackingListeners();

    throw new Error(
      "Location tracking is not available on this platform."
    );
  } catch (error) {
    trackingWatchId =
      null;

    trackingStatus =
      "inactive";

    setLocationPolicy({
      enabled: false,
    });

    notifyTrackingListeners();

    console.error(
      "[NEXUS-LOCATION] Failed to start tracking:",
      error
    );

    throw new Error(
      getLocationErrorMessage(
        error,
        "Unable to start location tracking."
      )
    );
  }
}

/**
 * Stop foreground location tracking.
 */
export async function stopLocationTracking(): Promise<NexusLocationTrackingStatus> {
  try {
    if (isNativePlatform()) {
      if (
        trackingWatchId !== null
      ) {
        await Geolocation.clearWatch({
          id: String(
            trackingWatchId
          ),
        });
      }
    } else if (
      isBrowserGeolocationAvailable() &&
      typeof trackingWatchId ===
        "number"
    ) {
      navigator.geolocation.clearWatch(
        trackingWatchId
      );
    }

    trackingWatchId =
      null;

    trackingStatus =
      "inactive";

    setLocationPolicy({
      enabled: false,
    });

    notifyTrackingListeners();

    return trackingStatus;
  } catch (error) {
    console.error(
      "[NEXUS-LOCATION] Failed to stop tracking:",
      error
    );

    trackingWatchId =
      null;

    trackingStatus =
      "inactive";

    setLocationPolicy({
      enabled: false,
    });

    notifyTrackingListeners();

    return trackingStatus;
  }
}

/* -------------------------------------------------------------------------- */
/* Tracking State                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Returns the current tracking state.
 */
export function getLocationTrackingStatus(): NexusLocationTrackingStatus {
  if (
    trackingStatus === "active"
  ) {
    return "active";
  }

  if (
    !isNativePlatform() &&
    !isBrowserGeolocationAvailable()
  ) {
    return "unavailable";
  }

  return "inactive";
}

/**
 * Returns the last known location.
 *
 * This works even when tracking is currently inactive.
 */
export function getLastKnownLocation(): NexusLocationResult | null {
  return loadLastKnownLocation();
}

/* -------------------------------------------------------------------------- */
/* Subscription                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Subscribe to location tracking updates.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToLocationTracking(
  listener: LocationTrackingListener
): () => void {
  trackingListeners.push(
    listener
  );

  listener(
    trackingStatus,
    lastKnownLocation ||
      loadLastKnownLocation()
  );

  return () => {
    const index =
      trackingListeners.indexOf(
        listener
      );

    if (index !== -1) {
      trackingListeners.splice(
        index,
        1
      );
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Combined Status                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns all location state required by Settings
 * and future Permission Center functionality.
 */
export async function getLocationStatus() {
  const permission =
    await getLocationPermission();

  return {
    permission,
    tracking:
      getLocationTrackingStatus(),
    current:
      getLastKnownLocation(),
    policy:
      getLocationPolicy(),
  };
}

/* -------------------------------------------------------------------------- */
/* Cleanup                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Releases the active tracking watcher.
 *
 * App Lifecycle / Background Engine can use this
 * later when those systems are implemented.
 */
export async function disposeLocationTracking(): Promise<void> {
  await stopLocationTracking();

  trackingListeners.length = 0;
}