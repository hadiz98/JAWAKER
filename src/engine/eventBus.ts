import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";

type GameEvent = "MOVE_APPLIED" | "GAME_STARTED" | "GAME_OVER" | "PLAYER_DISCONNECTED" | "PLAYER_RECONNECTED";
type RoomEvent = "GAME_STARTED";

type EventPayload = Record<string, unknown>;

let gameChannel: RealtimeChannel | null = null;
let roomChannel: RealtimeChannel | null = null;

const gameHandlers = new Map<GameEvent, Set<(payload: EventPayload) => void>>();
const roomHandlers = new Map<RoomEvent, Set<(payload: EventPayload) => void>>();

function getGameHandlers(event: GameEvent): Set<(payload: EventPayload) => void> {
  if (!gameHandlers.has(event)) gameHandlers.set(event, new Set());
  return gameHandlers.get(event)!;
}

function getRoomHandlers(event: RoomEvent): Set<(payload: EventPayload) => void> {
  if (!roomHandlers.has(event)) roomHandlers.set(event, new Set());
  return roomHandlers.get(event)!;
}

export const eventBus = {
  connectGame(gameId: string, userId: string) {
    if (gameChannel) {
      supabase.removeChannel(gameChannel);
      gameChannel = null;
    }
    gameChannel = supabase.channel(`game:${gameId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });
    gameChannel
      .on("broadcast", { event: "MOVE_APPLIED" }, (m: { payload?: EventPayload }) => {
        getGameHandlers("MOVE_APPLIED").forEach((h) => h((m.payload ?? m) as EventPayload));
      })
      .on("broadcast", { event: "GAME_STARTED" }, (m: { payload?: EventPayload }) => {
        getGameHandlers("GAME_STARTED").forEach((h) => h((m.payload ?? m) as EventPayload));
      })
      .on("broadcast", { event: "GAME_OVER" }, (m: { payload?: EventPayload }) => {
        getGameHandlers("GAME_OVER").forEach((h) => h((m.payload ?? m) as EventPayload));
      });
    gameChannel.subscribe();
    return gameChannel;
  },

  connectRoom(roomId: string, userId: string) {
    if (roomChannel) {
      supabase.removeChannel(roomChannel);
      roomChannel = null;
    }
    roomChannel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });
    roomChannel.on("broadcast", { event: "GAME_STARTED" }, (m: { payload?: EventPayload }) => {
      getRoomHandlers("GAME_STARTED").forEach((h) => h((m.payload ?? m) as EventPayload));
    });
    roomChannel.subscribe();
    return roomChannel;
  },

  disconnect() {
    if (gameChannel) {
      supabase.removeChannel(gameChannel);
      gameChannel = null;
    }
    if (roomChannel) {
      supabase.removeChannel(roomChannel);
      roomChannel = null;
    }
  },

  onGame(event: GameEvent, handler: (payload: EventPayload) => void) {
    const set = getGameHandlers(event);
    set.add(handler);
    return () => set.delete(handler);
  },

  onRoom(event: RoomEvent, handler: (payload: EventPayload) => void) {
    const set = getRoomHandlers(event);
    set.add(handler);
    return () => set.delete(handler);
  },

  trackPresenceRoom(data: { userId: string; username?: string }) {
    roomChannel?.track(data);
  },

  trackPresenceGame(data: { userId: string; status?: string }) {
    gameChannel?.track(data);
  },
};
