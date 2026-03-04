import type { PlinkoDropPayload } from "@/lib/games/thunder-plinko";
import {
  getThunderPlinkoConfig,
  getThunderPlinkoHistory,
  getThunderPlinkoState,
  playThunderPlinko,
} from "@/lib/games/thunder-plinko";

export type GameId = "thunder-plinko";

export type GameService = {
  getConfig: (input: { rows: number; risk: unknown }) => unknown;
  getState: (userId: string) => Promise<unknown>;
  getHistory: (userId: string) => Promise<unknown>;
  play: (userId: string, payload: PlinkoDropPayload) => Promise<unknown>;
};

const registry: Record<GameId, GameService> = {
  "thunder-plinko": {
    getConfig: getThunderPlinkoConfig,
    getState: getThunderPlinkoState,
    getHistory: getThunderPlinkoHistory,
    play: playThunderPlinko,
  },
};

export function getGameService(gameId: string) {
  if (gameId in registry) {
    return registry[gameId as GameId];
  }
  return null;
}

