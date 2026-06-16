import { toast } from "react-toastify";
import { apiUrl } from "./apiBase";

export type AuthFetchInit = RequestInit & {
  /**
   * When true, a 401 response does not clear the session or redirect.
   * Use for public endpoints (e.g. login) or logout where the client handles cleanup.
   */
  skipAuthExpiredRedirect?: boolean;
};

let sessionExpirySignOutPending = false;
let idleSignOutPending = false;

const IDLE_LOGOUT_MS = 15 * 60 * 1000;

function signInHref(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? `${base}signin` : `${base}/signin`;
}

/** Removes auth entries from session storage (same keys used after sign-in). */
export function clearAuthSession(): void {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("userEmail");
}

function redirectToSignIn(): void {
  const path = signInHref();
  if (window.location.pathname === path || window.location.pathname.endsWith("/signin")) {
    return;
  }
  window.location.replace(path);
}

function scheduleSessionExpiredSignOut(): void {
  if (sessionExpirySignOutPending || idleSignOutPending) return;
  sessionExpirySignOutPending = true;

  toast.warning("Session expired", {
    className: "app-toast-session-expired",
    autoClose: 3500,
    closeOnClick: false,
    draggable: false,
    closeButton: false,
    onClose: () => {
      clearAuthSession();
      redirectToSignIn();
      sessionExpirySignOutPending = false;
    },
  });
}

/** Signs the user out after a period of inactivity (see useIdleLogout). */
export function scheduleIdleSignOut(): void {
  if (idleSignOutPending || sessionExpirySignOutPending) return;
  if (!sessionStorage.getItem("accessToken")) return;
  idleSignOutPending = true;

  void authFetch("/auth/logout", {
    method: "POST",
    skipAuthExpiredRedirect: true,
  });

  toast.warning("You were signed out due to inactivity.", {
    className: "app-toast-session-expired",
    autoClose: 3500,
    closeOnClick: false,
    draggable: false,
    closeButton: false,
    onClose: () => {
      clearAuthSession();
      redirectToSignIn();
      idleSignOutPending = false;
    },
  });
}

export const IDLE_LOGOUT_TIMEOUT_MS = IDLE_LOGOUT_MS;

/**
 * Fetch against the API, attaching Bearer access token when present.
 * On 401 (expired or invalid access token), shows a small top-center “Session expired” notice, then clears auth and redirects to sign-in unless skipped.
 */
export async function authFetch(
  apiPath: string,
  init: AuthFetchInit = {},
): Promise<Response> {
  const { skipAuthExpiredRedirect, ...rest } = init;
  const url = apiPath.startsWith("http") ? apiPath : apiUrl(apiPath);
  const headers = new Headers(rest.headers ?? undefined);
  const token = sessionStorage.getItem("accessToken");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const credentials = rest.credentials ?? "include";
  const res = await fetch(url, { ...rest, headers, credentials });

  if (res.status === 401 && !skipAuthExpiredRedirect) {
    scheduleSessionExpiredSignOut();
  }

  return res;
}
