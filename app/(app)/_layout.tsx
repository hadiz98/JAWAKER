import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/src/hooks/useAuth";

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
