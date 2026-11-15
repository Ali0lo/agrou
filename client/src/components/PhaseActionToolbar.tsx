import React from 'react';
import {
  Eye,
  EyeOff,
  FastForward,
  Flame,
  Heart,
  Lock,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Vote,
} from 'lucide-react';
import { ROLE_CATALOG } from '../constants/roles';
import {
  ActiveNightSubMode,
  NightActionPayload,
  RoleType,
  SanitizedRoomState,
} from '../types/game';

interface PhaseActionToolbarProps {
  room: SanitizedRoomState;
  activeNightMode: ActiveNightSubMode;
  onSetActiveNightMode: (mode: ActiveNightSubMode) => void;
  onSubmitNightAction: (payload: NightActionPayload) => void;
  onToggleLittleGirlPeek: (peeking: boolean) => void;
  onToggleSkipDiscussion: () => void;
  onCastDayVote: (targetId: string | 'SKIP' | null) => void;
  onPlayAgain: () => void;
}

const WOLF_ROLES: ReadonlySet<RoleType> = new Set([
  'WEREWOLF',
  'BLACK_WOLF',
  'MYSTIC_WOLF',
  'WHITE_WOLF',
]);

export const PhaseActionToolbar: React.FC<PhaseActionToolbarProps> = ({
  room,
  activeNightMode,
  onSetActiveNightMode,
  onSubmitNightAction,
  onToggleLittleGirlPeek,
  onToggleSkipDiscussion,
  onCastDayVote,
  onPlayAgain,
}) => {
  const self = room.self;
  const selfPlayer = room.players.find((p) => p.id === self?.playerId) ?? null;
  const isAlive = Boolean(selfPlayer?.isAlive);
  const aliveCount = room.players.filter((p) => p.isAlive).length;
  const skipThreshold = Math.floor(aliveCount / 2) + 1;

  const findName = (id: string | null | undefined) =>
    room.players.find((p) => p.id === id)?.nickname ?? 'Naməlum';

  // Active Hunter Interrupt Banner overrides regular phase toolbar
  if (room.hunterRevenge && !room.hunterRevenge.resolved) {
    const hunter = room.players.find(
      (p) => p.id === room.hunterRevenge?.hunterId
    );
    const isMeHunter = self?.playerId === room.hunterRevenge.hunterId;

    return (
      <div className="rounded-2xl bg-gradient-to-r from-red-950/90 via-amber-950/80 to-red-950/90 border border-amber-500/60 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0 animate-pulse">
            <Target className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="text-sm font-bold text-amber-200">
              🏹 OVÇU İNTİQAMI — {hunter?.nickname} son gülləsini atır!
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {isMeHunter
                ? 'İntiqam almaq üçün tonqaldan istənilən sağ oyunçuya 15 saniyə içində klikləyin!'
                : 'Ovçu hədəfini seçənə qədər taymer dayandırılıb.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ROLE_REVEAL Banner
  if (room.phase === 'ROLE_REVEAL') {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-amber-500/30 p-3.5 text-center text-xs text-amber-200">
        🎭 Rollar paylandı! Gecə düşmədən əvvəl gizli şəxsiyyətinizi və
        qələbə şərtinizi yadda saxlayın.
      </div>
    );
  }

  // NIGHT_PHASE Controls
  if (room.phase === 'NIGHT_PHASE' && self) {
    if (!isAlive) {
      return (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-700/70 p-3.5 flex items-center gap-2.5 text-xs text-slate-300">
          <Skull className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            👻 Siz artıq ruhunuzu tapşırmısınız (İzləyici rejimi). Sağ qalan
            oyunçuların bütün rollarını görə və Ruhlar çatında yaza bilərsiniz.
          </span>
        </div>
      );
    }

    const roleMeta = ROLE_CATALOG[self.role];
    const isWolf = WOLF_ROLES.has(self.role);
    const dousedCount = self.arsonistDousedTargetIds.length;

    return (
      <div className="rounded-2xl bg-indigo-950/60 border border-indigo-500/35 p-3.5 flex flex-col gap-2.5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{roleMeta.icon}</span>
            <div>
              <div className="text-xs font-bold text-slate-100">
                {roleMeta.displayName} — Gecə Hərəkəti
              </div>
              <div className="text-[11px] text-indigo-200/80">
                {isWolf &&
                  activeNightMode !== 'MYSTIC_WOLF_INSPECT' &&
                  activeNightMode !== 'WHITE_WOLF_KILL' &&
                  '🩸 Sürü qurbanını seçmək üçün sağ oyunçuya klikləyin.'}
                {isWolf &&
                  activeNightMode === 'MYSTIC_WOLF_INSPECT' &&
                  '👁️ GÜC YOXLAMA REJİMİ: Hədəfin xüsusi gücü olub-olmadığını görmək üçün oyunçuya klikləyin.'}
                {isWolf &&
                  activeNightMode === 'WHITE_WOLF_KILL' &&
                  '🗡️ XƏYANƏT REJİMİ: Öldürmək üçün bir Qətil yoldaşınıza klikləyin.'}
                {self.role === 'SEER' &&
                  '🔮 Əsl rolunu görmək üçün bir oyunçuya klikləyin.'}
                {self.role === 'GUARD' &&
                  '🛡️ Qorumaq üçün bir oyunçuya klikləyin (ard-arda eyni şəxs olmaz).'}
                {self.role === 'WITCH' &&
                  (activeNightMode === 'WITCH_POISON'
                    ? '☠️ ZƏHƏR REJİMİ: Zəhərləmək üçün sağ bir oyunçuya klikləyin.'
                    : '🧪 Gecə qurbanını Xilas İksiri ilə dirildə və ya Zəhər rejimini aça bilərsiniz.')}
                {self.role === 'LITTLE_GIRL' &&
                  '👧 Qətillərin gecə çatını gizlicə dinləyə bilərsiniz — amma diqqətli olun!'}
                {self.role === 'ARSONIST' &&
                  `🛢️ Benzin tökmək üçün bir oyunçuya klikləyin (${dousedCount} benzinli), yaxud Alovlandırın.`}
                {(self.role === 'VILLAGER' ||
                  self.role === 'HUNTER' ||
                  self.role === 'ANGEL') &&
                  '😴 Kənd gecə yatır. Gündüzün açılmasını gözləyin.'}
              </div>
            </div>
          </div>

          {self.nightActionSummary && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-semibold">
              ✓ {self.nightActionSummary}
            </span>
          )}
        </div>

        {/* Action Sub-Mode Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* BLACK_WOLF 1x Infect */}
          {self.role === 'BLACK_WOLF' && (
            <button
              type="button"
              disabled={
                !self.blackWolfInfectionAvailable || !self.currentWolfTargetId
              }
              onClick={() =>
                onSubmitNightAction({
                  actionType: 'BLACK_WOLF_INFECT',
                  targetId: self.currentWolfTargetId,
                })
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                self.blackWolfInfectionAvailable && self.currentWolfTargetId
                  ? 'bg-red-700/80 hover:bg-red-600 text-white border-red-400 cursor-pointer'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {self.blackWolfInfectionAvailable
                ? self.currentWolfTargetId
                  ? `🦠 ${findName(self.currentWolfTargetId)} adlı oyunçunu Yoluxdur (1x)`
                  : '🦠 Yoluxdur (1x — əvvəl qurban seçin)'
                : '✓ Yoluxdurma artıq istifadə olunub'}
            </button>
          )}

          {/* MYSTIC_WOLF Inspector Mode */}
          {self.role === 'MYSTIC_WOLF' && (
            <button
              type="button"
              onClick={() =>
                onSetActiveNightMode(
                  activeNightMode === 'MYSTIC_WOLF_INSPECT'
                    ? 'DEFAULT'
                    : 'MYSTIC_WOLF_INSPECT'
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                activeNightMode === 'MYSTIC_WOLF_INSPECT'
                  ? 'bg-fuchsia-600 text-white border-fuchsia-300 shadow-lg'
                  : 'bg-slate-800 hover:bg-slate-700 text-fuchsia-200 border-fuchsia-500/40'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {activeNightMode === 'MYSTIC_WOLF_INSPECT'
                ? '← Sürü Ovuna Qayıt'
                : '👁️ Güc Yoxla (Adi vs Güclü)'}
            </button>
          )}

          {/* WHITE_WOLF Even-Night Betrayal */}
          {self.role === 'WHITE_WOLF' && (
            <button
              type="button"
              disabled={room.nightNumber % 2 !== 0}
              onClick={() =>
                onSetActiveNightMode(
                  activeNightMode === 'WHITE_WOLF_KILL'
                    ? 'DEFAULT'
                    : 'WHITE_WOLF_KILL'
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                room.nightNumber % 2 === 0
                  ? activeNightMode === 'WHITE_WOLF_KILL'
                    ? 'bg-slate-100 text-slate-950 border-white shadow-lg cursor-pointer'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-500 cursor-pointer'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              {room.nightNumber % 2 === 0
                ? activeNightMode === 'WHITE_WOLF_KILL'
                  ? '← Sürü Ovuna Qayıt'
                  : '🗡️ Canavar Yoldaşını Öldür'
                : '🐻‍❄️ Canavara xəyanət cüt gecələrdə açılır'}
            </button>
          )}

          {/* WITCH Potions */}
          {self.role === 'WITCH' && (
            <>
              <button
                type="button"
                disabled={
                  !self.witchPotions?.healAvailable || !self.currentWolfTargetId
                }
                onClick={() =>
                  onSubmitNightAction({
                    actionType: 'WITCH_HEAL',
                    targetId: self.currentWolfTargetId,
                  })
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                  self.witchPotions?.healAvailable && self.currentWolfTargetId
                    ? 'bg-emerald-600/80 hover:bg-emerald-500 text-white border-emerald-400 cursor-pointer'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 cursor-not-allowed'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                {!self.witchPotions?.healAvailable
                  ? 'Xilas İksiri İşlənib'
                  : self.currentWolfTargetId
                    ? `💚 ${findName(self.currentWolfTargetId)} adlı oyunçunu Xilas Et`
                    : '💚 Qurban gözlənilir...'}
              </button>

              <button
                type="button"
                disabled={!self.witchPotions?.poisonAvailable}
                onClick={() =>
                  onSetActiveNightMode(
                    activeNightMode === 'WITCH_POISON'
                      ? 'DEFAULT'
                      : 'WITCH_POISON'
                  )
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                  self.witchPotions?.poisonAvailable
                    ? activeNightMode === 'WITCH_POISON'
                      ? 'bg-violet-600 text-white border-violet-300 cursor-pointer'
                      : 'bg-slate-800 hover:bg-slate-700 text-violet-200 border-violet-500/40 cursor-pointer'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 cursor-not-allowed'
                }`}
              >
                <Skull className="w-3.5 h-3.5" />
                {self.witchPotions?.poisonAvailable
                  ? activeNightMode === 'WITCH_POISON'
                    ? '✕ Zəhər Rejimini Bağla'
                    : '☠️ Ölüm Zəhəri (1x)'
                  : 'Zəhər İşlənib'}
              </button>
            </>
          )}

          {/* LITTLE GIRL Peek & Exposure Bar */}
          {self.role === 'LITTLE_GIRL' && (
            <div className="flex flex-wrap items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => onToggleLittleGirlPeek(!self.isPeeking)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                  self.isPeeking
                    ? 'bg-pink-600 text-white border-pink-300 shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-pink-200 border-pink-500/40'
                }`}
              >
                {self.isPeeking ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Gözünü Çək (Dayandır)
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    👀 Qətil Çatına Gizlicə Bax
                  </>
                )}
              </button>

              <div className="flex-1 min-w-[140px]">
                <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                  <span>Aşkarlanma Riski</span>
                  <span
                    className={
                      self.exposureLevel >= 65
                        ? 'text-red-400 font-bold'
                        : 'text-amber-300'
                    }
                  >
                    {self.exposureLevel}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${self.exposureLevel}%` }}
                    className={`h-full transition-all duration-300 ${
                      self.exposureLevel >= 65
                        ? 'bg-red-500'
                        : 'bg-amber-400'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ARSONIST Ignite Button */}
          {self.role === 'ARSONIST' && (
            <button
              type="button"
              disabled={dousedCount === 0}
              onClick={() =>
                onSubmitNightAction({ actionType: 'ARSONIST_IGNITE' })
              }
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                dousedCount > 0
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white border-orange-300 shadow-lg cursor-pointer'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700 cursor-not-allowed'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              🔥 Hamısını Alovlandır ({dousedCount} Benzinli)
            </button>
          )}
        </div>

        {/* Wolf Alert banner when Little Girl is detected */}
        {isWolf && room.wolfAlertedThisNight && (
          <div className="text-xs text-red-200 bg-red-950/70 border border-red-500/50 rounded-xl px-3 py-1.5 font-medium">
            ⚠️ Kimsə (Kiçik Qız) söhbətinizi gizlicə dinləyir!
          </div>
        )}
      </div>
    );
  }

  // DAWN_SUMMARY Banner
  if (room.phase === 'DAWN_SUMMARY') {
    return (
      <div className="rounded-2xl bg-amber-950/40 border border-amber-500/40 p-3.5 space-y-2 shadow-lg">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
          🌅 {room.dayNumber}-ci Gün Açıldı — Gecə Xülasəsi
        </div>
        {room.lastNightCasualties.length === 0 ? (
          <div className="text-sm text-emerald-200 font-medium">
            🛡️ Bu gecə kənddə heç kim ölmədi! Bütün oyunçular sağdır.
          </div>
        ) : (
          <div className="space-y-1">
            {room.lastNightCasualties.map((c) => {
              const info = c.role !== 'UNKNOWN' ? ROLE_CATALOG[c.role] : null;
              return (
                <div
                  key={c.playerId}
                  className="text-xs text-red-200 bg-red-950/50 border border-red-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold">💀 {c.nickname} öldü</span>
                  {info ? (
                    <span className="text-slate-200">
                      {info.icon} Rolu: <strong>{info.displayName}</strong>
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Rolu gizlidir
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // DAY_DISCUSSION Banner
  if (room.phase === 'DAY_DISCUSSION') {
    const hasVotedSkip =
      selfPlayer && room.skipDiscussionVotes.includes(selfPlayer.id);

    return (
      <div className="rounded-2xl bg-slate-900/80 border border-amber-500/35 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-amber-300">
            ☀️ {room.dayNumber}-ci Gün Müzakirəsi
          </div>
          <div className="text-[11px] text-slate-300">
            Şübhəliləri müzakirə edin. Hazırsınızsa, səsverməyə erkən keçin.
          </div>
        </div>

        {isAlive && (
          <button
            type="button"
            onClick={onToggleSkipDiscussion}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
              hasVotedSkip
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border-amber-500/40'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            Müzakirəni Bitir ({room.skipDiscussionVotes.length}/{skipThreshold})
          </button>
        )}
      </div>
    );
  }

  // DAY_VOTING Banner
  if (room.phase === 'DAY_VOTING') {
    const myVote = selfPlayer ? room.dayVotes[selfPlayer.id] : undefined;

    return (
      <div className="rounded-2xl bg-slate-900/85 border border-orange-500/45 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Vote className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-orange-200">
              🗳️ Edam Səsverməsi
            </div>
            <div className="text-[11px] text-slate-300">
              {isAlive
                ? myVote === 'SKIP'
                  ? 'Səsiniz: Heç kimi asma (Keç).'
                  : myVote
                    ? `Səsiniz: ${findName(myVote)} (dəyişmək üçün yenidən klikləyin).`
                    : 'Asılmasını istədiyiniz oyunçuya klikləyin, yaxud keçin.'
                : 'Ruhlar səsverməyə qarışa bilməz.'}
            </div>
          </div>
        </div>

        {isAlive && (
          <button
            type="button"
            onClick={() =>
              onCastDayVote(myVote === 'SKIP' ? null : 'SKIP')
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              myVote === 'SKIP'
                ? 'bg-slate-200 text-slate-950 border-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
            }`}
          >
            🕊️ Keç (SKIP)
          </button>
        )}
      </div>
    );
  }

  // EXECUTION_REVEAL Banner
  if (room.phase === 'EXECUTION_REVEAL') {
    const ex = room.lastExecutedPlayer;
    const exInfo = ex && ex.role !== 'UNKNOWN' ? ROLE_CATALOG[ex.role] : null;

    return (
      <div className="rounded-2xl bg-slate-900/85 border border-red-500/40 p-3.5 text-xs">
        {ex ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-red-200">
            <span className="font-bold">
              🔨 {ex.nickname} kənd məhkəməsi ilə edam edildi!
            </span>
            {exInfo ? (
              <span>
                {exInfo.icon} Rolu: <strong>{exInfo.displayName}</strong>
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Rolu gizlidir 🔒
              </span>
            )}
          </div>
        ) : (
          <div className="text-slate-200 font-medium">
            ⚖️ Səsvermədə heç kim edam edilmədi. Tezliklə gecə düşür...
          </div>
        )}
      </div>
    );
  }

  // GAME_OVER Summary & MVP Card
  if (room.phase === 'GAME_OVER') {
    const winnerStyle =
      room.winner === 'VILLAGE'
        ? 'from-emerald-950/90 to-slate-900 border-emerald-400/60 text-emerald-200'
        : room.winner === 'WEREWOLF'
          ? 'from-red-950/90 to-slate-900 border-red-400/60 text-red-200'
          : room.winner === 'ANGEL'
            ? 'from-yellow-950/80 to-slate-900 border-yellow-400/60 text-yellow-200'
            : room.winner === 'WHITE_WOLF'
              ? 'from-slate-800 to-slate-950 border-slate-300/60 text-slate-100'
              : room.winner === 'ARSONIST'
                ? 'from-orange-950/90 to-slate-900 border-orange-400/60 text-orange-200'
                : 'from-slate-900 to-slate-950 border-slate-500/60 text-slate-200';

    return (
      <div
        className={`rounded-2xl bg-gradient-to-br ${winnerStyle} border p-4 space-y-3 shadow-2xl`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="text-sm font-extrabold">OYUN BİTDİ</div>
              <div className="text-xs opacity-90">{room.winReason}</div>
            </div>
          </div>

          {selfPlayer?.isHost && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Yenidən Oyna (Lobbiyə Qayıt)
            </button>
          )}
        </div>

        {room.mvpAwards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {room.mvpAwards.map((award) => (
              <div
                key={`${award.playerId}-${award.title}`}
                className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2.5 text-xs"
              >
                <div className="font-bold text-amber-300">{award.title}</div>
                <div className="text-slate-100 font-semibold mt-0.5">
                  {ROLE_CATALOG[award.role].icon} {award.nickname}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {award.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};
