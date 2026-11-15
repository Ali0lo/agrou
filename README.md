# 🔥 Campfire Wolves

An *Agrou*-inspired, real-time multiplayer social deduction browser game for **4 to 16 players**, built with **React + TypeScript + Tailwind CSS + Framer Motion** on the frontend and an authoritative **Node.js + Express + Socket.io** engine on the backend.

---

## ✨ Features

- **Cozy-Yet-Eerie Campfire Arena (4–16 Seats):** Dynamic radial trigonometric seating (`sin`/`cos`) around an animated SVG campfire strictly centered at `(50%, 50%)` that shifts between warm daytime embers and deep indigo moonlight while scaling cleanly up to 16 players.
- **Automatic Faction Distribution & Boolean Role Builder:**
  - Host toggles special roles strictly **ON / OFF** (maximum **1** per special role per match — no manual counters).
  - On match start, the server reads the connected player count (`4–16`), enforces the exact **Normal / Qatil / Tərəfsiz** faction quota table, overflows any disabled Tərəfsiz shortage into Normal, and automatically fills remaining slots with base **Villager** / **Werewolf** roles.
- **Host Lobby Setting — Reveal Dead Players' Roles (`revealDeadRoles`):** Toggle whether eliminated players' roles are revealed (`"Ölən oyunçuların rolunu göstər"`) or kept hidden (`"Rolu gizlidir 🔒"`) until Game Over.
- **Server-Authoritative Anti-Cheat:** All phase timers, vote tallies, and night resolutions run exclusively on the server. Each client receives an individually sanitized state snapshot via `sanitizeStateForPlayer(roomState, playerId)`—hidden roles are masked as `"UNKNOWN"` unless authorized (`White Wolf` appears as a standard `Werewolf` to teammates).
- **20 Playable Roles Across 3 Teams (`2 AUTO-FILL` + `18` Toggleable Specials):**
  - **Normal (Village — 10 Roles):** Kəndli (*Villager* AUTO-FILL), Ağsaqqal (*Elder* — 2-hit night armor; if voted out, Normal powers are lost), Ayı Təlimçisi (*Bear Tamer* — bear growls at dawn if adjacent neighbor is Qatil), Qarğa (*Crow* — curses 1 target nightly for `+2` penalty day votes), Kupid (*Cupid* — Night 1 links 2 Lovers with heartbreak & private chat), Kahin (*Seer*), Cadugər (*Witch* — Heal + Poison), Mühafizəçi (*Guard*), Ovçu (*Hunter* — 15s dying shot), Kiçik Qız (*Little Girl* — anonymized peek at Qatil chat).
  - **Qatil (Werewolves — 5 Roles):** Canavar (*Werewolf* AUTO-FILL), Qara Canavar (*Black Wolf* — 1x infect pack target into Werewolf), Mistik Canavar (*Mystic Wolf* — checks whether a non-wolf holds a special power or is a base Villager), İntiqamçı Qurd (*Vengeful Wolf* — drags 1 player down if voted out by village), Kölgə Qurd (*Shadow Wolf* — 1x hides all live day vote counts during voting).
  - **Tərəfsiz (Neutral — 5 Roles):** Mələk (*Angel* — wins if voted out Day 1; converts to Villager at Night 2), Təlxək (*Jester* — wins immediately if voted out on any Day), Vəhşi Uşaq (*Wild Child* — starts on Normal, chooses Role Model Night 1, secretly transforms into Werewolf if Model dies), Ağ Canavar (*White Wolf* — betrays fellow wolves on even nights, sole survivor win), Alovçu (*Arsonist* — Douse targets over multiple nights, Ignite all doused simultaneously, sole survivor win).
- **Multi-Channel Chat & Audio:** Public Campfire Chat (`public`), private red-tinted Qatil Pack Chat (`wolves`, with anonymized `"Canavar ???"` spying for a peeking Little Girl), Lovers Chat (`lovers`) for Cupid's linked pair, Ghost Chat (`dead`) for eliminated spectators, speaking/typing indicators, and synthesized Web Audio API sound effects.
- **Seamless Reconnection & AI Bots:** Mid-match refresh restoration via `sessionStorage`, plus 1-click AI bots in the lobby to test or fill 4–16 player rooms anytime.

---

## 🚀 Quick Start & Usage

### 1. Prerequisites
- **Node.js** `v18+`
- **npm** `v9+`

### 2. Install Dependencies
From the repository root:

```bash
npm install
```

### 3. Start the Development Servers
Launch both backend and frontend together:

```bash
npm run dev
```

Or run in separate terminals:

```bash
# Terminal 1 — Authoritative Socket.io server on http://localhost:4000
npm run dev:server

# Terminal 2 — Vite + React frontend on http://localhost:5173
npm run dev:client
```

Then open **http://localhost:5173** in your browser.

---

## 🧪 Building, Linting & Running Tests

```bash
# Run the Vitest unit test suite (quotas 4..16, role mechanics, sanitization, chat rules)
npm test

# Type-check both server and client workspaces
npm run lint

# Build production artifacts for both /server and /client
npm run build
```

---

## 📂 Monorepo Structure

```text
agrou/
├── ARCHITECTURE.md           # State machine, 4-16 quota deck-builder, WS contracts & security
├── README.md                 # Usage & setup documentation
├── package.json              # Root workspace scripts (build, test, lint, dev)
├── server/                   # Authoritative Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── index.ts          # Express + Socket.io server entry
│   │   ├── constants/        # Automatic 4-16 quota table & 20-role metadata
│   │   ├── types/game.ts     # Domain & state interfaces
│   │   ├── engine/           # GameEngine, RoomManager, StateSanitizer, WinConditionChecker
│   │   │   └── roles/        # Strategy pattern per role + NightResolver
│   │   └── socket/           # Real-time WebSocket event handlers
│   └── tests/engine.test.ts  # Comprehensive unit tests for quotas, roles & security
└── client/                   # Vite + React + TypeScript + Tailwind CSS + Framer Motion UI
    └── src/
        ├── App.tsx           # Main application & Socket.io lifecycle
        ├── constants/        # Quota preview calculator & 20-role catalog
        ├── components/       # CampfireArena, LobbyConfigPanel, PhaseActionToolbar, ChatPanel, etc.
        └── services/         # Web Audio API sound synthesizer & sessionStorage persistence
```
