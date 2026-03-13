import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useRoomStore } from "@/src/store/roomStore";
import { gameRegistry } from "@/src/engine/registry";
import "@/src/games";

const FUNCTIONS_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "") + "/functions/v1";

export default function CreateRoomScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gameType, setGameType] = useState("template");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const setRoom = useRoomStore((s) => s.setRoom);

  const gameTypes = gameRegistry.list();
  const rules = gameTypes.length ? gameRegistry.get(gameType) : null;

  async function createRoom() {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        Alert.alert("Error", "Not signed in");
        setLoading(false);
        return;
      }

      const res = await fetch(`${FUNCTIONS_URL}/create-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ game_type: gameType, max_players: maxPlayers }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Failed to create room");
        setLoading(false);
        return;
      }

      setRoom(data);
      router.replace(`/(app)/room/${data.code}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-12 dark:bg-neutral-900">
      <Text className="mb-6 text-2xl font-bold text-neutral-900 dark:text-white">
        Create room
      </Text>

      <Text className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
        Game type
      </Text>
      <View className="mb-6 flex-row flex-wrap gap-2">
        {gameTypes.map((gt) => (
          <Pressable
            key={gt}
            onPress={() => setGameType(gt)}
            className={`rounded-lg border-2 py-2 px-4 ${
              gameType === gt
                ? "border-neutral-900 dark:border-white"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            <Text
              className={`font-medium ${
                gameType === gt ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              {gt}
            </Text>
          </Pressable>
        ))}
      </View>

      {rules && (
        <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-500">
          Players: {rules.minPlayers}–{rules.maxPlayers}
        </Text>
      )}

      <Text className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
        Max players
      </Text>
      <View className="mb-8 flex-row gap-2">
        {[2, 3, 4, 5, 6].map((n) => (
          <Pressable
            key={n}
            onPress={() => setMaxPlayers(n)}
            className={`rounded-lg border-2 py-2 px-4 ${
              maxPlayers === n ? "border-neutral-900 dark:border-white" : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            <Text
              className={
                maxPlayers === n ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
              }
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={createRoom}
        disabled={loading}
        className="rounded-xl bg-neutral-900 py-3 active:opacity-80 disabled:opacity-50 dark:bg-white"
      >
        <Text className="text-center font-semibold text-white dark:text-neutral-900">
          {loading ? "Creating…" : "Create room"}
        </Text>
      </Pressable>
    </View>
  );
}
