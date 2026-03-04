"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Peg = { x: number; y: number };
type PlinkoRisk = "low" | "medium" | "high";
type AutoSpeed = "slow" | "normal" | "fast" | "turbo";
type HitAnimation = { index: number; startedAt: number } | null;
type HistoryItem = {
  value: number;
  fillTop: string;
  fillBottom: string;
  text: string;
  border: string;
};
type FairnessState = {
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
};

type DropResult = {
  index: number;
  multiplier: number;
  payout: number;
  multipliers: number[];
  rtp: number;
  balanceBefore: number;
  balanceAfter: number;
  fairness: {
    clientSeed: string;
    serverSeedHash: string;
    nonce: number;
    nextNonce: number;
  };
};

type AnimatedBall = {
  active: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startedAt: number;
  durationMs: number;
  outcome: DropResult;
};

const WIDTH = 900;
const HEIGHT = 540;
const BALL_RADIUS = 7;
const PEG_RADIUS = 5;
const BIN_GAP = 4;
const BIN_HEIGHT = 30;
const BIN_BOTTOM_PADDING = 6;
const ROW_MIN = 8;
const ROW_MAX = 16;
const AUTO_SPEED_MS: Record<AutoSpeed, number> = {
  slow: 500,
  normal: 220,
  fast: 120,
  turbo: 60,
};
const GAME_ID = "thunder-plinko";

