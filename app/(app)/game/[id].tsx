import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { useGameStore } from "@/src/store/gameStore";
import { useGame } from "@/src/hooks/useGame";
import { useAuth } from "@/src/hooks/useAuth";
import { isMyTurn, getOpponents, getTimeRemaining } from "@/src/engine/selectors";
import { Hand } from "@/src/components/Hand";
import { TurnTimer } from "@/src/components/TurnTimer";

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const state = useGameStore((s) => s.state);
  const myHand = useGameStore((s) => s.myHand);
  const { playCard } = useGame(gameId ?? null);

  const myTurn = isMyTurn(state, user?.id);
  const opponents = getOpponents(state, user?.id);
  const deadline = state?.turnDeadline ?? 0;
  const totalSeconds = 30;

  if (!gameId) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <Text className="text-neutral-600 dark:text-neutral-400">Invalid game</Text>
      </View>
    );
  }

  if (!state) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <Text className="text-neutral-600 dark:text-neutral-400">Loading game…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <Pressable onPress={() => router.replace("/(app)/home")} className="rounded-lg bg-neutral-200 px-3 py-1.5 dark:bg-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Leave</Text>
        </Pressable>
        <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Round {state.round}
        </Text>
        {myTurn && (
          <TurnTimer deadline={deadline} totalSeconds={totalSeconds} active={myTurn} />
        )}
      </View>

      <View className="flex-1 justify-between px-4 py-6">
        <View className="items-center gap-4">
          {opponents.map((p) => (
            <View key={p.id} className="rounded-lg bg-white px-4 py-2 dark:bg-neutral-800">
              <Text className="font-medium text-neutral-900 dark:text-white">
                {p.username}
                {state.currentPlayerId === p.id && " (turn)"}
              </Text>
            </View>
          ))}
        </View>

        <Hand
          cards={myHand}
          disabled={!myTurn}
          onPlayCard={playCard}
          state={state}
          playerId={user?.id ?? ""}
        />
      </View>
    </View>
  );
}
