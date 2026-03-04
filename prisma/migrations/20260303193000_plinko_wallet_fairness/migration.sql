-- AlterTable
ALTER TABLE "User"
ADD COLUMN "balance" DECIMAL(12,2) NOT NULL DEFAULT 1000.00;

-- CreateTable
CREATE TABLE "PlinkoProvablyFair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlinkoProvablyFair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlinkoRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "bet" DECIMAL(12,2) NOT NULL,
    "multiplier" DECIMAL(12,2) NOT NULL,
    "payout" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "resultIndex" INTEGER NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlinkoRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlinkoProvablyFair_userId_key" ON "PlinkoProvablyFair"("userId");

-- CreateIndex
CREATE INDEX "PlinkoRound_userId_createdAt_idx" ON "PlinkoRound"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PlinkoProvablyFair" ADD CONSTRAINT "PlinkoProvablyFair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlinkoRound" ADD CONSTRAINT "PlinkoRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

