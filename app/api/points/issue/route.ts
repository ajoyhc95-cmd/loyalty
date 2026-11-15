import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { recordLedgerTransaction } from "@/lib/ledger";
import { parsePoints } from "@/lib/points";

export async function POST(request: NextRequest) {
  const auth = requireUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  const points = body && typeof body === "object" ? parsePoints((body as Record<string, unknown>).points) : null;
  if (!points) return NextResponse.json({ error: "Enter a positive amount with up to two decimal places." }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT id FROM accounts WHERE owner_user_id = $1 AND account_type = 'admin_primary' FOR UPDATE", [auth.user!.id]);
    if (!result.rowCount) throw new Error("Admin Primary Account is missing.");
    await recordLedgerTransaction(client, {
      category: "primary_issuance",
      points,
      createdBy: auth.user!.id,
      description: "Points issued to Admin Primary Account",
      entries: [{ accountId: result.rows[0].id, delta: points }],
      allowExternalIssuance: true,
    });
    await client.query(
      "UPDATE system_settings SET setting_value = setting_value + $1 WHERE setting_key = 'lifetime_primary_issuance'",
      [points],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, message: `${points.toFixed(2)} points issued to the Primary Account.` });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error, "Could not issue points.");
  } finally {
    client.release();
  }
}
