/** Public file under Vite `base` (needed on GitHub Pages project sites). */
export function publicUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

export const isGithubPages = import.meta.env.VITE_GITHUB_PAGES === "1";
