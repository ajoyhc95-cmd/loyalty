import { randomUUID } from "node:crypto";

export function parsePoints(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return null;
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-8) return null;
  return amount;
}

export function splitPoints(total: number, percentages: number[]) {
  const amounts: number[] = [];
  let assigned = 0;
  percentages.forEach((percentage, index) => {
    const amount = index === percentages.length - 1
      ? Number((total - assigned).toFixed(2))
      : Number(((total * percentage) / 100).toFixed(2));
    amounts.push(amount);
    assigned += amount;
  });
  return amounts;
}

export function newTransactionCode() {
  return `TX-${randomUUID()}`;
}

