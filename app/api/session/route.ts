import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user!;
  try {
    const [profile, accounts, recent, people, pending, settings, plans, questions] = await Promise.all([
      db.query(
        `SELECT u.photo_url AS "photoDataUrl", s.shop_name AS "shopName", s.address AS "shopAddress"
         FROM users u LEFT JOIN shops s ON s.owner_user_id = u.id
         WHERE u.id = $1 AND u.status = 'active'`,
        [user.id],
      ),
      db.query(
        `SELECT id, account_type AS "accountType", account_number AS "accountNumber", balance
         FROM accounts WHERE owner_user_id = $1 OR ($2 = 'admin' AND owner_user_id IS NULL)
         ORDER BY account_type`,
        [user.id, user.role],
      ),
      db.query(
        `SELECT t.transaction_code AS "transactionCode", t.category, t.points, t.description, t.created_at AS "createdAt",
                e.points_delta AS "pointsDelta", e.balance_after AS "balanceAfter"
         FROM ledger_entries e JOIN point_transactions t ON t.id = e.transaction_id
         JOIN accounts a ON a.id = e.account_id
         WHERE a.owner_user_id = $1 OR ($2 = 'admin' AND a.owner_user_id IS NULL)
         ORDER BY t.created_at DESC LIMIT 12`,
        [user.id, user.role],
      ),
      db.query(
        `SELECT u.name, u.user_id AS "userId", u.role, u.shop_name AS "shopName", a.account_number AS "accountNumber"
         FROM users u LEFT JOIN accounts a ON a.owner_user_id = u.id
         WHERE u.status = 'active' AND u.role <> 'admin' ORDER BY u.name LIMIT 100`,
      ),
      user.role === "admin"
        ? db.query(`SELECT id, name, email, role, mobile, address, date_of_birth AS "dateOfBirth",
                           exam_number AS "examNumber", marks, approval_number AS "approvalNumber",
                           shop_name AS "shopName", created_at AS "createdAt"
                    FROM users WHERE status = 'pending' ORDER BY created_at`)
        : Promise.resolve({ rows: [] }),
      user.role === "admin"
        ? db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'lifetime_primary_issuance'")
        : Promise.resolve({ rows: [] }),
      db.query("SELECT correct_answers_percentage AS score, customer_percentage AS customer, admins_commission_percentage AS admin, agents_commission_percentage AS agent FROM plans ORDER BY correct_answers_percentage"),
      user.role === "agent" ? db.query("SELECT id, question, answers FROM questions WHERE active = TRUE ORDER BY id LIMIT 4") : Promise.resolve({ rows: [] }),
    ]);

    let primaryTotal = 0;
    let otherTotal = 0;
    if (user.role === "admin") {
      const sums = await db.query(
        `SELECT
          COALESCE(SUM(balance) FILTER (WHERE account_type = 'admin_primary'), 0) AS primary_balance,
          COALESCE(SUM(balance) FILTER (WHERE account_type <> 'admin_primary'), 0) AS other_balance
         FROM accounts`,
      );
      primaryTotal = Number(settings.rows[0]?.setting_value ?? 0);
      otherTotal = Number(sums.rows[0]?.other_balance ?? 0);
      return NextResponse.json({
        user: { ...user, ...profile.rows[0] },
        accounts: accounts.rows,
        recent: recent.rows,
        people: people.rows,
        pending: pending.rows,
        plans: plans.rows,
        primaryBalance: Number(sums.rows[0]?.primary_balance ?? 0),
        issuanceAlert: primaryTotal > otherTotal,
        lifetimeIssued: primaryTotal,
        otherBalances: otherTotal,
      });
    }
    return NextResponse.json({
      user: { ...user, ...profile.rows[0] },
      accounts: accounts.rows,
      recent: recent.rows,
      people: people.rows,
      plans: plans.rows,
      questions: questions.rows,
    });
  } catch (error) {
    console.error("Dashboard data load failed:", error);
    return NextResponse.json({ error: "Could not load your account data." }, { status: 500 });
  }
}
