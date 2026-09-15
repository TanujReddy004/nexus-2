"use client";

import {
  Bell,
  Check,
  Crosshair,
  MapPin,
  Monitor,
  Moon,
  Palette,
  Settings2,
  Smartphone,
  Sun,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import AppShell from "@/components/app-shell";
import AuthGuard from "@/components/auth-guard";
import LocationMap from "@/components/location-map";
import { supabase } from "@/lib/supabase";

import {
  getCurrentNexusLocation,
  getLastKnownLocation,
  getLocationPermission,
  getLocationTrackingStatus,
  requestLocationPermission,
  startLocationTracking,
  stopLocationTracking,
  subscribeToLocationTracking,
  type NexusLocationPermission,
  type NexusLocationTrackingStatus,
} from "@/lib/location";

import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/native/notifications";

import {
  sendTestNotification,
} from "@/lib/notifications/notification-engine";

import {
  getPreferences,
  getSoundEnabled,
  getTheme,
  setPreferences,
  setSoundEnabled,
  setTheme,
  type NexusPreferences,
  type Theme,
} from "@/lib/workspace-store";

const themes: {
  value: Theme;
  label: string;
  icon: typeof Sun;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    icon: Monitor,
  },
];

type NotificationTestState =
  | "idle"
  | "sending"
  | "success"
  | "error";

