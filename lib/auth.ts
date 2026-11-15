import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type Role = "admin" | "agent" | "merchant" | "customer";
export type SessionUser = { id: string; email: string; name: string; role: Role; userId: string; generateIdCard?: boolean };

const cookieName = "loyalty_session";
const sessionDuration = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return value;
}

export function hashPassword(password: string) {
  const salt = createHmac("sha256", secret()).update(randomUUID()).digest("hex").slice(0, 32);
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== 64) return false;
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + sessionDuration })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseToken(token?: string | null): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number };
    if (data.exp <= Math.floor(Date.now() / 1000)) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      userId: data.userId,
      generateIdCard: data.generateIdCard,
    };
  } catch {
    return null;
  }
}

export function getRequestUser(request: NextRequest) {
  return parseToken(request.cookies.get(cookieName)?.value);
}

export function sessionCookie(token: string) {
  return {
    name: cookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionDuration,
  };
}

export function clearSessionCookie() {
  return { ...sessionCookie(""), maxAge: 0 };
}

export function isRole(role: string): role is Role {
  return ["admin", "agent", "merchant", "customer"].includes(role);
}
