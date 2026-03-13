import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/hooks/useAuth";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <View className="flex-1 bg-white px-6 pt-16 dark:bg-neutral-900">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-lg text-neutral-600 dark:text-neutral-400">
            Signed in as
          </Text>
          <Text className="text-xl font-semibold text-neutral-900 dark:text-white">
            {user?.user_metadata?.full_name ?? user?.email ?? "Player"}
          </Text>
        </View>
        <Pressable
          onPress={signOut}
          className="rounded-lg bg-neutral-200 py-2 px-4 active:opacity-80 dark:bg-neutral-700"
        >
          <Text className="font-medium text-neutral-900 dark:text-white">
            Sign out
          </Text>
        </Pressable>
      </View>

      <View className="mt-16 flex-1 items-center justify-center gap-6">
        <Text className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
          Jawaker
        </Text>
        <Text className="mb-4 text-center text-neutral-600 dark:text-neutral-400">
          Create or join a game to get started
        </Text>
        <Pressable
          onPress={() => router.push("/(app)/room/create")}
          className="min-w-[200] rounded-xl bg-neutral-900 py-3 active:opacity-80 dark:bg-white"
        >
          <Text className="text-center font-semibold text-white dark:text-neutral-900">
            Create game
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/room/join")}
          className="min-w-[200] rounded-xl border-2 border-neutral-900 py-3 active:opacity-80 dark:border-white"
        >
          <Text className="text-center font-semibold text-neutral-900 dark:text-white">
            Join game
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
