import { create } from "zustand";

export interface RoomPlayer {
  id: string;
  username: string;
  avatar_url?: string | null;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  game_type: string;
  max_players: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface RoomState {
  room: Room | null;
  players: RoomPlayer[];
  setRoom: (room: Room | null) => void;
  setPlayers: (players: RoomPlayer[]) => void;
  clear: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: [],
  setRoom: (room) => set({ room }),
  setPlayers: (players) => set({ players }),
  clear: () => set({ room: null, players: [] }),
}));
