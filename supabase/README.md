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
