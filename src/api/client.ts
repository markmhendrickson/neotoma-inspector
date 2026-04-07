const LEGACY_API_URL_KEY = "neotoma_inspector_api_url";
const LEGACY_AUTH_TOKEN_KEY = "neotoma_inspector_auth_token";
const API_URL_KEY_PREFIX = "neotoma_inspector_api_url";
const AUTH_TOKEN_KEY_PREFIX = "neotoma_inspector_auth_token";
const LOCAL_PROXY_BASE = "/api";

export type InspectorEnvironment = "dev" | "prod";

export function getInspectorEnvironment(): InspectorEnvironment {
  const env = import.meta.env.VITE_NEOTOMA_ENV;
  if (env === "prod" || env === "production") {
    return "prod";
  }
  return "dev";
}

function getScopedStorageKey(prefix: string): string {
  return `${prefix}_${getInspectorEnvironment()}`;
}

function getStoredValue(prefix: string, legacyKey: string): string | null {
  const scopedKey = getScopedStorageKey(prefix);
  const scopedValue = localStorage.getItem(scopedKey);
  if (scopedValue) {
    return scopedValue;
  }

  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue) {
    localStorage.setItem(scopedKey, legacyValue);
    localStorage.removeItem(legacyKey);
    return legacyValue;
  }

  return null;
}

function normalizeStoredUrl(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function isProxyDefaultEnabled(): boolean {
  return import.meta.env.DEV;
}

export function getDefaultApiUrl(): string {
  if (import.meta.env.VITE_NEOTOMA_API_URL) {
    return import.meta.env.VITE_NEOTOMA_API_URL;
  }
  return getInspectorEnvironment() === "prod" ? "http://localhost:3180" : "http://localhost:3080";
}

export function getSavedApiUrl(): string | null {
  const storedValue = normalizeStoredUrl(getStoredValue(API_URL_KEY_PREFIX, LEGACY_API_URL_KEY));
  if (!storedValue) {
    return null;
  }

  // Migrate older local-dev defaults back to the proxy-based default.
  if (isProxyDefaultEnabled() && storedValue === getDefaultApiUrl()) {
    clearApiUrl();
    return null;
  }

  return storedValue;
}

export function getApiUrl(): string {
  return getSavedApiUrl() || (isProxyDefaultEnabled() ? LOCAL_PROXY_BASE : getDefaultApiUrl());
}

export function setApiUrl(url: string) {
  const normalized = url.trim();
  if (!normalized) {
    clearApiUrl();
    return;
  }
  localStorage.setItem(getScopedStorageKey(API_URL_KEY_PREFIX), normalized);
}

export function clearApiUrl() {
  localStorage.removeItem(getScopedStorageKey(API_URL_KEY_PREFIX));
  localStorage.removeItem(LEGACY_API_URL_KEY);
}

export function getAuthToken(): string | null {
  return getStoredValue(AUTH_TOKEN_KEY_PREFIX, LEGACY_AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(getScopedStorageKey(AUTH_TOKEN_KEY_PREFIX), token);
}

export function clearAuthToken() {
  localStorage.removeItem(getScopedStorageKey(AUTH_TOKEN_KEY_PREFIX));
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl().replace(/\/$/, "");
  const url = `${base}${path}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let msg: string;
    try {
      const json = JSON.parse(body);
      msg = json.message || json.error || `HTTP ${res.status}`;
    } catch {
      msg = body || `HTTP ${res.status}`;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  let queryString = "";
  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
    if (entries.length) {
      queryString = "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    }
  }
  return request<T>(path + queryString);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
