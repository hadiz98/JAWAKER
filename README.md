# Multiplayer Card Game Engine
### React Native + Supabase — Cursor Implementation Guide

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Folder Structure](#4-folder-structure)
5. [Database Schema Design](#5-database-schema-design)
6. [Phase 1 — Project Setup](#phase-1--project-setup)
7. [Phase 2 — Supabase Configuration](#phase-2--supabase-configuration)
8. [Phase 3 — Google Auth](#phase-3--google-auth)
9. [Phase 4 — Database Schema & RLS](#phase-4--database-schema--rls)
10. [Phase 5 — Core Engine Layer](#phase-5--core-engine-layer)
11. [Phase 6 — Game Plugin System](#phase-6--game-plugin-system)
12. [Phase 7 — Edge Functions](#phase-7--edge-functions)
13. [Phase 8 — Realtime Layer](#phase-8--realtime-layer)
14. [Phase 9 — State Management](#phase-9--state-management)
15. [Phase 10 — Screens & Navigation](#phase-10--screens--navigation)
16. [Phase 11 — Game UI Components](#phase-11--game-ui-components)
17. [Phase 12 — First Game Plugin](#phase-12--first-game-plugin)
18. [Phase 13 — Disconnect & Edge Cases](#phase-13--disconnect--edge-cases)
19. [Adding a New Game Checklist](#adding-a-new-game-checklist)
20. [Realtime Event Reference](#realtime-event-reference)
21. [Common Pitfalls](#common-pitfalls)

---

## 1. Project Overview

A generic real-time multiplayer card game platform. The infrastructure (rooms, auth, realtime, turn management) is built once and shared. Each card game is a plugin that implements a single rules interface — the engine handles everything else.

**What the engine provides (built once):**
- Google OAuth login
- Create and join game rooms with a shareable 6-character code
- Real-time card play with optimistic UI
- Server-side move validation via Edge Functions
- Turn timers synced across all clients
- Disconnect detection and auto-forfeit

**What each game plugin provides (per game):**
- Which moves are valid
- How to apply a move to the game state
- How to detect a winner
- How to calculate scores
- How to set up a new round

---

## 2. Architecture

### Layers

```
React Native App (Expo)
        ↕  WebSocket + REST
Supabase Realtime  ←→  PostgreSQL
        ↕
   Edge Functions
        ↕
  IGameRules Plugin
```

### How a move flows through the system

1. Player taps a card on their device
2. Client immediately removes the card from hand (optimistic update)
3. Client calls the `play-move` Edge Function
4. Edge Function loads the game state from the database
5. Edge Function asks the game plugin: is this move valid?
6. If invalid → return error → client puts the card back
7. If valid → apply move → save new state to database
8. Edge Function broadcasts `MOVE_APPLIED` event to all players in the room
9. All clients receive the event and sync their UI to the canonical state

### Why this separation matters

The Edge Function is the single source of truth. Clients never trust each other. The game plugin is just a pure logic module — no network calls, no database access. This makes rules easy to test and easy to swap.

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile framework | React Native with Expo (SDK 51+) | Cross-platform iOS + Android |
| Navigation | Expo Router (file-based) | Clean screen routing with auth guards |
| State management | Zustand | Lightweight, no boilerplate |
| Backend & database | Supabase | Realtime, Auth, PostgreSQL, Edge Functions in one |
| Realtime | Supabase Realtime — Broadcast + Presence | WebSocket channels per game room |
| Server logic | Supabase Edge Functions (Deno + TypeScript) | Authoritative move validation |
| Auth | Supabase Auth with Google OAuth provider | One-tap login |
| Animations | React Native Reanimated 3 | Card animations, turn timer |
| Styling | NativeWind (Tailwind for React Native) | Fast consistent styling |
| Language | TypeScript throughout | Type safety across client + server |

---

## 4. Folder Structure

```
/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   └── login.tsx             # Google login screen
│   ├── (app)/
│   │   ├── _layout.tsx           # Auth guard — redirects to login if no session
│   │   ├── home.tsx              # Lobby — create or join a game
│   │   ├── room/
│   │   │   ├── create.tsx        # Pick game type, set max players
│   │   │   ├── join.tsx          # Enter 6-character room code
│   │   │   └── [code].tsx        # Waiting room — shows who has joined
│   │   └── game/
│   │       └── [id].tsx          # Active game screen
│   └── _layout.tsx
│
├── src/
│   ├── engine/                   # Built once — never touched again
│   │   ├── types.ts              # IGameRules interface, GameState, Move, Card, Player
│   │   ├── registry.ts           # Register and retrieve game plugins by name
│   │   ├── dealer.ts             # Build deck, shuffle, deal hands
│   │   └── turnManager.ts        # Turn order, deadline calculation
│   │
│   ├── games/                    # One file per card game
│   │   ├── _template.ts          # Starter file — copy this for each new game
│   │   ├── trix.ts               # Example: Trix rules
│   │   └── baloot.ts             # Example: Baloot rules
│   │
│   ├── store/
│   │   ├── authStore.ts          # Current user session
│   │   ├── roomStore.ts          # Room state, players in lobby
│   │   └── gameStore.ts          # Game state, my hand, pending moves
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            # Session + user from Supabase Auth
│   │   ├── useRoom.ts            # Room subscription and lobby presence
│   │   └── useGame.ts            # Main game hook — realtime wiring + playCard action
│   │
│   ├── components/
│   │   ├── Card.tsx              # Single card — face up or face down, animated
│   │   ├── Hand.tsx              # Row of cards the current player holds
│   │   ├── Table.tsx             # Center of the table — played cards this trick
│   │   ├── PlayerSeat.tsx        # Opponent seat — shows card count, name, turn indicator
│   │   ├── TurnTimer.tsx         # Countdown ring — turns red at 10 seconds
│   │   └── RoomCode.tsx          # Displays the 6-char code with a copy button
│   │
│   └── lib/
│       ├── supabase.ts           # Supabase client singleton with secure storage
│       └── constants.ts          # Turn timeout, max players, game type names
│
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── types.ts          # Shared types used across all functions
│   │   │   ├── registry.ts       # Same registry as client — registers all game plugins
│   │   │   └── games/            # Same game plugin files — shared between client and server
│   │   ├── create-room/
│   │   ├── join-room/
│   │   ├── start-game/
│   │   └── play-move/            # Core handler — validates and applies every move
│   │
│   └── migrations/
│       └── 001_initial.sql
│
└── README.md
```

---

## 5. Database Schema Design

### Tables

**profiles**
Extends Supabase's built-in `auth.users`. Stores display name and avatar. Created automatically via a database trigger when a user signs up.

**rooms**
Represents a game lobby. Has a unique 6-character join code. Status moves from `waiting` → `active` → `finished`. Tracks the host, game type, and max player count.

**games**
One row per active or completed game session. Stores the entire serialized game state as a JSONB column. Also tracks whose turn it is and when the turn expires.

**game_players**
Join table between a game and its players. Each row stores one player's hand (as JSONB), their seat index, score, and connection status.

**moves**
Append-only log of every move made. Used for debugging, replay, and auditing. Never updated — only inserted.

### Row Level Security rules

- `profiles` — anyone authenticated can read, only the owner can update their own
- `rooms` — any authenticated user can read and create, only the host can update
- `games` — only players who are in the game can read it
- `game_players` — a player can only read their own hand; all players in the game can read the public seat info (score, seat index, connection status) of their co-players
- `moves` — readable only by players in that game

### Important constraints

- A player's hand in `game_players` must never be sent to other players via RLS or broadcast
- The `game_state` column in `games` contains all hands — the Edge Function strips other players' hands before broadcasting
- The room code must be unique — generate and retry if collision occurs

---

## Phase 1 — Project Setup

### Step 1.1 — Create the Expo project

- Scaffold a new Expo project using the Expo Router template
- Choose TypeScript when prompted
- Test that the default app runs on your simulator or device

### Step 1.2 — Install core dependencies

Install the following packages:
- `@supabase/supabase-js` — Supabase client
- `expo-secure-store` — encrypted token storage on device
- `expo-auth-session` — handles OAuth redirect flow
- `expo-web-browser` — opens browser for Google login
- `zustand` — state management
- `react-native-reanimated` — animations
- `nativewind` + `tailwindcss` — styling

### Step 1.3 — Configure NativeWind

- Create `tailwind.config.js` at project root pointing to your app and src files
- Add the NativeWind Babel plugin to `babel.config.js`
- Add NativeWind types to `tsconfig.json`
- Test that a Tailwind class applies correctly on a component

### Step 1.4 — Set up environment variables

- Create `.env.local` at project root
- Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as placeholders for now
- Add `.env.local` to `.gitignore` immediately

---

## Phase 2 — Supabase Configuration

### Step 2.1 — Create Supabase project

- Go to supabase.com and create a new project
- Choose a region close to your target users
- Save the database password somewhere safe
- Wait for the project to finish provisioning (~2 minutes)

### Step 2.2 — Get project credentials

- Go to Settings → API in your Supabase dashboard
- Copy the Project URL and the `anon` public key
- Paste them into your `.env.local`

### Step 2.3 — Create the Supabase client singleton

- Create `src/lib/supabase.ts`
- Initialize the Supabase client with URL and anon key from environment variables
- Use `expo-secure-store` as the auth storage adapter — not AsyncStorage, which is unencrypted
- Add an `AppState` listener to pause token auto-refresh when the app backgrounds and resume when it foregrounds

### Step 2.4 — Install and configure Supabase CLI

- Install the Supabase CLI globally
- Run `supabase login`
- Inside your project folder, run `supabase init` to create the `supabase/` folder
- Run `supabase link --project-ref YOUR_REF` to connect to your remote project
- Your project ref is the string in your Supabase dashboard URL

---

## Phase 3 — Google Auth

### Step 3.1 — Create Google OAuth credentials

- Go to console.cloud.google.com
- Create a new project
- Enable the Google Identity API under APIs & Services → Library
- Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
- Choose "Web application" as the application type
- Under Authorized Redirect URIs, add: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- Save the Client ID and Client Secret

### Step 3.2 — Enable Google provider in Supabase

- Go to Supabase Dashboard → Authentication → Providers → Google
- Toggle the provider on
- Paste in the Client ID and Client Secret from Google Cloud Console
- Save the configuration

### Step 3.3 — Add redirect URLs in Supabase

- Go to Supabase Dashboard → Authentication → URL Configuration
- Add your development redirect: `exp://localhost:8081`
- Add your production custom scheme when ready (e.g. `yourapp://`)
- These same URLs must also be listed in Google Cloud Console under Authorized Redirect URIs

### Step 3.4 — Create the login screen

- Create `app/(auth)/login.tsx`
- Show the app name, a tagline, and a "Continue with Google" button
- On button press, call `supabase.auth.signInWithOAuth` with `provider: 'google'` and `skipBrowserRedirect: true`
- Open the returned URL with `expo-web-browser`'s `openAuthSessionAsync`
- On success, extract the authorization code from the redirect URL and exchange it for a session using `supabase.auth.exchangeCodeForSession`
- Show a loading indicator while the browser session is in progress

### Step 3.5 — Create the auth hook

- Create `src/hooks/useAuth.ts`
- On mount, call `supabase.auth.getSession()` to restore any saved session
- Subscribe to `supabase.auth.onAuthStateChange` to respond to login and logout events
- Return `{ session, user, loading }` for components to consume

### Step 3.6 — Create the auth guard layout

- Create `app/(app)/_layout.tsx`
- Call `useAuth()` to check the current session
- While `loading` is true, render nothing or a splash screen
- If there is no session, use `<Redirect href="/(auth)/login" />`
- If a session exists, render the child Stack navigator
- Every screen inside `app/(app)/` is now automatically protected

### Step 3.7 — Handle sign out

- Add a sign out button somewhere in the app (home screen header or settings)
- On press, call `supabase.auth.signOut()`
- The `onAuthStateChange` subscription will fire, update the store, and the auth guard will redirect to login automatically

---

## Phase 4 — Database Schema & RLS

### Step 4.1 — Write the migration file

- Create `supabase/migrations/001_initial.sql`
- Define tables in dependency order: `profiles` first (references `auth.users`), then `rooms`, then `games`, then `game_players`, then `moves`
- For each table, include all columns with appropriate types, defaults, and foreign key constraints
- Write a SQL function `generate_room_code()` that returns a random 6-character string using only unambiguous characters (no O, 0, I, 1, l)
- Write a trigger function `handle_new_user()` that inserts a row into `profiles` whenever a row is inserted into `auth.users`
- Attach the trigger to `after insert on auth.users`

### Step 4.2 — Enable RLS on all tables

- After each table definition, add `ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY`
- Do this for all five tables — without it any authenticated user can read and write everything

### Step 4.3 — Write RLS policies

Write policies for each table:

- `profiles`: one SELECT policy allowing any authenticated user to read; one UPDATE policy allowing only `auth.uid() = id`
- `rooms`: SELECT for any authenticated user; INSERT requiring `auth.uid() = host_id`; UPDATE for the host only
- `games`: SELECT only for users who have a row in `game_players` for that game id
- `game_players` SELECT for own row using `user_id = auth.uid()`; a second SELECT policy for co-player info (seat, score, is_connected) visible to anyone in the same game
- `moves`: SELECT for players in that game

### Step 4.4 — Run the migration

- Open the Supabase SQL Editor
- Paste the full migration file and run it
- Verify all five tables appear in the Table Editor
- Verify the trigger exists under Database → Triggers
- Verify the `generate_room_code` function exists under Database → Functions

### Step 4.5 — Test RLS

- Sign up a test user via Google login in your app
- Verify a `profiles` row was automatically created
- In the SQL Editor, try querying `game_players` while impersonating the anon role — should return 0 rows
- Confirm the trigger fires correctly by checking that the profile row contains the user's Google display name and avatar

---

## Phase 5 — Core Engine Layer

### Step 5.1 — Define all core types

Create `src/engine/types.ts` and define:

- `Suit` — union type of the four suits
- `Rank` — union type from Ace through King
- `Card` — object with `suit`, `rank`, and a unique `id` string (e.g. `"spades_A"`)
- `Player` — object with `id`, `username`, and `seatIndex`
- `Move` — object with a `type` string discriminator, an optional `card`, and optional `data` for game-specific payloads
- `GameState` — object with `players`, `hands` (map of userId to Card array), `publicState` (open-ended object for game-specific data), `currentPlayerId`, `turnDeadline` (unix milliseconds), `round`, `status`, and optional `winner`
- `IGameRules` — the interface described in the next step

### Step 5.2 — Define the IGameRules interface

Add `IGameRules` to `types.ts`. It must declare:

**Readonly properties:**
- `gameType` — unique string key like `'trix'` or `'baloot'`
- `minPlayers` and `maxPlayers` — integers
- `turnTimeoutSeconds` — integer

**Methods:**
- `getInitialState(players: Player[]): GameState`
- `isValidMove(state: GameState, move: Move, playerId: string): boolean`
- `getValidMoves(state: GameState, playerId: string): Move[]`
- `applyMove(state: GameState, move: Move): GameState`
- `getWinner(state: GameState): string | null`
- `calculateScore(state: GameState): Record<string, number>`
- `onRoundEnd(state: GameState): GameState`

### Step 5.3 — Create the game registry

Create `src/engine/registry.ts`:
- Define a class with a private `Map<string, IGameRules>` property
- `register(rules: IGameRules)` — stores the rules object keyed by `rules.gameType`
- `get(gameType: string): IGameRules` — retrieves by key, throws a descriptive error if not found
- `list(): string[]` — returns all registered game type keys
- Export a single shared instance of this class

### Step 5.4 — Create the dealer utility

Create `src/engine/dealer.ts` with three pure functions:
- `buildDeck(suits?, ranks?)` — constructs a full deck of Card objects; suits and ranks are optional parameters with standard defaults, so games using partial decks can override them
- `shuffle<T>(array: T[]): T[]` — implements Fisher-Yates; returns a new array and does not mutate the input
- `deal(deck: Card[], numPlayers: number): Card[][]` — distributes cards round-robin into N arrays and returns them

### Step 5.5 — Create the turn manager utility

Create `src/engine/turnManager.ts` with:
- `nextPlayerIndex(currentIndex: number, totalPlayers: number): number` — increments with wraparound
- `calculateDeadline(timeoutSeconds: number): number` — returns `Date.now() + timeoutSeconds * 1000`
- `isExpired(deadline: number): boolean` — returns `Date.now() > deadline`

---

## Phase 6 — Game Plugin System

### Step 6.1 — Create the plugin template file

Create `src/games/_template.ts`:
- Implement all methods of `IGameRules` with clearly marked `// TODO:` sections for the game-specific logic
- Include working implementations of the boilerplate parts: removing a played card from hand, calling `nextPlayerIndex`, calling `calculateDeadline`
- At the bottom, register the instance: `gameRegistry.register(new TemplateGameRules())`
- Add a comment at the top: "Copy this file to add a new game. Fill in the TODO sections."

### Step 6.2 — Create a central games index file

Create `src/games/index.ts`:
- Import each game plugin file (just the import — the registration happens inside each file)
- This single import ensures all plugins are registered before anything reads from the registry

### Step 6.3 — Mirror game files for Edge Functions

- The `supabase/functions/_shared/` directory needs the same `types.ts`, `registry.ts`, and game plugin files
- Create `supabase/functions/_shared/games/index.ts` that imports all the same game plugins
- The easiest approach is to keep the files in sync manually or use a build script to copy them
- Each Edge Function imports from `_shared/` at the top of its file to ensure all plugins are registered

---

## Phase 7 — Edge Functions

### Step 7.1 — create-room function

Create `supabase/functions/create-room/index.ts`.

This function must:
1. Extract and verify the user's JWT from the `Authorization` header
2. Read `game_type` and `max_players` from the request body
3. Call `generate_room_code()` via Supabase RPC
4. Query the `rooms` table to check the code is not already in use — if it is, generate a new one and repeat
5. Insert a new row into `rooms` with the code, game type, max players, and the user's id as host
6. Return the created room object

### Step 7.2 — join-room function

Create `supabase/functions/join-room/index.ts`.

This function must:
1. Verify the user's JWT
2. Read the `code` string from the request body and uppercase it
3. Query `rooms` for a row matching that code
4. Return 404 if no room is found
5. Return 409 Conflict if the room status is not `waiting`
6. Return the room object on success — the client will use this to subscribe to the room's presence channel

### Step 7.3 — start-game function

Create `supabase/functions/start-game/index.ts`.

This function must:
1. Verify the user's JWT and confirm they are the host of the given room
2. Load the list of players who have joined (tracked via Realtime presence or a `room_members` table)
3. Verify the player count meets `rules.minPlayers`
4. Call `rules.getInitialState(players)` to build the initial game state
5. Insert a row into `games` with the full state, current player, and turn deadline
6. Insert a row into `game_players` for each player — include their hand from the initial state
7. Update the room's `status` to `active`
8. For each player, send a targeted `GAME_STARTED` broadcast containing only that player's hand plus the public state — never broadcast all hands to all players

### Step 7.4 — play-move function

Create `supabase/functions/play-move/index.ts`. This is the most important function.

This function must:
1. Verify the user's JWT
2. Read `game_id` and `move` from the request body
3. Load the game row including its `game_state`
4. Return 404 if the game does not exist
5. Return 409 if `game.status` is not `active`
6. Return 400 if `state.currentPlayerId` does not match the requesting user's id
7. Call `rules.isValidMove(state, move, user.id)` — return 400 with a clear message if false
8. Call `rules.applyMove(state, move)` to produce the new state
9. Call `rules.getWinner(newState)` — if a winner is found, set the status to `finished` and record `finished_at`
10. Update the `games` row atomically with the new state, current player id, and turn deadline
11. Insert a row into `moves` for the audit log
12. Build the broadcast payload — include the move and the new state, but strip all hands from the state except the receiving player's own hand
13. Broadcast `MOVE_APPLIED` to the `game:{gameId}` channel
14. Return `{ ok: true }`

### Step 7.5 — Deploy all functions

- Run `supabase functions deploy <function-name>` for each function
- Set any required environment secrets using `supabase secrets set KEY=value`
- Test each function using a REST client with a valid JWT in the Authorization header before wiring them to the app

---

## Phase 8 — Realtime Layer

### Step 8.1 — Plan the channel structure

- One channel per game, named `game:{gameId}`
- Configure with `broadcast: { self: true }` so the move sender also receives their own `MOVE_APPLIED` event and syncs state
- Configure with `presence: { key: userId }` so the client's connection status is visible to others
- Subscribe when the game screen mounts, unsubscribe on unmount

### Step 8.2 — Create the event bus wrapper

Create `src/engine/eventBus.ts`:
- Wraps the Supabase channel with typed methods
- Exposes: `connect(gameId)`, `disconnect()`, `on(eventName, handler)`, `trackPresence(data)`
- Components and hooks interact only with this wrapper — never with the Supabase channel directly
- This makes it easy to mock in tests and swap the transport later if needed

### Step 8.3 — Create the room hook

Create `src/hooks/useRoom.ts`:
- Subscribes to a room-level channel (named `room:{roomId}`) for the waiting room
- Tracks presence to show who has joined
- Listens for a `GAME_STARTED` event to navigate all players to the game screen simultaneously
- Unsubscribes when leaving the waiting room

### Step 8.4 — Create the main game hook

Create `src/hooks/useGame.ts`:
- On mount, fetch the current game state from the database (handles rejoins)
- Subscribe to the game channel via the event bus
- On `MOVE_APPLIED` broadcast: call `gameStore.syncFromServer` with the new state and the player's updated hand
- On `GAME_OVER` broadcast: show a results modal
- On `PLAYER_DISCONNECTED`: update the store so `PlayerSeat` shows a disconnected indicator
- Expose a `playCard(card)` function that: calls `gameStore.applyMoveOptimistic`, invokes the `play-move` Edge Function, and calls `gameStore.rollbackMove` on error
- Unsubscribe on unmount

### Step 8.5 — Presence tracking

- In `useRoom` and `useGame`, call `channel.track({ userId, status: 'online' })` after subscribing
- Listen to the presence `leave` event to start a 60-second grace period timer
- Listen to the presence `join` event to cancel an active timer and mark the player as reconnected
- After the grace period expires, trigger the forfeit logic

---

## Phase 9 — State Management

### Step 9.1 — Auth store

Create `src/store/authStore.ts`:
- Stores `session` (Supabase Session object) and `user` (Supabase User object)
- Populated by the `useAuth` hook on app start and on every auth state change
- Other stores and hooks read the current user from here

### Step 9.2 — Room store

Create `src/store/roomStore.ts`:
- Stores the current room object (id, code, game type, status, host id)
- Stores `players` — an array of profiles for everyone currently in the lobby
- Updated when presence events arrive in `useRoom`
- Has a `clear()` action that resets everything when the user leaves a room

### Step 9.3 — Game store

Create `src/store/gameStore.ts` with the following state and actions:

State:
- `gameId` — string or null
- `state` — the current `GameState` from the server, or null
- `myHand` — the current player's Card array
- `pendingMove` — the Move that was sent optimistically but not yet confirmed, or null

Actions:
- `setGame(gameId, state, hand)` — initialize the store when the game starts or on rejoin
- `applyMoveOptimistic(move)` — immediately update `myHand` to remove the played card; store the move as `pendingMove`
- `rollbackMove()` — restore the card removed by the optimistic update; clear `pendingMove`
- `syncFromServer(state, hand)` — replace the full state and hand with the server's version; clear `pendingMove`
- `clear()` — reset everything when leaving a game

### Step 9.4 — Derived selectors

Add these as selector functions (either inside the store or as standalone utils):
- `isMyTurn(state, userId)` — true if `state.currentPlayerId === userId`
- `getOpponents(state, myUserId)` — returns players sorted by seat, excluding the current user
- `getTimeRemaining(deadline)` — returns seconds remaining from the unix ms deadline, clamped to zero

---

## Phase 10 — Screens & Navigation

### Step 10.1 — Root layout

Create `app/_layout.tsx`:
- Set up the root Stack navigator with `screenOptions={{ headerShown: false }}`
- This wraps everything including the login screen — no auth logic here

### Step 10.2 — Home screen

Create `app/(app)/home.tsx`:
- Display the signed-in user's avatar and display name
- Two primary action buttons: "Create Game" and "Join Game"
- Sign out button in the top-right corner
- Navigate to `/(app)/room/create` or `/(app)/room/join` on button press

### Step 10.3 — Create room screen

Create `app/(app)/room/create.tsx`:
- Display a list of available game types retrieved from `gameRegistry.list()`
- Show the min/max player count for the selected game type
- A player count selector (slider or stepper) within the allowed range
- A "Create Room" button that calls the `create-room` Edge Function
- On success, navigate to `/(app)/room/[code]`

### Step 10.4 — Join room screen

Create `app/(app)/room/join.tsx`:
- A single large text input for the 6-character room code
- Set `autoCapitalize="characters"` and `autoCorrect={false}` on the input
- A "Join" button that calls the `join-room` Edge Function
- Show an error message if the room is not found or already started
- On success, navigate to `/(app)/room/[code]`

### Step 10.5 — Waiting room screen

Create `app/(app)/room/[code].tsx`:
- Display the room code using the `RoomCode` component
- Show a list of player avatars and names as they join (driven by presence events in `useRoom`)
- Show a player count like "3 / 4 players"
- If the current user is the host, show a "Start Game" button — disabled until `minPlayers` are present
- When `GAME_STARTED` is received, navigate all players to `/(app)/game/[id]`
- Show a "Leave Room" option

### Step 10.6 — Game screen

Create `app/(app)/game/[id].tsx`:
- On mount, call the `setGame` action to initialize the store, then subscribe via `useGame`
- Render `TurnTimer`, `Table`, the opponent `PlayerSeat` components, and the current player's `Hand`
- Listen for `GAME_OVER` and show a results modal with final scores and a "Play Again" option
- Handle the back button — show a confirmation dialog before forfeiting

---

## Phase 11 — Game UI Components

### Step 11.1 — Card component

Create `src/components/Card.tsx`:
- Props: `card`, `faceDown`, `onPress`, `disabled`, `selected`
- Render the card face (suit symbol + rank) or a card back pattern when `faceDown` is true
- When `selected` is true, animate the card 8px upward using Reanimated's `withSpring`
- When `disabled` is true, reduce opacity and ignore press events
- Tap the card to call `onPress` — the parent (`Hand`) decides whether to select or play it

### Step 11.2 — Hand component

Create `src/components/Hand.tsx`:
- Receive the array of cards to display
- Fan the cards horizontally with overlap; the overlap increases as card count increases
- Call `rules.getValidMoves(state, userId)` client-side to determine which cards are playable — dim the unplayable ones
- On card press, if it is the player's turn, call `playCard(card)` from `useGame`
- Animate cards sliding out when played

### Step 11.3 — Table component

Create `src/components/Table.tsx`:
- Render the cards currently on the table (the current trick or discard)
- Position each card based on the seat of the player who played it — this makes it visually clear who played what
- Animate a card flying from the edge of the screen (player's hand position) to the center when a `MOVE_APPLIED` event arrives

### Step 11.4 — PlayerSeat component

Create `src/components/PlayerSeat.tsx`:
- Props: `player`, `cardCount`, `score`, `isCurrentTurn`, `isConnected`
- Show the player's avatar, username, and score
- Show a stack of face-down cards representing their hand size
- Show a turn indicator ring (highlighted) when `isCurrentTurn` is true
- Show a disconnected icon when `isConnected` is false
- Position is determined by the parent game screen based on seat index relative to the current player

### Step 11.5 — TurnTimer component

Create `src/components/TurnTimer.tsx`:
- Receive `deadline` (unix ms) and `totalSeconds`
- Recalculate remaining time every 500ms using `setInterval`
- Display as a circular progress ring that depletes over time
- When under 10 seconds, switch to red color and add a subtle pulse animation
- When it is not the current player's turn, render at reduced opacity

### Step 11.6 — RoomCode component

Create `src/components/RoomCode.tsx`:
- Display the code as large spaced characters (use letter-spacing)
- Show a copy icon button next to it
- On press, copy the code to the clipboard using Expo Clipboard and show a brief "Copied!" confirmation
- Optionally show a share button that opens the native share sheet with the code

---

## Phase 12 — First Game Plugin

### Step 12.1 — Copy the template

- Duplicate `src/games/_template.ts` to `src/games/mygame.ts` (use your actual game name)
- Change `gameType` to a unique lowercase string
- Set `minPlayers`, `maxPlayers`, and `turnTimeoutSeconds` to the correct values for your game
- Update the class name

### Step 12.2 — Implement getInitialState

- Call `buildDeck()` — pass custom suits or ranks if the game uses a non-standard deck
- Call `shuffle()` on the deck
- Call `deal()` to split into N hands
- Build the `GameState` object:
  - Set `players` from the parameter
  - Set `hands` as a map of each player's id to their dealt cards
  - Set `publicState` with all game-specific initial values (trump suit, bids, current trick, etc.)
  - Set `currentPlayerId` to the first player (apply your game's rule for who goes first)
  - Set `turnDeadline` using `calculateDeadline(this.turnTimeoutSeconds)`
  - Set `round` to 1 and `status` to `'active'`

### Step 12.3 — Implement isValidMove

- Return false immediately if `state.currentPlayerId !== playerId`
- Return false if the card is not in the player's hand
- Add your game's specific rules — must follow suit, lead restrictions, trump rules, etc.
- Keep this function pure — no side effects, no mutations

### Step 12.4 — Implement applyMove

- Create a copy of the state — never mutate the input
- Remove the played card from the player's hand copy
- Add the card to the appropriate place in `publicState` (current trick, discard pile, etc.)
- Advance the turn: use `nextPlayerIndex` and `calculateDeadline`
- If the trick is complete (all players have played), resolve the trick: determine the winner, update scores, clear the trick, and set the next leader as current player
- Return the full new state

### Step 12.5 — Implement getWinner

- Check your game's win condition (target score reached, all cards played, etc.)
- Return the userId of the winner as a string, or `null` if the game is still ongoing

### Step 12.6 — Implement calculateScore

- Compute the current score for each player based on the game state
- Return a plain object mapping each userId to their integer score

### Step 12.7 — Implement onRoundEnd

- Reset trick-related state
- Deal new hands for the next round (re-shuffle and re-deal, or use the remaining deck)
- Increment the round counter
- Determine who leads the next round per your game's rules
- Set a new `turnDeadline`
- Return the updated state

### Step 12.8 — Register and test

- At the bottom of the file, call `gameRegistry.register(new MyGameRules())`
- Import the file in `src/games/index.ts`
- Import the file in `supabase/functions/_shared/games/index.ts`
- Verify the game appears in the create-room screen dropdown
- Create a game, start it, and verify the initial state is correct (check player hands in the database)
- Play a card and verify the state updates correctly

---

## Phase 13 — Disconnect & Edge Cases

### Step 13.1 — Detect app backgrounding

- In the game screen, add a React Native `AppState` event listener
- When the app transitions to `background` or `inactive`, update `is_connected = false` in `game_players` for the current user
- When the app returns to `active`, update `is_connected = true`
- Other clients receive a `PLAYER_DISCONNECTED` or `PLAYER_RECONNECTED` broadcast (sent by the Edge Function via a database webhook or the client itself)

### Step 13.2 — Implement the grace period timer

- In `useGame`, listen to the presence `leave` event on the game channel
- Start a 60-second countdown when another player leaves
- If a presence `join` arrives for that same user within 60 seconds, cancel the timer
- If the timer expires, call the `play-move` Edge Function with `move.type = 'forfeit_turn'` to skip that player's turn
- The Edge Function handles `forfeit_turn` the same as any other move: it advances the turn and broadcasts

### Step 13.3 — Add a turn timeout safety net via pg_cron

- Enable the pg_cron extension in Supabase Dashboard → Database → Extensions
- Write a SQL function that: queries for games where `status = 'active'` and `turn_deadline < now()`, and for each such game calls the `play-move` Edge Function with `forfeit_turn` using pg_net
- Schedule this function to run every 30 seconds using `cron.schedule`
- This catches cases where all clients disconnect and no client is alive to trigger the grace period logic

### Step 13.4 — Implement the rejoin flow

- When `useGame` mounts for a game that already has `status = 'active'`, fetch the game row from the database
- Load the state and the player's hand from `game_players` into the store
- Resubscribe to the game channel
- The other players' clients receive the presence `join` event and cancel any disconnect timers for this player

### Step 13.5 — Handle permanent abandonment

- If a player never reconnects after the grace period, their turn is forfeited automatically
- Decide per game whether to continue (remaining players play on) or end the game
- If ending the game, update `games.status` to `finished` and broadcast `GAME_OVER` with a reason of `player_abandoned`

---

## Adding a New Game Checklist

Use this for every new card game added to the platform:

- [ ] Copy `src/games/_template.ts` and rename it
- [ ] Set `gameType`, `minPlayers`, `maxPlayers`, `turnTimeoutSeconds`
- [ ] Implement `getInitialState` — shuffle, deal, build initial public state
- [ ] Implement `isValidMove` — turn check, hand check, game rules
- [ ] Implement `applyMove` — remove card, update public state, advance turn, resolve trick if complete
- [ ] Implement `getWinner` — return userId string or null
- [ ] Implement `calculateScore` — return userId-to-score map
- [ ] Implement `onRoundEnd` — reset and set up next round
- [ ] Register the plugin at the bottom of the file
- [ ] Import in `src/games/index.ts`
- [ ] Import in `supabase/functions/_shared/games/index.ts`
- [ ] Add the game type string to `src/lib/constants.ts`
- [ ] Create a room with the new game type and verify it appears in the dropdown
- [ ] Start a game and verify the initial state is valid (all players have correct hand sizes)
- [ ] Play a valid card and verify the state updates and the turn advances
- [ ] Try to play an invalid card and verify it is rejected and the card returns to hand
- [ ] Test with the turn timer expiring — verify the turn advances automatically

---

## Realtime Event Reference

All events are sent on the `game:{gameId}` Supabase Realtime Broadcast channel. Only Edge Functions send events — clients only listen.

| Event | Sent when | Key payload fields |
|---|---|---|
| `GAME_STARTED` | Host triggers start | Initial game state with each player's hand filtered to only their own cards |
| `MOVE_APPLIED` | Any valid move | The move object, the new game state (hands stripped), optional winner userId |
| `TURN_EXPIRED` | Turn timer runs out | The userId who timed out, the new `currentPlayerId` |
| `PLAYER_DISCONNECTED` | Grace period expires | The userId of the disconnected player |
| `PLAYER_RECONNECTED` | Player rejoins the channel | The userId of the reconnected player |
| `GAME_OVER` | Winner detected or player abandons | Winner userId, final scores map, reason string |

---

## Common Pitfalls

**Never send a player's hand to other players**
Strip all hands from the state before broadcasting. Each player's broadcast payload should contain only their own hand. Failing to do this allows clients to cheat by inspecting the network response.

**Always validate moves server-side**
The Edge Function must call `rules.isValidMove` regardless of what the client says. A client can be modified to send any move payload.

**Use expo-secure-store, not AsyncStorage, for auth tokens**
AsyncStorage is unencrypted. If a user's device is compromised, their session token would be readable. Secure store uses the OS keychain.

**Keep game plugin methods pure**
`isValidMove` and `applyMove` must have no side effects — no network calls, no database access, no `Math.random()` in `applyMove`. The only randomness allowed is the shuffle in `getInitialState`. This makes the logic deterministic and testable.

**Optimistic updates must always have a rollback path**
Never discard the previous state before the server confirms. Store `pendingMove` and restore it if the Edge Function returns an error.

**Room codes must use only unambiguous characters**
Exclude O (looks like 0), I (looks like 1 or l), and 0 and 1 themselves. Users type these codes on small keyboards — ambiguous characters cause frustrating failed joins.

**The `moves` table is append-only**
Never update a row in `moves`. Only insert. This is an audit log and must be immutable.

**Do not share the `game_state` column directly with clients**
The `games` table holds all players' hands in one JSONB column for atomicity. Never expose this column directly via RLS SELECT. Always go through the Edge Function which filters hands before returning or broadcasting.
