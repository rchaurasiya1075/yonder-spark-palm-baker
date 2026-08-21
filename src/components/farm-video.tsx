import { useState } from "react";
import { Play } from "lucide-react";
import { extractYouTubeId, toVideoEmbed, youtubeThumb } from "@/lib/drive";
import { SmartImage } from "@/components/smart-image";

export function FarmVideo({
  url,
  name,
  autoPlay = false,
}: {
  url: string;
  name: string;
  autoPlay?: boolean;
}) {
  const embed = toVideoEmbed(url);
  const ytId = extractYouTubeId(url);
  const [playing, setPlaying] = useState(autoPlay);
  if (!embed) return null;

  if (embed.kind === "file") {
    return (
      <video
        src={embed.src}
        controls
        playsInline
        controlsList="nodownload"
        className="aspect-video w-full bg-ink"
      />
    );
  }

  if (embed.kind === "drive") {
    return (
      <iframe
        title={`${name} video`}
        src={embed.src}
        className="aspect-video w-full bg-ink"
        allow="autoplay; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  const poster = ytId ? youtubeThumb(ytId) : "";
  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="relative block aspect-video w-full overflow-hidden bg-ink"
        aria-label={`Play ${name} video`}
      >
        {poster ? (
          <SmartImage src={poster} alt="" className="size-full object-cover opacity-90" />
        ) : null}
        <span className="absolute inset-0 grid place-items-center bg-ink/35">
          <span className="grid size-14 place-items-center rounded-full bg-paper/95 text-ink shadow-[var(--shadow-card)]">
            <Play className="size-6 fill-ink" />
          </span>
        </span>
      </button>
    );
  }

  const src = embed.src.includes("autoplay=1") ? embed.src : `${embed.src}&autoplay=1`;
  return (
    <iframe
      title={`${name} video`}
      src={src}
      className="aspect-video w-full bg-ink"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