function formatMultiplier(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

function getBinLayout(totalBins: number, pegs: Peg[]) {
  const bottomY = Math.max(...pegs.map((peg) => peg.y));
  const bottomRow = pegs.filter((peg) => Math.abs(peg.y - bottomY) < 0.01).map((peg) => peg.x).sort((a, b) => a - b);
  const left = bottomRow[0];
  const right = bottomRow[bottomRow.length - 1];
  const available = right - left - BIN_GAP * (totalBins - 1);
  const binWidth = available / totalBins;
  const y = Math.min(HEIGHT - BIN_HEIGHT - BIN_BOTTOM_PADDING, bottomY + 32);
  return { binWidth, y, left };
}

function getBinPalette(index: number, total: number) {
  const isHot = index === 0 || index === total - 1;
  return {
    fillTop: isHot ? "#84dd1f" : "#36b41e",
    fillBottom: isHot ? "#58ca16" : "#1fa61a",
    border: "rgba(12, 35, 9, 0.55)",
    text: "#0a1b08",
  };
}

function buildFallbackMultipliers(rows: number) {
  return Array.from({ length: rows + 1 }, () => 1);
}

export default function ThunderPlinko() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballRef = useRef<AnimatedBall | null>(null);
  const frameRef = useRef<number | null>(null);
  const hitAnimationRef = useRef<HitAnimation>(null);

  const [bet, setBet] = useState(10);
  const [balance, setBalance] = useState(1250);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [difficulty, setDifficulty] = useState<PlinkoRisk>("medium");
  const [rows, setRows] = useState(10);
  const [status, setStatus] = useState("Ready");
  const [lastWin, setLastWin] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isDropping, setIsDropping] = useState(false);
  const [autoGamesInput, setAutoGamesInput] = useState("0");
  const [autoInfinite, setAutoInfinite] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState<AutoSpeed>("fast");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [multipliers, setMultipliers] = useState<number[]>(buildFallbackMultipliers(10));
  const [rtp, setRtp] = useState(96);
  const [fairness, setFairness] = useState<FairnessState | null>(null);

  const pegs = useMemo(() => {
    const result: Peg[] = [];
    const topY = 56;
    const bottomY = HEIGHT - 110;
    const rowGap = Math.max(24, ((bottomY - topY) / Math.max(1, rows - 1)) * 0.84);
    const colGap = Math.max(18, Math.min(64, ((WIDTH - 180) / Math.max(1, rows + 1)) * 0.68));

    for (let row = 0; row < rows; row += 1) {
      const cols = row + 3;
      const y = topY + row * rowGap;
      const rowWidth = (cols - 1) * colGap;
      const startX = WIDTH / 2 - rowWidth / 2;

      for (let col = 0; col < cols; col += 1) {
        result.push({ x: startX + col * colGap, y });
      }
    }

    return result;
  }, [rows]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadConfig() {
      try {
        const response = await fetch(`/api/games/${GAME_ID}/config?rows=${rows}&risk=${difficulty}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load config");
        const data = (await response.json()) as { multipliers: number[]; rtp: number };
        setMultipliers(data.multipliers);
        setRtp(data.rtp);
      } catch {
        if (!controller.signal.aborted) {
          setMultipliers(buildFallbackMultipliers(rows));
          setStatus("Using fallback config.");
        }
      }
    }

    void loadConfig();
    return () => controller.abort();
  }, [rows, difficulty]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServerState() {
      try {
        const [stateResponse, historyResponse] = await Promise.all([
          fetch(`/api/games/${GAME_ID}/state`, { signal: controller.signal }),
          fetch(`/api/games/${GAME_ID}/history`, { signal: controller.signal }),
        ]);

        if (stateResponse.ok) {
          const stateData = (await stateResponse.json()) as {
            balance: number;
            fairness: FairnessState;
          };
          setBalance(stateData.balance);
          setFairness(stateData.fairness);
        }

        if (historyResponse.ok) {
          const historyData = (await historyResponse.json()) as {
            rounds: Array<{ multiplier: number; resultIndex: number; rows: number }>;
          };
          const mapped = historyData.rounds
            .slice()
            .reverse()
            .map((round) => {
              const palette = getBinPalette(round.resultIndex, round.rows + 1);
              return { value: round.multiplier, ...palette };
            });
          setHistory(mapped);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("Could not load server state.");
        }
      }
    }

    void loadServerState();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context = ctx;

    function drawBins(ctx2d: CanvasRenderingContext2D, nowMs: number) {
      if (multipliers.length === 0) return;
      const { binWidth, y: binY, left } = getBinLayout(multipliers.length, pegs);
      const currentHit = hitAnimationRef.current;

      for (let i = 0; i < multipliers.length; i += 1) {
        const x = left + i * (binWidth + BIN_GAP);
        const palette = getBinPalette(i, multipliers.length);
        const isHitBin = currentHit?.index === i;
        const elapsed = isHitBin ? nowMs - currentHit.startedAt : 0;
        const progress = isHitBin ? Math.min(1, elapsed / 260) : 1;
        const pop = isHitBin ? Math.sin(progress * Math.PI) * 0.24 : 0;
        const scaleY = 1 + pop;
        const scaleX = 1 + pop * 0.12;

        const rawBoxW = binWidth;
        const rawBoxH = BIN_HEIGHT;
        const boxW = rawBoxW * scaleX;
        const boxH = rawBoxH * scaleY;
        const boxX = x + (rawBoxW - boxW) / 2;
        const boxY = binY + (rawBoxH - boxH);

        const grad = ctx2d.createLinearGradient(x, binY, x, HEIGHT);
        grad.addColorStop(0, palette.fillTop);
        grad.addColorStop(1, palette.fillBottom);

        ctx2d.fillStyle = grad;
        ctx2d.fillRect(boxX, boxY, boxW, boxH);
        ctx2d.strokeStyle = palette.border;
        ctx2d.strokeRect(boxX, boxY, boxW, boxH);

        ctx2d.fillStyle = palette.text;
        const fontSize = Math.max(12, Math.min(24, binWidth * 0.36));
        ctx2d.font = `700 ${fontSize}px Rajdhani, sans-serif`;
        ctx2d.textAlign = "center";
        ctx2d.fillText(formatMultiplier(multipliers[i]), x + binWidth / 2, boxY + boxH * 0.72);
      }

      if (currentHit && nowMs - currentHit.startedAt >= 270) {
        hitAnimationRef.current = null;
      }
    }

    function drawBoard(ctx2d: CanvasRenderingContext2D) {
      ctx2d.clearRect(0, 0, WIDTH, HEIGHT);

      const bg = ctx2d.createLinearGradient(0, 0, 0, HEIGHT);
      bg.addColorStop(0, "#0c2635");
      bg.addColorStop(1, "#081d2e");
      ctx2d.fillStyle = bg;
      ctx2d.fillRect(0, 0, WIDTH, HEIGHT);

      drawBins(ctx2d, performance.now());

      ctx2d.fillStyle = "#f0f6ff";
      for (const peg of pegs) {
        ctx2d.beginPath();
        ctx2d.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
        ctx2d.fill();
      }

      const ball = ballRef.current;
      if (ball?.active) {
        const gradient = ctx2d.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, BALL_RADIUS + 3);
        gradient.addColorStop(0, "#fff7d6");
        gradient.addColorStop(1, "#f5a524");
        ctx2d.fillStyle = gradient;
        ctx2d.beginPath();
        ctx2d.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx2d.fill();
      }
    }

    function settleBall(result: DropResult) {
      const win = result.payout;
      const palette = getBinPalette(result.index, multipliers.length);
      setLastWin(win);
      setBalance(result.balanceAfter);
      setFairness({
        clientSeed: result.fairness.clientSeed,
        serverSeedHash: result.fairness.serverSeedHash,
        nonce: result.fairness.nextNonce,
      });
      setHistory((prev) => [...prev, { value: result.multiplier, ...palette }].slice(-20));
      setStatus(`Landed on ${result.multiplier}x`);
      hitAnimationRef.current = { index: result.index, startedAt: performance.now() };
      setIsDropping(false);
      ballRef.current = null;
    }

    function tick(ts: number) {
      const ball = ballRef.current;
      if (ball?.active) {
        const progress = Math.min(1, (ts - ball.startedAt) / ball.durationMs);
        const easedY = progress * progress;
        const sway = Math.sin(progress * Math.PI * (rows * 0.48)) * (1 - progress) * 16;

        ball.x = ball.startX + (ball.targetX - ball.startX) * progress + sway;
        ball.y = ball.startY + (ball.targetY - ball.startY) * easedY;

        if (progress >= 1) {
          settleBall(ball.outcome);
        }
      }

      drawBoard(context);
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [multipliers, pegs, rows]);

  const dropBall = useCallback(async () => {
    if (isDropping) return false;
    if (bet <= 0 || Number.isNaN(bet)) {
      setStatus("Set a valid bet");
      return false;
    }
    if (balance < bet) {
      setStatus("Insufficient balance");
      return false;
    }
    if (multipliers.length !== rows + 1) {
      setStatus("Loading config...");
      return false;
    }

    setStatus("Ball dropped...");
    setLastWin(0);
    setIsDropping(true);

    try {
      const response = await fetch(`/api/games/${GAME_ID}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, risk: difficulty, bet }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({ message: "Drop failed" }))) as { message?: string };
        throw new Error(errorBody.message ?? "Drop failed");
      }

      const result = (await response.json()) as DropResult;
      setMultipliers(result.multipliers);
      setRtp(result.rtp);

      const { binWidth, y: binY, left } = getBinLayout(result.multipliers.length, pegs);
      const stride = binWidth + BIN_GAP;
      const targetX = left + result.index * stride + binWidth / 2;

      ballRef.current = {
        active: true,
        x: WIDTH / 2,
        y: 24,
        startX: WIDTH / 2,
        startY: 24,
        targetX,
        targetY: binY + BIN_HEIGHT * 0.45,
        startedAt: performance.now(),
        durationMs: Math.max(600, 900 - rows * 12),
        outcome: result,
      };

      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not drop ball. Try again.");
      setIsDropping(false);
      return false;
    }
  }, [isDropping, bet, balance, multipliers.length, rows, difficulty, pegs]);

  useEffect(() => {
    if (!autoRunning || mode !== "auto" || isDropping) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (!autoInfinite && autoRemaining <= 0) {
          setAutoRunning(false);
          setStatus("Autoplay complete.");
          return;
        }

        const started = await dropBall();
        if (!started) {
          setAutoRunning(false);
          return;
        }

        if (!autoInfinite) {
          setAutoRemaining((prev) => {
            const next = Math.max(0, prev - 1);
            setAutoGamesInput(String(next));
            return next;
          });
        }
      })();
    }, AUTO_SPEED_MS[autoSpeed]);

    return () => window.clearTimeout(timer);
  }, [autoRunning, mode, isDropping, autoInfinite, autoRemaining, autoSpeed, dropBall]);

  function handlePrimaryAction() {
    if (mode === "manual") {
      void dropBall();
      return;
    }

    if (autoRunning) {
      setAutoRunning(false);
      setStatus("Autoplay stopped.");
      return;
    }

    const parsed = Number.parseInt(autoGamesInput, 10);
    const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    setAutoGamesInput(String(normalized));
    setAutoRemaining(normalized);
    setAutoRunning(true);
    setStatus(
      autoInfinite
        ? `Autoplay started (infinite, ${autoSpeed}).`
        : `Autoplay started (${normalized} rounds, ${autoSpeed}).`,
    );
  }

  return (
    <div className="panel card-glow flex h-[calc(100vh-16px)] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-[#344e79] bg-[#080f1d] px-4 py-3">
        <h1 className="section-title text-2xl text-white">Thunder Plinko</h1>
        <div className="flex items-center gap-2 rounded-lg border border-[#344e79] bg-[#0b152a] px-2 py-1.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ea9d6]">Balance</p>
            <p className="text-sm font-bold text-[#7dffbf]">${balance.toFixed(2)}</p>
          </div>
          <Link
            href="/wallet"
            className="rounded-md border border-[#3b5688] bg-[#11274a] px-2.5 py-1 text-xs font-semibold text-[#dce9ff] hover:bg-[#17325f]"
          >
            Wallet
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[300px_1fr]">
        <aside className="overflow-y-auto border-r border-[#344e79] bg-[#0b152a] p-3">
          <div className="mb-4 flex rounded-full bg-[#0d1f3a] p-1">
            <button
              className={`w-1/2 rounded-full py-2 text-sm font-semibold ${
                mode === "manual" ? "bg-[#345470] text-white" : "text-[#c5d8e9]"
              }`}
              type="button"
              onClick={() => setMode("manual")}
            >
              Manual
            </button>
            <button
              className={`w-1/2 rounded-full py-2 text-sm font-semibold ${
                mode === "auto" ? "bg-[#345470] text-white" : "text-[#c5d8e9]"
              }`}
              type="button"
              onClick={() => setMode("auto")}
            >
              Auto
            </button>
          </div>

          <label className="mb-1 block text-sm font-semibold text-[#bcd4e7]" htmlFor="amount">
            Amount
          </label>
          <div className="mb-4 flex overflow-hidden rounded-lg border border-[#3b5688] bg-[#0f223f]">
            <input
              id="amount"
              className="h-10 w-full bg-transparent px-3 text-lg text-[#dcecff] outline-none"
              type="number"
              min={0}
              step={0.1}
              value={bet}
              onChange={(event) => setBet(Number(event.target.value))}
            />
            <button
              className="w-14 border-l border-[#3b5688] text-[#cce2f6]"
              type="button"
              onClick={() => setBet((v) => Number((v / 2).toFixed(2)))}
            >
              1/2
            </button>
            <button
              className="w-14 border-l border-[#3b5688] text-[#cce2f6]"
              type="button"
              onClick={() => setBet((v) => Number((v * 2).toFixed(2)))}
            >
              2x
            </button>
          </div>

          <label className="mb-1 block text-sm font-semibold text-[#bcd4e7]" htmlFor="difficulty">
            Difficulty
          </label>
          <select
            id="difficulty"
            className="mb-4 h-11 w-full rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-lg text-[#e4f0ff]"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as PlinkoRisk)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <label className="mb-1 block text-sm font-semibold text-[#bcd4e7]" htmlFor="rows">
            Rows
          </label>
          <select
            id="rows"
            className="mb-4 h-11 w-full rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-lg text-[#e4f0ff]"
            value={rows}
            onChange={(event) => setRows(Math.max(ROW_MIN, Math.min(ROW_MAX, Number(event.target.value))))}
          >
            <option value={8}>8</option>
            <option value={9}>9</option>
            <option value={10}>10</option>
            <option value={11}>11</option>
            <option value={12}>12</option>
            <option value={13}>13</option>
            <option value={14}>14</option>
            <option value={15}>15</option>
            <option value={16}>16</option>
          </select>

          {mode === "auto" ? (
            <>
              <label className="mb-1 block text-sm font-semibold text-[#bcd4e7]" htmlFor="numberOfGames">
                Number of Games
              </label>
              <div className="mb-4 flex overflow-hidden rounded-lg border border-[#3b5688] bg-[#0f223f]">
                <input
                  id="numberOfGames"
                  className="h-10 w-full bg-transparent px-3 text-lg text-[#dcecff] outline-none"
                  type="number"
                  min={0}
                  step={1}
                  value={autoGamesInput}
                  onFocus={(event) => {
                    if (event.target.value === "0") setAutoGamesInput("");
                  }}
                  onBlur={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                    setAutoGamesInput(String(normalized));
                  }}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "") {
                      setAutoGamesInput("");
                      return;
                    }
                    if (/^\d+$/.test(next)) setAutoGamesInput(next);
                  }}
                />
                <button
                  type="button"
                  className={`w-14 border-l border-[#3b5688] text-xl font-bold transition-colors ${
                    autoInfinite ? "bg-[#1f7a1f] text-[#eaffea]" : "bg-transparent text-[#cce2f6] hover:bg-[#132b4a]"
                  }`}
                  onClick={() => setAutoInfinite((prev) => !prev)}
                  title="Toggle infinite autoplay"
                >
                  {"\u221E"}
                </button>
              </div>

              <label className="mb-1 block text-sm font-semibold text-[#bcd4e7]" htmlFor="autoSpeed">
                Auto Speed
              </label>
              <select
                id="autoSpeed"
                className="mb-4 h-11 w-full rounded-lg border border-[#3b5688] bg-[#0f223f] px-3 text-lg text-[#e4f0ff]"
                value={autoSpeed}
                onChange={(event) => setAutoSpeed(event.target.value as AutoSpeed)}
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
                <option value="turbo">Turbo</option>
              </select>
            </>
          ) : null}

          <button
            className="h-11 w-full rounded-lg bg-[#2d7de0] text-lg font-semibold text-white disabled:opacity-60"
            type="button"
            onClick={handlePrimaryAction}
            disabled={mode === "manual" ? isDropping : false}
          >
            {mode === "auto" ? (autoRunning ? "Stop Autoplay" : "Start Autoplay") : "Play"}
          </button>

          <div className="mt-4 rounded-lg border border-[#3b5688] bg-[#0f223f] p-3 text-sm text-[#b9d0e4]">
            <p>Status: {status}</p>
            <p>Balance: ${balance.toFixed(2)}</p>
            <p>Last Win: ${lastWin.toFixed(2)}</p>
            <p>RTP: {rtp.toFixed(2)}%</p>
            {fairness ? (
              <>
                <p>Nonce: {fairness.nonce}</p>
                <p className="truncate">Seed Hash: {fairness.serverSeedHash}</p>
              </>
            ) : null}
            {mode === "auto" && !autoInfinite ? <p>Remaining: {autoRemaining}</p> : null}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[#0b152a] p-3">
          <div className="mb-2 rounded-lg border border-[#344e79] bg-[#0f223f] px-2 py-2">
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
              {history.length === 0 ? (
                <span className="px-2 text-xs text-[#8fb1cc]">History will appear here after each drop</span>
              ) : (
                history.map((item, index) => (
                  <span
                    key={`${item.value}-${index}`}
                    className="rounded-md border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      borderColor: item.border,
                      color: item.text,
                      background: `linear-gradient(180deg, ${item.fillTop}, ${item.fillBottom})`,
                    }}
                  >
                    {formatMultiplier(item.value)}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-[#344e79] bg-[#0e1a33] p-2">
            <canvas ref={canvasRef} className="h-full w-full rounded-lg bg-[#081a31]" width={WIDTH} height={HEIGHT} />
          </div>

          <div className="mt-2 flex items-center justify-between rounded-lg border border-[#344e79] bg-[#0f223f] px-3 py-2 text-[#d5e6f6]">
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span>SET</span>
              <span>GRID</span>
              <span>POP</span>
              <span>FULL</span>
            </div>
            <strong className="section-title text-lg">Stake</strong>
            <div className="rounded-lg border border-[#3b5688] bg-[#17325f] px-3 py-1.5 text-sm font-semibold">
              Fairness
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
