import { MvpAward, RoomState, WinningFaction } from '../types/game.js';
import { isWolfPackRole } from './roles/RoleStrategy.js';

export interface WinCheckResult {
  isGameOver: boolean;
  winner: WinningFaction | null;
  reason: string | null;
}

export class WinConditionChecker {
  static check(
    room: RoomState,
    context?: { justExecutedPlayerId?: string }
  ): WinCheckResult {
    // 1. Check Jester (Təlxək / Dəli) & Day 1 Angel Execution Win
    if (context?.justExecutedPlayerId) {
      const executed = room.players.find(
        (p) => p.id === context.justExecutedPlayerId
      );
      if (executed && executed.role === 'JESTER') {
        return {
          isGameOver: true,
          winner: 'JESTER',
          reason: `🃏 ${executed.nickname} (Təlxək / Jester) kəndi aldadaraq özünü edam etdirdi və təkbaşına qalib oldu!`,
        };
      }
      if (executed && executed.role === 'ANGEL' && room.dayNumber === 1) {
        return {
          isGameOver: true,
          winner: 'ANGEL',
          reason: `${executed.nickname} (the Angel) was executed by the village on Day 1 and ascended to victory!`,
        };
      }
    }

    const alivePlayers = room.players.filter((p) => p.isAlive);

    // 2. Lovers (Aşiqlər) Solo Pair Win: if the last 2 alive players are the linked Lovers
    if (alivePlayers.length === 2 && room.lovers) {
      const [l1, l2] = room.lovers;
      const bothLoversAlive =
        alivePlayers.some((p) => p.id === l1) &&
        alivePlayers.some((p) => p.id === l2);
      if (bothLoversAlive) {
        const p1 = alivePlayers[0];
        const p2 = alivePlayers[1];
        // If they are cross-faction (e.g. Wolf + Villager/Neutral), or last two standing
        if (p1.faction !== p2.faction) {
          return {
            isGameOver: true,
            winner: 'LOVERS',
            reason: `💘 Aşiqlər (${p1.nickname} & ${p2.nickname}) bütün maneələri aşaraq birlikdə sağ qaldılar və qalib gəldilər!`,
          };
        }
      }
    }

    const aliveWhiteWolves = alivePlayers.filter((p) => p.role === 'WHITE_WOLF');
    const aliveSerialKillers = alivePlayers.filter(
      (p) => p.role === 'SERIAL_KILLER'
    );
    const alivePackWolves = alivePlayers.filter(
      (p) =>
        p.role === 'WEREWOLF' ||
        p.role === 'BIG_BAD_WOLF' ||
        p.role === 'BLACK_WOLF' ||
        p.role === 'WOLF_SEER'
    );
    const totalHostileThreats =
      alivePackWolves.length +
      aliveWhiteWolves.length +
      aliveSerialKillers.length;
    const aliveNonWolves = alivePlayers.filter((p) => !isWolfPackRole(p.role));

    // 3. White Wolf solo win: only when White Wolf is the very last player alive
    if (alivePlayers.length === 1 && aliveWhiteWolves.length === 1) {
      const ww = aliveWhiteWolves[0];
      return {
        isGameOver: true,
        winner: 'WHITE_WOLF',
        reason: `🐻‍❄️ ${ww.nickname} (Ağ Canavar / White Wolf) həm kəndi, həm də sürünü məhv edərək tək sağ qalan qalib oldu!`,
      };
    }

    // 4. Serial Killer solo win: only when Serial Killer is the very last player alive
    if (alivePlayers.length === 1 && aliveSerialKillers.length === 1) {
      const sk = aliveSerialKillers[0];
      return {
        isGameOver: true,
        winner: 'SERIAL_KILLER',
        reason: `🗡️ ${sk.nickname} (Zərbəçi / Serial Killer) gecənin tək hakimi olaraq qalib gəldi!`,
      };
    }

    // 5. Village Team win: all Werewolves and Killing Neutrals (White Wolf, Serial Killer) are dead
    if (totalHostileThreats === 0) {
      return {
        isGameOver: true,
        winner: 'VILLAGE',
        reason:
          '🌾 Bütün Canavarlar və təhlükələr zərərsizləşdirildi! Kəndlilər (Village) qalib gəldi!',
      };
    }

    // Check if living cross-faction Lovers exist (if so, game continues until Lovers or their faction resolves)
    let hasLivingCrossFactionLovers = false;
    if (room.lovers) {
      const p1 = alivePlayers.find((p) => p.id === room.lovers?.[0]);
      const p2 = alivePlayers.find((p) => p.id === room.lovers?.[1]);
      if (p1 && p2 && p1.faction !== p2.faction) {
        hasLivingCrossFactionLovers = true;
      }
    }

    // 6. Werewolf Team win: Werewolves equal or outnumber non-Werewolves
    // (when no White Wolf, Serial Killer, or cross-faction Lovers remain to contest)
    if (
      aliveWhiteWolves.length === 0 &&
      aliveSerialKillers.length === 0 &&
      !hasLivingCrossFactionLovers &&
      alivePackWolves.length >= aliveNonWolves.length
    ) {
      return {
        isGameOver: true,
        winner: 'WEREWOLF',
        reason:
          '🐺 Canavarlar kəndlilərin sayına çatdı və tonqal ətrafını ələ keçirdi! Canavarlar qalib gəldi!',
      };
    }

    return {
      isGameOver: false,
      winner: null,
      reason: null,
    };
  }

