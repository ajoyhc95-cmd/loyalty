import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { recordLedgerTransaction } from "@/lib/ledger";
import { parsePoints } from "@/lib/points";

const targetRoles: Record<string, string[]> = {
  admin: ["agent", "merchant", "customer"],
  customer: ["merchant", "agent"],
  merchant: ["customer"],
};

export async function POST(request: NextRequest) {
  const auth = requireUser(request, ["admin", "customer", "merchant"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const points = parsePoints(data.points);
  const recipient = typeof data.recipient === "string" ? data.recipient.trim() : "";
  if (!points || !recipient) return NextResponse.json({ error: "Enter a recipient and a positive amount (up to two decimal places)." }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const sourceType = auth.user!.role === "admin" ? "admin_primary" : auth.user!.role;
    const source = await client.query(
      "SELECT id FROM accounts WHERE owner_user_id = $1 AND account_type = $2",
      [auth.user!.id, sourceType],
    );
    if (!source.rowCount) throw new ApiError("Your points account is not available.", 404);

    const target = await client.query(
      `SELECT a.id AS "accountId", a.account_type AS "accountType", u.id AS "userId", u.user_id AS "targetUserId", u.name, u.role
       FROM accounts a JOIN users u ON u.id = a.owner_user_id
       WHERE u.status = 'active' AND (lower(u.user_id) = lower($1) OR lower(a.account_number) = lower($1))
       LIMIT 1`,
      [recipient],
    );
    if (!target.rowCount) throw new ApiError("No active account matches that ID or account number.", 404);
    if (target.rows[0].userId === auth.user!.id) throw new ApiError("You cannot transfer points to yourself.", 400);
    const allowed = targetRoles[auth.user!.role] ?? [];
    if (!allowed.includes(target.rows[0].role)) throw new ApiError("Transfers to that account type are not allowed.", 403);

    const txn = await recordLedgerTransaction(client, {
      category: auth.user!.role === "merchant" ? "merchant_discount" : auth.user!.role === "admin" ? "admin_distribution" : "customer_transfer",
      points,
      createdBy: auth.user!.id,
      description: `Points transferred to ${target.rows[0].name} (${target.rows[0].targetUserId})`,
      entries: [
        { accountId: source.rows[0].id, delta: -points },
        { accountId: target.rows[0].accountId, delta: points },
      ],
      validateBalances: auth.user!.role === "admin"
        ? async (balancesAfter) => {
            const reserved = await client.query("SELECT COALESCE(SUM(points), 0) AS points FROM coupons WHERE status = 'available'");
            if ((balancesAfter.get(source.rows[0].id) ?? 0) < Number(reserved.rows[0].points)) {
              throw new ApiError("That transfer would use points reserved for unredeemed product coupons.", 409);
            }
          }
        : undefined,
    });
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, transactionCode: txn.transactionCode });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error, "Could not complete the transfer.");
  } finally {
    client.release();
  }
}
