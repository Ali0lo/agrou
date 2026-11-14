import {
  NightActionPayload,
  PlayerState,
  RoleType,
  RoomState,
} from '../../types/game.js';
import {
  buildRoleMetadata,
  computeConsensusWolfTarget,
  getFactionForRole,
  isWolfPackRole,
  NightResolutionContext,
  RoleStrategy,
  ValidationResult,
} from './RoleStrategy.js';

function markSubmitted(room: RoomState, playerId: string): void {
  if (!room.nightActions.submittedPlayerIds.includes(playerId)) {
    room.nightActions.submittedPlayerIds.push(playerId);
  }
}

export class PassiveRoleStrategy implements RoleStrategy {
  readonly metadata;
  constructor(role: RoleType) {
    this.metadata = buildRoleMetadata(role);
  }
  canActAtNight(): boolean {
    return false;
  }
  validateNightAction(): ValidationResult {
    return { valid: false, error: `${this.metadata.displayName} has no active night target ability.` };
  }
  recordNightInput(): void {}
  resolveNightAction(): void {}
}

export class SeerStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('SEER');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      !room.villagePowersLost &&
      !room.nightActions.seerInspectedThisNight
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost after the Elder was executed!' };
    }
    if (payload.actionType !== 'SEER_INSPECT') {
      return { valid: false, error: 'Invalid action type for Seer.' };
    }
    if (room.nightActions.seerInspectedThisNight) {
      return { valid: false, error: 'Seer has already inspected a player tonight.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Seer must select another living player.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Target must be a living player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target) return;
    room.nightActions.seerTargetId = target.id;
    room.nightActions.seerInspectedThisNight = true;
    actor.knownRoles[target.id] = target.role;
    actor.stats.abilitiesUsed += 1;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    if (context.room.villagePowersLost) return;
    const targetId = context.room.nightActions.seerTargetId;
    if (!targetId) return;
    const target = context.room.players.find((p) => p.id === targetId);
    if (!target) return;
    actor.knownRoles[target.id] = target.role;
    context.seerInspection = {
      seerId: actor.id,
      targetId: target.id,
      role: target.role,
    };
  }
}

export class GuardStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('GUARD');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive && !room.villagePowersLost;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost!' };
    }
    if (payload.actionType !== 'GUARD_PROTECT') {
      return { valid: false, error: 'Invalid action type for Guard.' };
    }
    if (!payload.targetId) {
      return { valid: false, error: 'Guard must choose a player to protect.' };
    }
    if (actor.lastProtectedPlayerId && payload.targetId === actor.lastProtectedPlayerId) {
      return {
        valid: false,
        error: 'Guard cannot protect the same player two nights in a row.',
      };
    }
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Guard target must be a living player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    room.nightActions.guardTargetId = payload.targetId ?? null;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    if (context.room.villagePowersLost) return;
    const targetId = context.room.nightActions.guardTargetId;
    if (!targetId) {
      actor.lastProtectedPlayerId = null;
      return;
    }
    if (actor.lastProtectedPlayerId === targetId) return;
    const target = context.room.players.find((p) => p.id === targetId && p.isAlive);
    if (!target) return;

    context.protectedPlayerIds.add(target.id);
    actor.lastProtectedPlayerId = target.id;
    actor.stats.abilitiesUsed += 1;
  }
}

