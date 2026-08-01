/**
 * Client for the Express + PostgreSQL backend in /server.
 *
 * Base URL comes from VITE_API_URL (set it in a .env file at the project
 * root, e.g. VITE_API_URL=http://localhost:5001/api). Defaults to
 * http://localhost:5001/api so the app works with zero config against the
 * backend's default port from server/.env.example.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001/api";
const TOKEN_KEY = "careerai-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore (SSR / storage disabled) */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // Without this, the browser's HTTP cache can serve a stale response for
    // a GET request with the same URL (e.g. admin re-visiting /admin/students
    // after a new student registered) since the backend doesn't set explicit
    // cache-control headers. Every request here should always hit the server.
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (body && (body.error?.formErrors?.[0] ?? body.error?.message ?? body.error)) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof message === "string" ? message : JSON.stringify(message));
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
};

/** True once we at least have a token — doesn't guarantee the backend is reachable. */
export function isAuthed() {
  return !!getToken();
}
