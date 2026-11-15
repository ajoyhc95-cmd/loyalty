import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { db } from "@/lib/db";

const expectedScores = [0, 25, 50, 75, 100];

export async function PUT(request: NextRequest) {
  const auth = requireUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  const rows = body && typeof body === "object" ? (body as Record<string, unknown>).plans : null;
  if (!Array.isArray(rows) || rows.length !== expectedScores.length) {
    return NextResponse.json({ error: "Provide all five score plans." }, { status: 400 });
  }

  const validated: Array<{ score: number; customer: number; admin: number; agent: number }> = [];
  for (const [index, raw] of rows.entries()) {
    if (typeof raw !== "object" || raw === null) return NextResponse.json({ error: "Invalid plan data." }, { status: 400 });
    const row = raw as Record<string, unknown>;
    const score = Number(row.score);
    const customer = Number(row.customer);
    const admin = Number(row.admin);
    const agent = Number(row.agent);
    if (
      score !== expectedScores[index] ||
      [customer, admin, agent].some((value) => !Number.isFinite(value) || value < 0 || value > 100) ||
      Math.round((customer + admin + agent) * 100) !== 10_000 ||
      customer + admin === 0
    ) return NextResponse.json({ error: "Each plan must use the listed score and shares totaling exactly 100%." }, { status: 400 });
    validated.push({ score, customer, admin, agent });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const plan of validated) {
      const result = await client.query(
        `UPDATE plans SET customer_percentage = $1, admins_commission_percentage = $2, agents_commission_percentage = $3
         WHERE correct_answers_percentage = $4`,
        [plan.customer, plan.admin, plan.agent, plan.score],
      );
      if (result.rowCount !== 1) throw new Error(`Missing plan for ${plan.score}% correct answers.`);
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Plan update failed:", error);
    return NextResponse.json({ error: "Could not save point plans." }, { status: 500 });
  } finally {
    client.release();
  }
}
