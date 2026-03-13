import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/src/lib/supabase";
import { eventBus } from "@/src/engine/eventBus";
import { useRoomStore, type RoomPlayer } from "@/src/store/roomStore";
import { useAuth } from "@/src/hooks/useAuth";

export function useRoom(roomId: string | null) {
  const router = useRouter();
  const { user } = useAuth();
  const { room, setPlayers } = useRoomStore();
  const channelRef = useRef<ReturnType<typeof eventBus.connectRoom> | null>(null);

  useEffect(() => {
    if (!roomId || !user) return;

    channelRef.current = eventBus.connectRoom(roomId, user.id);
    const ch = channelRef.current;

    eventBus.trackPresenceRoom({
      userId: user.id,
      username: user.user_metadata?.full_name ?? user.email ?? "Player",
    });

    const unsubGameStarted = eventBus.onRoom("GAME_STARTED", (payload) => {
      const gameId = (payload as { game_id?: string }).game_id;
      if (gameId) router.replace(`/(app)/game/${gameId}`);
    });

    const presenceUnsub = ch?.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const players: RoomPlayer[] = [];
      Object.entries(state).forEach(([, presences]) => {
        const p = Array.isArray(presences) ? presences[0] : presences;
        if (p?.userId) {
          players.push({
            id: p.userId,
            username: (p as { username?: string }).username ?? "Player",
          });
        }
      });
      setPlayers(players);
    });

    return () => {
      unsubGameStarted();
      presenceUnsub?.();
      eventBus.disconnect();
      channelRef.current = null;
    };
  }, [roomId, user?.id]);

  return { room, players: useRoomStore((s) => s.players) };
}
