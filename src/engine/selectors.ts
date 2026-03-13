import type { GameState, Player } from "./types";

export function isMyTurn(state: GameState | null, userId: string | undefined): boolean {
  return !!state && !!userId && state.currentPlayerId === userId;
}

export function getOpponents(state: GameState | null, myUserId: string | undefined): Player[] {
  if (!state || !myUserId) return [];
  return state.players
    .filter((p) => p.id !== myUserId)
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

export function getTimeRemaining(deadline: number): number {
  const remaining = Math.floor((deadline - Date.now()) / 1000);
  return Math.max(0, remaining);
}
