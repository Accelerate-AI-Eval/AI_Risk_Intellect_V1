/**
 * API origin from `.env.local` (`VITE_BASE_URL`), no trailing slash.
 * Leave unset or empty to use same-origin URLs (e.g. Vite dev proxy for `/api`).
 * If set, use the API **root** only, e.g. `http://localhost:5005` or `http://localhost:5005/api/v1`
 * (do not duplicate `/api` in both base and `apiUrl("/api/...")` — extra `/api` is stripped when needed).
 */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_BASE_URL;
  if (v == null || String(v).trim() === "") return "";
  return String(v).trim().replace(/\/$/, "");
}

/**
 * Join API base + path. Avoids `/api/v1` + `/api/auth/...` → `/api/v1/api/auth/...`
 * when `VITE_BASE_URL` already includes a version prefix (e.g. `.../api/v1`).
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base === "") return p;
  const joined = `${base.replace(/\/$/, "")}${p}`;
  return joined.replace(/\/api\/(v\d+)\/api\//i, "/api/$1/");
}
