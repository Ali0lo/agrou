# 🔥 Campfire Wolves

An *Agrou*-inspired, real-time multiplayer social deduction browser game for **4 to 12 players**, built with **React + TypeScript + Tailwind CSS + Framer Motion** on the frontend and an authoritative **Node.js + Express + Socket.io** engine on the backend.

---

## ✨ Features

- **Cozy-Yet-Eerie Campfire Arena:** Radial trigonometric seating (`sin`/`cos`) around an animated SVG campfire that dynamically shifts between warm daytime embers and deep indigo moonlight.
- **Server-Authoritative Anti-Cheat:** All phase timers, vote tallies, and night resolutions run exclusively on the server. Each player receives an individually sanitized state snapshot via `sanitizeStateForPlayer(roomState, playerId)`—hidden roles are stripped to `"UNKNOWN"` unless authorized.
- **10 Playable Roles Across 3 Factions:**
  - **Village Team:** Villager, Seer, Witch (Heal & Poison Potions), Guard, Hunter (15s dying revenge shot), Little Girl (real-time peeking on anonymized Wolf chat with an exposure risk gauge).
  - **Werewolf Team:** Werewolf, Black Wolf (single-use secret infection that converts the pack's victim into a Werewolf).
  - **Neutral Roles:** Angel (instant solo win if executed on Day 1), White Wolf (masks as a regular Werewolf, can betray a fellow Wolf every second night, wins only as the sole survivor).
- **Multi-Channel Chat & Audio:** Public Campfire Chat, private red-tinted Werewolf Pack Chat (with anonymized `"Wolf 1"`, `"Wolf 2"` spying for a peeking Little Girl), Ghost Chat for dead spectators, push-to-talk indicators, and zero-dependency synthesized Web Audio API sound effects.
- **Seamless Reconnection & AI Bots:** Automatic mid-match seat & role restoration on browser refresh via `sessionStorage`, plus 1-click AI bots so you can test or fill 4–12 player lobbies anytime.

---

## 🚀 Quick Start & Usage

### 1. Prerequisites
- **Node.js** `v18+` (tested with `v20` / `v24`)
- **npm** `v9+`

### 2. Install Dependencies
From the repository root:

```bash
npm install
```

### 3. Start the Development Servers
You can launch both the backend and frontend together with a single command:

```bash
npm run dev
```

Or run them in two separate terminal tabs:

```bash
# Terminal 1 — Start the Socket.io backend server on http://localhost:4000
npm run dev:server
```

```bash
# Terminal 2 — Start the Vite + React frontend on http://localhost:5173
npm run dev:client
```

Then open **http://localhost:5173** in your browser.

---

## 🎮 How to Play

1. **Create or Join a Campfire Room (`LOBBY`):**
   - Pick your nickname, woodland avatar emoji, and seat aura color.
   - Click **Create New Campfire Room** to become the Host and receive a 5-character room code (e.g., `#K7M4P`) and a one-click **Invite Link** (`?room=K7M4P`) to share with friends.
   - Playing solo or short a few friends? Click **+ Add Bot** in the Host panel to populate seats up to 4–12 players.
   - Customize the **Role Deck** counts and **Phase Timers** (Night, Day Discussion, Day Voting), then click **Start Match**.
2. **Role Reveal (`ROLE_REVEAL` — 8s):**
   - Watch your 3D tarot card flip to reveal your secret Role, Faction, and Win Condition.
   - Click **Role Guide** in the top navigation bar at any time during the match to inspect all role mechanics.
3. **Night Phase (`NIGHT_PHASE` — 30s default):**
   - **Werewolves:** Plot in the **Wolf Pack** chat tab and click a player seat around the campfire to vote on who to devour.
   - **Black Wolf:** Can click **Infect Victim (1x per game)** to convert the pack's target into a Werewolf instead of killing them.
   - **White Wolf:** On even nights (Night 2, 4, 6...), can toggle **Betray Fellow Wolf** and click another Werewolf seat to secretly eliminate them.
   - **Seer:** Click any living player seat to immediately inspect their true role.
   - **Guard:** Click any living player seat to protect them from Werewolf attacks tonight (cannot protect the same player two nights in a row).
   - **Witch:** Sees who the Werewolves are currently targeting and can use a single-use **Heal Potion** to save them or **Poison Potion** to eliminate any player (bypasses Guard protection).
   - **Little Girl:** Toggle **Peek at Werewolf Chat** to spy on anonymized Wolf messages (`Wolf 1`, `Wolf 2`), but watch your **Exposure %** meter—each second peeking risks alerting the Wolves!
4. **Dawn Summary (`DAWN_SUMMARY` — 8s):**
   - Announces who perished in the night (revealing their role) or celebrates a peaceful sunrise.
   - If the **Hunter** died, a 15-second **Hunter's Final Revenge** window triggers so the Hunter can shoot one living player.
5. **Day Discussion (`DAY_DISCUSSION` — 90s default):**
   - Debate in the public **Campfire** chat (or **Ghost Chat** if eliminated).
   - Click **End Discussion Early**—if `>50%` of living players agree, the game skips straight to voting.
6. **Day Tribunal Vote (`DAY_VOTING` — 30s default) & Execution (`EXECUTION_REVEAL` — 6s):**
   - Click a suspect's seat around the campfire to cast your elimination vote, or click **Skip Vote**.
   - Live vote counts appear next to each avatar. Ties result in no elimination.
7. **Game Over (`GAME_OVER`):**
   - Full role reveal, winning faction celebration, **Campfire MVP Awards**, and a **Play Again (Same Lobby)** button for the Host.

---

## 🧪 Building & Running Tests

```bash
# Run the Vitest unit test suite (role resolution edge cases, sanitization, win conditions)
npm test

# Type-check and build both /server and /client for production
npm run build
```

---

## 📂 Monorepo Structure

```text
agrou/
├── ARCHITECTURE.md           # State machine diagram, WebSocket contracts & security design
├── README.md                 # Usage & setup documentation
├── package.json              # Root workspace scripts (build, test, dev:server, dev:client)
├── server/                   # Authoritative Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── index.ts          # Express + Socket.io server entry
│   │   ├── types/game.ts     # Domain & state interfaces
│   │   ├── engine/           # GameEngine, RoomManager, StateSanitizer, WinConditionChecker
│   │   │   └── roles/        # Strategy/Command pattern per role + NightResolver
│   │   └── socket/           # Real-time WebSocket event handlers
│   └── tests/engine.test.ts  # 16 unit tests for role resolution & security rules
└── client/                   # Vite + React + TypeScript + Tailwind CSS + Framer Motion UI
    └── src/
        ├── App.tsx           # Main application & Socket.io lifecycle
        ├── components/       # CampfireArena, CampfireSvg, ChatPanel, LobbyConfigPanel, etc.
        └── services/         # Web Audio API sound synthesizer & sessionStorage persistence
```
