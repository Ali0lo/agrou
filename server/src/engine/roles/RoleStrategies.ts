import {
  NightActionPayload,
  PlayerState,
  RoleType,
  RoomState,
} from '../../types/game.js';
import {
  computeConsensusWolfTarget,
  isWolfPackRole,
  NightResolutionContext,
  RoleMetadata,
  RoleStrategy,
  ValidationResult,
} from './RoleStrategy.js';

export class VillagerStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'VILLAGER',
    name: 'Villager',
    faction: 'VILLAGE',
    shortDescription: 'A humble townsperson with no night ability. Uses deduction and voting during the day.',
    winCondition: 'Eliminate all Werewolves and hostile Neutrals.',
    hasNightAction: false,
  };

  canActAtNight(): boolean {
    return false;
  }

  validateNightAction(): ValidationResult {
    return { valid: false, error: 'Villagers cannot perform night actions.' };
  }

  recordNightInput(): void {}
  resolveNightAction(): void {}
}

export class SeerStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'SEER',
    name: 'Seer',
    faction: 'VILLAGE',
    shortDescription: 'Each night, inspects one player around the campfire to learn their true role.',
    winCondition: 'Eliminate all Werewolves and hostile Neutrals.',
    hasNightAction: true,
  };

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive && !room.nightActions.seerInspectedThisNight;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
    if (payload.actionType !== 'SEER_INSPECT') {
      return { valid: false, error: 'Invalid action type for Seer.' };
    }
    if (room.nightActions.seerInspectedThisNight) {
      return { valid: false, error: 'Seer has already inspected a player tonight.' };
    }
    if (!payload.targetId) {
      return { valid: false, error: 'Target player is required.' };
    }
    if (payload.targetId === actor.id) {
      return { valid: false, error: 'Seer cannot inspect themselves.' };
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
    // Immediately reveal to Seer so they get instant feedback at night
    actor.knownRoles[target.id] = target.role;
    actor.stats.abilitiesUsed += 1;
    if (!room.nightActions.submittedPlayerIds.includes(actor.id)) {
      room.nightActions.submittedPlayerIds.push(actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
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
  readonly metadata: RoleMetadata = {
    role: 'GUARD',
    name: 'Guard',
    faction: 'VILLAGE',
    shortDescription: 'Each night, protects one player from Werewolf attacks. Cannot protect the same player two nights in a row.',
    winCondition: 'Eliminate all Werewolves and hostile Neutrals.',
    hasNightAction: true,
  };

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };
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
    if (!room.nightActions.submittedPlayerIds.includes(actor.id)) {
      room.nightActions.submittedPlayerIds.push(actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const targetId = context.room.nightActions.guardTargetId;
    if (!targetId) {
      actor.lastProtectedPlayerId = null;
      return;
    }
    if (actor.lastProtectedPlayerId === targetId) {
      // Defensive guard against invalid state
      return;
    }
    const target = context.room.players.find((p) => p.id === targetId && p.isAlive);
    if (!target) return;

    context.protectedPlayerIds.add(target.id);
    actor.lastProtectedPlayerId = target.id;
    actor.stats.abilitiesUsed += 1;
  }
}

export class WitchStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'WITCH',
    name: 'Witch',
    faction: 'VILLAGE',
    shortDescription: 'Starts with two single-use potions: a Heal Potion to save the Werewolves\' victim, and a Poison Potion to eliminate any player.',
    winCondition: 'Eliminate all Werewolves and hostile Neutrals.',
    hasNightAction: true,
  };

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      (room.witchPotions.healAvailable || room.witchPotions.poisonAvailable)
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Dead players cannot act.' };

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
    if (!room.nightActions.submittedPlayerIds.includes(actor.id)) {
      room.nightActions.submittedPlayerIds.push(actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;

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

export class HunterStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'HUNTER',
    name: 'Hunter',
    faction: 'VILLAGE',
    shortDescription: 'Passive: Whenever the Hunter dies (at night or by day vote), they have 15 seconds to shoot and eliminate one living player.',
    winCondition: 'Eliminate all Werewolves and hostile Neutrals.',
    hasNightAction: false,
  };

  canActAtNight(): boolean {
    return false;
  }

  validateNightAction(): ValidationResult {
    return { valid: false, error: 'Hunter only acts upon dying.' };
  }

  recordNightInput(): void {}
  resolveNightAction(): void {}
}

export class LittleGirlStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'LITTLE_GIRL',
    name: 'Little Girl',
    faction: 'VILLAGE',
    shortDescription: 'Can toggle "Peek" at night to read anonymized Werewolf chat, risking increasing exposure and alerting the pack.',
    winCondition: 'Eliminate all Werewolves and hostile Neutrals.',
    hasNightAction: true,
  };

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(): ValidationResult {
    return { valid: false, error: 'Use night:littleGirlPeek to toggle peeking.' };
  }

  recordNightInput(): void {}
  resolveNightAction(): void {}
}

