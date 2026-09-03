"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

/**
 * Quick light/dark flip for the nav. Reads `resolvedTheme` (not `theme`) so it
 * still shows the right icon while the theme is set to "system".
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";

  // Nothing derived from the resolved theme may be server-rendered — the server
  // has no idea which theme this browser will pick, so the icon and title wait
  // for hydration to avoid a mismatch.
  return (
    <button
      aria-label="Toggle theme"
      title={mounted ? (isDark ? "Light" : "Dark") : undefined}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {mounted && !isDark ? <Moon className="h-[17px] w-[17px]" /> : <Sun className="h-[17px] w-[17px]" />}
    </button>
  );
}
