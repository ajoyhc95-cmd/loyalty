import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser, type Role } from "@/lib/auth";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) return jsonError(error.message, error.status);
  console.error(fallback, error);
  return jsonError(fallback, 500);
}

export function requireUser(request: NextRequest, roles?: Role[]) {
  const user = getRequestUser(request);
  if (!user) return { user: null, response: jsonError("Please sign in to continue.", 401) };
  if (roles && !roles.includes(user.role)) return { user: null, response: jsonError("You do not have permission to perform this action.", 403) };
  return { user, response: null };
}

