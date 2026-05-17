"use client";

import { TokenPair } from "@/lib/schemas";

const ACCESS_KEY = "wq.access";
const REFRESH_KEY = "wq.refresh";

export function setTokens(tokens: TokenPair, persistent: boolean = true): void {
  if (typeof window === "undefined") return;
  const target = persistent ? window.localStorage : window.sessionStorage;
  const other = persistent ? window.sessionStorage : window.localStorage;
  target.setItem(ACCESS_KEY, tokens.access_token);
  target.setItem(REFRESH_KEY, tokens.refresh_token);
  other.removeItem(ACCESS_KEY);
  other.removeItem(REFRESH_KEY);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.sessionStorage.removeItem(ACCESS_KEY);
  window.sessionStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem(ACCESS_KEY) ??
    window.localStorage.getItem(ACCESS_KEY)
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem(REFRESH_KEY) ??
    window.localStorage.getItem(REFRESH_KEY)
  );
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

export function isPersistent(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REFRESH_KEY) !== null;
}
