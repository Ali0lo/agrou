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
  seerInspection: { seerId: string; targetId: string; role: RoleType } | null;
  casualties: NightCasualty[];
}

export interface RoleMetadata {
  role: RoleType;
  name: string;
  faction: Faction;
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

export function isWolfPackRole(role: RoleType): boolean {
  return role === 'WEREWOLF' || role === 'BLACK_WOLF' || role === 'WHITE_WOLF';
}

export function getFactionForRole(role: RoleType): Faction {
  switch (role) {
    case 'VILLAGER':
    case 'SEER':
    case 'WITCH':
    case 'GUARD':
    case 'HUNTER':
    case 'LITTLE_GIRL':
      return 'VILLAGE';
    case 'WEREWOLF':
    case 'BLACK_WOLF':
      return 'WEREWOLF';
    case 'ANGEL':
    case 'WHITE_WOLF':
      return 'NEUTRAL';
  }
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
