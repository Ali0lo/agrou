export type RoleType =
  | 'VILLAGER'
  | 'SEER'
  | 'WITCH'
  | 'GUARD'
  | 'HUNTER'
  | 'LITTLE_GIRL'
  | 'WEREWOLF'
  | 'BLACK_WOLF'
  | 'ANGEL'
  | 'WHITE_WOLF';

export type VisibleRoleType = RoleType | 'UNKNOWN';

export type Faction = 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL';
export type VisibleFaction = Faction | 'UNKNOWN';

export type WinningFaction = 'VILLAGE' | 'WEREWOLF' | 'ANGEL' | 'WHITE_WOLF' | 'NONE';

export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT_PHASE'
  | 'DAWN_SUMMARY'
  | 'DAY_DISCUSSION'
  | 'DAY_VOTING'
  | 'EXECUTION_REVEAL'
  | 'GAME_OVER';

export interface PhaseTimers {
  roleReveal: number;      // Default 8s
  nightPhase: number;      // Default 30s
  dawnSummary: number;     // Default 8s
  dayDiscussion: number;   // Default 90s
  dayVoting: number;       // Default 30s
  executionReveal: number; // Default 6s
  hunterRevenge: number;   // Default 15s
}

export interface PlayerStats {
  votesCast: number;
  correctWolfVotes: number;
  nightsSurvived: number;
  abilitiesUsed: number;
  killsTriggered: number;
}

export interface PlayerState {
  id: string;
  socketId: string | null;
  sessionToken: string;
  nickname: string;
  avatar: string;
  color: string;
  seatIndex: number;
  isHost: boolean;
  isBot: boolean;
  isConnected: boolean;
  isAlive: boolean;
  role: RoleType;
  originalRole: RoleType;
  faction: Faction;
  revealedRole: RoleType | null;
  deathReason: string | null;
  diedAtPhase: GamePhase | null;
  diedOnDay: number | null;
  isSpeaking: boolean;
  isTyping: boolean;
  // Role-specific per-player state
  knownRoles: Record<string, RoleType>; // Used by Seer
  lastProtectedPlayerId: string | null; // Used by Guard
  isPeeking: boolean;                   // Used by Little Girl
  exposureLevel: number;                // 0-100 warning meter for Little Girl
  stats: PlayerStats;
}

export type NightActionType =
  | 'WOLF_VOTE'
  | 'SEER_INSPECT'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'GUARD_PROTECT'
  | 'BLACK_WOLF_INFECT'
  | 'WHITE_WOLF_KILL';

export interface NightActionPayload {
  actionType: NightActionType;
  targetId?: string | null;
}

export interface NightActionsState {
  wolfVotes: Record<string, string | null>; // wolfPlayerId -> targetPlayerId
  guardTargetId: string | null;
  seerTargetId: string | null;
  seerInspectedThisNight: boolean;
  witchHealUsedThisNight: boolean;
  witchPoisonTargetId: string | null;
  blackWolfInfectUsedThisNight: boolean;
  whiteWolfTargetId: string | null;
  submittedPlayerIds: string[];
}

export interface WitchPotionsState {
  healAvailable: boolean;
  poisonAvailable: boolean;
}

export interface HunterRevengeState {
  hunterId: string;
  triggeredFromPhase: 'DAWN_SUMMARY' | 'EXECUTION_REVEAL';
  endsAt: number;
  resolved: boolean;
  shotTargetId: string | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  channel: 'PUBLIC' | 'WOLF' | 'GHOST' | 'SYSTEM';
  content: string;
  timestamp: number;
  isAnonymized?: boolean;
}

export interface NightCasualty {
  playerId: string;
  nickname: string;
  role: RoleType;
  cause: 'WEREWOLVES' | 'WITCH_POISON' | 'WHITE_WOLF' | 'HUNTER_SHOT' | 'EXECUTION';
}

export interface MvpAward {
  playerId: string;
  nickname: string;
  role: RoleType;
  title: string;
  description: string;
}

export interface RoomConfig {
  timers: PhaseTimers;
  enabledRoles: Record<RoleType, number>;
  allowWebRTC: boolean;
}

export interface RoomState {
  roomCode: string;
  createdAt: number;
  phase: GamePhase;
  dayNumber: number;
  nightNumber: number;
  phaseEndsAt: number | null;
  config: RoomConfig;
  players: PlayerState[];
  // Night & role state
  nightActions: NightActionsState;
  witchPotions: WitchPotionsState;
  blackWolfInfectionAvailable: boolean;
  wolfAlertedThisNight: boolean;
  wolfAliasMap: Record<string, string>; // wolfPlayerId -> "Wolf 1", "Wolf 2"
  // Dawn & Day state
  lastNightCasualties: NightCasualty[];
  lastNightInfectedId: string | null;
  skipDiscussionVotes: string[]; // playerIds who clicked "End Discussion Early"
  dayVotes: Record<string, string | 'SKIP'>; // voterId -> targetId | 'SKIP'
  lastExecutedPlayer: NightCasualty | null;
  // Hunter interrupt state
  hunterRevenge: HunterRevengeState | null;
  // Game Over state
  winner: WinningFaction | null;
  winReason: string | null;
  mvpAwards: MvpAward[];
  // Logs & Chat
  messages: ChatMessage[];
}

export interface SanitizedPlayerState {
  id: string;
  nickname: string;
  avatar: string;
  color: string;
  seatIndex: number;
  isHost: boolean;
  isBot: boolean;
  isConnected: boolean;
  isAlive: boolean;
  role: VisibleRoleType;
  faction: VisibleFaction;
  revealedRole: RoleType | null;
  deathReason: string | null;
  isSpeaking: boolean;
  isTyping: boolean;
}

export interface SanitizedSelfSecretState {
  playerId: string;
  role: RoleType;
  originalRole: RoleType;
  faction: Faction;
  knownRoles: Record<string, RoleType>;
  lastProtectedPlayerId: string | null;
  isPeeking: boolean;
  exposureLevel: number;
  witchPotions: WitchPotionsState | null;
  blackWolfInfectionAvailable: boolean | null;
  currentWolfTargetId: string | null;
  hasSubmittedNightAction: boolean;
  nightActionSummary: string | null;
  wasInfectedToWolf: boolean;
}

export interface SanitizedRoomState {
  roomCode: string;
  phase: GamePhase;
  dayNumber: number;
  nightNumber: number;
  phaseEndsAt: number | null;
  config: RoomConfig;
  players: SanitizedPlayerState[];
  self: SanitizedSelfSecretState | null;
  wolfVotes: Record<string, string | null> | null;
  wolfAlertedThisNight: boolean;
  lastNightCasualties: NightCasualty[];
  skipDiscussionVotes: string[];
  dayVotes: Record<string, string | 'SKIP'>;
  lastExecutedPlayer: NightCasualty | null;
  hunterRevenge: HunterRevengeState | null;
  winner: WinningFaction | null;
  winReason: string | null;
  mvpAwards: MvpAward[];
}
