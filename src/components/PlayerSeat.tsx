import { View, Text } from "react-native";
import type { Player } from "@/src/engine/types";

interface PlayerSeatProps {
  player: Player;
  cardCount: number;
  score: number;
  isCurrentTurn: boolean;
  isConnected: boolean;
}

export function PlayerSeat({
  player,
  cardCount,
  score,
  isCurrentTurn,
  isConnected,
}: PlayerSeatProps) {
  return (
    <View
      className={`rounded-xl border-2 bg-white px-4 py-3 dark:bg-neutral-800 ${
        isCurrentTurn ? "border-amber-500 dark:border-amber-400" : "border-neutral-200 dark:border-neutral-700"
      } ${!isConnected ? "opacity-70" : ""}`}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-600">
            <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
              {player.username?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View>
            <Text className="font-medium text-neutral-900 dark:text-white" numberOfLines={1}>
              {player.username ?? "Player"}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {cardCount} card{cardCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Score: {score}
          </Text>
          {!isConnected && (
            <View className="rounded bg-red-100 px-1.5 py-0.5 dark:bg-red-900/40">
              <Text className="text-xs font-medium text-red-700 dark:text-red-300">Offline</Text>
            </View>
          )}
          {isCurrentTurn && (
            <View className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
          )}
        </View>
      </View>
      {cardCount > 0 && (
        <View className="mt-2 flex-row gap-0.5">
          {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
            <View
              key={i}
              className="h-8 w-5 rounded border border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-700"
              style={{ marginLeft: i > 0 ? -8 : 0 }}
            />
          ))}
          {cardCount > 8 && (
            <Text className="ml-1 self-center text-xs text-neutral-500">+{cardCount - 8}</Text>
          )}
        </View>
      )}
    </View>
  );
}
