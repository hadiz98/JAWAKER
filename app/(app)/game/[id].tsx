import { useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppState, AppStateStatus, View, Text, Pressable } from "react-native";
import { useGameStore } from "@/src/store/gameStore";
import { useGame } from "@/src/hooks/useGame";
import { useAuth } from "@/src/hooks/useAuth";
import { supabase } from "@/src/lib/supabase";
import { gameRegistry } from "@/src/engine/registry";
import { isMyTurn, getOpponents } from "@/src/engine/selectors";
import { Hand } from "@/src/components/Hand";
import { PlayerSeat } from "@/src/components/PlayerSeat";
import { Table } from "@/src/components/Table";
import { TurnTimer } from "@/src/components/TurnTimer";

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const state = useGameStore((s) => s.state);
  const myHand = useGameStore((s) => s.myHand);
  const coPlayers = useGameStore((s) => s.coPlayers);
  const { playCard } = useGame(gameId ?? null);

  useEffect(() => {
    if (!gameId || !user || state?.status !== "active") return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const connected = next === "active";
      supabase
        .from("game_players")
        .update({ is_connected: connected, updated_at: new Date().toISOString() })
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .then(() => {});
    });
    return () => sub.remove();
  }, [gameId, user?.id, state?.status]);

  const myTurn = isMyTurn(state, user?.id);
  const opponents = getOpponents(state, user?.id);
  const deadline = state?.turnDeadline ?? 0;
  const gameType = (state?.publicState?.gameType as string) ?? "template";
  const totalSeconds = state ? (gameRegistry.get(gameType).turnTimeoutSeconds ?? 30) : 30;
  const tableCards = (state?.publicState?.tableCards ?? []) as import("@/src/engine/types").Card[];
  const tricksWon = (state?.publicState?.tricksWon ?? {}) as Record<string, number> | undefined;
  const isFinished = state?.status === "finished";
  const winnerId = state?.winner;
  const winnerPlayer = state?.players.find((p) => p.id === winnerId);

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
        <View className="gap-3">
          {opponents.map((p) => (
            <PlayerSeat
              key={p.id}
              player={p}
              cardCount={coPlayers[p.id]?.cardCount ?? 0}
              score={coPlayers[p.id]?.score ?? tricksWon?.[p.id] ?? 0}
              isCurrentTurn={state.currentPlayerId === p.id}
              isConnected={coPlayers[p.id]?.isConnected ?? true}
            />
          ))}
        </View>

        <View className="my-4">
          <Table cards={tableCards} />
        </View>

        <Hand
          cards={myHand}
          disabled={!myTurn}
          onPlayCard={playCard}
          state={state}
          playerId={user?.id ?? ""}
        />
      </View>

      {isFinished && (
        <View className="absolute inset-0 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-neutral-800">
            <Text className="mb-2 text-center text-lg font-bold text-neutral-900 dark:text-white">
              Game over
            </Text>
            <Text className="mb-6 text-center text-neutral-600 dark:text-neutral-400">
              {winnerId === user?.id
                ? "You win!"
                : winnerPlayer
                  ? `${winnerPlayer.username} wins`
                  : "Game ended"}
            </Text>
            <Pressable
              onPress={() => router.replace("/(app)/home")}
              className="rounded-xl bg-neutral-900 py-3 dark:bg-white"
            >
              <Text className="text-center font-semibold text-white dark:text-neutral-900">
                Back to home
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
