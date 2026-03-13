import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useRoomStore } from "@/src/store/roomStore";
import { useRoom } from "@/src/hooks/useRoom";
import { useAuth } from "@/src/hooks/useAuth";
import { RoomCode } from "@/src/components/RoomCode";
import { gameRegistry } from "@/src/engine/registry";
import "@/src/games";

const BASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "") + "/functions/v1";
const JOIN_ROOM_URL = BASE_URL + "/join-room";
const START_GAME_URL = BASE_URL + "/start-game";

export default function WaitingRoomScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { room: roomInStore, setRoom, setPlayers, clear } = useRoomStore();
  const [loading, setStartLoading] = useState(false);

  const codeUpper = code?.toUpperCase();
  const roomId = roomInStore && codeUpper && roomInStore.code === codeUpper ? roomInStore.id : null;
  const { players } = useRoom(roomId);

  useEffect(() => {
    if (!code) return;
    if (roomInStore && codeUpper && roomInStore.code === codeUpper) return;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;
      const res = await fetch(JOIN_ROOM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: codeUpper }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data);
      }
    })();
  }, [code]);

  const room = roomInStore && codeUpper && roomInStore.code === codeUpper ? roomInStore : null;
  const isHost = room && user && room.host_id === user.id;
  const rules = room ? gameRegistry.get(room.game_type) : null;
  const canStart = rules && players.length >= rules.minPlayers;

  async function startGame() {
    if (!room || !user || !isHost || !canStart) return;
    setStartLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const playersPayload = players.map((p, i) => ({
        id: p.id,
        username: p.username,
        seatIndex: i,
      }));

      const res = await fetch(START_GAME_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ room_id: room.id, players: playersPayload }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Failed to start game");
        setStartLoading(false);
        return;
      }

      router.replace(`/(app)/game/${data.game_id}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to start");
    } finally {
      setStartLoading(false);
    }
  }

  function leaveRoom() {
    clear();
    router.replace("/(app)/home");
  }

  if (!room && roomId === null && codeUpper) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <Text className="text-neutral-600 dark:text-neutral-400">Loading room…</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="mb-4 text-center text-neutral-600 dark:text-neutral-400">
          Room not found
        </Text>
        <Pressable onPress={() => router.replace("/(app)/home")} className="rounded-lg bg-neutral-200 px-4 py-2">
          <Text className="font-medium text-neutral-900 dark:text-white">Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white px-6 pt-12 dark:bg-neutral-900">
      <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">Room code</Text>
      <RoomCode code={room.code} />

      <Text className="mt-8 mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
        Players ({players.length} / {room.max_players})
      </Text>
      <View className="mb-6 gap-2">
        {players.map((p) => (
          <View
            key={p.id}
            className="flex-row items-center rounded-lg bg-neutral-100 py-2 px-3 dark:bg-neutral-800"
          >
            <Text className="font-medium text-neutral-900 dark:text-white">{p.username}</Text>
            {p.id === user?.id && (
              <Text className="ml-2 text-xs text-neutral-500">(you)</Text>
            )}
          </View>
        ))}
      </View>

      {isHost && (
        <Pressable
          onPress={startGame}
          disabled={!canStart || loading}
          className="mb-4 rounded-xl bg-neutral-900 py-3 active:opacity-80 disabled:opacity-50 dark:bg-white"
        >
          <Text className="text-center font-semibold text-white dark:text-neutral-900">
            {loading ? "Starting…" : canStart ? "Start game" : `Need ${rules?.minPlayers ?? 2} players to start`}
          </Text>
        </Pressable>
      )}

      <Pressable onPress={leaveRoom} className="rounded-lg border border-neutral-300 py-2 dark:border-neutral-600">
        <Text className="text-center text-neutral-700 dark:text-neutral-300">Leave room</Text>
      </Pressable>
    </View>
  );
}
