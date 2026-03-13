/**
 * Trix — 2-player trick-taking. Mirror of src/games/trix.ts for Edge Functions.
 */
import type { Card, GameState, IGameRules, Move, Player } from "../types.ts";
import type { Rank, Suit } from "../types.ts";
import { gameRegistry } from "../registry.ts";
import { buildDeck, deal, shuffle } from "../dealer.ts";
import { calculateDeadline, nextPlayerIndex } from "../turnManager.ts";

const RANK_ORDER: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
function rankStrength(rank: Rank): number {
  const i = RANK_ORDER.indexOf(rank);
  return i === -1 ? 0 : i;
}

function compareCardsInSuit(a: Card, b: Card, leadSuit: Suit): number {
  if (a.suit !== leadSuit && b.suit !== leadSuit) return 0;
  if (a.suit !== leadSuit) return 1;
  if (b.suit !== leadSuit) return -1;
  return rankStrength(a.rank) - rankStrength(b.rank);
}

function winnerOfTrick(cards: { card: Card; playerId: string }[], leadSuit: Suit): string {
  let best = cards[0];
  for (let i = 1; i < cards.length; i++) {
    if (compareCardsInSuit(cards[i].card, best.card, leadSuit) > 0) best = cards[i];
  }
  return best.playerId;
}

interface TrixPublicState {
  gameType: string;
  tableCards: Card[];
  currentTrick: { card: Card; playerId: string }[];
  leadSuit: Suit | null;
  tricksWon: Record<string, number>;
}

class TrixGameRules implements IGameRules {
  readonly gameType = "trix";
  readonly minPlayers = 2;
  readonly maxPlayers = 2;
  readonly turnTimeoutSeconds = 30;

  getInitialState(players: Player[]): GameState {
    const deck = shuffle(buildDeck());
    const hands = deal(deck, players.length);
    const handsMap: Record<string, Card[]> = {};
    players.forEach((p, i) => {
      handsMap[p.id] = hands[i];
    });
    const tricksWon: Record<string, number> = {};
    players.forEach((p) => (tricksWon[p.id] = 0));
    return {
      players,
      hands: handsMap,
      publicState: {
        gameType: this.gameType,
        tableCards: [],
        currentTrick: [],
        leadSuit: null,
        tricksWon,
      } as TrixPublicState,
      currentPlayerId: players[0].id,
      turnDeadline: calculateDeadline(this.turnTimeoutSeconds),
      round: 1,
      status: "active",
    };
  }

  isValidMove(state: GameState, move: Move, playerId: string): boolean {
    if (state.currentPlayerId !== playerId) return false;
    if (state.status !== "active") return false;
    if (move.type === "forfeit_turn") return true;
    if (move.type !== "play_card" || !move.card) return false;

    const hand = state.hands[playerId] ?? [];
    if (!hand.some((c) => c.id === move.card!.id)) return false;

    const publicState = state.publicState as TrixPublicState;
    const currentTrick = publicState.currentTrick ?? [];
    const leadSuit = publicState.leadSuit;

    if (currentTrick.length === 0) return true;
    if (!leadSuit) return true;

    const hasLeadSuit = hand.some((c) => c.suit === leadSuit);
    if (hasLeadSuit && move.card.suit !== leadSuit) return false;
    return true;
  }

  getValidMoves(state: GameState, playerId: string): Move[] {
    if (state.currentPlayerId !== playerId || state.status !== "active") return [];
    const hand = state.hands[playerId] ?? [];
    const publicState = state.publicState as TrixPublicState;
    const leadSuit = publicState.leadSuit;
    const currentTrick = publicState.currentTrick ?? [];

    let validCards = hand;
    if (currentTrick.length > 0 && leadSuit) {
      const canFollow = hand.filter((c) => c.suit === leadSuit);
      if (canFollow.length > 0) validCards = canFollow;
    }
    return validCards.map((card) => ({ type: "play_card" as const, card }));
  }

  applyMove(state: GameState, move: Move): GameState {
    const playerId = state.currentPlayerId;
    const publicState = { ...state.publicState } as TrixPublicState;
    const currentTrick = [...(publicState.currentTrick ?? [])];
    const tableCards = [...(publicState.tableCards ?? [])];
    const tricksWon = { ...(publicState.tricksWon ?? {}) };
    state.players.forEach((p) => {
      if (tricksWon[p.id] === undefined) tricksWon[p.id] = 0;
    });

    if (move.type === "forfeit_turn") {
      const currentIndex = state.players.findIndex((p) => p.id === playerId);
      const nextIndex = nextPlayerIndex(currentIndex, state.players.length);
      const nextPlayer = state.players[nextIndex];
      return {
        ...state,
        publicState,
        currentPlayerId: nextPlayer.id,
        turnDeadline: calculateDeadline(this.turnTimeoutSeconds),
      };
    }

    if (move.type !== "play_card" || !move.card) return state;

    const hands = { ...state.hands };
    hands[playerId] = (hands[playerId] ?? []).filter((c) => c.id !== move.card!.id);
    const card = move.card;

    currentTrick.push({ card, playerId });
    tableCards.push(card);

    let leadSuit = publicState.leadSuit;
    if (currentTrick.length === 1) leadSuit = card.suit;

    let nextPlayerId = state.currentPlayerId;
    let nextDeadline = calculateDeadline(this.turnTimeoutSeconds);
    const numPlayers = state.players.length;

    if (currentTrick.length >= numPlayers) {
      const trickWinnerId = winnerOfTrick(currentTrick, leadSuit!);
      tricksWon[trickWinnerId] = (tricksWon[trickWinnerId] ?? 0) + 1;
      nextPlayerId = trickWinnerId;
      currentTrick.length = 0;
      leadSuit = null;
    } else {
      const currentIndex = state.players.findIndex((p) => p.id === playerId);
      const nextIndex = nextPlayerIndex(currentIndex, state.players.length);
      nextPlayerId = state.players[nextIndex].id;
    }

    return {
      ...state,
      hands,
      publicState: {
        ...publicState,
        tableCards,
        currentTrick,
        leadSuit,
        tricksWon,
      },
      currentPlayerId: nextPlayerId,
      turnDeadline: nextDeadline,
    };
  }

  getWinner(state: GameState): string | null {
    const publicState = state.publicState as TrixPublicState;
    const tricksWon = publicState.tricksWon ?? {};
    const p0 = state.players[0];
    const p1 = state.players[1];
    const t0 = tricksWon[p0.id] ?? 0;
    const t1 = tricksWon[p1.id] ?? 0;
    if (t0 + t1 < 13) return null;
    if (t0 > t1) return p0.id;
    if (t1 > t0) return p1.id;
    return null;
  }

  calculateScore(state: GameState): Record<string, number> {
    const publicState = state.publicState as TrixPublicState;
    const tricksWon = publicState.tricksWon ?? {};
    const out: Record<string, number> = {};
    state.players.forEach((p) => (out[p.id] = tricksWon[p.id] ?? 0));
    return out;
  }

  onRoundEnd(state: GameState): GameState {
    return { ...state, round: state.round + 1 };
  }
}

gameRegistry.register(new TrixGameRules());
