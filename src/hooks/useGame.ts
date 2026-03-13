import { useEffect, useRef } from "react";
import { supabase } from "@/src/lib/supabase";
import { eventBus } from "@/src/engine/eventBus";
import { useGameStore } from "@/src/store/gameStore";
import { useAuth } from "@/src/hooks/useAuth";
import type { GameState } from "@/src/engine/types";

const FUNCTIONS_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "") + "/functions/v1";
const GRACE_PERIOD_MS = 60_000;
const TURN_TIMEOUT_CHECK_MS = 2_000;

export function useGame(gameId: string | null) {
  const { user } = useAuth();
  const { setGame, setCoPlayers, syncFromServer, applyMoveOptimistic, rollbackMove, clear } = useGameStore();
  const channelRef = useRef<ReturnType<typeof eventBus.connectGame> | null>(null);
  const graceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastForfeitDeadlineRef = useRef<number>(0);

  useEffect(() => {
    const gid = gameId;
    const uid = user;
    if (!gid || !uid) return;

    let cancelled = false;

    async function load(gameIdStr: string, currentUser: NonNullable<typeof user>) {
      const { data: gameRow, error: gameErr } = await supabase
        .from("games")
        .select("game_state, current_player_id, turn_deadline, round, status")
        .eq("id", gameIdStr)
        .single();

      if (gameErr || !gameRow || cancelled) return;

      const { data: myRow } = await supabase
        .from("game_players")
        .select("hand")
        .eq("game_id", gameIdStr)
        .eq("user_id", currentUser.id)
        .single();

      const state = gameRow.game_state as GameState;
      const myHand = (myRow?.hand ?? []) as import("@/src/engine/types").Card[];
      setGame(gameIdStr, state, myHand);

      const { data: allPlayers } = await supabase
        .from("game_players")
        .select("user_id, seat_index, score, is_connected, hand")
        .eq("game_id", gameIdStr);
      if (!cancelled && allPlayers) {
        const co: Record<string, import("@/src/store/gameStore").CoPlayerInfo> = {};
        allPlayers.forEach((row: { user_id: string; seat_index: number; score: number; is_connected: boolean; hand: unknown[] }) => {
          if (row.user_id !== currentUser.id) {
            co[row.user_id] = {
              seatIndex: row.seat_index,
              score: row.score ?? 0,
              isConnected: row.is_connected ?? true,
              cardCount: Array.isArray(row.hand) ? row.hand.length : 0,
            };
          }
        });
        setCoPlayers(co);
      }
    }

    load(gid, uid);

    channelRef.current = eventBus.connectGame(gid, uid.id);
    eventBus.trackPresenceGame({ userId: uid.id, status: "online" });

    const channel = supabase
      .channel(`game_players:${gid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gid}` },
        (payload) => {
          if (cancelled) return;
          const n = payload.new as { user_id?: string; is_connected?: boolean };
          if (n?.user_id && n.user_id !== uid.id) {
            const prev = useGameStore.getState().coPlayers[n.user_id];
            if (prev)
              useGameStore.getState().setCoPlayers({
                ...useGameStore.getState().coPlayers,
                [n.user_id]: { ...prev, isConnected: n.is_connected ?? true },
              });
          }
        }
      )
      .subscribe();

    const unsubLeave = eventBus.onPresenceLeave((leftUserId) => {
      if (leftUserId === uid.id) return;
      if (graceTimersRef.current[leftUserId]) {
        clearTimeout(graceTimersRef.current[leftUserId]);
      }
      graceTimersRef.current[leftUserId] = setTimeout(async () => {
        delete graceTimersRef.current[leftUserId];
        if (cancelled) return;
        const s = useGameStore.getState().state;
        if (s?.status !== "active" || s.currentPlayerId !== leftUserId) return;
        const res = await supabase.auth.getSession();
        const token = (res as { data?: { session?: { access_token?: string } } })?.data?.session?.access_token;
        if (!token) return;
        await fetch(`${FUNCTIONS_URL}/play-move`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ game_id: gid, move: { type: "forfeit_turn" } }),
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
      const [{ data: myRow }, { data: allPlayers }] = await Promise.all([
        supabase.from("game_players").select("hand").eq("game_id", gid).eq("user_id", uid.id).single(),
        supabase.from("game_players").select("user_id, seat_index, score, is_connected, hand").eq("game_id", gid),
      ]);
      const myHand = (myRow?.hand ?? []) as import("@/src/engine/types").Card[];
      const stateWithWinner = p.winner ? { ...p.state, status: "finished" as const, winner: p.winner } : p.state;
      syncFromServer(stateWithWinner, myHand);
      if (!cancelled && allPlayers) {
        const co: Record<string, import("@/src/store/gameStore").CoPlayerInfo> = {};
        allPlayers.forEach((row: { user_id: string; seat_index: number; score: number; is_connected: boolean; hand: unknown[] }) => {
          if (row.user_id !== uid!.id) {
            co[row.user_id] = {
              seatIndex: row.seat_index,
              score: row.score ?? 0,
              isConnected: row.is_connected ?? true,
              cardCount: Array.isArray(row.hand) ? row.hand.length : 0,
            };
          }
        });
        setCoPlayers(co);
      }
    });

    const unsubOver = eventBus.onGame("GAME_OVER", (payload) => {
      const p = payload as { winner?: string };
      const s = useGameStore.getState().state;
      if (s) useGameStore.setState({ state: { ...s, status: "finished", winner: p.winner } });
    });

    async function maybeForfeitExpiredTurn() {
      if (cancelled) return;
      const s = useGameStore.getState().state;
      if (!s || s.status !== "active" || s.currentPlayerId !== uid!.id) return;
      if (Date.now() <= s.turnDeadline) return;
      if (lastForfeitDeadlineRef.current === s.turnDeadline) return;
      lastForfeitDeadlineRef.current = s.turnDeadline;
      const res = await supabase.auth.getSession();
      const token = (res as { data?: { session?: { access_token?: string } } })?.data?.session?.access_token;
      if (!token) return;
      await fetch(`${FUNCTIONS_URL}/play-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ game_id: gid, move: { type: "forfeit_turn" } }),
      });
    }

    const timeoutInterval = setInterval(maybeForfeitExpiredTurn, TURN_TIMEOUT_CHECK_MS);

    return () => {
      clearInterval(timeoutInterval);
      cancelled = true;
      supabase.removeChannel(channel);
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

    const { data } = await supabase.auth.getSession();
    const token = (data as { session?: { access_token?: string } } | null)?.session?.access_token;
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
