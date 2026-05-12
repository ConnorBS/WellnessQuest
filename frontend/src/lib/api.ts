"use client";

import { z, ZodSchema } from "zod";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth";
import { TokenPairSchema } from "@/lib/schemas";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API error ${status}`);
  }
}

type FetchOpts = RequestInit & { skipAuth?: boolean };

async function refreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const r = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!r.ok) {
    clearTokens();
    return false;
  }
  const parsed = TokenPairSchema.safeParse(await r.json());
  if (!parsed.success) {
    clearTokens();
    return false;
  }
  setTokens(parsed.data);
  return true;
}

async function rawFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
  const headers = new Headers(opts.headers ?? {});
  if (!(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!opts.skipAuth) {
    const access = getAccessToken();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

export async function apiFetch<T>(
  path: string,
  schema: ZodSchema<T>,
  opts: FetchOpts = {},
): Promise<T> {
  let resp = await rawFetch(path, opts);
  if (resp.status === 401 && !opts.skipAuth) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      resp = await rawFetch(path, opts);
    }
  }
  if (!resp.ok && resp.status !== 202) {
    let body: unknown = null;
    try {
      body = await resp.json();
    } catch {
      body = await resp.text();
    }
    throw new ApiError(resp.status, body);
  }
  const data = await resp.json();
  return schema.parse(data);
}

export async function apiPost<T>(
  path: string,
  schema: ZodSchema<T>,
  body: unknown,
): Promise<T> {
  return apiFetch(path, schema, { method: "POST", body: JSON.stringify(body) });
}

export async function apiPatch<T>(
  path: string,
  schema: ZodSchema<T>,
  body: unknown,
): Promise<T> {
  return apiFetch(path, schema, { method: "PATCH", body: JSON.stringify(body) });
}

export async function apiUpload<T>(
  path: string,
  schema: ZodSchema<T>,
  file: File,
): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch(path, schema, { method: "POST", body: fd });
}

export async function apiDelete(path: string): Promise<void> {
  const resp = await rawFetch(path, { method: "DELETE" });
  if (!resp.ok && resp.status !== 204) throw new ApiError(resp.status, await resp.text());
}

export async function apiPostVoid(path: string, body: unknown): Promise<void> {
  let resp = await rawFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (resp.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) resp = await rawFetch(path, { method: "POST", body: JSON.stringify(body) });
  }
  if (!resp.ok && resp.status !== 204) {
    let body: unknown = null;
    try {
      body = await resp.json();
    } catch {
      body = await resp.text();
    }
    throw new ApiError(resp.status, body);
  }
}

export { API_BASE };
export const _z = z;
