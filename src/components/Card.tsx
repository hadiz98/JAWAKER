import type { Card as CardType } from "@/src/engine/types";
import { Pressable, Text, View } from "react-native";

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

const suitSymbols: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export function Card({ card, faceDown, onPress, disabled, selected }: CardProps) {
  if (faceDown) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="h-24 w-16 items-center justify-center rounded-lg border-2 border-neutral-400 bg-neutral-600 dark:border-neutral-500 dark:bg-neutral-700"
      >
        <Text className="text-2xl text-white">?</Text>
      </Pressable>
    );
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-24 w-16 items-center justify-center rounded-lg border-2 bg-white dark:bg-neutral-800 ${
        selected ? "-translate-y-1 border-neutral-900 dark:border-white" : "border-neutral-300 dark:border-neutral-600"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <Text className={`text-lg font-bold ${red ? "text-red-600" : "text-neutral-900 dark:text-white"}`}>
        {suitSymbols[card.suit] ?? card.suit}
      </Text>
      <Text className={`text-sm font-medium ${red ? "text-red-600" : "text-neutral-900 dark:text-white"}`}>
        {card.rank}
      </Text>
    </Pressable>
  );
}