export class WerewolfStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'WEREWOLF',
    name: 'Werewolf',
    faction: 'WEREWOLF',
    shortDescription: 'Communicates in the secret Werewolf chat at night and votes with the pack to devour one victim.',
    winCondition: 'Equal or outnumber non-Werewolves.',
    hasNightAction: true,
  };

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

export class BlackWolfStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'BLACK_WOLF',
    name: 'Black Wolf',
    faction: 'WEREWOLF',
    shortDescription: 'Votes with the Werewolf pack. Once per game at night, can infect the pack\'s victim instead of killing them, converting them into a Werewolf.',
    winCondition: 'Equal or outnumber non-Werewolves.',
    hasNightAction: true,
  };

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
        return { valid: false, error: 'Black Wolf infection has already been used this game.' };
      }
      const currentTarget = computeConsensusWolfTarget(room);
      if (!currentTarget) {
        return { valid: false, error: 'The pack must select a victim before infecting.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type for Black Wolf.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
    } else if (payload.actionType === 'BLACK_WOLF_INFECT') {
      room.nightActions.blackWolfInfectUsedThisNight = !room.nightActions.blackWolfInfectUsedThisNight;
      if (!room.nightActions.submittedPlayerIds.includes(actor.id)) {
        room.nightActions.submittedPlayerIds.push(actor.id);
      }
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (
      room.nightActions.blackWolfInfectUsedThisNight &&
      room.blackWolfInfectionAvailable &&
      context.wolfVictimId
    ) {
      // Infection only succeeds if victim is not protected by Guard and not saved by Witch
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

export class AngelStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'ANGEL',
    name: 'Angel',
    faction: 'NEUTRAL',
    shortDescription: 'Wins immediately if voted out by the village on Day 1. If they survive Day 1, converts into a standard Villager.',
    winCondition: 'Get executed by the village vote on Day 1.',
    hasNightAction: false,
  };

  canActAtNight(): boolean {
    return false;
  }

  validateNightAction(): ValidationResult {
    return { valid: false, error: 'Angel has no night action.' };
  }

  recordNightInput(): void {}
  resolveNightAction(): void {}
}

export class WhiteWolfStrategy implements RoleStrategy {
  readonly metadata: RoleMetadata = {
    role: 'WHITE_WOLF',
    name: 'White Wolf',
    faction: 'NEUTRAL',
    shortDescription: 'Appears as a normal Werewolf to the pack. Every second night, may secretly kill one fellow Werewolf. Wins only as the last player alive.',
    winCondition: 'Be the sole surviving player around the campfire.',
    hasNightAction: true,
  };

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
      if (!payload.targetId) {
        return { valid: false, error: 'White Wolf must choose a fellow Werewolf or cancel.' };
      }
      if (payload.targetId === actor.id) {
        return { valid: false, error: 'White Wolf cannot target themselves.' };
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
      if (!room.nightActions.submittedPlayerIds.includes(actor.id)) {
        room.nightActions.submittedPlayerIds.push(actor.id);
      }
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

export const ROLE_STRATEGIES: Record<RoleType, RoleStrategy> = {
  VILLAGER: new VillagerStrategy(),
  SEER: new SeerStrategy(),
  GUARD: new GuardStrategy(),
  WITCH: new WitchStrategy(),
  HUNTER: new HunterStrategy(),
  LITTLE_GIRL: new LittleGirlStrategy(),
  WEREWOLF: new WerewolfStrategy(),
  BLACK_WOLF: new BlackWolfStrategy(),
  ANGEL: new AngelStrategy(),
  WHITE_WOLF: new WhiteWolfStrategy(),
};

export function getRoleStrategy(role: RoleType): RoleStrategy {
  return ROLE_STRATEGIES[role];
}