export class WitchStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('WITCH');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      !room.villagePowersLost &&
      (room.witchPotions.healAvailable || room.witchPotions.poisonAvailable)
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost!' };
    }

    if (payload.actionType === 'WITCH_HEAL') {
      if (!room.witchPotions.healAvailable) {
        return { valid: false, error: 'Heal Potion has already been used.' };
      }
      const wolfVictimId = computeConsensusWolfTarget(room);
      if (!wolfVictimId) {
        return { valid: false, error: 'No player is currently targeted by the Werewolves.' };
      }
      return { valid: true };
    }

    if (payload.actionType === 'WITCH_POISON') {
      if (!room.witchPotions.poisonAvailable) {
        return { valid: false, error: 'Poison Potion has already been used.' };
      }
      if (!payload.targetId) {
        return { valid: false, error: 'Must select a player to poison.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId);
      if (!target || !target.isAlive) {
        return { valid: false, error: 'Poison target must be a living player.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type for Witch.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WITCH_HEAL') {
      room.nightActions.witchHealUsedThisNight = true;
    } else if (payload.actionType === 'WITCH_POISON') {
      room.nightActions.witchPoisonTargetId = payload.targetId ?? null;
    }
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (room.villagePowersLost) return;

    if (
      room.nightActions.witchHealUsedThisNight &&
      room.witchPotions.healAvailable &&
      context.wolfVictimId
    ) {
      context.witchSavedVictim = true;
      room.witchPotions.healAvailable = false;
      actor.stats.abilitiesUsed += 1;
    }

    if (
      room.nightActions.witchPoisonTargetId &&
      room.witchPotions.poisonAvailable
    ) {
      const target = room.players.find(
        (p) => p.id === room.nightActions.witchPoisonTargetId && p.isAlive
      );
      if (target) {
        context.poisonedPlayerIds.add(target.id);
        room.witchPotions.poisonAvailable = false;
        actor.stats.abilitiesUsed += 1;
        actor.stats.killsTriggered += 1;
      }
    }
  }
}

export class CupidStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('CUPID');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      room.nightNumber === 1 &&
      room.lovers === null
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.nightNumber !== 1) {
      return { valid: false, error: 'Cupid only links Lovers on Night 1.' };
    }
    if (payload.actionType !== 'CUPID_LINK') {
      return { valid: false, error: 'Invalid action type for Cupid.' };
    }
    const { targetId, secondTargetId } = payload;
    if (!targetId || !secondTargetId || targetId === secondTargetId) {
      return { valid: false, error: 'Cupid must select two distinct living players.' };
    }
    const p1 = room.players.find((p) => p.id === targetId && p.isAlive);
    const p2 = room.players.find((p) => p.id === secondTargetId && p.isAlive);
    if (!p1 || !p2) {
      return { valid: false, error: 'Both Lovers must be living players.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (!payload.targetId || !payload.secondTargetId) return;
    room.nightActions.cupidLoverIds = [payload.targetId, payload.secondTargetId];
    // Apply immediately so Lovers can see their bond
    const p1 = room.players.find((p) => p.id === payload.targetId);
    const p2 = room.players.find((p) => p.id === payload.secondTargetId);
    if (p1 && p2) {
      // Clear any previous selection on Night 1
      for (const p of room.players) {
        p.loverPartnerId = null;
      }
      p1.loverPartnerId = p2.id;
      p2.loverPartnerId = p1.id;
      room.lovers = [p1.id, p2.id];
      actor.stats.abilitiesUsed += 1;
      markSubmitted(room, actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext): void {
    const pair = context.room.nightActions.cupidLoverIds;
    if (context.room.nightNumber === 1 && pair && !context.room.lovers) {
      const p1 = context.room.players.find((p) => p.id === pair[0] && p.isAlive);
      const p2 = context.room.players.find((p) => p.id === pair[1] && p.isAlive);
      if (p1 && p2) {
        p1.loverPartnerId = p2.id;
        p2.loverPartnerId = p1.id;
        context.room.lovers = [p1.id, p2.id];
      }
    }
  }
}

export class CrowStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('CROW');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive && !room.villagePowersLost;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost!' };
    }
    if (payload.actionType !== 'CROW_CURSE') {
      return { valid: false, error: 'Invalid action type for Crow.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Crow must select another living player to curse.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
    if (!target) {
      return { valid: false, error: 'Crow target must be a living player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    room.nightActions.crowTargetId = payload.targetId ?? null;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    if (context.room.villagePowersLost) return;
    const targetId = context.room.nightActions.crowTargetId;
    if (!targetId) return;
    const target = context.room.players.find((p) => p.id === targetId && p.isAlive);
    if (target) {
      context.crowCursedId = target.id;
      actor.stats.abilitiesUsed += 1;
    }
  }
}

export class MediumStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('MEDIUM');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      !room.villagePowersLost &&
      !room.nightActions.mediumInspectedThisNight &&
      room.players.some((p) => !p.isAlive)
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost!' };
    }
    if (payload.actionType !== 'MEDIUM_INSPECT') {
      return { valid: false, error: 'Invalid action type for Medium.' };
    }
    if (room.nightActions.mediumInspectedThisNight) {
      return { valid: false, error: 'Medium has already channeled a spirit tonight.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || target.isAlive) {
      return { valid: false, error: 'Medium must select an eliminated (dead) player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    const target = room.players.find((p) => p.id === payload.targetId && !p.isAlive);
    if (!target) return;
    room.nightActions.mediumTargetId = target.id;
    room.nightActions.mediumInspectedThisNight = true;
    actor.knownRoles[target.id] = target.role;
    actor.stats.abilitiesUsed += 1;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    if (context.room.villagePowersLost) return;
    const targetId = context.room.nightActions.mediumTargetId;
    if (!targetId) return;
    const target = context.room.players.find((p) => p.id === targetId && !p.isAlive);
    if (target) {
      actor.knownRoles[target.id] = target.role;
    }
  }
}

export class FoxStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('FOX');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      !room.villagePowersLost &&
      !player.foxPowerLost &&
      !room.nightActions.foxSniffedThisNight
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.villagePowersLost) {
      return { valid: false, error: 'Village special powers were lost!' };
    }
    if (actor.foxPowerLost) {
      return { valid: false, error: 'The Fox has lost its scent power for the rest of the game.' };
    }
    if (payload.actionType !== 'FOX_SNIFF') {
      return { valid: false, error: 'Invalid action type for Fox.' };
    }
    if (room.nightActions.foxSniffedThisNight) {
      return { valid: false, error: 'Fox has already sniffed a group tonight.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
    if (!target) {
      return { valid: false, error: 'Fox must select a living player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    const aliveOrdered = [...room.players]
      .filter((p) => p.isAlive)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const centerIdx = aliveOrdered.findIndex((p) => p.id === payload.targetId);
    if (centerIdx === -1) return;

    const leftIdx = (centerIdx - 1 + aliveOrdered.length) % aliveOrdered.length;
    const rightIdx = (centerIdx + 1) % aliveOrdered.length;

    const trio = Array.from(
      new Set([
        aliveOrdered[leftIdx],
        aliveOrdered[centerIdx],
        aliveOrdered[rightIdx],
      ])
    );

    const hasWolf = trio.some((p) => isWolfPackRole(p.role));
    actor.lastFoxSniff = {
      centerPlayerId: aliveOrdered[centerIdx].id,
      checkedPlayerIds: trio.map((p) => p.id),
      hasWolf,
    };
    if (!hasWolf) {
      actor.foxPowerLost = true;
    }

    room.nightActions.foxTargetId = payload.targetId ?? null;
    room.nightActions.foxSniffedThisNight = true;
    actor.stats.abilitiesUsed += 1;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(): void {}
}

export class LittleGirlStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('LITTLE_GIRL');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive && !room.villagePowersLost;
  }

  validateNightAction(): ValidationResult {
    return { valid: false, error: 'Use night:littleGirlPeek to toggle peeking.' };
  }

  recordNightInput(): void {}
  resolveNightAction(): void {}
}

export class WerewolfStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('WEREWOLF');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType !== 'WOLF_VOTE') {
      return { valid: false, error: 'Invalid action type for Werewolf.' };
    }
    if (payload.targetId) {
      const target = room.players.find((p) => p.id === payload.targetId);
      if (!target || !target.isAlive) {
        return { valid: false, error: 'Vote target must be a living player.' };
      }
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
  }

  resolveNightAction(): void {}
}

export class BigBadWolfStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('BIG_BAD_WOLF');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType === 'WOLF_VOTE') {
      if (payload.targetId) {
        const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
        if (!target) return { valid: false, error: 'Target must be a living player.' };
      }
      return { valid: true };
    }

    if (payload.actionType === 'BIG_BAD_WOLF_KILL') {
      if (room.anyWolfHasDied) {
        return {
          valid: false,
          error: 'Big Bad Wolf lost their extra attack because a Werewolf has already died.',
        };
      }
      if (!payload.targetId) {
        return { valid: false, error: 'Must select a living player for the extra attack.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
      if (!target || isWolfPackRole(target.role)) {
        return {
          valid: false,
          error: 'Big Bad Wolf extra attack must target a living non-Werewolf.',
        };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type for Big Bad Wolf.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
    } else if (payload.actionType === 'BIG_BAD_WOLF_KILL') {
      room.nightActions.bigBadWolfTargetId = payload.targetId ?? null;
      markSubmitted(room, actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (room.anyWolfHasDied) return;
    const targetId = room.nightActions.bigBadWolfTargetId;
    if (!targetId) return;
    const target = room.players.find(
      (p) => p.id === targetId && p.isAlive && !isWolfPackRole(p.role)
    );
    if (target) {
      context.bigBadWolfVictimId = target.id;
      actor.stats.abilitiesUsed += 1;
      actor.stats.killsTriggered += 1;
    }
  }
}

export class BlackWolfStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('BLACK_WOLF');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType === 'WOLF_VOTE') {
      if (payload.targetId) {
        const target = room.players.find((p) => p.id === payload.targetId);
        if (!target || !target.isAlive) {
          return { valid: false, error: 'Vote target must be a living player.' };
        }
      }
      return { valid: true };
    }

    if (payload.actionType === 'BLACK_WOLF_INFECT') {
      if (!room.blackWolfInfectionAvailable) {
        return { valid: false, error: 'Infectious Father of Wolves has already used infection this game.' };
      }
      const currentTarget = computeConsensusWolfTarget(room);
      if (!currentTarget) {
        return { valid: false, error: 'The pack must select a victim before infecting.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type for Infectious Father of Wolves.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
    } else if (payload.actionType === 'BLACK_WOLF_INFECT') {
      room.nightActions.blackWolfInfectUsedThisNight =
        !room.nightActions.blackWolfInfectUsedThisNight;
      markSubmitted(room, actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (
      room.nightActions.blackWolfInfectUsedThisNight &&
      room.blackWolfInfectionAvailable &&
      context.wolfVictimId
    ) {
      if (
        !context.protectedPlayerIds.has(context.wolfVictimId) &&
        !context.witchSavedVictim
      ) {
        const victim = room.players.find(
          (p) => p.id === context.wolfVictimId && p.isAlive
        );
        if (victim && !isWolfPackRole(victim.role)) {
          context.infectedPlayerId = victim.id;
          room.blackWolfInfectionAvailable = false;
          actor.stats.abilitiesUsed += 1;
        }
      }
    }
  }
}

export class WolfSeerStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('WOLF_SEER');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType === 'WOLF_VOTE') {
      if (payload.targetId) {
        const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
        if (!target) return { valid: false, error: 'Vote target must be a living player.' };
      }
      return { valid: true };
    }

    if (payload.actionType === 'WOLF_SEER_INSPECT') {
      if (room.nightActions.wolfSeerInspectedThisNight) {
        return { valid: false, error: 'Wolf Seer has already inspected a player tonight.' };
      }
      if (!payload.targetId || payload.targetId === actor.id) {
        return { valid: false, error: 'Wolf Seer must choose another living player.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
      if (!target) {
        return { valid: false, error: 'Target must be a living player.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type for Wolf Seer.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
    } else if (payload.actionType === 'WOLF_SEER_INSPECT') {
      const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
      if (!target) return;
      room.nightActions.wolfSeerTargetId = target.id;
      room.nightActions.wolfSeerInspectedThisNight = true;
      // Share with Wolf Seer and living pack wolves
      for (const p of room.players) {
        if (p.isAlive && isWolfPackRole(p.role)) {
          p.knownRoles[target.id] = target.role;
        }
      }
      actor.stats.abilitiesUsed += 1;
      markSubmitted(room, actor.id);
    }
  }

  resolveNightAction(): void {}
}

export class WhiteWolfStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('WHITE_WOLF');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType === 'WOLF_VOTE') {
      if (payload.targetId) {
        const target = room.players.find((p) => p.id === payload.targetId);
        if (!target || !target.isAlive) {
          return { valid: false, error: 'Vote target must be a living player.' };
        }
      }
      return { valid: true };
    }

    if (payload.actionType === 'WHITE_WOLF_KILL') {
      if (room.nightNumber % 2 !== 0) {
        return {
          valid: false,
          error: 'White Wolf can only devour a fellow Werewolf on even nights (Night 2, 4, 6...).',
        };
      }
      if (!payload.targetId || payload.targetId === actor.id) {
        return { valid: false, error: 'White Wolf must choose another living Werewolf.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId);
      if (!target || !target.isAlive || !isWolfPackRole(target.role)) {
        return {
          valid: false,
          error: 'White Wolf can only target a living fellow Werewolf with their solo attack.',
        };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type for White Wolf.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
    } else if (payload.actionType === 'WHITE_WOLF_KILL') {
      room.nightActions.whiteWolfTargetId = payload.targetId ?? null;
      markSubmitted(room, actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (room.nightNumber % 2 !== 0) return;
    const targetId = room.nightActions.whiteWolfTargetId;
    if (!targetId || targetId === actor.id) return;

    const target = room.players.find(
      (p) => p.id === targetId && p.isAlive && isWolfPackRole(p.role)
    );
    if (!target) return;

    context.whiteWolfVictimId = target.id;
    actor.stats.abilitiesUsed += 1;
    actor.stats.killsTriggered += 1;
  }
}

export class ThiefStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('THIEF');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      room.nightNumber === 1 &&
      room.thiefExtraRoles !== null
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.nightNumber !== 1 || !room.thiefExtraRoles) {
      return { valid: false, error: 'Thief can only swap cards on Night 1.' };
    }
    if (payload.actionType !== 'THIEF_SWAP') {
      return { valid: false, error: 'Invalid action type for Thief.' };
    }
    const idx = payload.choiceIndex;
    if (idx !== 0 && idx !== 1) {
      return { valid: false, error: 'Must choose card 0 or card 1.' };
    }

    const [card0, card1] = room.thiefExtraRoles;
    const chosenRole = idx === 0 ? card0 : card1;
    const otherRole = idx === 0 ? card1 : card0;

    // Classic Agrou rule: If one card is a Werewolf and the other is not, Thief MUST choose the Werewolf
    if (isWolfPackRole(otherRole) && !isWolfPackRole(chosenRole)) {
      return {
        valid: false,
        error: 'When a Werewolf card is present, the Thief is forced to pick the Werewolf!',
      };
    }

    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (!room.thiefExtraRoles) return;
    const idx = payload.choiceIndex;
    if (idx !== 0 && idx !== 1) return;

    room.nightActions.thiefChosenIndex = idx;
    const newRole = room.thiefExtraRoles[idx];
    actor.role = newRole;
    actor.faction = getFactionForRole(newRole);
    if (newRole === 'ELDER') {
      actor.elderLivesRemaining = 2;
    }
    if (newRole === 'MAYOR') {
      actor.isMayor = true;
    }
    room.thiefExtraRoles = null;
    actor.stats.abilitiesUsed += 1;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (room.nightNumber === 1 && room.thiefExtraRoles && actor.role === 'THIEF') {
      // If Thief didn't manually pick and one of the cards is a Werewolf, force-assign the Werewolf card
      const [c0, c1] = room.thiefExtraRoles;
      if (isWolfPackRole(c0) || isWolfPackRole(c1)) {
        const forcedRole = isWolfPackRole(c0) ? c0 : c1;
        actor.role = forcedRole;
        actor.faction = getFactionForRole(forcedRole);
      }
      room.thiefExtraRoles = null;
    }
  }
}

export class WildChildStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('WILD_CHILD');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      room.nightNumber === 1 &&
      player.roleModelId === null
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (room.nightNumber !== 1) {
      return { valid: false, error: 'Wild Child only selects a Role Model on Night 1.' };
    }
    if (payload.actionType !== 'WILD_CHILD_MODEL') {
      return { valid: false, error: 'Invalid action type for Wild Child.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Wild Child must choose another living player as Role Model.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
    if (!target) {
      return { valid: false, error: 'Role Model must be a living player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (!payload.targetId) return;
    room.nightActions.wildChildModelId = payload.targetId;
    actor.roleModelId = payload.targetId;
    actor.stats.abilitiesUsed += 1;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    if (
      context.room.nightNumber === 1 &&
      !actor.roleModelId &&
      context.room.nightActions.wildChildModelId
    ) {
      actor.roleModelId = context.room.nightActions.wildChildModelId;
    }
  }
}

export class SerialKillerStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('SERIAL_KILLER');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType !== 'SERIAL_KILLER_KILL') {
      return { valid: false, error: 'Invalid action type for Serial Killer.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Serial Killer must select another living player.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
    if (!target) {
      return { valid: false, error: 'Target must be a living player.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    room.nightActions.serialKillerTargetId = payload.targetId ?? null;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const targetId = context.room.nightActions.serialKillerTargetId;
    if (!targetId || targetId === actor.id) return;
    const target = context.room.players.find((p) => p.id === targetId && p.isAlive);
    if (target) {
      context.serialKillerVictimId = target.id;
      actor.stats.abilitiesUsed += 1;
      actor.stats.killsTriggered += 1;
    }
  }
}

export const ROLE_STRATEGIES: Record<RoleType, RoleStrategy> = {
  // Village (12)
  VILLAGER: new PassiveRoleStrategy('VILLAGER'),
  SEER: new SeerStrategy(),
  GUARD: new GuardStrategy(),
  WITCH: new WitchStrategy(),
  HUNTER: new PassiveRoleStrategy('HUNTER'),
  CUPID: new CupidStrategy(),
  LITTLE_GIRL: new LittleGirlStrategy(),
  ELDER: new PassiveRoleStrategy('ELDER'),
  CROW: new CrowStrategy(),
  SISTERS: new PassiveRoleStrategy('SISTERS'),
  MEDIUM: new MediumStrategy(),
  FOX: new FoxStrategy(),
  // Werewolves (5)
  WEREWOLF: new WerewolfStrategy(),
  BIG_BAD_WOLF: new BigBadWolfStrategy(),
  BLACK_WOLF: new BlackWolfStrategy(),
  WOLF_SEER: new WolfSeerStrategy(),
  WHITE_WOLF: new WhiteWolfStrategy(),
  // Neutral / Special (5 + ANGEL)
  THIEF: new ThiefStrategy(),
  WILD_CHILD: new WildChildStrategy(),
  JESTER: new PassiveRoleStrategy('JESTER'),
  SERIAL_KILLER: new SerialKillerStrategy(),
  MAYOR: new PassiveRoleStrategy('MAYOR'),
  ANGEL: new PassiveRoleStrategy('ANGEL'),
};

export function getRoleStrategy(role: RoleType): RoleStrategy {
  return ROLE_STRATEGIES[role];
}
