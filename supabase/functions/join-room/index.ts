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

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) {
    return new Response(
      JSON.stringify({ error: "Room code is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: room, error: fetchError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!room) {
    return new Response(
      JSON.stringify({ error: "Room not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (room.status !== "waiting") {
    return new Response(
      JSON.stringify({ error: "Room is not waiting for players" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(room), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