export default function SettingsPage() {
  const [theme, setThemeState] =
    useState<Theme>("dark");

  const [preferences, setPreferencesState] =
    useState<NexusPreferences>({
      notifications: true,
      sound: true,
      vibration: true,
      reducedMotion: false,
    });

  const [saved, setSaved] =
    useState(false);

  const [notificationPermission, setNotificationPermission] =
    useState<
      Awaited<
        ReturnType<
          typeof getNotificationPermission
        >
      >
    >("unavailable");

  const [notificationLoading, setNotificationLoading] =
    useState(false);

  const [notificationTestState, setNotificationTestState] =
    useState<NotificationTestState>(
      "idle"
    );

  const [locationPermission, setLocationPermission] =
    useState<NexusLocationPermission>(
      "unavailable"
    );

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationResult, setLocationResult] =
    useState<{
      latitude: number;
      longitude: number;
      accuracy: number;
    } | null>(null);

  const [locationError, setLocationError] =
    useState("");

  const [locationTrackingStatus, setLocationTrackingStatus] =
    useState<NexusLocationTrackingStatus>(
      getLocationTrackingStatus()
    );

  const [locationTrackingLoading, setLocationTrackingLoading] =
    useState(false);

  useEffect(() => {
    setThemeState(getTheme());

    setPreferencesState(
      getPreferences()
    );

    getLocationPermission().then(
      setLocationPermission
    );

    getNotificationPermission().then(
      setNotificationPermission
    );

    const lastKnown = getLastKnownLocation();
    if (lastKnown) {
      setLocationResult(lastKnown);
    }

    const unsubscribeLocation =
      subscribeToLocationTracking((status, location) => {
        setLocationTrackingStatus(status);

        if (location) {
          setLocationResult(location);

          void persistLocation(location, true).catch((error) => {
            console.error(
              "[NEXUS-LOCATION] Failed to save tracked location:",
              error
            );
          });
        }
      });

    return unsubscribeLocation;
  }, []);

  const showSaved = () => {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 1200);
  };

  const changeTheme = (
    value: Theme
  ) => {
    setThemeState(value);
    setTheme(value);
    showSaved();
  };

  const savePreferences = (
    next: NexusPreferences
  ) => {
    setPreferencesState(next);
    setPreferences(next);
  };

  const updatePreference = (
    key: keyof NexusPreferences,
    value: boolean
  ) => {
    const next = {
      ...preferences,
      [key]: value,
    };

    savePreferences(next);

    if (key === "sound") {
      setSoundEnabled(value);
    }

    if (
      key === "vibration" &&
      value &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate(20);
    }

    showSaved();
  };

  /**
   * Notifications are different from the
   * other preferences because they also
   * depend on the operating system/browser
   * permission.
   */
  const handleNotificationPreference =
    async (
      enabled: boolean
    ) => {
      if (!enabled) {
        updatePreference(
          "notifications",
          false
        );

        setNotificationTestState(
          "idle"
        );

        return;
      }

      setNotificationLoading(true);
      setNotificationTestState(
        "idle"
      );

      try {
        const current =
          await getNotificationPermission();

        let permission = current;

        if (
          permission !== "granted"
        ) {
          permission =
            await requestNotificationPermission();
        }

        setNotificationPermission(
          permission
        );

        if (
          permission !== "granted"
        ) {
          setNotificationTestState(
            "error"
          );

          return;
        }

        updatePreference(
          "notifications",
          true
        );
      } catch (error) {
        console.error(
          "[NEXUS-NOTIFICATIONS] Failed to enable notifications:",
          error
        );

        setNotificationTestState(
          "error"
        );
      } finally {
        setNotificationLoading(
          false
        );
      }
    };

  /**
   * Send a real test notification.
   */
  const handleTestNotification =
    async () => {
      if (
        !preferences.notifications
      ) {
        setNotificationTestState(
          "error"
        );

        return;
      }

      setNotificationTestState(
        "sending"
      );

      try {
        const permission =
          await getNotificationPermission();

        if (
          permission !== "granted"
        ) {
          const requested =
            await requestNotificationPermission();

          setNotificationPermission(
            requested
          );

          if (
            requested !==
            "granted"
          ) {
            setNotificationTestState(
              "error"
            );

            return;
          }
        } else {
          setNotificationPermission(
            permission
          );
        }

        const sent =
          await sendTestNotification();

        setNotificationTestState(
          sent
            ? "success"
            : "error"
        );
      } catch (error) {
        console.error(
          "[NEXUS-NOTIFICATIONS] Test notification failed:",
          error
        );

        setNotificationTestState(
          "error"
        );
      }
    };

  const notificationGranted =
    notificationPermission ===
    "granted";

  const notificationBlocked =
    notificationPermission ===
    "denied";

  const notificationDescription =
    notificationGranted
      ? "NEXUS can send updates to this device."
      : notificationBlocked
        ? "Notifications are blocked by your device or browser."
        : notificationPermission ===
            "unavailable"
          ? "Notifications are not available on this platform."
          : "Allow NEXUS to send progress and task updates.";

  const handleLocationPermission =
    async () => {
      setLocationLoading(true);
      setLocationError("");

      try {
        const permission =
          await requestLocationPermission();

        setLocationPermission(
          permission
        );

        if (
          permission !== "granted"
        ) {
          setLocationError(
            "Location permission was not granted."
          );
        }
      } catch (error) {
        console.error(
          "[NEXUS-LOCATION] Permission request failed:",
          error
        );

        setLocationError(
          "Unable to request location permission."
        );
      } finally {
        setLocationLoading(false);
      }
    };

  const persistLocation = async (
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    } | null,
    shared: boolean
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        location_shared: shared,
        location_latitude: shared ? location?.latitude ?? null : null,
        location_longitude: shared ? location?.longitude ?? null : null,
        location_updated_at: shared ? new Date().toISOString() : null,
      })
      .eq("id", user.id);

    if (error) {
      throw error;
    }
  };

  const handleTestLocation =
    async () => {
      setLocationLoading(true);
      setLocationError("");

      try {
        const permission =
          await getLocationPermission();

        setLocationPermission(
          permission
        );

        if (
          permission !== "granted"
        ) {
          setLocationError(
            "Allow location access first."
          );

          return;
        }

        const location =
          await getCurrentNexusLocation();

        setLocationResult(
          location
        );

        await persistLocation(location, true);
      } catch (error) {
        console.error(
          "[NEXUS-LOCATION] Failed to get location:",
          error
        );

        setLocationError(
          "Could not get your current location. Make sure device Location is turned on."
        );
      } finally {
        setLocationLoading(false);
      }
    };

  const handleStartLocationTracking =
    async () => {
      setLocationTrackingLoading(true);
      setLocationError("");

      try {
        await startLocationTracking();

        setLocationPermission(
          await getLocationPermission()
        );

        const currentLocation = getLastKnownLocation();
        if (currentLocation) {
          setLocationResult(currentLocation);
          await persistLocation(currentLocation, true);
        }
      } catch (error) {
        console.error(
          "[NEXUS-LOCATION] Failed to start continuous tracking:",
          error
        );

        setLocationError(
          error instanceof Error
            ? error.message
            : "Unable to start continuous location tracking."
        );
      } finally {
        setLocationTrackingLoading(false);
      }
    };

  const handleStopLocationTracking =
    async () => {
      setLocationTrackingLoading(true);
      setLocationError("");

      try {
        await stopLocationTracking();
        await persistLocation(null, false);
      } catch (error) {
        console.error(
          "[NEXUS-LOCATION] Failed to stop tracking:",
          error
        );

        setLocationError(
          "Unable to stop location tracking."
        );
      } finally {
        setLocationTrackingLoading(false);
      }
    };

  const locationGranted =
    locationPermission ===
    "granted";

  const locationStatusLabel =
    locationTrackingStatus === "active"
      ? "Tracking"
      : locationGranted
        ? "Ready"
        : locationPermission ===
            "denied"
          ? "Denied"
          : "Not enabled";

  return (
    <AuthGuard>
      <AppShell>
        <div className="page mx-auto max-w-4xl px-4 pb-28 sm:px-6 lg:px-8">
          {/* HEADER */}

          <header className="mb-5 flex items-center justify-between sm:mb-7">
            <div>
              <p className="eyebrow">
                NEXUS
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Settings
              </h1>
            </div>

            {saved && (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-400">
                <Check size={12} />
                Saved
              </div>
            )}
          </header>

          {/* APPEARANCE */}

          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b p-4 sm:p-5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10">
                <Palette
                  size={17}
                  className="text-violet-400"
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold">
                  Appearance
                </h2>

                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Choose your theme.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
              {themes.map(
                ({
                  value,
                  label,
                  icon: Icon,
                }) => {
                  const selected =
                    theme === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        changeTheme(
                          value
                        )
                      }
                      className="relative flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-medium transition"
                      style={{
                        borderColor:
                          selected
                            ? "rgba(139,92,246,.55)"
                            : "var(--nexus-border)",
                        background:
                          selected
                            ? "rgba(139,92,246,.10)"
                            : "var(--nexus-surface-2)",
                        color:
                          selected
                            ? "var(--nexus-text)"
                            : "var(--nexus-muted)",
                      }}
                    >
                      <Icon size={15} />

                      <span>
                        {label}
                      </span>

                      {selected && (
                        <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-violet-500 text-white">
                          <Check size={9} />
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </section>

          {/* PREFERENCES */}

          <section className="card mt-3 overflow-hidden sm:mt-4">
            <div className="flex items-center gap-3 border-b p-4 sm:p-5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10">
                <Settings2
                  size={17}
                  className="text-cyan-400"
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold">
                  Preferences
                </h2>

                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Control how NEXUS behaves.
                </p>
              </div>
            </div>

            <div className="divide-y">
              {/* NOTIFICATIONS */}

              <div className="px-4 py-3.5 sm:px-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
                      style={{
                        borderColor:
                          "var(--nexus-border)",
                        background:
                          "var(--nexus-surface-2)",
                        color:
                          preferences.notifications &&
                          notificationGranted
                            ? "var(--nexus-purple)"
                            : "var(--nexus-muted)",
                      }}
                    >
                      <Bell size={16} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        Notifications
                      </p>

                      <p
                        className={`mt-0.5 text-[9px] ${
                          notificationBlocked
                            ? "text-rose-400"
                            : notificationGranted
                              ? "text-emerald-400"
                              : "text-zinc-500"
                        }`}
                      >
                        {notificationDescription}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Notifications ${
                      preferences.notifications
                        ? "on"
                        : "off"
                    }`}
                    aria-pressed={
                      preferences.notifications
                    }
                    onClick={() =>
                      void handleNotificationPreference(
                        !preferences.notifications
                      )
                    }
                    disabled={
                      notificationLoading
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      preferences.notifications
                        ? "bg-violet-500"
                        : "bg-zinc-300 dark:bg-zinc-700"
                    } ${
                      notificationLoading
                        ? "cursor-wait opacity-60"
                        : ""
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        preferences.notifications
                          ? "left-[22px]"
                          : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* TEST NOTIFICATION */}

                <div className="mt-3 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    borderColor:
                      "var(--nexus-border)",
                    background:
                      "var(--nexus-surface-2)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold">
                      Notification test
                    </p>

                    <p className="mt-0.5 text-[9px] text-zinc-500">
                      Send a real NEXUS notification to this device.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleTestNotification()
                    }
                    disabled={
                      !preferences.notifications ||
                      notificationTestState ===
                        "sending"
                    }
                    className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {notificationTestState ===
                    "sending"
                      ? "Sending..."
                      : "Test notification"}
                  </button>
                </div>

                {notificationTestState ===
                  "success" && (
                  <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[9px] text-emerald-400">
                    Test notification sent successfully.
                  </div>
                )}

                {notificationTestState ===
                  "error" && (
                  <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[9px] leading-4 text-rose-400">
                    {notificationBlocked
                      ? "Notifications are blocked. Allow NEXUS notifications in your device or browser settings."
                      : "Could not send the test notification. Please allow notifications and try again."}
                  </div>
                )}
              </div>

              {/* FOCUS SOUNDS */}

              <SettingRow
                icon={
                  preferences.sound ? (
                    <Volume2 size={16} />
                  ) : (
                    <VolumeX size={16} />
                  )
                }
                title="Focus sounds"
                enabled={
                  getSoundEnabled()
                }
                onChange={(value) =>
                  updatePreference(
                    "sound",
                    value
                  )
                }
              />

              {/* HAPTIC FEEDBACK */}

              <SettingRow
                icon={
                  <Smartphone size={16} />
                }
                title="Haptic feedback"
                enabled={
                  preferences.vibration
                }
                onChange={(value) =>
                  updatePreference(
                    "vibration",
                    value
                  )
                }
              />

              {/* REDUCED MOTION */}

              <SettingRow
                icon={
                  <Zap size={16} />
                }
                title="Reduced motion"
                enabled={
                  preferences.reducedMotion
                }
                onChange={(value) =>
                  updatePreference(
                    "reducedMotion",
                    value
                  )
                }
              />
            </div>
          </section>

          {/* LOCATION */}

          <section className="card mt-3 overflow-hidden sm:mt-4">
            <div className="flex items-center justify-between border-b p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10">
                  <MapPin
                    size={17}
                    className="text-cyan-400"
                  />
                </div>

                <div>
                  <h2 className="text-sm font-semibold">
                    Location
                  </h2>

                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    Used only when NEXUS needs your location.
                  </p>
                </div>
              </div>

              <span
                className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
                style={{
                  background:
                    locationGranted
                      ? "rgba(16,185,129,.10)"
                      : "rgba(148,163,184,.10)",
                  color:
                    locationGranted
                      ? "#34d399"
                      : "var(--nexus-muted)",
                }}
              >
                {locationStatusLabel}
              </span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                    style={{
                      borderColor:
                        "var(--nexus-border)",
                      background:
                        "var(--nexus-surface-2)",
                    }}
                  >
                    <Crosshair
                      size={16}
                      className={
                        locationGranted
                          ? "text-emerald-400"
                          : "text-zinc-500"
                      }
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      Location access
                    </p>

                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      {locationGranted
                        ? "Permission granted"
                        : locationPermission ===
                            "denied"
                          ? "Permission denied"
                          : "Permission not granted"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!locationGranted && (
                    <button
                      type="button"
                      onClick={
                        handleLocationPermission
                      }
                      disabled={
                        locationLoading
                      }
                      className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locationLoading
                        ? "Requesting..."
                        : "Allow"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      handleTestLocation
                    }
                    disabled={
                      locationLoading
                    }
                    className="rounded-xl border px-3 py-2 text-[10px] font-semibold transition hover:bg-white/[.03] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor:
                        "var(--nexus-border)",
                    }}
                  >
                    {locationLoading
                      ? "Checking..."
                      : "Get location"}
                  </button>

                  {locationTrackingStatus === "active" ? (
                    <button
                      type="button"
                      onClick={
                        handleStopLocationTracking
                      }
                      disabled={
                        locationTrackingLoading
                      }
                      className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locationTrackingLoading
                        ? "Stopping..."
                        : "Stop tracking"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        handleStartLocationTracking
                      }
                      disabled={
                        locationTrackingLoading ||
                        !locationGranted
                      }
                      className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locationTrackingLoading
                        ? "Starting..."
                        : "Start tracking"}
                    </button>
                  )}
                </div>
              </div>

              {locationResult && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <LocationValue
                    label="Latitude"
                    value={locationResult.latitude.toFixed(
                      5
                    )}
                  />

                  <LocationValue
                    label="Longitude"
                    value={locationResult.longitude.toFixed(
                      5
                    )}
                  />

                  <LocationValue
                    label="Accuracy"
                    value={`±${Math.round(
                      locationResult.accuracy
                    )}m`}
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[9px] text-zinc-600">
                  {locationTrackingStatus === "active"
                    ? "Continuous tracking is active."
                    : "Tracking starts only when you explicitly choose Start tracking."}
                </span>
              </div>

              {locationError && (
                <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[10px] leading-4 text-rose-400">
                  {locationError}
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold">Location map</p>
                    <p className="mt-0.5 text-[9px] text-zinc-500">
                      Google Maps with the NEXUS map component fallback.
                    </p>
                  </div>
                  {locationResult && (
                    <span className="shrink-0 rounded-full border px-2 py-1 text-[8px] font-medium text-zinc-400" style={{ borderColor: "var(--nexus-border)" }}>
                      Current position
                    </span>
                  )}
                </div>

                <LocationMap
                  location={locationResult}
                  height={300}
                  provider="auto"
                />
              </div>
            </div>
          </section>

          {/* SIMPLE APP INFO */}

          <div className="pb-4 pt-5 text-center">
            <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">
              NEXUS
            </p>

            <p className="mt-1 text-[9px] text-zinc-600">
              Personal productivity system
            </p>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function SettingRow({
  icon,
  title,
  enabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  enabled: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
          style={{
            borderColor:
              "var(--nexus-border)",
            background:
              "var(--nexus-surface-2)",
            color: enabled
              ? "var(--nexus-purple)"
              : "var(--nexus-muted)",
          }}
        >
          {icon}
        </div>

        <p className="text-xs font-medium">
          {title}
        </p>
      </div>

      <button
        type="button"
        aria-label={`${title} ${
          enabled ? "on" : "off"
        }`}
        aria-pressed={enabled}
        onClick={() =>
          onChange(!enabled)
        }
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          enabled
            ? "bg-violet-500"
            : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            enabled
              ? "left-[22px]"
              : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function LocationValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{
        borderColor:
          "var(--nexus-border)",
        background:
          "var(--nexus-surface-2)",
      }}
    >
      <p className="text-[9px] text-zinc-500">
        {label}
      </p>

      <p className="mt-1 truncate text-[10px] font-medium">
        {value}
      </p>
    </div>
  );
}