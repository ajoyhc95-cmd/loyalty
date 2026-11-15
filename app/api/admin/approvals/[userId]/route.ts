import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, requireUser } from "@/lib/api";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = requireUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const { userId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const decision = body && typeof body === "object" ? (body as Record<string, unknown>).decision : null;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query(
      "SELECT id, role, name, shop_name, address FROM users WHERE id = $1 AND status = 'pending' FOR UPDATE",
      [userId],
    );
    if (!pending.rowCount) throw new ApiError("This signup request is no longer pending.", 409);
    const user = pending.rows[0];
    if (decision === "reject") {
      await client.query("UPDATE users SET status = 'rejected' WHERE id = $1", [user.id]);
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    const prefix = user.role === "merchant" ? "MER" : user.role === "agent" ? "AGT" : "CUS";
    const assignedUserId = `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const accountNumber = `LA-${randomUUID().slice(0, 10).toUpperCase()}`;
    await client.query("UPDATE users SET status = 'active', user_id = $1 WHERE id = $2", [assignedUserId, user.id]);
    await client.query(
      "INSERT INTO accounts (owner_user_id, account_type, account_number) VALUES ($1, $2, $3)",
      [user.id, user.role, accountNumber],
    );
    if (user.role === "merchant") {
      await client.query(
        "INSERT INTO shops (shop_name, owner_user_id, address) VALUES ($1, $2, $3)",
        [user.shop_name || `${user.name}'s shop`, user.id, user.address],
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, status: "active", userId: assignedUserId, accountNumber });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error, "Could not update the signup request.");
  } finally {
    client.release();
  }
}
