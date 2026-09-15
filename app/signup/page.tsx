"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    setIsNativeApp(Capacitor.isNativePlatform());
  }, []);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: signupError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
            },
          },
        });

      if (signupError) {
        setError(signupError.message);
        setLoading(false);
        return;
      }

      setMessage(
        "Account created successfully! Please check your email for verification."
      );

      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Signup error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your account. Please try again."
      );
    }

    setLoading(false);
  };

  return (
    <>
      {/* =========================================================
          GLOBAL VISIBILITY FIX
      ========================================================= */}

      <style jsx global>{`
        /*
         * Force normal text inside the signup form to remain visible.
         */
        input {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
        }

        input::placeholder {
          color: #6b7280 !important;
          opacity: 1 !important;
          -webkit-text-fill-color: #6b7280 !important;
        }

        /*
         * Chrome autofill fix.
         */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          box-shadow: 0 0 0 1000px #111117 inset !important;
          background-color: #111117 !important;
          transition: background-color 9999s ease-out 0s;
        }

        /*
         * Fix text when the user highlights/selects it.
         */
        ::selection {
          background: rgba(139, 92, 246, 0.55) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        /*
         * Explicitly protect headings from inherited dark text.
         */
        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
          color: #ffffff;
          -webkit-text-fill-color: #ffffff;
        }
      `}</style>

      <main className="flex min-h-screen items-center justify-center bg-[#08080f] px-4 py-8 text-white">

        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d15] shadow-2xl md:grid-cols-2">

          {/* =====================================================
              LEFT SIDE
          ===================================================== */}

          <section
            className={`${
              isNativeApp ? "hidden" : "relative flex"
            } min-h-[650px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#7c3aed] via-[#4c1d95] to-[#25103d] p-8 sm:p-10 md:p-12`}
          >

            {/* Decorative circle */}

            <div className="absolute -right-20 top-24 h-72 w-72 rounded-full border border-white/10" />

            <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-purple-400/10 blur-3xl" />

            <div className="relative z-10">

              {/* LOGO */}

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white font-bold text-purple-700">
                  N
                </div>

                <span className="text-xl font-bold tracking-wide text-black">
                  NEXUS
                </span>

              </div>

            </div>

            {/* HERO */}

            <div className="relative z-10">

              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-2xl text-black">
                ✦
              </div>

              <h1
                className="text-4xl font-bold leading-tight md:text-5xl"
                style={{
                  color: "#ffffff",
                  WebkitTextFillColor: "#ffffff",
                }}
              >
                <span
                  style={{
                    color: "#000000",
                    WebkitTextFillColor: "#000000",
                  }}
                >
                  Build your work.
                </span>

                <br />

                <span
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                >
                  Your way.
                </span>
              </h1>

              <p
                className="mt-6 max-w-md text-base leading-7"
                style={{
                  color: "rgba(255,255,255,0.8)",
                  WebkitTextFillColor: "rgba(255,255,255,0.8)",
                }}
              >
                Create your NEXUS workspace and bring your projects,
                focus, and insights together in one place.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">

                <span
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm"
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                >
                  Focus
                </span>

                <span
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm"
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                >
                  Projects
                </span>

                <span
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm"
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                >
                  Insights
                </span>

              </div>

            </div>

            {/* FOOTER */}

            <p
              className="relative z-10 text-sm"
              style={{
                color: "rgba(255,255,255,0.6)",
                WebkitTextFillColor: "rgba(255,255,255,0.6)",
              }}
            >
              Built for Web · Android · iOS
            </p>

          </section>

          {/* =====================================================
              RIGHT SIDE
          ===================================================== */}

          <section
            className="flex items-center bg-[#0c0c12] p-6 sm:p-8 md:p-12"
            style={{
              color: "#ffffff",
            }}
          >

            <div className="mx-auto w-full max-w-md">

              {/* HEADER */}

              <p
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{
                  color: "#c4b5fd",
                  WebkitTextFillColor: "#c4b5fd",
                }}
              >
                JOIN NEXUS
              </p>

              {/* IMPORTANT: HEADING FIX */}

              <h2
                className="mt-3 text-3xl font-bold tracking-tight"
                style={{
                  color: "#ffffff",
                  WebkitTextFillColor: "#ffffff",
                }}
              >
                Create your account.
              </h2>

              <p
                className="mt-3 text-sm"
                style={{
                  color: "#9ca3af",
                  WebkitTextFillColor: "#9ca3af",
                }}
              >
                Start building your perfect workflow today.
              </p>

              {/* =================================================
                  FORM
              ================================================= */}

              <form
                onSubmit={handleSignup}
                autoComplete="off"
                className="mt-8 space-y-4"
              >

                {/* FULL NAME */}

                <div>

                  <label
                    htmlFor="signup-full-name"
                    className="mb-2 block text-sm"
                    style={{
                      color: "#d1d5db",
                      WebkitTextFillColor: "#d1d5db",
                    }}
                  >
                    Full name
                  </label>

                  <input
                    id="signup-full-name"
                    name="signup-full-name"
                    type="text"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    required
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 outline-none transition placeholder:text-gray-500 focus:border-purple-500 focus:bg-white/[0.06]"
                    style={{
                      color: "#ffffff",
                      WebkitTextFillColor: "#ffffff",
                      caretColor: "#ffffff",
                    }}
                  />

                </div>

                {/* EMAIL */}

                <div>

                  <label
                    htmlFor="signup-email"
                    className="mb-2 block text-sm"
                    style={{
                      color: "#d1d5db",
                      WebkitTextFillColor: "#d1d5db",
                    }}
                  >
                    Email address
                  </label>

                  <input
                    id="signup-email"
                    name="signup-email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    required
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 outline-none transition placeholder:text-gray-500 focus:border-purple-500 focus:bg-white/[0.06]"
                    style={{
                      color: "#ffffff",
                      WebkitTextFillColor: "#ffffff",
                      caretColor: "#ffffff",
                    }}
                  />

                </div>

                {/* PASSWORD */}

                <div className="relative">

                  <label
                    htmlFor="signup-password"
                    className="mb-2 block text-sm"
                    style={{
                      color: "#d1d5db",
                      WebkitTextFillColor: "#d1d5db",
                    }}
                  >
                    Password
                  </label>

                  <input
                    id="signup-password"
                    name="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 outline-none transition placeholder:text-gray-500 focus:border-purple-500 focus:bg-white/[0.06]"
                    style={{
                      color: "#ffffff",
                      WebkitTextFillColor: "#ffffff",
                      caretColor: "#ffffff",
                    }}
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-[42px] rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                        <path d="M3 3l18 18" strokeLinecap="round" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
                        <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8a17.5 17.5 0 0 1-3.2 5.1M6.2 6.2C4.6 7.4 3.3 9.5 2 12c1.5 4 5 8 10 8 1.5 0 2.9-.3 4.1-.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>

                </div>

                {/* CONFIRM PASSWORD */}

                <div className="relative">

                  <label
                    htmlFor="signup-confirm-password"
                    className="mb-2 block text-sm"
                    style={{
                      color: "#d1d5db",
                      WebkitTextFillColor: "#d1d5db",
                    }}
                  >
                    Confirm password
                  </label>

                  <input
                    id="signup-confirm-password"
                    name="signup-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 outline-none transition placeholder:text-gray-500 focus:border-purple-500 focus:bg-white/[0.06]"
                    style={{
                      color: "#ffffff",
                      WebkitTextFillColor: "#ffffff",
                      caretColor: "#ffffff",
                    }}
                  />

                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute right-3 top-[42px] rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                        <path d="M3 3l18 18" strokeLinecap="round" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
                        <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8a17.5 17.5 0 0 1-3.2 5.1M6.2 6.2C4.6 7.4 3.3 9.5 2 12c1.5 4 5 8 10 8 1.5 0 2.9-.3 4.1-.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>

                </div>

                {/* ERROR */}

                {error && (
                  <div
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm"
                    style={{
                      color: "#fca5a5",
                      WebkitTextFillColor: "#fca5a5",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* SUCCESS */}

                {message && (
                  <div
                    className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm"
                    style={{
                      color: "#86efac",
                      WebkitTextFillColor: "#86efac",
                    }}
                  >
                    {message}
                  </div>
                )}

                {/* CREATE ACCOUNT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a855f7] py-3.5 font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                  }}
                >
                  {loading
                    ? "Creating account..."
                    : "Create NEXUS Account →"}
                </button>

              </form>

              {/* =================================================
                  SIGN IN
              ================================================= */}

              <p
                className="mt-7 text-center text-sm"
                style={{
                  color: "#71717a",
                  WebkitTextFillColor: "#71717a",
                }}
              >
                Already have an account?{" "}

                <Link
                  href="/"
                  className="font-medium transition hover:text-purple-300"
                  style={{
                    color: "#c4b5fd",
                    WebkitTextFillColor: "#c4b5fd",
                  }}
                >
                  Sign in
                </Link>

              </p>

              {/* SECURITY */}

              <p
                className="mt-8 text-center text-xs"
                style={{
                  color: "#52525b",
                  WebkitTextFillColor: "#52525b",
                }}
              >
                Secure authentication · Email verification · Encrypted sessions
              </p>

            </div>

          </section>

        </div>

      </main>
    </>
  );
}