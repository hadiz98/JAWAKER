/**
 * Copy this file to add a new game. Fill in the TODO sections.
 */
import type { Card, GameState, IGameRules, Move, Player } from "../types.ts";
import { gameRegistry } from "../registry.ts";
import { buildDeck, deal, shuffle } from "../dealer.ts";
import { calculateDeadline, nextPlayerIndex } from "../turnManager.ts";

class TemplateGameRules implements IGameRules {
  readonly gameType = "template";
  readonly minPlayers = 2;
  readonly maxPlayers = 4;
  readonly turnTimeoutSeconds = 30;

  getInitialState(players: Player[]): GameState {
    const deck = shuffle(buildDeck());
    const hands = deal(deck, players.length);
    const handsMap: Record<string, Card[]> = {};
    players.forEach((p, i) => {
      handsMap[p.id] = hands[i];
    });
    const firstPlayer = players[0];
    return {
      players,
      hands: handsMap,
      publicState: { gameType: this.gameType },
      currentPlayerId: firstPlayer.id,
      turnDeadline: calculateDeadline(this.turnTimeoutSeconds),
      round: 1,
      status: "active",
    };
  }

  isValidMove(state: GameState, move: Move, playerId: string): boolean {
    if (state.currentPlayerId !== playerId) return false;
    if (state.status !== "active") return false;
    if (move.type === "play_card" && move.card) {
      const hand = state.hands[playerId] ?? [];
      if (!hand.some((c) => c.id === move.card!.id)) return false;
      return true;
    }
    return false;
  }

  getValidMoves(state: GameState, playerId: string): Move[] {
    if (state.currentPlayerId !== playerId || state.status !== "active") {
      return [];
    }
    const hand = state.hands[playerId] ?? [];
    return hand.map((card) => ({ type: "play_card", card }));
  }

  applyMove(state: GameState, move: Move): GameState {
    const playerId = state.currentPlayerId;
    const hands = { ...state.hands };
    const publicState = { ...state.publicState };

    if (move.type === "play_card" && move.card) {
      hands[playerId] = (hands[playerId] ?? []).filter((c) => c.id !== move.card!.id);
    }

    const currentIndex = state.players.findIndex((p) => p.id === playerId);
    const nextIndex = nextPlayerIndex(currentIndex, state.players.length);
    const nextPlayer = state.players[nextIndex];

    return {
      ...state,
      hands,
      publicState,
      currentPlayerId: nextPlayer.id,
      turnDeadline: calculateDeadline(this.turnTimeoutSeconds),
    };
  }

  getWinner(state: GameState): string | null {
    return null;
  }

  calculateScore(state: GameState): Record<string, number> {
    const scores: Record<string, number> = {};
    state.players.forEach((p) => (scores[p.id] = 0));
    return scores;
  }

  onRoundEnd(state: GameState): GameState {
    return { ...state, round: state.round + 1 };
  }
}

gameRegistry.register(new TemplateGameRules());
