import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { parsePoints } from "@/lib/points";

export async function POST(request: NextRequest) {
  const auth = requireUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const points = parsePoints(data.points);
  const quantity = Number(data.quantity ?? 1);
  if (!points || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return NextResponse.json({ error: "Enter valid points and a quantity from 1 to 50." }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const primary = await client.query(
      "SELECT balance FROM accounts WHERE owner_user_id = $1 AND account_type = 'admin_primary' FOR UPDATE",
      [auth.user!.id],
    );
    if (!primary.rowCount) throw new Error("Admin Primary Account is missing.");
    const outstanding = await client.query("SELECT COALESCE(SUM(points), 0) AS points FROM coupons WHERE status = 'available'");
    const newReserve = points * quantity;
    if (Number(primary.rows[0].balance) - Number(outstanding.rows[0].points) < newReserve) {
      throw new ApiError("Primary Account does not have enough unreserved points for these coupons.", 409);
    }
    const codes: Array<{ code: string; points: number }> = [];
    for (let index = 0; index < quantity; index++) {
      const code = `CP-${randomBytes(12).toString("hex").toUpperCase()}`;
      await client.query("INSERT INTO coupons (code, points, created_by) VALUES ($1, $2, $3)", [code, points, auth.user!.id]);
      codes.push({ code, points });
    }
    await client.query("COMMIT");
    return NextResponse.json({ coupons: codes }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error, "Could not create coupons.");
  } finally {
    client.release();
  }
}
