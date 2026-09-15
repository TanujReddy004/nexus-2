"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  initializeBackgroundEngine,
} from "@/lib/background/background-engine";

export default function AppStart({
  children,
}: {
  children: React.ReactNode;
}) {
  const [starting, setStarting] =
    useState(true);

  const [visible, setVisible] =
    useState(true);

  /*
   * NEXUS startup animation.
   */
  useEffect(() => {
    const fadeTimer =
      window.setTimeout(() => {
        setVisible(false);
      }, 1100);

    const removeTimer =
      window.setTimeout(() => {
        setStarting(false);
      }, 1450);

    return () => {
      window.clearTimeout(
        fadeTimer
      );

      window.clearTimeout(
        removeTimer
      );
    };
  }, []);

  /*
   * Phase 1:
   * Initialize the Background Engine and
   * App Lifecycle system.
   *
   * Reminder reconciliation is handled by
   * the Background Engine so AppStart does
   * not maintain a second reminder-sync path.
   */
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (cancelled) {
        return;
      }

      try {
        await initializeBackgroundEngine();
      } catch (error) {
        console.error(
          "[NEXUS-START] Background Engine initialization failed:",
          error
        );
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}

      {starting && (
        <div
          className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#08080c] transition-opacity duration-300 ${
            visible
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          <div className="flex flex-col items-center">

            {/* NEXUS MARK */}

            <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 shadow-[0_0_60px_rgba(139,92,246,0.35)]">
              <div className="absolute inset-[1px] rounded-[23px] bg-[#111018]" />

              <span className="relative text-3xl font-bold text-white">
                N
              </span>
            </div>

            {/* BRAND */}

            <div className="mt-7 text-center">
              <h1 className="text-xl font-semibold tracking-[0.18em] text-white">
                NEXUS
              </h1>

              <p className="mt-2 text-[10px] font-medium tracking-[0.28em] text-zinc-500">
                PERSONAL PRODUCTIVITY OS
              </p>
            </div>

            {/* LOADING INDICATOR */}

            <div className="mt-8 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />

              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400 [animation-delay:150ms]" />

              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400 [animation-delay:300ms]" />
            </div>

          </div>
        </div>
      )}
    </>
  );
}