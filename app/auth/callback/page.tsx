"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing secure sign-in…");

  useEffect(() => {
    let cancelled = false;

    const completeSignIn = async () => {
      const params = new URLSearchParams(window.location.search);

      const code = params.get("code");
      const errorDescription = params.get("error_description");

      if (errorDescription) {
        if (!cancelled) {
          setMessage(errorDescription);

          setTimeout(() => {
            window.location.replace("/");
          }, 1800);
        }

        return;
      }

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) {
            setMessage(error.message);

            setTimeout(() => {
              window.location.replace("/");
            }, 1800);
          }

          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        window.location.replace("/dashboard/");
        return;
      }

      if (!cancelled) {
        setMessage(
          "We could not complete the sign-in. Please try again."
        );

        setTimeout(() => {
          window.location.replace("/");
        }, 1800);
      }
    };

    completeSignIn();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#08080c] px-6 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-xl font-bold shadow-lg shadow-purple-950/40">
          N
        </div>

        <h1 className="mt-6 text-xl font-semibold">NEXUS</h1>

        <p className="mt-2 text-sm text-zinc-400">
          {message}
        </p>

        <div className="mx-auto mt-6 h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-purple-400" />
      </div>
    </main>
  );
}