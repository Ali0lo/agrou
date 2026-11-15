import { MvpAward, RoomState, WinningFaction } from '../types/game.js';
import { isQatilFactionRole, isWolfPackRole } from './roles/RoleStrategy.js';

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
    // 1. Day 1 Angel Instant Execution Win
    // 1. Jester any-day Vote Execution solo win & Angel Day 1 Vote Execution solo win
    if (context?.justExecutedPlayerId) {
      const executed = room.players.find(
        (p) => p.id === context.justExecutedPlayerId
      );
      if (executed && executed.role === 'JESTER') {
        return {
          isGameOver: true,
          winner: 'JESTER',
          reason: `🃏 ${executed.nickname} (Təlxək / Jester) kənd səsverməsində edam edildi və təkbaşına qalib gəldi!`,
        };
      }
      if (executed && executed.role === 'ANGEL' && room.dayNumber === 1) {
        return {
          isGameOver: true,
          winner: 'ANGEL',
          reason: `👼 ${executed.nickname} (Mələk / Angel) 1-ci gün səsvermə ilə edam edildi və təkbaşına qalib gəldi!`,
        };
      }
    }

    const alivePlayers = room.players.filter((p) => p.isAlive);

    // 2. Mutual destruction / No survivors
    if (alivePlayers.length === 0) {
      return {
        isGameOver: true,
        winner: 'NONE',
        reason: '🌑 Tonqal ətrafında heç kim sağ qalmadı — oyun bərabərliklə bitdi!',
      };
    }

    // 2b. Mixed-faction Lovers solo duo win (last 2 survivors together)
    const hasAliveMixedLovers = alivePlayers.some((p) => {
      if (!p.loverPartnerId) return false;
      const partner = alivePlayers.find((o) => o.id === p.loverPartnerId);
      return Boolean(partner && partner.faction !== p.faction);
    });

    if (alivePlayers.length === 2) {
      const [first, second] = alivePlayers;
      if (
        first.loverPartnerId === second.id &&
        second.loverPartnerId === first.id &&
        first.faction !== second.faction
      ) {
        return {
          isGameOver: true,
          winner: 'LOVERS',
          reason: `💘 Aşiqlər (${first.nickname} & ${second.nickname}) fərqli komandalardan olsalar da son 2 sağ qalan olaraq qalib gəldilər!`,
        };
      }
    }

    const aliveWhiteWolves = alivePlayers.filter((p) => p.role === 'WHITE_WOLF');
    const aliveArsonists = alivePlayers.filter((p) => p.role === 'ARSONIST');
    const aliveQatilWolves = alivePlayers.filter((p) =>
      isQatilFactionRole(p.role)
    );
    const totalHostileThreats =
      aliveQatilWolves.length +
      aliveWhiteWolves.length +
      aliveArsonists.length;

    // 3. White Wolf sole survivor solo win
    if (alivePlayers.length === 1 && aliveWhiteWolves.length === 1) {
      const ww = aliveWhiteWolves[0];
      return {
        isGameOver: true,
        winner: 'WHITE_WOLF',
        reason: `🐻‍❄️ ${ww.nickname} (Ağ Canavar / White Wolf) sağ qalan sonuncu oyunçu olaraq təkbaşına qalib gəldi!`,
      };
    }

    // 4. Arsonist sole survivor solo win
    if (alivePlayers.length === 1 && aliveArsonists.length === 1) {
      const arso = aliveArsonists[0];
      return {
        isGameOver: true,
        winner: 'ARSONIST',
        reason: `🔥 ${arso.nickname} (Alovçu / Arsonist) bütün tonqalı külə çevirib sonuncu sağ qalan qalib oldu!`,
      };
    }

    // 5. Normal (Village Team) win: all Qatil and lethal Tərəfsiz (White Wolf, Arsonist) eliminated
    if (totalHostileThreats === 0) {
      return {
        isGameOver: true,
        winner: 'VILLAGE',
        reason:
          '🌾 Bütün Qatillər və təhlükəli Tərəfsizlər zərərsizləşdirildi! Normal (Kənd) komandası qalib gəldi!',
      };
    }

    // 6. Qatil (Werewolf Team) win: alive Qatil equal or outnumber all other alive players
    // (while White Wolf, Arsonist, and cross-faction Lovers no longer contest survival)
    const aliveNonWolves = alivePlayers.filter((p) => !isWolfPackRole(p.role));
    if (
      !hasAliveMixedLovers &&
      aliveWhiteWolves.length === 0 &&
      aliveArsonists.length === 0 &&
      aliveQatilWolves.length >= aliveNonWolves.length
    ) {
      return {
        isGameOver: true,
        winner: 'WEREWOLF',
        reason:
          '🐺 Qatillər (Canavarlar) qalan bütün oyunçuların sayına çatdı və qalib gəldi!',
      };
    }

    return {
      isGameOver: false,
      winner: null,
      reason: null,
    };
  }

  /**
   * Converts surviving Angel into base Villager before Night 2 begins.
   */
  static convertSurvivingAngelsAfterDay1(room: RoomState): string[] {
    if (room.nightNumber > 2) return [];
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
        description: `Qatillərə qarşı ${bestVoter.stats.correctWolfVotes} dəqiq səs verdi.`,
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
