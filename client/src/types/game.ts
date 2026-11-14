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

export interface NightCasualty {
  playerId: string;
  nickname: string;
  role: RoleType;
  cause: 'WEREWOLVES' | 'WITCH_POISON' | 'WHITE_WOLF' | 'HUNTER_SHOT' | 'EXECUTION';
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

export interface RoleInfo {
  role: RoleType;
  name: string;
  icon: string;
  faction: Faction;
  colorClass: string;
  badgeBg: string;
  description: string;
  winCondition: string;
}

export const ROLE_CATALOG: Record<RoleType, RoleInfo> = {
  VILLAGER: {
    role: 'VILLAGER',
    name: 'Villager',
    icon: '🌾',
    faction: 'VILLAGE',
    colorClass: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
    description: 'No special night power. Relies on sharp deduction and daytime voting to root out the Werewolves.',
    winCondition: 'Win with the Village when all Werewolves and Killing Neutrals are eliminated.',
  },
  SEER: {
    role: 'SEER',
    name: 'Seer',
    icon: '🔮',
    faction: 'VILLAGE',
    colorClass: 'text-purple-300',
    badgeBg: 'bg-purple-500/20 border-purple-500/40 text-purple-200',
    description: 'Each night, selects one player around the campfire to inspect and privately learns their exact role.',
    winCondition: 'Win with the Village when all Werewolves and Killing Neutrals are eliminated.',
  },
  WITCH: {
    role: 'WITCH',
    name: 'Witch',
    icon: '🧪',
    faction: 'VILLAGE',
    colorClass: 'text-fuchsia-300',
    badgeBg: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-200',
    description: 'Starts with two single-use potions: a Heal Potion to save the Werewolves\' target, and a Poison Potion to eliminate any player at night.',
    winCondition: 'Win with the Village when all Werewolves and Killing Neutrals are eliminated.',
  },
  GUARD: {
    role: 'GUARD',
    name: 'Guard',
    icon: '🛡️',
    faction: 'VILLAGE',
    colorClass: 'text-sky-300',
    badgeBg: 'bg-sky-500/20 border-sky-500/40 text-sky-200',
    description: 'Each night, selects one player to protect from Werewolf attacks. Cannot protect the same player two nights in a row.',
    winCondition: 'Win with the Village when all Werewolves and Killing Neutrals are eliminated.',
  },
  HUNTER: {
    role: 'HUNTER',
    name: 'Hunter',
    icon: '🏹',
    faction: 'VILLAGE',
    colorClass: 'text-amber-300',
    badgeBg: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
    description: 'Passive ability: Whenever the Hunter dies (at night or by day vote), they get 15 seconds to shoot and eliminate one living player.',
    winCondition: 'Win with the Village when all Werewolves and Killing Neutrals are eliminated.',
  },
  LITTLE_GIRL: {
    role: 'LITTLE_GIRL',
    name: 'Little Girl',
    icon: '🕯️',
    faction: 'VILLAGE',
    colorClass: 'text-teal-300',
    badgeBg: 'bg-teal-500/20 border-teal-500/40 text-teal-200',
    description: 'Can toggle "Peek" during the Night Phase to spy on Werewolf chat (anonymized as "Wolf 1", "Wolf 2"), but each second increases exposure risk.',
    winCondition: 'Win with the Village when all Werewolves and Killing Neutrals are eliminated.',
  },
  WEREWOLF: {
    role: 'WEREWOLF',
    name: 'Werewolf',
    icon: '🐺',
    faction: 'WEREWOLF',
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/20 border-rose-500/40 text-rose-200',
    description: 'Plots in secret red-tinted Werewolf chat at night and votes with the pack to devour one victim.',
    winCondition: 'Win with the Werewolf Pack when Werewolves equal or outnumber non-Werewolves.',
  },
  BLACK_WOLF: {
    role: 'BLACK_WOLF',
    name: 'Black Wolf',
    icon: '🖤',
    faction: 'WEREWOLF',
    colorClass: 'text-red-400',
    badgeBg: 'bg-red-600/25 border-red-500/50 text-red-200',
    description: 'Once per game at night, can infect the Werewolves\' victim instead of killing them, secretly converting them into a Werewolf.',
    winCondition: 'Win with the Werewolf Pack when Werewolves equal or outnumber non-Werewolves.',
  },
  ANGEL: {
    role: 'ANGEL',
    name: 'Angel',
    icon: '👼',
    faction: 'NEUTRAL',
    colorClass: 'text-yellow-300',
    badgeBg: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200',
    description: 'Wins immediately if voted out by the village on Day 1. If they survive Day 1, they convert into a standard Villager.',
    winCondition: 'Get executed by the village vote on Day 1.',
  },
  WHITE_WOLF: {
    role: 'WHITE_WOLF',
    name: 'White Wolf',
    icon: '🐻‍❄️',
    faction: 'NEUTRAL',
    colorClass: 'text-indigo-200',
    badgeBg: 'bg-indigo-500/25 border-indigo-400/50 text-indigo-100',
    description: 'Appears as a normal Werewolf to other Wolves. Every second night (Night 2, 4...), may secretly kill one fellow Werewolf.',
    winCondition: 'Win solo by being the very last player alive around the campfire.',
  },
};

export const AVATAR_OPTIONS = [
  '🦊', '🦉', '🐺', '🦌', '🐻', '🐈‍⬛', '🦔', '🐸', '🦅', '🐿️', '🦡', '🌙',
];

export const COLOR_OPTIONS = [
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#84cc16', // Lime
];
