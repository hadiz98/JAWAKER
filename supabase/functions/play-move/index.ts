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

  let body: { game_id?: string; move?: { type: string; card?: unknown; data?: unknown } };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const game_id = body.game_id;
  const move = body.move;
  if (!game_id || !move) {
    return new Response(
      JSON.stringify({ error: "game_id and move required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: gameRow, error: gameError } = await supabaseAdmin
    .from("games")
    .select("*, rooms!inner(game_type)")
    .eq("id", game_id)
    .single();

  if (gameError || !gameRow) {
    return new Response(
      JSON.stringify({ error: "Game not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (gameRow.status !== "active") {
    return new Response(
      JSON.stringify({ error: "Game is not active" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const gameType = (gameRow.rooms as { game_type?: string } | null)?.game_type ?? "template";
  const rules = gameRegistry.get(gameType);
  const state = gameRow.game_state as import("../_shared/types.ts").GameState;

  if (state.currentPlayerId !== user.id) {
    return new Response(
      JSON.stringify({ error: "Not your turn" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!rules.isValidMove(state, move as import("../_shared/types.ts").Move, user.id)) {
    return new Response(
      JSON.stringify({ error: "Invalid move" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const newState = rules.applyMove(state, move as import("../_shared/types.ts").Move);
  const winner = rules.getWinner(newState);

  const updatePayload: Record<string, unknown> = {
    game_state: newState,
    current_player_id: newState.currentPlayerId,
    turn_deadline: newState.turnDeadline,
    round: newState.round,
    status: newState.status,
    updated_at: new Date().toISOString(),
  };
  if (winner !== null) {
    updatePayload.status = "finished";
    updatePayload.winner_id = winner;
    updatePayload.finished_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("games")
    .update(updatePayload)
    .eq("id", game_id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  await supabaseAdmin.from("moves").insert({
    game_id,
    user_id: user.id,
    move,
  });

  // Broadcast MOVE_APPLIED so all clients sync (state without hands; clients refetch own hand)
  const stateForBroadcast = { ...newState, hands: {} };
  const channel = supabaseAdmin.channel(`game:${game_id}`);
  await channel.httpSend("MOVE_APPLIED", {
    move,
    state: stateForBroadcast,
    winner: winner ?? undefined,
  }).catch(() => {});

  if (winner !== null) {
    await channel.httpSend("GAME_OVER", { winner }).catch(() => {});
  }

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }
  );
});
