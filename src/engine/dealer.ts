import type { Card, Rank, Suit } from "./types";

const DEFAULT_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const DEFAULT_RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export function buildDeck(
  suits: Suit[] = DEFAULT_SUITS,
  ranks: Rank[] = DEFAULT_RANKS
): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${suit}_${rank}` });
    }
  }
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function deal(deck: Card[], numPlayers: number): Card[][] {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  deck.forEach((card, i) => {
    hands[i % numPlayers].push(card);
  });
  return hands;
}
