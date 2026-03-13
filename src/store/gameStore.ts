import type { Card, GameState, Move } from "@/src/engine/types";
import { create } from "zustand";

export interface CoPlayerInfo {
  seatIndex: number;
  score: number;
  isConnected: boolean;
  cardCount: number;
}

interface GameStoreState {
  gameId: string | null;
  state: GameState | null;
  myHand: Card[];
  pendingMove: Move | null;
  coPlayers: Record<string, CoPlayerInfo>;
  setGame: (gameId: string, state: GameState, hand: Card[]) => void;
  setCoPlayers: (info: Record<string, CoPlayerInfo>) => void;
  applyMoveOptimistic: (move: Move) => void;
  rollbackMove: () => void;
  syncFromServer: (state: GameState, hand: Card[]) => void;
  clear: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameId: null,
  state: null,
  myHand: [],
  pendingMove: null,
  coPlayers: {},

  setGame: (gameId, state, hand) =>
    set({ gameId, state, myHand: hand, pendingMove: null }),

  setCoPlayers: (coPlayers) => set({ coPlayers }),

  applyMoveOptimistic: (move) => {
    const { myHand } = get();
    if (move.card) {
      const nextHand = myHand.filter((c) => c.id !== move.card!.id);
      set({ myHand: nextHand, pendingMove: move });
    } else {
      set({ pendingMove: move });
    }
  },

  rollbackMove: () => {
    const { pendingMove, myHand } = get();
    if (!pendingMove?.card) {
      set({ pendingMove: null });
      return;
    }
    set({
      myHand: [...myHand, pendingMove.card],
      pendingMove: null,
    });
  },

  syncFromServer: (state, hand) =>
    set({ state, myHand: hand, pendingMove: null }),

  clear: () =>
    set({ gameId: null, state: null, myHand: [], pendingMove: null, coPlayers: {} }),
}));
