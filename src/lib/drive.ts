/** Convert a Google Drive share link into a viewable image URL. */
export function toDriveViewUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/drive\.google\.com\/uc\?/i.test(trimmed) && /[?&]id=/.test(trimmed)) {
    return trimmed;
  }
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const id = fileMatch?.[1] ?? idMatch?.[1];
  if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
  return trimmed;
}

export function normalizeImageUrls(urls: string[]): string[] {
  return urls
    .map(toDriveViewUrl)
    .map((u) => u.trim())
    .filter(Boolean);
}

export type VideoEmbed =
  | { kind: "youtube"; src: string }
  | { kind: "file"; src: string };

export function toVideoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const yt = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/,
  );
  if (yt?.[1]) {
    return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}` };
  }
  return { kind: "file", src: trimmed };
}
