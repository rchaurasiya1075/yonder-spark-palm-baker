/** Public file under Vite `base` (needed on GitHub Pages project sites). */
export function publicUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const raw = String(path || "").trim();
  if (!raw) return prefix;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withSlash === prefix.replace(/\/$/, "") || withSlash.startsWith(prefix)) {
    return withSlash;
  }
  return `${prefix}${withSlash.replace(/^\//, "")}`;
}

export const isGithubPages = import.meta.env.VITE_GITHUB_PAGES === "1";
