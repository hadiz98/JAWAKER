# Supabase

## Run the migration

**Option A — Supabase Dashboard (recommended)**  
1. Open your project at [supabase.com](https://supabase.com) → SQL Editor.  
2. Copy the contents of `migrations/001_initial.sql`.  
3. Paste and run.  
4. In Table Editor, confirm: `profiles`, `rooms`, `games`, `game_players`, `moves`.  
5. Under Database → Triggers, confirm `on_auth_user_created`.  
6. Under Database → Functions, confirm `generate_room_code` and `handle_new_user`.

**Option B — Supabase CLI**  
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

After running the migration, new sign-ups (e.g. Google login) will get a row in `profiles` automatically.

---

## Deploy Edge Functions (remote)

Your project is already linked (`supabase link --project-ref ...`). From the **project root** (`Z:\jawaker`):

### 1. Set the service role secret

`start-game` and `play-move` need the **service_role** key (bypasses RLS). Get it from:

**Supabase Dashboard → Project Settings → API → Project API keys → `service_role` (secret).**

Then run (replace with your actual key):

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Or on Windows PowerShell, if the key contains special characters, use:

```powershell
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically to deployed functions; you only set `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Deploy all functions

From project root:

```bash
npx supabase functions deploy create-room
npx supabase functions deploy join-room
npx supabase functions deploy start-game
npx supabase functions deploy play-move
```

Or deploy everything in `supabase/functions/` at once:

```bash
npx supabase functions deploy
```

### 3. Verify

- **Dashboard → Edge Functions** — you should see `create-room`, `join-room`, `start-game`, `play-move`.
- Call an function with a valid JWT in the `Authorization` header to test (e.g. from your app or Postman).
