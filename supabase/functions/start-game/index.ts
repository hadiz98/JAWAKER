import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { gameRegistry } from "../_shared/registry.ts";
import "../_shared/games/index.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { room_id?: string; players?: { id: string; username: string; seatIndex: number }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const room_id = body.room_id;
  const players = body.players;
  if (!room_id || !Array.isArray(players) || players.length === 0) {
    return new Response(
      JSON.stringify({ error: "room_id and players array required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("id", room_id)
    .single();

  if (roomError || !room) {
    return new Response(
      JSON.stringify({ error: "Room not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (room.host_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Only the host can start the game" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (room.status !== "waiting") {
    return new Response(
      JSON.stringify({ error: "Room is not in waiting status" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const rules = gameRegistry.get(room.game_type);
  if (players.length < rules.minPlayers) {
    return new Response(
      JSON.stringify({ error: `At least ${rules.minPlayers} players required` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const playersForState = players.map((p, i) => ({
    id: p.id,
    username: p.username,
    seatIndex: i,
  }));

  const initialState = rules.getInitialState(playersForState);

  const { data: game, error: gameInsertError } = await supabaseAdmin
    .from("games")
    .insert({
      room_id,
      game_state: initialState,
      current_player_id: initialState.currentPlayerId,
      turn_deadline: initialState.turnDeadline,
      round: initialState.round,
      status: initialState.status,
    })
    .select()
    .single();

  if (gameInsertError) {
    return new Response(
      JSON.stringify({ error: gameInsertError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const gamePlayers = playersForState.map((p, i) => ({
    game_id: game.id,
    user_id: p.id,
    hand: initialState.hands[p.id] ?? [],
    seat_index: i,
    score: 0,
    is_connected: true,
  }));

  const { error: gpError } = await supabaseAdmin.from("game_players").insert(gamePlayers);
  if (gpError) {
    return new Response(
      JSON.stringify({ error: gpError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  await supabaseAdmin
    .from("rooms")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", room_id);

  const roomChannel = supabaseAdmin.channel(`room:${room_id}`);
  await roomChannel.httpSend("GAME_STARTED", { game_id: game.id }).catch(() => {});

  return new Response(
    JSON.stringify({ game_id: game.id, game }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }
  );
});
