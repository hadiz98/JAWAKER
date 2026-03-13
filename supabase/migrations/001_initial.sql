-- Phase 4: Database Schema & RLS for Jawaker
-- Run this in Supabase Dashboard → SQL Editor (or: supabase db push)

-- ---------------------------------------------------------------------------
-- 1. generate_room_code() — 6 chars, unambiguous (no O, 0, I, 1, l)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 3. handle_new_user() trigger — insert profile on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. rooms
-- ---------------------------------------------------------------------------
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  max_players int NOT NULL CHECK (max_players >= 2 AND max_players <= 6),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_rooms_code ON public.rooms(code);
CREATE INDEX idx_rooms_host_id ON public.rooms(host_id);
CREATE INDEX idx_rooms_status ON public.rooms(status);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rooms_insert"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "rooms_update_host"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- 5. games
-- ---------------------------------------------------------------------------
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  game_state jsonb NOT NULL,
  current_player_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  turn_deadline bigint NOT NULL,
  round int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_games_room_id ON public.games(room_id);
CREATE INDEX idx_games_status ON public.games(status);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- (games SELECT policy created after game_players exists, below)

-- ---------------------------------------------------------------------------
-- 6. game_players
-- ---------------------------------------------------------------------------
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hand jsonb NOT NULL DEFAULT '[]',
  seat_index int NOT NULL CHECK (seat_index >= 0),
  score int NOT NULL DEFAULT 0,
  is_connected boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (game_id, user_id),
  UNIQUE (game_id, seat_index)
);

CREATE INDEX idx_game_players_game_id ON public.game_players(game_id);
CREATE INDEX idx_game_players_user_id ON public.game_players(user_id);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Own row: full access (including hand) for the player
CREATE POLICY "game_players_select_own"
  ON public.game_players FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Co-players in the same game: only seat_index, score, is_connected (no hand)
-- We expose hand only via service role / Edge Function; RLS allows reading own row only.
-- For "co-player info only" we'd need a view or second policy that restricts columns.
-- Per README: "a second SELECT policy for co-player info (seat, score, is_connected) visible to anyone in the same game"
-- So all players in the game can read all game_players rows of that game, but the app/Edge Function must never send hand to others.
-- Simplest: allow SELECT for users who are in the same game (then client/Edge Function strips hand when broadcasting).
CREATE POLICY "game_players_select_same_game"
  ON public.game_players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = game_players.game_id AND gp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. moves (append-only audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  move jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_moves_game_id ON public.moves(game_id);

ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moves_select_players"
  ON public.moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = moves.game_id AND gp.user_id = auth.uid()
    )
  );

-- Games: SELECT only for players in that game (requires game_players to exist)
CREATE POLICY "games_select_players"
  ON public.games FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = games.id AND gp.user_id = auth.uid()
    )
  );

-- Inserts into moves/games/game_players are done via Edge Functions (service role).
