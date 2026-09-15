import "./globals.css";
import type { Metadata } from "next";
import AppStart from "@/components/app-start";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "NEXUS — Personal Productivity OS",
  description:
    "A futuristic command center for focused work.",
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("nexus-theme");

    /*
     * NEXUS default appearance is LIGHT.
     *
     * If the user has already selected a theme,
     * respect that choice.
     */
    var theme =
      stored === "light" ||
      stored === "system" ||
      stored === "dark"
        ? stored
        : "light";

    var resolved = theme;

    if (theme === "system") {
      resolved =
        window.matchMedia(
          "(prefers-color-scheme: light)"
        ).matches
          ? "light"
          : "dark";
    }

    /*
     * Apply the theme before React renders.
     * This prevents the dark/light flash during page load.
     */
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    document.documentElement.setAttribute(
      "data-resolved-theme",
      resolved
    );

    document.documentElement.style.colorScheme =
      resolved;
  } catch (error) {
    /*
     * Safe fallback:
     * NEXUS should open in LIGHT mode.
     */
    document.documentElement.setAttribute(
      "data-theme",
      "light"
    );

    document.documentElement.setAttribute(
      "data-resolved-theme",
      "light"
    );

    document.documentElement.style.colorScheme =
      "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning className={cn("font-sans", geist.variable)}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
      </head>

      <body>
        <AppStart>
          {children}
        </AppStart>
      </body>
    </html>
  );
}