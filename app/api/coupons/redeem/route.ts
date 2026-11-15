import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { recordLedgerTransaction } from "@/lib/ledger";

export async function POST(request: NextRequest) {
  const auth = requireUser(request, ["agent"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  const code = body && typeof body === "object" && typeof (body as Record<string, unknown>).code === "string"
    ? ((body as Record<string, unknown>).code as string).trim().toUpperCase()
    : "";
  if (!code) return NextResponse.json({ error: "Scan or enter a product coupon code." }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const coupon = await client.query("SELECT id, code, points, status FROM coupons WHERE code = $1 FOR UPDATE", [code]);
    if (!coupon.rowCount || coupon.rows[0].status !== "available") throw new ApiError("Coupon is invalid or has already been redeemed.", 409);
    const [primary, agent] = await Promise.all([
      client.query("SELECT id FROM accounts WHERE account_type = 'admin_primary' AND owner_user_id IS NOT NULL LIMIT 1"),
      client.query("SELECT id FROM accounts WHERE owner_user_id = $1 AND account_type = 'agent'", [auth.user!.id]),
    ]);
    if (!primary.rowCount || !agent.rowCount) throw new Error("Required points accounts are missing.");
    const points = Number(coupon.rows[0].points);
    const txn = await recordLedgerTransaction(client, {
      category: "coupon_redemption",
      points,
      createdBy: auth.user!.id,
      description: `Coupon ${coupon.rows[0].code} redeemed`,
      entries: [
        { accountId: primary.rows[0].id, delta: -points },
        { accountId: agent.rows[0].id, delta: points },
      ],
    });
    await client.query("UPDATE coupons SET status = 'redeemed', redeemed_by = $1, redeemed_at = NOW() WHERE id = $2", [auth.user!.id, coupon.rows[0].id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, points, transactionCode: txn.transactionCode });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error, "Could not redeem coupon.");
  } finally {
    client.release();
  }
}
