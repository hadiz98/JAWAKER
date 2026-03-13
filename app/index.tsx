import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/hooks/useAuth";

export default function LoginScreen() {
  const { session, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  async function signInWithGoogle() {
    setSigningIn(true);
    try {
      const redirectUri = makeRedirectUri({
        scheme: "jawaker",
        path: "auth/callback",
      });

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (signInError) {
        Alert.alert("Error", signInError.message);
        setSigningIn(false);
        return;
      }

      if (!data?.url) {
        Alert.alert("Error", "No auth URL returned");
        setSigningIn(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        { showInRecents: true }
      );

      if (result.type !== "success" || !result.url) {
        setSigningIn(false);
        return;
      }

      const url = new URL(result.url);
      const code =
        url.searchParams.get("code") ?? url.hash.match(/code=([^&]+)/)?.[1];
      if (!code) {
        Alert.alert("Error", "No authorization code in redirect");
        setSigningIn(false);
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        Alert.alert("Error", exchangeError.message);
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setSigningIn(false);
    }
  }

  if (loading) {
    return null;
  }

  if (session) {
    return <Redirect href="/(app)/home" />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-8 dark:bg-neutral-900">
      <Text className="mb-2 text-3xl font-bold text-neutral-900 dark:text-white">
        Jawaker
      </Text>
      <Text className="mb-10 text-center text-neutral-600 dark:text-neutral-400">
        Real-time multiplayer card games
      </Text>

      <Pressable
        onPress={signInWithGoogle}
        disabled={signingIn}
        className="min-w-[240] flex-row items-center justify-center rounded-xl bg-neutral-900 py-3 px-6 active:opacity-80 dark:bg-white"
      >
        {signingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white dark:text-neutral-900">
            Continue with Google
          </Text>
        )}
      </Pressable>
    </View>
  );
}
