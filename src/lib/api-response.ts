import { NextResponse } from "next/server";

/**
 * Success envelope for /api/v1 GET endpoints. Sets the short-TTL,
 * stale-while-revalidate Cache-Control described in docs/architecture.md §8 —
 * pass `cache: false` for responses that must never be cached (e.g. anything
 * that reflects the current user's identity).
 */
export function jsonOk<T>(data: T, init?: { status?: number; cache?: boolean }) {
  const response = NextResponse.json(data, { status: init?.status ?? 200 });
  if (init?.cache !== false) {
    response.headers.set("Cache-Control", "public, max-age=20, stale-while-revalidate=40");
  } else {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  internal_error: 500,
};

/** Uniform error shape for every /api/v1 and /internal/v1 endpoint (docs/api.md). */
export function jsonError(code: ApiErrorCode, message: string) {
  const response = NextResponse.json({ error: { code, message } }, { status: STATUS_BY_CODE[code] });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
