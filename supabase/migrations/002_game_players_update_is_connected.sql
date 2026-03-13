-- Allow each player to update their own is_connected flag (for disconnect/reconnect).
CREATE POLICY "game_players_update_own_connected"
  ON public.game_players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
