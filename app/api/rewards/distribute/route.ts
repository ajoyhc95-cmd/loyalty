import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { recordLedgerTransaction } from "@/lib/ledger";
import { parsePoints, splitPoints } from "@/lib/points";

export async function POST(request: NextRequest) {
  const auth = requireUser(request, ["agent"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const points = parsePoints(data.points);
  const recipient = typeof data.recipient === "string" ? data.recipient.trim() : "";
  const answers = data.answers;
  if (!points || !recipient || !Array.isArray(answers) || answers.length !== 4 || answers.some((answer) => typeof answer !== "object" || answer === null)) {
    return NextResponse.json({ error: "Provide a recipient, points, and answers to all four questions." }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const questions = await client.query<{ id: string; correct_answer: string; answers: string[] }>(
      "SELECT id, correct_answer, answers FROM questions WHERE active = TRUE ORDER BY id LIMIT 4",
    );
    if (questions.rowCount !== 4) throw new ApiError("The quiz must have exactly four active questions configured.", 503);
    const submitted = new Map<string, string>(
      (answers as Array<{ questionId?: unknown; answer?: unknown }>).map((answer) => [String(answer.questionId), String(answer.answer)] as const),
    );
    if (new Set(submitted.keys()).size !== 4 || questions.rows.some((question) => !submitted.has(question.id))) {
      throw new ApiError("Answer each current quiz question exactly once.", 400);
    }
    if (questions.rows.some((question) => !question.answers.includes(submitted.get(question.id) ?? ""))) {
      throw new ApiError("Choose one of the listed answers for every question.", 400);
    }
    const correct = questions.rows.filter((question) => submitted.get(question.id) === question.correct_answer).length;
    const score = correct * 25;
    const plan = await client.query(
      `SELECT customer_percentage AS customer, admins_commission_percentage AS admin, agents_commission_percentage AS agent
       FROM plans WHERE correct_answers_percentage = $1`,
      [score],
    );
    if (!plan.rowCount) throw new ApiError(`No point plan is configured for a ${score}% score.`, 503);

    const customer = await client.query(
      `SELECT a.id AS "accountId", u.id AS "userId"
       FROM users u JOIN accounts a ON a.owner_user_id = u.id AND a.account_type = 'customer'
       WHERE u.status = 'active' AND (lower(u.user_id) = lower($1) OR lower(a.account_number) = lower($1))
       LIMIT 1`,
      [recipient],
    );
    const [agent, secondary] = await Promise.all([
      client.query("SELECT id FROM accounts WHERE owner_user_id = $1 AND account_type = 'agent'", [auth.user!.id]),
      client.query("SELECT id FROM accounts WHERE account_type = 'admin_secondary' AND owner_user_id IS NOT NULL LIMIT 1"),
    ]);
    if (!customer.rowCount) throw new ApiError("No active customer matches that ID or account number.", 404);
    if (!agent.rowCount || !secondary.rowCount) throw new Error("Required points accounts are missing.");

    const percentages = plan.rows[0];
    const [customerShare, adminShare, agentShare] = splitPoints(points, [
      Number(percentages.customer),
      Number(percentages.admin),
      Number(percentages.agent),
    ]);
    const txn = await recordLedgerTransaction(client, {
      category: "agent_reward_distribution",
      points,
      createdBy: auth.user!.id,
      description: `${points.toFixed(2)} points · ${score}% quiz · customer ${customerShare} · admin ${adminShare} · agent ${agentShare} · ${recipient}`,
      entries: [
        { accountId: agent.rows[0].id, delta: -points },
        { accountId: customer.rows[0].accountId, delta: customerShare },
        { accountId: secondary.rows[0].id, delta: adminShare },
        { accountId: agent.rows[0].id, delta: agentShare },
      ],
    });
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, score, customerShare, adminShare, agentShare, transactionCode: txn.transactionCode });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error, "Could not distribute reward points.");
  } finally {
    client.release();
  }
}
