import type { Card as CardType } from "@/src/engine/types";
import { View } from "react-native";
import { Card } from "./Card";

interface TableProps {
  cards: CardType[];
}

export function Table({ cards }: TableProps) {
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
