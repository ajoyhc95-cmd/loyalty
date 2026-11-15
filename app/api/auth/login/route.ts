import { NextRequest, NextResponse } from "next/server";
import { createSession, isRole, sessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Enter your user ID or email and password.");
  const { identifier, password } = body as { identifier?: unknown; password?: unknown };
  if (
    typeof identifier !== "string" || typeof password !== "string" ||
    !identifier.trim() || identifier.length > 255 || !password || password.length > 256
  ) {
    return jsonError("Enter your user ID or email and password.");
  }

  try {
    const result = await db.query(
      `SELECT id, name, email, user_id, role, status, password_hash, generate_id_card
       FROM users WHERE lower(email) = lower($1) OR lower(user_id) = lower($1) LIMIT 1`,
      [identifier.trim()],
    );
    const user = result.rows[0];
    if (!user || user.status !== "active" || !user.password_hash || !isRole(user.role) || !verifyPassword(password, user.password_hash)) {
      return jsonError("Invalid sign-in details, or the account is not yet approved.", 401);
    }

    const token = createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      userId: user.user_id,
      generateIdCard: user.generate_id_card,
    });
    const response = NextResponse.json({ user: { name: user.name, role: user.role, userId: user.user_id } });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return jsonError("Sign-in is temporarily unavailable. Please try again.", 500);
  }
}