  static convertSurvivingAngelsAfterDay1(room: RoomState): string[] {
    if (room.dayNumber !== 1) return [];
    const convertedIds: string[] = [];

    for (const player of room.players) {
      if (player.isAlive && player.role === 'ANGEL') {
        player.role = 'VILLAGER';
        player.faction = 'VILLAGE';
        convertedIds.push(player.id);
      }
    }

    return convertedIds;
  }

  static computeMvpAwards(room: RoomState): MvpAward[] {
    const awards: MvpAward[] = [];
    if (room.players.length === 0) return awards;

    const sortedByImpact = [...room.players].sort((a, b) => {
      const scoreA =
        a.stats.abilitiesUsed * 3 +
        a.stats.correctWolfVotes * 4 +
        a.stats.killsTriggered * 3 +
        a.stats.nightsSurvived * 2 +
        (a.isAlive ? 5 : 0);
      const scoreB =
        b.stats.abilitiesUsed * 3 +
        b.stats.correctWolfVotes * 4 +
        b.stats.killsTriggered * 3 +
        b.stats.nightsSurvived * 2 +
        (b.isAlive ? 5 : 0);
      return scoreB - scoreA;
    });

    const topPlayer = sortedByImpact[0];
    if (topPlayer) {
      awards.push({
        playerId: topPlayer.id,
        nickname: topPlayer.nickname,
        role: topPlayer.role,
        title: 'Tonqal MVP (Campfire MVP)',
        description: `${topPlayer.stats.nightsSurvived} gecə sağ qaldı və oyuna ən böyük təsiri göstərdi.`,
      });
    }

    const bestVoter = [...room.players]
      .filter((p) => p.stats.correctWolfVotes > 0)
      .sort((a, b) => b.stats.correctWolfVotes - a.stats.correctWolfVotes)[0];

    if (bestVoter && bestVoter.id !== topPlayer?.id) {
      awards.push({
        playerId: bestVoter.id,
        nickname: bestVoter.nickname,
        role: bestVoter.role,
        title: 'İti İntuisiya (Sharpest Instincts)',
        description: `Canavarlara qarşı ${bestVoter.stats.correctWolfVotes} dəqiq səs verdi.`,
      });
    }

    const nightOwl = [...room.players]
      .filter((p) => p.stats.abilitiesUsed > 0)
      .sort((a, b) => b.stats.abilitiesUsed - a.stats.abilitiesUsed)[0];

    if (
      nightOwl &&
      !awards.some((existing) => existing.playerId === nightOwl.id)
    ) {
      awards.push({
        playerId: nightOwl.id,
        nickname: nightOwl.nickname,
        role: nightOwl.role,
        title: 'Gecə Ustası (Master of the Night)',
        description: `${nightOwl.stats.abilitiesUsed} gecə qabiliyyətini uğurla işlətdi.`,
      });
    }

    return awards;
  }
}
