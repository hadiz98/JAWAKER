import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, type AppStateStatus, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  "";

/** Web: expo-secure-store is not available; use localStorage. Native: use encrypted secure store. */
const authStorage =
  Platform.OS === "web"
    ? {
        getItem: async (key: string): Promise<string | null> => {
          if (typeof localStorage === "undefined") return null;
          return localStorage.getItem(key);
        },
        setItem: async (key: string, value: string): Promise<void> => {
          localStorage?.setItem(key, value);
        },
        removeItem: async (key: string): Promise<void> => {
          localStorage?.removeItem(key);
        },
      }
    : {
        getItem: async (key: string): Promise<string | null> =>
          SecureStore.getItemAsync(key),
        setItem: async (key: string, value: string): Promise<void> => {
          await SecureStore.setItemAsync(key, value);
        },
        removeItem: async (key: string): Promise<void> => {
          await SecureStore.deleteItemAsync(key);
        },
      };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// Pause token auto-refresh when app is backgrounded; resume when foregrounded (native only).
if (Platform.OS !== "web") {
  const subscription = AppState.addEventListener(
    "change",
    (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    }
  );
}
