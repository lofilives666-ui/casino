import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createDeterministicPlinkoDrop, getPlinkoConfig, type PlinkoRisk } from "@/lib/plinko";

export type PlinkoDropPayload = {
  rows?: number;
  risk?: PlinkoRisk;
  bet?: number;
};

function parseRisk(value: unknown): PlinkoRisk {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function createServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function getThunderPlinkoConfig(input: { rows: number; risk: unknown }) {
  const rows = Number.parseInt(String(input.rows), 10);
  const risk = parseRisk(input.risk);
  return getPlinkoConfig(rows, risk);
}

export async function getThunderPlinkoState(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, balance: true },
    });
    if (!user) throw new Error("User not found.");

    let fair = await tx.plinkoProvablyFair.findUnique({
      where: { userId: user.id },
      select: { clientSeed: true, serverSeedHash: true, nonce: true },
    });

    if (!fair) {
      const serverSeed = createServerSeed();
      fair = await tx.plinkoProvablyFair.create({
        data: {
          userId: user.id,
          serverSeed,
          serverSeedHash: hashSeed(serverSeed),
          clientSeed: user.email,
        },
        select: { clientSeed: true, serverSeedHash: true, nonce: true },
      });
    }

    return {
      balance: Number(user.balance),
      fairness: fair,
    };
  });
}

export async function getThunderPlinkoHistory(userId: string) {
  const rounds = await prisma.plinkoRound.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      risk: true,
      rows: true,
      bet: true,
      multiplier: true,
      payout: true,
      balanceBefore: true,
      balanceAfter: true,
      resultIndex: true,
      nonce: true,
      serverSeedHash: true,
      clientSeed: true,
      createdAt: true,
    },
  });

  return {
    rounds: rounds.map((item) => ({
      ...item,
      bet: Number(item.bet),
      multiplier: Number(item.multiplier),
      payout: Number(item.payout),
      balanceBefore: Number(item.balanceBefore),
      balanceAfter: Number(item.balanceAfter),
    })),
  };
}

export async function playThunderPlinko(userId: string, payload: PlinkoDropPayload) {
  const bet = Number(payload.bet ?? 0);
  const risk = parseRisk(payload.risk);
  const rows = Number(payload.rows ?? 10);

  if (!Number.isFinite(bet) || bet <= 0) {
    throw new Error("INVALID_BET");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, balance: true, email: true },
    });
    if (!user) throw new Error("User not found.");

    const balanceBefore = Number(user.balance);
    if (balanceBefore < bet) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    let fair = await tx.plinkoProvablyFair.findUnique({
      where: { userId: user.id },
    });

    if (!fair) {
      const serverSeed = createServerSeed();
      fair = await tx.plinkoProvablyFair.create({
        data: {
          userId: user.id,
          serverSeed,
          serverSeedHash: hashSeed(serverSeed),
          clientSeed: user.email,
          nonce: 0,
        },
      });
    }

    const result = createDeterministicPlinkoDrop({
      rows,
      risk,
      bet,
      serverSeed: fair.serverSeed,
      clientSeed: fair.clientSeed,
      nonce: fair.nonce,
    });

    const payout = toMoney(result.payout);
    const balanceAfter = toMoney(balanceBefore - bet + payout);

    await tx.user.update({
      where: { id: user.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedger.createMany({
      data: [
        {
          userId: user.id,
          type: "DEBIT",
          amount: toMoney(bet),
          reason: "PLINKO_BET",
        },
        {
          userId: user.id,
          type: "CREDIT",
          amount: payout,
          reason: "PLINKO_PAYOUT",
        },
      ],
    });

    await tx.walletTransaction.create({
      data: {
        userId: user.id,
        kind: "GAME_ROUND",
        amount: payout,
        status: "COMPLETED",
        provider: "THUNDER_PLINKO",
        providerRef: fair.serverSeedHash,
      },
    });

    await tx.plinkoRound.create({
      data: {
        userId: user.id,
        risk: result.risk,
        rows: result.rows,
        bet: toMoney(bet),
        multiplier: toMoney(result.multiplier),
        payout,
        balanceBefore: toMoney(balanceBefore),
        balanceAfter,
        resultIndex: result.index,
        nonce: fair.nonce,
        serverSeedHash: fair.serverSeedHash,
        clientSeed: fair.clientSeed,
      },
    });

    const updatedFair = await tx.plinkoProvablyFair.update({
      where: { userId: user.id },
      data: { nonce: { increment: 1 } },
      select: {
        nonce: true,
        clientSeed: true,
        serverSeedHash: true,
      },
    });

    return {
      ...result,
      payout,
      balanceBefore: toMoney(balanceBefore),
      balanceAfter,
      fairness: {
        clientSeed: updatedFair.clientSeed,
        serverSeedHash: updatedFair.serverSeedHash,
        nonce: fair.nonce,
        nextNonce: updatedFair.nonce,
      },
    };
  });
}

