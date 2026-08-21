/** Google Drive + YouTube helpers. Drive `uc?export=view` often 403s — we prefer lh3/thumbnail. */

import { publicUrl } from "@/lib/public-url";

export function extractDriveId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const patterns = [
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/open\?id=([a-zA-Z0-9_-]{10,})/,
    /drive\.google\.com\/thumbnail\?[^#]*[?&]?id=([a-zA-Z0-9_-]{10,})/,
    /(?:drive|docs)\.google\.com\/uc\?[^#]*[?&]?id=([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) return trimmed;
  return null;
}

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const isYt =
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com");
    if (isYt) {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && /^[A-Za-z0-9_-]{11}$/.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      if (host === "youtu.be" && parts[0]) {
        const id = parts[0].replace(/[^A-Za-z0-9_-]/g, "").slice(0, 11);
        if (id.length === 11) return id;
      }
      const markers = new Set(["shorts", "embed", "live", "v"]);
      for (let i = 0; i < parts.length - 1; i++) {
        if (!markers.has(parts[i])) continue;
        const id = parts[i + 1].replace(/[^A-Za-z0-9_-]/g, "").slice(0, 11);
        if (id.length === 11) return id;
      }
    }
  } catch {
    /* fall through to regex */
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

export function youtubeThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function driveImageCandidates(input: string): string[] {
  const id = extractDriveId(input);
  if (!id) return [];
  return [
    `https://lh3.googleusercontent.com/d/${id}=w2000`,
    `https://lh3.googleusercontent.com/d/${id}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://drive.google.com/uc?id=${id}&export=download`,
  ];
}

/** Convert a Google Drive share link into a viewable image URL. */
export function toDriveViewUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (extractYouTubeId(trimmed)) return trimmed;
  const id = extractDriveId(trimmed);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w2000`;
  return trimmed;
}

export function mediaCandidates(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const yt = extractYouTubeId(trimmed);
  if (yt) {
    return [youtubeThumb(yt), `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`];
  }
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return [trimmed];
  }
  if (trimmed.startsWith("//")) {
    return [`https:${trimmed}`];
  }
  if (trimmed.startsWith("/")) {
    return [publicUrl(trimmed)];
  }
  const drive = driveImageCandidates(trimmed);
  if (drive.length) {
    const seen = new Set(drive);
    if (!seen.has(trimmed)) drive.push(trimmed);
    return drive;
  }
  return [trimmed];
}

export function normalizeImageUrls(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    for (const part of raw.split(/[\n,]+/)) {
      if (extractYouTubeId(part)) continue;
      const url = toDriveViewUrl(part);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

export type VideoEmbed =
  | { kind: "youtube"; src: string; id: string }
  | { kind: "drive"; src: string }
  | { kind: "file"; src: string };

export function normalizeVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const yt = extractYouTubeId(trimmed);
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  const driveId = extractDriveId(trimmed);
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  return trimmed;
}

export function toVideoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const yt = extractYouTubeId(trimmed);
  if (yt) {
    return {
      kind: "youtube",
      id: yt,
      src: `https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1`,
    };
  }
  const driveId = extractDriveId(trimmed);
  if (driveId) {
    return { kind: "drive", src: `https://drive.google.com/file/d/${driveId}/preview` };
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return { kind: "file", src: publicUrl(trimmed) };
  }
  return { kind: "file", src: trimmed };
}
