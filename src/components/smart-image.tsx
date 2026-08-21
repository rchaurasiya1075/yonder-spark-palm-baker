import { useEffect, useMemo, useState } from "react";
import { mediaCandidates } from "@/lib/drive";
import { cn } from "@/lib/utils";

export function SmartImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const candidates = useMemo(() => (src ? mediaCandidates(src) : []), [src]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src]);

  const current = candidates[index];
  if (!current) {
    return (
      <div className={cn("grid place-items-center bg-cream text-xs text-muted", className)}>
        No image
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
