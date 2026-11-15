import { ROLE_CATALOG } from '../constants/roles';

export { ROLE_CATALOG };

export type RoleType =
  // Normal (Village Team)
  | 'VILLAGER'
  | 'SEER'
  | 'WITCH'
  | 'GUARD'
  | 'HUNTER'
  | 'LITTLE_GIRL'
  // Qətil (Werewolf Team)
  | 'WEREWOLF'
  | 'BLACK_WOLF'
  | 'MYSTIC_WOLF'
  // Tərəfsiz (Neutral Team)
  | 'ANGEL'
  | 'WHITE_WOLF'
  | 'ARSONIST';

export type VisibleRoleType = RoleType | 'UNKNOWN';
export type Faction = 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL';
export type VisibleFaction = Faction | 'UNKNOWN';
export type WinningFaction =
  | 'VILLAGE'
  | 'WEREWOLF'
  | 'ANGEL'
  | 'WHITE_WOLF'
  | 'ARSONIST'
  | 'NONE';

export interface FactionQuota {
  normal: number;
  qetil: number;
  terefsiz: number;
}

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
  enabledRoles: Record<RoleType, boolean>;
  allowWebRTC: boolean;
  revealDeadRoles: boolean;
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
  mysticWolfInspections: Record<string, boolean>;
  arsonistDousedTargetIds: string[];
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

export type DeathCause =
  | 'WEREWOLVES'
  | 'WITCH_POISON'
  | 'WHITE_WOLF'
  | 'ARSONIST_IGNITE'
  | 'HUNTER_SHOT'
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
  skipDiscussionVotes: string[];
  dayVotes: Record<string, string | 'SKIP'>;
  lastExecutedPlayer: NightCasualty | null;
  hunterRevenge: HunterRevengeState | null;
  winner: WinningFaction | null;
  winReason: string | null;
  mvpAwards: MvpAward[];
}

export type ChatChannel = 'public' | 'wolves' | 'dead' | 'system';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  channel: ChatChannel;
  channelBadge: string;
  content: string;
  timestamp: number;
  isAnonymized?: boolean;
  isSpiritMessage?: boolean;
}

export type NightActionType =
  | 'WOLF_VOTE'
  | 'SEER_INSPECT'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'GUARD_PROTECT'
  | 'BLACK_WOLF_INFECT'
  | 'MYSTIC_WOLF_INSPECT'
  | 'WHITE_WOLF_KILL'
  | 'ARSONIST_DOUSE'
  | 'ARSONIST_IGNITE';

export interface NightActionPayload {
  actionType: NightActionType;
  targetId?: string | null;
}

export type ActiveNightSubMode =
  | 'DEFAULT'
  | 'WITCH_POISON'
  | 'WHITE_WOLF_KILL'
  | 'MYSTIC_WOLF_INSPECT'
  | null;

export interface RoleInfo {
  role: RoleType;
  name: string;
  nameAz: string;
  displayName: string;
  icon: string;
  faction: Faction;
  factionLabel: 'Normal' | 'Qətil' | 'Tərəfsiz';
  isBaseFiller?: boolean;
  color: string;
  badgeBg: string;
  shortDescription: string;
  winCondition: string;
  abilityGuide: string;
  nightActionLabel?: string;
}

export const AVATAR_OPTIONS = [
  '🦊',
  '🦉',
  '🐺',
  '🦌',
  '🐻',
  '🦔',
  '🦇',
  '🐈‍⬛',
  '🦅',
  '🐸',
  '🐇',
  '🦡',
  '🐗',
  '🦝',
  '🐿️',
  '🦢',
];

export const COLOR_OPTIONS = [
  '#f97316',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#f43f5e',
  '#06b6d4',
  '#d946ef',
  '#fb923c',
  '#22d3ee',
  '#8b5cf6',
];
