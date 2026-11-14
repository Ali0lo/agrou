import { ROLE_CATALOG } from '../constants/roles';

export { ROLE_CATALOG };

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
  // C. Neutral / Solo & Special Roles (5 Roles + ANGEL)
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
  roleReveal: number;
  nightPhase: number;
  dawnSummary: number;
  dayDiscussion: number;
  dayVoting: number;
  executionReveal: number;
  hunterRevenge: number;
}

export interface RoomConfig {
  timers: PhaseTimers;
  enabledRoles: Record<RoleType, number>;
  allowWebRTC: boolean;
  revealDeadRoles: boolean;
}

export interface FoxSniffResult {
  centerPlayerId: string;
  checkedPlayerIds: string[];
  hasWolf: boolean;
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

export interface WitchPotionsState {
  healAvailable: boolean;
  poisonAvailable: boolean;
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

export interface HunterRevengeState {
  hunterId: string;
  triggeredFromPhase: 'DAWN_SUMMARY' | 'EXECUTION_REVEAL';
  endsAt: number;
  resolved: boolean;
  shotTargetId: string | null;
}

export interface MvpAward {
  playerId: string;
  nickname: string;
  role: RoleType;
  title: string;
  description: string;
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
  secondTargetId?: string | null;
  choiceIndex?: 0 | 1;
}

export type ActiveNightSubMode =
  | 'DEFAULT'
  | 'WITCH_POISON'
  | 'WHITE_WOLF_KILL'
  | 'BIG_BAD_WOLF_KILL'
  | 'WOLF_SEER_INSPECT'
  | null;

export interface RoleInfo {
  role: RoleType;
  name: string;
  nameAz: string;
  nameEn: string;
  icon: string;
  faction: Faction;
  colorClass: string;
  badgeBg: string;
  description: string;
  winCondition: string;
}

export const AVATAR_OPTIONS = [
  '🦊', '🦉', '🐺', '🦌', '🐻', '🐈‍⬛', '🦔', '🐸', '🦅', '🐿️', '🦡', '🌙',
];

export const COLOR_OPTIONS = [
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#84cc16',
];
