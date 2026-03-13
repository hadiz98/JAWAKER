import type { Card as CardType } from "@/src/engine/types";
import { View, Text } from "react-native";
import { Card } from "./Card";

interface TableProps {
  /** Flat list of cards (e.g. template game). */
  cards: CardType[];
  /** Current trick with player id (e.g. Trix). When set, cards are shown grouped by player. */
  trick?: { card: CardType; playerId: string }[];
  /** Player list to resolve playerId to username when using trick. */
  players?: { id: string; username: string }[];
}

export function Table({ cards, trick, players = [] }: TableProps) {
  const playerNames = Object.fromEntries((players ?? []).map((p) => [p.id, p.username ?? "?"]));

  if (trick && trick.length > 0) {
    return (
      <View className="min-h-28 rounded-xl border-2 border-neutral-300 bg-neutral-100/50 px-4 py-4 dark:border-neutral-600 dark:bg-neutral-800/50">
        <View className="gap-3">
          {trick.map(({ card, playerId }) => (
            <View key={`${playerId}-${card.id}`} className="flex-row items-center gap-2">
              <Text className="min-w-20 text-xs text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
                {playerNames[playerId] ?? "Player"}
              </Text>
              <Card card={card} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View className="min-h-28 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-100/50 px-4 py-6 dark:border-neutral-600 dark:bg-neutral-800/50">
        {/* Empty table */}
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap justify-center gap-2 rounded-xl border-2 border-neutral-300 bg-neutral-100/50 px-4 py-4 dark:border-neutral-600 dark:bg-neutral-800/50">
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </View>
  );
}
