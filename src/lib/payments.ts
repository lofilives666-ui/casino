export const PAYMENT_LIMITS = {
  minDeposit: 10,
  maxDeposit: 5000,
  minWithdraw: 20,
  maxWithdraw: 2000,
  dailyWithdrawLimit: 5000,
} as const;

export function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export function parseAmount(input: unknown) {
  const amount = Number(input);
  if (!Number.isFinite(amount)) return null;
  return toMoney(amount);
}

