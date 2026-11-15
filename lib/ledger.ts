import type { PoolClient } from "pg";
import { ApiError } from "@/lib/api";
import { newTransactionCode } from "@/lib/points";

type Entry = { accountId: string; delta: number };

export async function recordLedgerTransaction(
  client: PoolClient,
  input: {
    category: string;
    points: number;
    createdBy: string;
    description: string;
    entries: Entry[];
    allowExternalIssuance?: boolean;
    validateBalances?: (balancesAfter: ReadonlyMap<string, number>) => Promise<void>;
  },
) {
  const grouped = new Map<string, number>();
  for (const entry of input.entries) grouped.set(entry.accountId, (grouped.get(entry.accountId) ?? 0) + entry.delta);
  const deltas = [...grouped.entries()]
    .map(([accountId, delta]) => ({ accountId, delta: Number(delta.toFixed(2)) }))
    .filter((entry) => entry.delta !== 0);

  if (!deltas.length) throw new Error("A transaction must change at least one account.");
  const sum = Number(deltas.reduce((total, entry) => total + entry.delta, 0).toFixed(2));
  if (!input.allowExternalIssuance && sum !== 0) throw new Error("Internal point transactions must balance.");
  if (input.allowExternalIssuance && (deltas.length !== 1 || deltas[0].delta < 0)) {
    throw new Error("External issuance must credit a single account.");
  }

  const ids = deltas.map((entry) => entry.accountId).sort();
  const locked = await client.query(
    "SELECT id, balance FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [ids],
  );
  if (locked.rowCount !== ids.length) throw new Error("One or more accounts no longer exist.");

  const balances = new Map<string, number>();
  for (const row of locked.rows) balances.set(row.id, Number(row.balance));
  for (const entry of deltas) {
    const updated = Number(((balances.get(entry.accountId) ?? 0) + entry.delta).toFixed(2));
    if (updated < 0) throw new ApiError("Insufficient points balance.", 409);
    balances.set(entry.accountId, updated);
  }
  await input.validateBalances?.(balances);

  const transaction = await client.query(
    `INSERT INTO point_transactions (transaction_code, category, points, created_by, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, transaction_code, created_at`,
    [newTransactionCode(), input.category, input.points, input.createdBy, input.description],
  );
  const result = transaction.rows[0];
  for (const entry of deltas) {
    await client.query(
      `UPDATE accounts SET balance = $1 WHERE id = $2`,
      [balances.get(entry.accountId), entry.accountId],
    );
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, points_delta, balance_after)
       VALUES ($1, $2, $3, $4)`,
      [result.id, entry.accountId, entry.delta, balances.get(entry.accountId)],
    );
  }
  return { transactionCode: result.transaction_code as string, createdAt: result.created_at as Date };
}
