import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { supabase } from "@/src/lib/supabase";

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("No authorization code received.");
      return;
    }

    let cancelled = false;

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        // If we're in a popup (OAuth opened in new window), close it and refresh the opener
        if (typeof window !== "undefined" && window.opener) {
          window.opener.location.href = "/";
          window.close();
          return;
        }
        router.replace("/(app)/home");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Sign in failed");
      });

    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="mb-4 text-center text-red-600 dark:text-red-400">
          {error}
        </Text>
        <Text
          className="text-blue-600 dark:text-blue-400"
          onPress={() => router.replace("/")}
        >
          Back to login
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-neutral-600 dark:text-neutral-400">
        Signing you in…
      </Text>
    </View>
  );
}
