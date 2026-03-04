import crypto from "node:crypto";

export type PlinkoRisk = "low" | "medium" | "high";

export const PLINKO_MIN_ROWS = 8;
export const PLINKO_MAX_ROWS = 16;
const TARGET_RTP = 0.96;

const MEDIUM_BASE_PACK: Record<number, number[]> = {
  8: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
  9: [18, 4.0, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4.0, 18],
  10: [22, 5.0, 2.0, 1.4, 0.6, 0.4, 0.6, 1.4, 2.0, 5.0, 22],
  11: [24, 6.0, 3.0, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3.0, 6.0, 24],
  12: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
  13: [43, 13, 6.0, 3.0, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3.0, 6.0, 13, 43],
  14: [58, 15, 7.0, 4.0, 1.9, 1.0, 0.5, 0.2, 0.5, 1.0, 1.9, 4.0, 7.0, 15, 58],
  15: [88, 18, 11, 5.0, 3.0, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3.0, 5.0, 11, 18, 88],
  16: [110, 41, 10, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10, 41, 110],
};

const RISK_MULTIPLIER: Record<PlinkoRisk, number> = {
  low: 0.58,
  medium: 1,
  high: 1.7,
};

function clampRows(rows: number) {
  if (!Number.isFinite(rows)) return PLINKO_MIN_ROWS;
  return Math.max(PLINKO_MIN_ROWS, Math.min(PLINKO_MAX_ROWS, Math.round(rows)));
}

function toDisplayMultiplier(value: number) {
  if (value >= 10) return Math.round(value);
  if (value >= 1) return Number(value.toFixed(1));
  return Number(value.toFixed(2));
}

function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

function nCr(n: number, r: number) {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function buildBinomialProbabilities(rows: number) {
  const n = rows;
  const denom = 2 ** n;
  return Array.from({ length: n + 1 }, (_, k) => nCr(n, k) / denom);
}

function expectedValue(multipliers: number[], probabilities: number[]) {
  return multipliers.reduce((sum, value, index) => sum + value * probabilities[index], 0);
}

function buildRiskPack(rows: number, risk: PlinkoRisk) {
  const safeRows = clampRows(rows);
  const base = MEDIUM_BASE_PACK[safeRows];
  const riskScale = RISK_MULTIPLIER[risk];

  const transformed = base.map((value) => {
    const next = 1 + (value - 1) * riskScale;
    return Math.max(0.15, next);
  });

  const probabilities = buildBinomialProbabilities(safeRows);
  const ev = expectedValue(transformed, probabilities);
  const normalizeScale = TARGET_RTP / ev;

  const multipliers = transformed.map((value) => toDisplayMultiplier(Math.max(0.15, value * normalizeScale)));
  const finalRtp = expectedValue(multipliers, probabilities);

  return {
    rows: safeRows,
    risk,
    multipliers,
    probabilities,
    rtp: Number((finalRtp * 100).toFixed(2)),
  };
}

function pickWeightedIndex(probabilities: number[], draw: number) {
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index];
    if (draw <= cumulative) return index;
  }
  return probabilities.length - 1;
}

function randomFloatFromSeed(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const slice = hash.slice(0, 13); // 52-bit precision
  const int = Number.parseInt(slice, 16);
  return int / 0x1_0000_0000_0000;
}

export function getPlinkoConfig(rows: number, risk: PlinkoRisk) {
  return buildRiskPack(rows, risk);
}

export function createPlinkoDrop(input: { rows: number; risk: PlinkoRisk; bet: number }) {
  const { rows, risk, bet } = input;
  const config = buildRiskPack(rows, risk);
  const index = pickWeightedIndex(config.probabilities, Math.random());
  const multiplier = config.multipliers[index];
  const payout = Number((bet * multiplier).toFixed(2));

  return {
    rows: config.rows,
    risk: config.risk,
    rtp: config.rtp,
    index,
    multiplier,
    payout,
    multipliers: config.multipliers,
  };
}

export function createDeterministicPlinkoDrop(input: {
  rows: number;
  risk: PlinkoRisk;
  bet: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}) {
  const { rows, risk, bet, serverSeed, clientSeed, nonce } = input;
  const config = buildRiskPack(rows, risk);
  const draw = randomFloatFromSeed(`${serverSeed}:${clientSeed}:${nonce}`);
  const index = pickWeightedIndex(config.probabilities, draw);
  const multiplier = config.multipliers[index];
  const payout = Number((bet * multiplier).toFixed(2));

  return {
    rows: config.rows,
    risk: config.risk,
    rtp: config.rtp,
    index,
    multiplier,
    payout,
    multipliers: config.multipliers,
    draw,
  };
}
