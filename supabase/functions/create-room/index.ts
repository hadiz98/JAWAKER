import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { game_type?: string; max_players?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const game_type = body.game_type ?? "template";
  const max_players = Math.min(6, Math.max(2, Number(body.max_players) ?? 4));

  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const { data: codeData, error: rpcError } = await supabase.rpc("generate_room_code");
    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "Failed to generate room code" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    code = codeData as string;

    const { data: existing } = await supabase.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    return new Response(
      JSON.stringify({ error: "Could not generate unique room code" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: room, error: insertError } = await supabase
    .from("rooms")
    .insert({
      code,
      host_id: user.id,
      game_type,
      max_players,
      status: "waiting",
    })
    .select()
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(room), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
