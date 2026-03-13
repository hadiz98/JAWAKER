import { useEffect, useRef } from "react";
import { supabase } from "@/src/lib/supabase";
import { eventBus } from "@/src/engine/eventBus";
import { useGameStore } from "@/src/store/gameStore";
import { useAuth } from "@/src/hooks/useAuth";
import type { GameState } from "@/src/engine/types";

const FUNCTIONS_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "") + "/functions/v1";
const GRACE_PERIOD_MS = 60_000;

export function useGame(gameId: string | null) {
  const { user } = useAuth();
  const { setGame, syncFromServer, applyMoveOptimistic, rollbackMove, clear } = useGameStore();
  const channelRef = useRef<ReturnType<typeof eventBus.connectGame> | null>(null);
  const graceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!gameId || !user) return;

    let cancelled = false;

    async function load() {
      const { data: gameRow, error: gameErr } = await supabase
        .from("games")
        .select("game_state, current_player_id, turn_deadline, round, status")
        .eq("id", gameId)
        .single();

      if (gameErr || !gameRow || cancelled) return;

      const { data: myRow } = await supabase
        .from("game_players")
        .select("hand")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .single();

      const state = gameRow.game_state as GameState;
      const myHand = (myRow?.hand ?? []) as import("@/src/engine/types").Card[];
      setGame(gameId, state, myHand);
    }

    load();

    channelRef.current = eventBus.connectGame(gameId, user.id);
    eventBus.trackPresenceGame({ userId: user.id, status: "online" });

    const unsubLeave = eventBus.onPresenceLeave((leftUserId) => {
      if (leftUserId === user.id) return;
      if (graceTimersRef.current[leftUserId]) {
        clearTimeout(graceTimersRef.current[leftUserId]);
      }
      graceTimersRef.current[leftUserId] = setTimeout(async () => {
        delete graceTimersRef.current[leftUserId];
        if (cancelled) return;
        const s = useGameStore.getState().state;
        if (s?.status !== "active" || s.currentPlayerId !== leftUserId) return;
        const { data: session } = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) return;
        await fetch(`${FUNCTIONS_URL}/play-move`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ game_id: gameId, move: { type: "forfeit_turn" } }),
        });
      }, GRACE_PERIOD_MS);
    });

    const unsubJoin = eventBus.onPresenceJoin((joinedUserId) => {
      if (graceTimersRef.current[joinedUserId]) {
        clearTimeout(graceTimersRef.current[joinedUserId]);
        delete graceTimersRef.current[joinedUserId];
      }
    });

    const unsubMove = eventBus.onGame("MOVE_APPLIED", async (payload) => {
      const p = payload as { state?: GameState; winner?: string };
      if (!p.state) return;
      const { data: myRow } = await supabase
        .from("game_players")
        .select("hand")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .single();
      const myHand = (myRow?.hand ?? []) as import("@/src/engine/types").Card[];
      const stateWithWinner = p.winner ? { ...p.state, status: "finished" as const, winner: p.winner } : p.state;
      syncFromServer(stateWithWinner, myHand);
    });

    const unsubOver = eventBus.onGame("GAME_OVER", (payload) => {
      const p = payload as { winner?: string };
      const s = useGameStore.getState().state;
      if (s) useGameStore.setState({ state: { ...s, status: "finished", winner: p.winner } });
    });

    return () => {
      cancelled = true;
      Object.values(graceTimersRef.current).forEach(clearTimeout);
      graceTimersRef.current = {};
      unsubLeave();
      unsubJoin();
      unsubMove();
      unsubOver();
      eventBus.disconnect();
      channelRef.current = null;
      clear();
    };
  }, [gameId, user?.id]);

  async function playCard(card: import("@/src/engine/types").Card) {
    const move = { type: "play_card" as const, card };
    applyMoveOptimistic(move);

    const { data: session } = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      rollbackMove();
      return;
    }

    const res = await fetch(`${FUNCTIONS_URL}/play-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ game_id: useGameStore.getState().gameId, move }),
    });

    if (!res.ok) {
      rollbackMove();
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Move failed");
    }
  }

  return { playCard };
}
