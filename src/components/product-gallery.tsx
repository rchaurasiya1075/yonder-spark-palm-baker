import { useState } from "react";
import { cn } from "@/lib/utils";
import { toVideoEmbed } from "@/lib/drive";

export function ProductGallery({
  images,
  name,
  videoUrl,
}: {
  images: string[];
  name: string;
  videoUrl?: string | null;
}) {
  const [active, setActive] = useState(0);
  const src = images[active] ?? images[0];
  const embed = toVideoEmbed(videoUrl);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-paper shadow-[var(--shadow-card)] ring-1 ring-border">
        {src ? (
          <img
            src={src}
            alt={name}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="grid aspect-square place-items-center text-sm text-muted">
            No image yet
          </div>
        )}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-md ring-1 ring-border",
                i === active && "ring-2 ring-accent",
              )}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      {embed ? (
        <div className="overflow-hidden rounded-xl bg-ink ring-1 ring-border">
          {embed.kind === "youtube" ? (
            <iframe
              title={`${name} video`}
              src={embed.src}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={embed.src} controls className="aspect-video w-full" />
          )}
        </div>
      ) : null}
    </div>
  );
}
