export type RoleType =
  // A. Village Team (12 Roles)
  | 'VILLAGER'
  | 'SEER'
  | 'GUARD'
  | 'WITCH'
  | 'HUNTER'
  | 'CUPID'
  | 'LITTLE_GIRL'
  | 'ELDER'
  | 'CROW'
  | 'SISTERS'
  | 'MEDIUM'
  | 'FOX'
  // B. Werewolf Team (5 Roles)
  | 'WEREWOLF'
  | 'BIG_BAD_WOLF'
  | 'BLACK_WOLF'
  | 'WOLF_SEER'
  | 'WHITE_WOLF'
  // C. Neutral / Solo & Special Roles (5 Roles + ANGEL alias)
  | 'THIEF'
  | 'WILD_CHILD'
  | 'JESTER'
  | 'SERIAL_KILLER'
  | 'MAYOR'
  | 'ANGEL';

export type VisibleRoleType = RoleType | 'UNKNOWN';

export type Faction = 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL';
export type VisibleFaction = Faction | 'UNKNOWN';

export type WinningFaction =
  | 'VILLAGE'
  | 'WEREWOLF'
  | 'WHITE_WOLF'
  | 'JESTER'
  | 'ANGEL'
  | 'SERIAL_KILLER'
  | 'LOVERS'
  | 'NONE';

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

export interface FoxSniffResult {
  centerPlayerId: string;
  checkedPlayerIds: string[];
  hasWolf: boolean;
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
  knownRoles: Record<string, RoleType>; // Used by Seer, Wolf Seer, Medium, Sisters
  lastProtectedPlayerId: string | null; // Used by Guard / Bodyguard
  isPeeking: boolean;                   // Used by Little Girl
  exposureLevel: number;                // 0-100 warning meter for Little Girl
  elderLivesRemaining: number;          // 2 for Elder, 1 for others
  foxPowerLost: boolean;                // True if Fox sniffed 3 non-wolves
  lastFoxSniff: FoxSniffResult | null;  // Latest Fox sniff result
  loverPartnerId: string | null;        // Linked by Cupid
  roleModelId: string | null;           // Chosen by Wild Child on Night 1
  isMayor: boolean;                     // Mayor / Sheriff badge (2x vote weight & tie-breaker)
  stats: PlayerStats;
}

export type NightActionType =
  | 'WOLF_VOTE'
  | 'SEER_INSPECT'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'GUARD_PROTECT'
  | 'BLACK_WOLF_INFECT'
  | 'WHITE_WOLF_KILL'
  | 'BIG_BAD_WOLF_KILL'
  | 'WOLF_SEER_INSPECT'
  | 'FOX_SNIFF'
  | 'MEDIUM_INSPECT'
  | 'CROW_CURSE'
  | 'CUPID_LINK'
  | 'WILD_CHILD_MODEL'
  | 'THIEF_SWAP'
  | 'SERIAL_KILLER_KILL';

export interface NightActionPayload {
  actionType: NightActionType;
  targetId?: string | null;
  secondTargetId?: string | null; // Used by Cupid to link 2 Lovers
  choiceIndex?: 0 | 1;            // Used by Thief to pick 1 of 2 extra cards
}

export interface NightActionsState {
  wolfVotes: Record<string, string | null>; // wolfPlayerId -> targetPlayerId
  guardTargetId: string | null;
  seerTargetId: string | null;
  seerInspectedThisNight: boolean;
  wolfSeerTargetId: string | null;
  wolfSeerInspectedThisNight: boolean;
  mediumTargetId: string | null;
  mediumInspectedThisNight: boolean;
  foxTargetId: string | null;
  foxSniffedThisNight: boolean;
  witchHealUsedThisNight: boolean;
  witchPoisonTargetId: string | null;
  blackWolfInfectUsedThisNight: boolean;
  bigBadWolfTargetId: string | null;
  whiteWolfTargetId: string | null;
  crowTargetId: string | null;
  serialKillerTargetId: string | null;
  cupidLoverIds: [string, string] | null;
  wildChildModelId: string | null;
  thiefChosenIndex: 0 | 1 | null;
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
  channel: 'PUBLIC' | 'WOLF' | 'GHOST' | 'SISTERS' | 'SYSTEM';
  content: string;
  timestamp: number;
  isAnonymized?: boolean;
}

export type DeathCause =
  | 'WEREWOLVES'
  | 'BIG_BAD_WOLF'
  | 'WITCH_POISON'
  | 'WHITE_WOLF'
  | 'SERIAL_KILLER'
  | 'HUNTER_SHOT'
  | 'HEARTBREAK'
  | 'EXECUTION';

export interface NightCasualty {
  playerId: string;
  nickname: string;
  role: VisibleRoleType;
  cause: DeathCause;
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
  revealDeadRoles: boolean; // Host toggle: reveal dead players' roles or keep hidden
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
  thiefExtraRoles: [RoleType, RoleType] | null;
  lovers: [string, string] | null;
  crowCursedPlayerId: string | null; // Receives +2 automatic votes on the next daytime voting board
  villagePowersLost: boolean;        // True if Elder was executed by village vote
  anyWolfHasDied: boolean;           // Disables Big Bad Wolf's extra kill once true
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
  isMayor: boolean;
  isCrowCursed: boolean;
  isLoverWithSelf: boolean;
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
  elderLivesRemaining: number;
  foxPowerLost: boolean;
  lastFoxSniff: FoxSniffResult | null;
  loverPartnerId: string | null;
  roleModelId: string | null;
  thiefExtraRoles: [RoleType, RoleType] | null;
  canBigBadWolfKill: boolean;
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
  crowCursedPlayerId: string | null;
  villagePowersLost: boolean;
  skipDiscussionVotes: string[];
  dayVotes: Record<string, string | 'SKIP'>;
  lastExecutedPlayer: NightCasualty | null;
  hunterRevenge: HunterRevengeState | null;
  winner: WinningFaction | null;
  winReason: string | null;
  mvpAwards: MvpAward[];
}
