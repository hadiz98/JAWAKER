/**
 * Core types for the card game engine.
 * Shared between client and Edge Functions (mirror in supabase/functions/_shared/).
 */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string;
  username: string;
  seatIndex: number;
}

export interface Move {
  type: string;
  card?: Card;
  data?: Record<string, unknown>;
}

export interface GameState {
  players: Player[];
  hands: Record<string, Card[]>;
  publicState: Record<string, unknown>;
  currentPlayerId: string;
  turnDeadline: number;
  round: number;
  status: "active" | "finished";
  winner?: string;
}

export interface IGameRules {
  readonly gameType: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly turnTimeoutSeconds: number;

  getInitialState(players: Player[]): GameState;
  isValidMove(state: GameState, move: Move, playerId: string): boolean;
  getValidMoves(state: GameState, playerId: string): Move[];
  applyMove(state: GameState, move: Move): GameState;
  getWinner(state: GameState): string | null;
  calculateScore(state: GameState): Record<string, number>;
  onRoundEnd(state: GameState): GameState;
}
