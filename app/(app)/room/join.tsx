import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useRoomStore } from "@/src/store/roomStore";

const JOIN_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "") + "/functions/v1/join-room";

export default function JoinRoomScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const setRoom = useRoomStore((s) => s.setRoom);

  async function joinRoom() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert("Error", "Enter a room code");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        Alert.alert("Error", "Not signed in");
        setLoading(false);
        return;
      }

      const res = await fetch(JOIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) Alert.alert("Room not found", "Check the code and try again.");
        else if (res.status === 409) Alert.alert("Cannot join", data.error ?? "Room already started.");
        else Alert.alert("Error", data.error ?? "Failed to join");
        setLoading(false);
        return;
      }

      setRoom(data);
      router.replace(`/(app)/room/${data.code}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-12 dark:bg-neutral-900">
      <Text className="mb-6 text-2xl font-bold text-neutral-900 dark:text-white">
        Join room
      </Text>
      <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
        Enter the 6-character code
      </Text>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="ABC123"
        placeholderTextColor="#9ca3af"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        className="mb-6 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-lg font-mono text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      />
      <Pressable
        onPress={joinRoom}
        disabled={loading}
        className="rounded-xl bg-neutral-900 py-3 active:opacity-80 disabled:opacity-50 dark:bg-white"
      >
        <Text className="text-center font-semibold text-white dark:text-neutral-900">
          {loading ? "Joining…" : "Join"}
        </Text>
      </Pressable>
    </View>
  );
}
