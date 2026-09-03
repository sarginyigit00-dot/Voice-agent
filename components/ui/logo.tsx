import { cn } from "@/lib/utils";
import appConfig from "@/app.config";

/**
 * Randevox logomark — user-supplied image at public/logo.png (mirrored at
 * app/icon.png for the favicon/OG image).
 *
 * Rendered as a MASK rather than an <img> so a single asset can take the
 * colour of whatever surface it sits on: white on the dark cockpit (the
 * previous `brightness-0 invert` look, unchanged), brand blue anywhere inside
 * `.ed-light`. Colour lives in the `.logo-mark` rules in globals.css.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={appConfig.name}
      className={cn("logo-mark h-8 w-8 shrink-0", className)}
    />
  );
}

/**
 * Brand mark + wordmark. `onDark` keeps the API compatible with the base kit,
 * but Randevox is dark-first either way.
 */
export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {withWordmark && (
        <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
          {appConfig.name}
        </span>
      )}
    </span>
  );
}
