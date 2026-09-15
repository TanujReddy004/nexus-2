"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { saveAuthHandoff, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [socialLoading, setSocialLoading] = useState<
    "google" | "apple" | null
  >(null);

  const [emailUnlocked, setEmailUnlocked] = useState(false);
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    try {
      console.error(
        "[NEXUS-AUTH] LOGIN: starting signInWithPassword."
      );

      const {
        data: { session },
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      console.error(
        "[NEXUS-AUTH] LOGIN: signInWithPassword returned.",
        {
          error: loginError?.message ?? "NONE",
          session: session ? "YES" : "NO",
          user: session?.user?.email ?? "NONE",
        }
      );

      if (loginError) {
        setError(loginError.message);
        setLoading(false);
        return;
      }

      if (!session) {
        setError(
          "Sign-in succeeded, but no active session was created. Please try again."
        );
        setLoading(false);
        return;
      }

      // Record the successful login in the user's profile for the Team dashboard.
      // These fields must exist in public.profiles.
      const loginTimestamp = new Date().toISOString();
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          last_login_at: loginTimestamp,
          last_seen_at: loginTimestamp,
          is_online: true,
        })
        .eq("id", session.user.id);

      if (profileUpdateError) {
        // Do not block login if activity tracking is not configured yet.
        console.error(
          "[NEXUS-AUTH] Unable to update profile activity:",
          profileUpdateError
        );
      }

      /*
       * Keep a short-lived mobile handoff in sessionStorage.
       * If the Android WebView reloads the static dashboard before
       * Supabase localStorage has been restored, AuthGuard can
       * rebuild the session from this handoff.
       */
      saveAuthHandoff(
        session.access_token,
        session.refresh_token
      );

      const dashboardPath = Capacitor.isNativePlatform()
        ? "/dashboard/index.html"
        : "/dashboard/";

      console.error(
        `[NEXUS-AUTH] LOGIN: session received. Navigating to ${dashboardPath}.`
      );

      /*
       * Web uses the normal Next.js route.
       * Capacitor uses the generated static dashboard HTML.
       */
      window.location.replace(dashboardPath);
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );

      setLoading(false);
    }
  };

  const handleSocialLogin = async (
    provider: "google" | "apple"
  ) => {
    setError("");
    setSocialLoading(provider);

    try {
      const { error: oauthError } =
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/auth/callback/`,
          },
        });

      if (oauthError) {
        setError(oauthError.message);
        setSocialLoading(null);
      }
    } catch (err) {
      console.error("OAuth error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to continue with social login."
      );

      setSocialLoading(null);
    }
  };

  return (
    <main className="nexus-login-page flex min-h-screen items-center justify-center bg-[#08080c] p-6 text-white">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 shadow-2xl md:grid-cols-2">

        {/* =========================================================
            LEFT SIDE
        ========================================================= */}

        <div className="hidden min-h-[650px] flex-col justify-between bg-gradient-to-br from-violet-600 via-purple-700 to-[#24113d] p-10 md:flex">

          <div>

            {/* LOGO */}

            <div className="flex items-center gap-3">

              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold"
                style={{
                  color: "#7c3aed",
                  WebkitTextFillColor: "#7c3aed",
                }}
              >
                N
              </div>

              <h1
                className="text-2xl font-bold"
                style={{
                  color: "#000000",
                  WebkitTextFillColor: "#000000",
                }}
              >
                NEXUS
              </h1>

            </div>

            {/* HERO */}

            <div className="mt-32">

              <div className="text-4xl font-bold leading-tight text-black">
                Your work.
                <br />
                In perfect flow.
              </div>

              <p className="mt-6 max-w-sm text-white/75">
                A focused command center for ambitious people
                who want to turn attention into progress.
              </p>

              <div className="mt-8 flex gap-3">

                <span className="rounded-full border border-white/20 px-4 py-2 text-sm text-black">
                  Focus
                </span>

                <span className="rounded-full border border-white/20 px-4 py-2 text-sm text-black">
                  Projects
                </span>

                <span className="rounded-full border border-white/20 px-4 py-2 text-sm text-black">
                  Insights
                </span>

              </div>

            </div>

          </div>

          <p className="text-sm text-white/60">
            Built for Web · Android · iOS
          </p>

        </div>

        {/* =========================================================
            RIGHT SIDE
        ========================================================= */}

        <div
          className="flex flex-col justify-center bg-[#0c0c12] p-8 text-white md:p-12"
          style={{ color: "#ffffff" }}
        >

          <div className="mx-auto w-full max-w-md">

            <p className="text-xs font-bold tracking-[0.2em] text-purple-400">
              WELCOME BACK
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Sign in to continue.
            </h2>

            <p className="mt-3 text-sm text-gray-400">
              Access your secure NEXUS workspace.
            </p>

            {/* =====================================================
                GOOGLE + APPLE
            ===================================================== */}

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">

              {/* GOOGLE */}

              <button
                type="button"
                onClick={() => handleSocialLogin("google")}
                disabled={
                  loading || socialLoading !== null
                }
                className="flex h-14 items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {socialLoading === "google" ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >

                    <path
                      fill="#4285F4"
                      d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z"
                    />

                    <path
                      fill="#34A853"
                      d="M12 21.72c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.72Z"
                    />

                    <path
                      fill="#FBBC05"
                      d="M6.53 13.8A5.86 5.86 0 0 1 6.22 12c0-.62.11-1.23.31-1.8V7.67H3.28A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.33l3.25-2.53Z"
                    />

                    <path
                      fill="#EA4335"
                      d="M12 6.17c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.25 14.63 2.28 12 2.28a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 7.89 9.46 6.17 12 6.17Z"
                    />

                  </svg>
                )}

                <span>
                  {socialLoading === "google"
                    ? "Connecting..."
                    : "Continue with Google"}
                </span>

              </button>

              {/* APPLE */}

              <button
                type="button"
                onClick={() => handleSocialLogin("apple")}
                disabled={
                  loading || socialLoading !== null
                }
                className="flex h-14 items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {socialLoading === "apple" ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-white"
                    aria-hidden="true"
                  >
                    <path d="M17.05 12.54c-.02-2.24 1.83-3.32 1.91-3.37-1.05-1.53-2.68-1.74-3.25-1.76-1.37-.14-2.7.82-3.4.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.92.88-3.68 2.21-1.58 2.74-.4 6.77 1.12 8.99.75 1.09 1.63 2.31 2.79 2.27 1.12-.05 1.54-.73 2.9-.73 1.35 0 1.74.73 2.91.71 1.2-.02 1.96-1.1 2.69-2.2.84-1.25 1.18-2.46 1.2-2.53-.03-.01-2.21-.85-2.23-3.63Zm-2.24-6.59c.61-.74 1.02-1.77.91-2.8-.88.04-1.95.59-2.58 1.33-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.59-1.23Z" />
                  </svg>
                )}

                <span>
                  {socialLoading === "apple"
                    ? "Connecting..."
                    : "Continue with Apple"}
                </span>

              </button>

            </div>

            {/* DIVIDER */}

            <div className="my-7 flex items-center gap-4">

              <div className="h-px flex-1 bg-white/10" />

              <span className="text-[10px] font-semibold tracking-[0.18em] text-gray-500">
                OR CONTINUE WITH EMAIL
              </span>

              <div className="h-px flex-1 bg-white/10" />

            </div>

            {/* =====================================================
                EMAIL LOGIN
            ===================================================== */}

            <form
              onSubmit={handleLogin}
              autoComplete="off"
              className="space-y-5"
            >

              {/* EMAIL */}

              <div>

                <label
                  htmlFor="nexus-email"
                  className="mb-2 block text-sm text-gray-300"
                >
                  Email address
                </label>

                <input
                  id="nexus-email"
                  name="nexus-email-entry"
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  onFocus={() =>
                    setEmailUnlocked(true)
                  }
                  readOnly={!emailUnlocked}
                  required
                  autoComplete="new-password"
                  spellCheck={false}
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-500 focus:bg-white/[0.06]"
                />

              </div>

              {/* PASSWORD */}

              <div className="relative">

                <div className="mb-2 flex justify-between">

                  <label
                    htmlFor="nexus-password"
                    className="text-sm text-gray-300"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    className="text-xs text-purple-400 transition hover:text-purple-300"
                  >
                    Forgot password?
                  </button>

                </div>

                <input
                  id="nexus-password"
                  name="nexus-password-entry"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  onFocus={() =>
                    setPasswordUnlocked(true)
                  }
                  readOnly={!passwordUnlocked}
                  required
                  autoComplete="new-password"
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 pr-14 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-500 focus:bg-white/[0.06]"
                />

                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-[calc(50%+14px)] -translate-y-1/2 rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                      <path d="M9.88 4.24A9.7 9.7 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-3.16 4.19" />
                      <path d="M6.61 6.61C3.97 8.3 2 12 2 12s3 8 10 8a9.7 9.7 0 0 0 4.12-.91" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>

              </div>

              {/* ERROR */}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={
                  loading || socialLoading !== null
                }
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-4 font-semibold text-white transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Signing in..."
                  : "Sign in to NEXUS →"}
              </button>

            </form>

            {/* =====================================================
                CREATE ACCOUNT
            ===================================================== */}

            <p className="mt-7 text-center text-sm text-gray-500">
              New to NEXUS?{" "}

              <button
                type="button"
                onClick={() => router.push("/signup")}
                className="font-medium text-purple-400 transition hover:text-purple-300"
              >
                Create an account
              </button>

            </p>

            <p className="mt-10 text-center text-xs text-gray-600">
              Secure authentication · Email verification · Encrypted sessions
            </p>

          </div>

        </div>

      </div>

      <style jsx global>{`
        /*
         * Keep the login screen white text visible when the global
         * Light theme overrides Tailwind text-white.
         */
        .nexus-login-page.text-white,
        .nexus-login-page .text-white {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          box-shadow: 0 0 0 1000px #111117 inset !important;
          transition: background-color 9999s ease-out 0s;
        }

        input::placeholder {
          color: #6b7280;
          opacity: 1;
        }
      `}</style>

    </main>
  );
}