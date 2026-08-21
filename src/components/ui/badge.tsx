import { cn } from "@/lib/utils";

function Badge({
  className,
  tone = "tan",
  children,
}: {
  className?: string;
  tone?: "tan" | "forest" | "accent" | "muted";
  children: React.ReactNode;
}) {
  const tones = {
    tan: "bg-tan/25 text-ink",
    forest: "bg-forest/10 text-forest",
    accent: "bg-accent/10 text-accent",
    muted: "bg-ink/5 text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export { Badge };
