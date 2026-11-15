import {
  NightActionPayload,
  PlayerState,
  RoleType,
  RoomState,
} from '../../types/game.js';
import {
  buildRoleMetadata,
  computeConsensusWolfTarget,
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

function checkVillagePowers(room: RoomState): ValidationResult | null {
  if (room.villagePowersLost) {
    return {
      valid: false,
      error: 'Ağsaqqal edam edildiyi üçün Normal rolların xüsusi gücləri itirilib.',
    };
  }
  return null;
}

function validateWolfVoteTarget(
  room: RoomState,
  payload: NightActionPayload
): ValidationResult {
  if (payload.targetId) {
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Qurban canlı oyunçu olmalıdır.' };
    }
  }
  return { valid: true };
}

function recordWolfVote(
  room: RoomState,
  actor: PlayerState,
  payload: NightActionPayload
): void {
  room.nightActions.wolfVotes[actor.id] = payload.targetId ?? null;
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
    return {
      valid: false,
      error: `${this.metadata.displayName} rolunun gecə hədəf gücü yoxdur.`,
    };
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
    const blocked = checkVillagePowers(room);
    if (blocked) return blocked;
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType !== 'SEER_INSPECT') {
      return { valid: false, error: 'Kahin üçün yanlış əməliyyat.' };
    }
    if (room.nightActions.seerInspectedThisNight) {
      return { valid: false, error: 'Kahin bu gecə artıq yoxlama aparıb.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Kahin başqa bir canlı oyunçu seçməlidir.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Hədəf canlı oyunçu olmalıdır.' };
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
    const blocked = checkVillagePowers(room);
    if (blocked) return blocked;
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType !== 'GUARD_PROTECT') {
      return { valid: false, error: 'Mühafizəçi üçün yanlış əməliyyat.' };
    }
    if (!payload.targetId) {
      return { valid: false, error: 'Qorumaq üçün bir oyunçu seçin.' };
    }
    if (actor.lastProtectedPlayerId && payload.targetId === actor.lastProtectedPlayerId) {
      return {
        valid: false,
        error: 'Guard cannot protect the same player two nights in a row.',
      };
    }
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Mühafizə hədəfi canlı oyunçu olmalıdır.' };
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
    const blocked = checkVillagePowers(room);
    if (blocked) return blocked;
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };

    if (payload.actionType === 'WITCH_HEAL') {
      if (!room.witchPotions.healAvailable) {
        return { valid: false, error: 'Həyat İksiri artıq işlənib.' };
      }
      const wolfVictimId = computeConsensusWolfTarget(room);
      if (!wolfVictimId) {
        return { valid: false, error: 'Canavarlar hələ heç kimi hədəf almayıb.' };
      }
      return { valid: true };
    }

    if (payload.actionType === 'WITCH_POISON') {
      if (!room.witchPotions.poisonAvailable) {
        return { valid: false, error: 'Ölüm İksiri artıq işlənib.' };
      }
      if (!payload.targetId) {
        return { valid: false, error: 'Zəhərləmək üçün oyunçu seçin.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId);
      if (!target || !target.isAlive) {
        return { valid: false, error: 'Zəhər hədəfi canlı oyunçu olmalıdır.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Cadugər üçün yanlış əməliyyat.' };
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

export class LittleGirlStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('LITTLE_GIRL');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive && !room.villagePowersLost;
  }

  validateNightAction(): ValidationResult {
    return { valid: false, error: 'Baxmaq üçün night:littleGirlPeek hadisəsindən istifadə edin.' };
  }

  recordNightInput(): void {}
  resolveNightAction(): void {}
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
    const blocked = checkVillagePowers(room);
    if (blocked) return blocked;
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType !== 'CROW_CURSE') {
      return { valid: false, error: 'Qarğa üçün yanlış əməliyyat.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Qarğa başqa bir canlı oyunçu seçməlidir.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId);
    if (!target || !target.isAlive) {
      return { valid: false, error: 'Lənət hədəfi canlı oyunçu olmalıdır.' };
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
    const { room } = context;
    if (room.villagePowersLost) return;
    const targetId = room.nightActions.crowTargetId;
    if (!targetId) return;
    const target = room.players.find((p) => p.id === targetId && p.isAlive);
    if (!target) return;
    room.cursedPlayerId = target.id;
    actor.stats.abilitiesUsed += 1;
  }
}

export class CupidStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('CUPID');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      !room.villagePowersLost &&
      room.nightNumber === 1 &&
      !room.cupidLinked
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    const blocked = checkVillagePowers(room);
    if (blocked) return blocked;
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (room.nightNumber !== 1 || room.cupidLinked) {
      return { valid: false, error: 'Kupid yalnız 1-ci gecə Aşiqləri bağlaya bilər.' };
    }
    if (payload.actionType !== 'CUPID_LINK') {
      return { valid: false, error: 'Kupid üçün yanlış əməliyyat.' };
    }
    if (!payload.targetId || !payload.secondTargetId) {
      return { valid: false, error: 'Bağlamaq üçün 2 fərqli canlı oyunçu seçin.' };
    }
    if (payload.targetId === payload.secondTargetId) {
      return { valid: false, error: 'Kupid 2 fərqli oyunçu seçməlidir.' };
    }
    const p1 = room.players.find((p) => p.id === payload.targetId && p.isAlive);
    const p2 = room.players.find((p) => p.id === payload.secondTargetId && p.isAlive);
    if (!p1 || !p2) {
      return { valid: false, error: 'Hər iki seçilmiş oyunçu canlı olmalıdır.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (!payload.targetId || !payload.secondTargetId) return;
    room.nightActions.cupidTargetIds = [payload.targetId, payload.secondTargetId];
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (room.villagePowersLost || room.nightNumber !== 1 || room.cupidLinked) return;
    const ids = room.nightActions.cupidTargetIds;
    if (!ids) return;
    const [id1, id2] = ids;
    if (!id1 || !id2 || id1 === id2) return;
    const p1 = room.players.find((p) => p.id === id1 && p.isAlive);
    const p2 = room.players.find((p) => p.id === id2 && p.isAlive);
    if (!p1 || !p2) return;

    p1.loverPartnerId = p2.id;
    p2.loverPartnerId = p1.id;
    room.cupidLinked = true;
    actor.stats.abilitiesUsed += 1;
  }
}

export class WildChildStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('WILD_CHILD');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return (
      room.phase === 'NIGHT_PHASE' &&
      player.isAlive &&
      room.nightNumber === 1 &&
      !player.roleModelId
    );
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (room.nightNumber !== 1 || actor.roleModelId) {
      return { valid: false, error: 'Vəhşi Uşaq yalnız 1-ci gecə Rol Model seçə bilər.' };
    }
    if (payload.actionType !== 'WILD_CHILD_MODEL') {
      return { valid: false, error: 'Vəhşi Uşaq üçün yanlış əməliyyat.' };
    }
    if (!payload.targetId || payload.targetId === actor.id) {
      return { valid: false, error: 'Özünüzdən başqa 1 canlı oyunçu seçin.' };
    }
    const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
    if (!target) {
      return { valid: false, error: 'Rol Model canlı oyunçu olmalıdır.' };
    }
    return { valid: true };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    room.nightActions.wildChildModelId = payload.targetId ?? null;
    markSubmitted(room, actor.id);
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    if (room.nightNumber !== 1 || actor.roleModelId) return;
    const modelId = room.nightActions.wildChildModelId;
    if (!modelId || modelId === actor.id) return;
    const target = room.players.find((p) => p.id === modelId && p.isAlive);
    if (!target) return;
    actor.roleModelId = target.id;
    actor.stats.abilitiesUsed += 1;
  }
}

export class WerewolfStrategy implements RoleStrategy {
  readonly metadata;

  constructor(role: 'WEREWOLF' | 'VENGEFUL_WOLF' | 'SHADOW_WOLF' = 'WEREWOLF') {
    this.metadata = buildRoleMetadata(role);
  }

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType !== 'WOLF_VOTE') {
      return { valid: false, error: `${this.metadata.nameAz} üçün yanlış əməliyyat.` };
    }
    return validateWolfVoteTarget(room, payload);
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    recordWolfVote(room, actor, payload);
  }

  resolveNightAction(): void {}
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
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType === 'WOLF_VOTE') {
      return validateWolfVoteTarget(room, payload);
    }

    if (payload.actionType === 'BLACK_WOLF_INFECT') {
      if (!room.blackWolfInfectionAvailable) {
        return { valid: false, error: 'Qara Canavar yoluxdurmanı bu oyunda artıq işlədib.' };
      }
      const currentTarget = computeConsensusWolfTarget(room);
      if (!currentTarget) {
        return { valid: false, error: 'Yoluxdurmaq üçün əvvəlcə sürü bir qurban seçməlidir.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Qara Canavar üçün yanlış əməliyyat.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      recordWolfVote(room, actor, payload);
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

export class MysticWolfStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('MYSTIC_WOLF');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType === 'WOLF_VOTE') {
      return validateWolfVoteTarget(room, payload);
    }

    if (payload.actionType === 'MYSTIC_WOLF_INSPECT') {
      if (room.nightActions.mysticWolfInspectedThisNight) {
        return { valid: false, error: 'Mistik Canavar bu gecə artıq yoxlama aparıb.' };
      }
      if (!payload.targetId || payload.targetId === actor.id) {
        return { valid: false, error: 'Yoxlamaq üçün başqa bir canlı oyunçu seçin.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
      if (!target) {
        return { valid: false, error: 'Hədəf canlı oyunçu olmalıdır.' };
      }
      if (isWolfPackRole(target.role)) {
        return {
          valid: false,
          error: 'Mistik Canavar yalnız qeyri-Canavar oyunçuları yoxlaya bilər.',
        };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Mistik Canavar üçün yanlış əməliyyat.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      recordWolfVote(room, actor, payload);
      return;
    }

    if (payload.actionType === 'MYSTIC_WOLF_INSPECT') {
      const target = room.players.find(
        (p) => p.id === payload.targetId && p.isAlive && !isWolfPackRole(p.role)
      );
      if (!target) return;

      room.nightActions.mysticWolfTargetId = target.id;
      room.nightActions.mysticWolfInspectedThisNight = true;
      // Checks whether target holds any special Normal or Tərəfsiz power (not plain Villager)
      actor.mysticWolfInspections[target.id] = target.role !== 'VILLAGER';
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
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };
    if (payload.actionType === 'WOLF_VOTE') {
      return validateWolfVoteTarget(room, payload);
    }

    if (payload.actionType === 'WHITE_WOLF_KILL') {
      if (room.nightNumber % 2 !== 0) {
        return {
          valid: false,
          error: 'Ağ Canavar digər Canavarı yalnız cüt gecələrdə (Gecə 2, 4, 6...) öldürə bilər.',
        };
      }
      if (!payload.targetId || payload.targetId === actor.id) {
        return { valid: false, error: 'Başqa bir canlı Canavar seçməlisiniz.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId);
      if (!target || !target.isAlive || !isWolfPackRole(target.role)) {
        return {
          valid: false,
          error: 'Ağ Canavar yalnız digər sağ Qatil üzvünə xəyanət edə bilər.',
        };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Ağ Canavar üçün yanlış əməliyyat.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'WOLF_VOTE') {
      recordWolfVote(room, actor, payload);
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

export class ArsonistStrategy implements RoleStrategy {
  readonly metadata = buildRoleMetadata('ARSONIST');

  canActAtNight(room: RoomState, player: PlayerState): boolean {
    return room.phase === 'NIGHT_PHASE' && player.isAlive;
  }

  validateNightAction(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): ValidationResult {
    if (!actor.isAlive) return { valid: false, error: 'Ölü oyunçular hərəkət edə bilməz.' };

    if (payload.actionType === 'ARSONIST_DOUSE') {
      if (!payload.targetId || payload.targetId === actor.id) {
        return { valid: false, error: 'Benzin tökmək üçün başqa bir canlı oyunçu seçin.' };
      }
      const target = room.players.find((p) => p.id === payload.targetId && p.isAlive);
      if (!target) {
        return { valid: false, error: 'Hədəf canlı oyunçu olmalıdır.' };
      }
      return { valid: true };
    }

    if (payload.actionType === 'ARSONIST_IGNITE') {
      const aliveDoused = room.arsonistDousedIds.filter((id) =>
        room.players.some((p) => p.id === id && p.isAlive && p.id !== actor.id)
      );
      if (aliveDoused.length === 0) {
        return {
          valid: false,
          error: 'Alovlandırmaq üçün əvvəlcə ən azı 1 sağ oyunçuya benzin tökülməlidir.',
        };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Alovçu (Arsonist) üçün yanlış əməliyyat.' };
  }

  recordNightInput(
    room: RoomState,
    actor: PlayerState,
    payload: NightActionPayload
  ): void {
    if (payload.actionType === 'ARSONIST_DOUSE') {
      room.nightActions.arsonistActionThisNight = 'DOUSE';
      room.nightActions.arsonistTargetId = payload.targetId ?? null;
      markSubmitted(room, actor.id);
    } else if (payload.actionType === 'ARSONIST_IGNITE') {
      room.nightActions.arsonistActionThisNight = 'IGNITE';
      room.nightActions.arsonistTargetId = null;
      markSubmitted(room, actor.id);
    }
  }

  resolveNightAction(context: NightResolutionContext, actor: PlayerState): void {
    const { room } = context;
    const action = room.nightActions.arsonistActionThisNight;
    if (!action) return;

    if (action === 'DOUSE' && room.nightActions.arsonistTargetId) {
      const target = room.players.find(
        (p) =>
          p.id === room.nightActions.arsonistTargetId &&
          p.isAlive &&
          p.id !== actor.id
      );
      if (target) {
        if (!room.arsonistDousedIds.includes(target.id)) {
          room.arsonistDousedIds.push(target.id);
        }
        actor.stats.abilitiesUsed += 1;
      }
      return;
    }

    if (action === 'IGNITE') {
      const aliveTargets = room.arsonistDousedIds.filter((id) =>
        room.players.some((p) => p.id === id && p.isAlive && p.id !== actor.id)
      );
      for (const id of aliveTargets) {
        context.arsonistIgnitedIds.add(id);
      }
      if (aliveTargets.length > 0) {
        actor.stats.abilitiesUsed += 1;
        actor.stats.killsTriggered += aliveTargets.length;
      }
      room.arsonistDousedIds = [];
    }
  }
}

export const ROLE_STRATEGIES: Record<RoleType, RoleStrategy> = {
  // Normal (Village)
  VILLAGER: new PassiveRoleStrategy('VILLAGER'),
  SEER: new SeerStrategy(),
  WITCH: new WitchStrategy(),
  GUARD: new GuardStrategy(),
  HUNTER: new PassiveRoleStrategy('HUNTER'),
  LITTLE_GIRL: new LittleGirlStrategy(),
  ELDER: new PassiveRoleStrategy('ELDER'),
  BEAR_TAMER: new PassiveRoleStrategy('BEAR_TAMER'),
  CROW: new CrowStrategy(),
  CUPID: new CupidStrategy(),
  // Qatil (Werewolves)
  WEREWOLF: new WerewolfStrategy('WEREWOLF'),
  BLACK_WOLF: new BlackWolfStrategy(),
  MYSTIC_WOLF: new MysticWolfStrategy(),
  VENGEFUL_WOLF: new WerewolfStrategy('VENGEFUL_WOLF'),
  SHADOW_WOLF: new WerewolfStrategy('SHADOW_WOLF'),
  // Tərəfsiz (Neutrals)
  ANGEL: new PassiveRoleStrategy('ANGEL'),
  WHITE_WOLF: new WhiteWolfStrategy(),
  ARSONIST: new ArsonistStrategy(),
  JESTER: new PassiveRoleStrategy('JESTER'),
  WILD_CHILD: new WildChildStrategy(),
};

export function getRoleStrategy(role: RoleType): RoleStrategy {
  return ROLE_STRATEGIES[role];
}
