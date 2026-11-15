import { ROLE_DEFINITIONS } from '../../constants/roles.js';
import {
  Faction,
  NightActionPayload,
  NightCasualty,
  PlayerState,
  RoleType,
  RoomState,
} from '../../types/game.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface NightResolutionContext {
  room: RoomState;
  protectedPlayerIds: Set<string>;
  wolfVictimId: string | null;
  witchSavedVictim: boolean;
  poisonedPlayerIds: Set<string>;
  infectedPlayerId: string | null;
  whiteWolfVictimId: string | null;
  arsonistIgnitedIds: Set<string>;
  casualties: NightCasualty[];
}

export interface RoleMetadata {
  role: RoleType;
  name: string;
  nameAz: string;
  displayName: string;
  icon: string;
  faction: Faction;
  factionLabel: 'Normal' | 'Qətil' | 'Tərəfsiz';
  shortDescription: string;
  winCondition: string;
  hasNightAction: boolean;
}

export interface RoleStrategy {
  readonly metadata: RoleMetadata;
  canActAtNight(room: RoomState, player: PlayerState): boolean;
  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult;
  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void;
  resolveNightAction(
    context: NightResolutionContext,
    actor: PlayerState
  ): void;
}

/**
 * Wolf-pack participation (includes White Wolf so they see pack chat and vote with Qətil).
 */
export function isWolfPackRole(role: RoleType): boolean {
  return (
    role === 'WEREWOLF' ||
    role === 'BLACK_WOLF' ||
    role === 'MYSTIC_WOLF' ||
    role === 'WHITE_WOLF'
  );
}

/**
 * Qətil faction win-condition roles (excludes solo White Wolf).
 */
export function isQetilFactionRole(role: RoleType): boolean {
  return role === 'WEREWOLF' || role === 'BLACK_WOLF' || role === 'MYSTIC_WOLF';
}

export function isLethalNeutralRole(role: RoleType): boolean {
  return role === 'WHITE_WOLF' || role === 'ARSONIST';
}

export function getFactionForRole(role: RoleType): Faction {
  return ROLE_DEFINITIONS[role]?.faction ?? 'VILLAGE';
}

export function buildRoleMetadata(role: RoleType): RoleMetadata {
  const def = ROLE_DEFINITIONS[role];
  return {
    role: def.role,
    name: def.nameEn,
    nameAz: def.nameAz,
    displayName: def.displayName,
    icon: def.icon,
    faction: def.faction,
    factionLabel: def.factionLabel,
    shortDescription: def.shortDescription,
    winCondition: def.winCondition,
    hasNightAction: def.hasNightAction,
  };
}

export function computeConsensusWolfTarget(room: RoomState): string | null {
  const tally = new Map<string, number>();
  const order: string[] = [];

  for (const [wolfId, targetId] of Object.entries(room.nightActions.wolfVotes)) {
    if (!targetId) continue;
    const wolf = room.players.find((p) => p.id === wolfId);
    const target = room.players.find((p) => p.id === targetId);
    if (!wolf || !wolf.isAlive || !isWolfPackRole(wolf.role)) continue;
    if (!target || !target.isAlive) continue;

    if (!tally.has(targetId)) {
      order.push(targetId);
      tally.set(targetId, 0);
    }
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }

  let bestTarget: string | null = null;
  let bestCount = 0;

  for (const targetId of order) {
    const count = tally.get(targetId) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestTarget = targetId;
    }
  }

  return bestTarget;
}
