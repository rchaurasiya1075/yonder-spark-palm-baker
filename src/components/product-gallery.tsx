import { useState } from "react";
import { Play } from "lucide-react";
import { extractYouTubeId, toVideoEmbed, youtubeThumb } from "@/lib/drive";
import { SmartImage } from "@/components/smart-image";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
  videoUrl,
}: {
  images: string[];
  name: string;
  videoUrl?: string | null;
}) {
  const embed = toVideoEmbed(videoUrl);
  const ytId = extractYouTubeId(videoUrl ?? "");
  const slides: Array<{ type: "image"; src: string } | { type: "video"; thumb: string }> = [
    ...images.filter(Boolean).map((src) => ({ type: "image" as const, src })),
  ];
  if (embed) {
    const thumb =
      embed.kind === "youtube" && ytId
        ? youtubeThumb(ytId)
        : images[0] || "";
    slides.push({ type: "video", thumb });
  }
  const [active, setActive] = useState(0);
  const slide = slides[active];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-paper shadow-[var(--shadow-card)] ring-1 ring-border">
        {slide?.type === "video" && embed ? (
          embed.kind === "file" ? (
            <video src={embed.src} controls className="aspect-video w-full bg-ink" />
          ) : (
            <iframe
              title={`${name} video`}
              src={embed.src}
              className="aspect-video w-full bg-ink"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )
        ) : slide?.type === "image" ? (
          <SmartImage src={slide.src} alt={name} className="aspect-square w-full object-cover" />
        ) : (
          <div className="grid aspect-square place-items-center text-sm text-muted">
            No image yet
          </div>
        )}
      </div>
      {slides.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((item, i) => (
            <button
              key={(item.type === "image" ? item.src : "video") + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md ring-1 ring-border",
                i === active && "ring-2 ring-accent",
              )}
              aria-label={item.type === "video" ? "Play video" : `View image ${i + 1}`}
            >
              {item.type === "image" ? (
                <SmartImage src={item.src} alt="" className="size-full object-cover" />
              ) : item.thumb ? (
                <SmartImage src={item.thumb} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center bg-ink text-paper">
                  <Play className="size-4" />
                </div>
              )}
              {item.type === "video" ? (
                <span className="absolute inset-0 grid place-items-center bg-ink/40">
                  <Play className="size-4 fill-paper text-paper" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
