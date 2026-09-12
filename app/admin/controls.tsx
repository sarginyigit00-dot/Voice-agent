import { cn } from "@/lib/utils";

/** Small controls shared by the /admin tabs. */

export function EmptyRow({ text }: { text: string }) {
  return <p className="px-3 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

export function ActionButton({
  children,
  onClick,
  disabled,
  destructive,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Defaults to "button" so instances inside a <form> don't submit it. */
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
        destructive
          ? "border-missed/30 text-missed hover:bg-missed/10"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none";
