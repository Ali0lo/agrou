import React from 'react';
import {
  AlertTriangle,
  Award,
  Crosshair,
  Eye,
  EyeOff,
  FastForward,
  FlaskConical,
  HeartPulse,
  Lock,
  RotateCcw,
  Skull,
  Sparkles,
  Trophy,
  Vote,
} from 'lucide-react';
import {
  ActiveNightSubMode,
  NightActionPayload,
  ROLE_CATALOG,
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

  const wolfTargetPlayer = self?.currentWolfTargetId
    ? room.players.find((p) => p.id === self.currentWolfTargetId)
    : null;

  const loverPartner = self?.loverPartnerId
    ? room.players.find((p) => p.id === self.loverPartnerId)
    : null;

  // 1. Hunter's Revenge 15s Interrupt Banner
  if (room.hunterRevenge && !room.hunterRevenge.resolved) {
    const hunter = room.players.find(
      (p) => p.id === room.hunterRevenge?.hunterId
    );
    const isMeHunter = self?.playerId === room.hunterRevenge.hunterId;

    return (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600/30 via-red-900/40 to-slate-900 border-2 border-amber-400/70 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg">
            <Crosshair className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
              🎯 Ovçunun Son İntiqamı (15s Pəncərə)
            </h3>
            <p className="text-xs text-slate-200">
              {isMeHunter
                ? 'Son nəfəsinizdə vurmaq üçün tonqal ətrafındakı canlı oyunçulardan birinə klikləyin!'
                : `${hunter?.nickname ?? 'Ovçu'} son atəşini hədəfləyir...`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. GAME OVER Summary & MVP Awards (Always reveals all roles)
  if (room.phase === 'GAME_OVER') {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-900 border-2 border-amber-500/50 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
                Oyun Bitdi — {room.winner} Qələbəsi
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {room.winReason}
              </h2>
            </div>
          </div>

          {selfPlayer?.isHost && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
            >
              <RotateCcw className="w-4 h-4" /> Yenidən Oyna (Eyni Otaq)
            </button>
          )}
        </div>

        {/* MVP Awards */}
        {room.mvpAwards.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" /> Tonqal MVP Mükafatları
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {room.mvpAwards.map((mvp) => {
                const roleMeta = ROLE_CATALOG[mvp.role];
                return (
                  <div
                    key={mvp.title}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-300">
                        🏅 {mvp.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeBg}`}
                      >
                        {roleMeta.icon} {roleMeta.nameAz}
                      </span>
                    </div>
                    <p className="text-sm font-black text-white">
                      {mvp.nickname}
                    </p>
                    <p className="text-xs text-slate-400">{mvp.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. NIGHT PHASE Role Controls
  if (room.phase === 'NIGHT_PHASE' && self) {
    return (
      <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 backdrop-blur-md space-y-3 shadow-xl">
        {/* Lovers Bond Notification */}
        {loverPartner && (
          <div className="px-3 py-1.5 rounded-xl bg-pink-500/15 border border-pink-400/40 text-pink-200 text-xs font-semibold flex items-center gap-2">
            <span>💘</span>
            <span>
              Aşiq ortağınız: <strong>{loverPartner.nickname}</strong>. Biri ölərsə, digəri də dərhal ölür!
            </span>
          </div>
        )}

        {/* Alert Banner for Wolves when Little Girl is detected spying */}
        {room.wolfAlertedThisNight &&
          (self.role === 'WEREWOLF' ||
            self.role === 'BIG_BAD_WOLF' ||
            self.role === 'BLACK_WOLF' ||
            self.role === 'WOLF_SEER' ||
            self.role === 'WHITE_WOLF') && (
            <div className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                👀 Kolluqda xışıltı var! Kiçik Qız bu gecə sürünü gizlicə izləyir!
              </span>
            </div>
          )}

        {!isAlive ? (
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>
              👻 İzləyici Rejimi (Spectator) — Bütün rolları görə və Ruh Söhbətində (Ghost Chat) danışa bilərsiniz.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* THIEF (Oğru) Night 1 Card Swap */}
            {self.role === 'THIEF' &&
              room.nightNumber === 1 &&
              self.thiefExtraRoles && (
                <div className="w-full flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-200">
                    <span className="font-bold text-amber-300">
                      🎭 Oğru (Thief):
                    </span>{' '}
                    Mərkəzdəki 2 əlavə kartdan birini seçərək rolunuzu dəyişin:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {self.thiefExtraRoles.map((cardRole, idx) => {
                      const meta = ROLE_CATALOG[cardRole];
                      return (
                        <button
                          key={`${cardRole}-${idx}`}
                          type="button"
                          onClick={() =>
                            onSubmitNightAction({
                              actionType: 'THIEF_SWAP',
                              choiceIndex: idx as 0 | 1,
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition hover:scale-105 ${meta.badgeBg}`}
                        >
                          <span>{meta.icon}</span>
                          <span>
                            Kart #{idx + 1}: {meta.nameAz} ({meta.nameEn})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* WITCH (Cadugər) */}
            {self.role === 'WITCH' && self.witchPotions && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-fuchsia-300">
                    🧪 Cadugər (Witch):
                  </span>{' '}
                  {wolfTargetPlayer ? (
                    <span>
                      Canavarların hədəfi:{' '}
                      <strong className="text-rose-400">
                        {wolfTargetPlayer.nickname}
                      </strong>
                      !
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Canavarların hədəf seçməsi gözlənilir...
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      !self.witchPotions.healAvailable || !wolfTargetPlayer
                    }
                    onClick={() =>
                      onSubmitNightAction({ actionType: 'WITCH_HEAL' })
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 disabled:opacity-40 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <HeartPulse className="w-3.5 h-3.5" />
                    <span>
                      {self.witchPotions.healAvailable
                        ? `Həyat İksiri (${
                            wolfTargetPlayer
                              ? `Xilas et: ${wolfTargetPlayer.nickname}`
                              : 'Hədəf yoxdur'
                          })`
                        : 'Həyat İksiri İşlənib'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!self.witchPotions.poisonAvailable}
                    onClick={() =>
                      onSetActiveNightMode(
                        activeNightMode === 'WITCH_POISON'
                          ? 'DEFAULT'
                          : 'WITCH_POISON'
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                      activeNightMode === 'WITCH_POISON'
                        ? 'bg-fuchsia-600 text-white border-fuchsia-300 shadow-lg'
                        : 'bg-fuchsia-600/25 hover:bg-fuchsia-600/40 border-fuchsia-400/40 text-fuchsia-200 disabled:opacity-40'
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>
                      {self.witchPotions.poisonAvailable
                        ? activeNightMode === 'WITCH_POISON'
                          ? 'Zəhərləmək üçün oyunçuya kliklə (Ləğv et)'
                          : 'Ölüm İksiri (Zəhərlə)'
                        : 'Ölüm İksiri İşlənib'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* BLACK WOLF (Yoluxucu Ata Canavar) */}
            {self.role === 'BLACK_WOLF' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-red-400">
                    🖤 Yoluxucu Ata Canavar:
                  </span>{' '}
                  Sürü ilə səs verin və ya hədəfi Canavara çevirin.{' '}
                  {wolfTargetPlayer && (
                    <span>
                      Sürü hədəfi:{' '}
                      <strong className="text-amber-300">
                        {wolfTargetPlayer.nickname}
                      </strong>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    !self.blackWolfInfectionAvailable || !wolfTargetPlayer
                  }
                  onClick={() =>
                    onSubmitNightAction({ actionType: 'BLACK_WOLF_INFECT' })
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-red-600/35 hover:bg-red-600/55 disabled:opacity-40 border border-red-400/50 text-red-100 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {self.blackWolfInfectionAvailable
                      ? self.nightActionSummary
                        ? 'Yoluxdurmanı Ləğv Et'
                        : `Yoluxdur: ${
                            wolfTargetPlayer?.nickname ?? 'Hədəf'
                          } (Oyun boyu 1x)`
                      : 'Yoluxdurma İşlənib'}
                  </span>
                </button>
              </div>
            )}

            {/* BIG BAD WOLF (Böyük Qara Canavar) */}
            {self.role === 'BIG_BAD_WOLF' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-red-400">
                    🐾 Böyük Qara Canavar:
                  </span>{' '}
                  Sürü səsverməsindən əlavə ikinci qurbanı seçə bilərsiniz (ilk canavar ölənə qədər).
                </div>

                <button
                  type="button"
                  disabled={!self.canBigBadWolfKill}
                  onClick={() =>
                    onSetActiveNightMode(
                      activeNightMode === 'BIG_BAD_WOLF_KILL'
                        ? 'DEFAULT'
                        : 'BIG_BAD_WOLF_KILL'
                    )
                  }
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                    activeNightMode === 'BIG_BAD_WOLF_KILL'
                      ? 'bg-red-500 text-white border-red-200'
                      : 'bg-red-600/25 hover:bg-red-600/40 border-red-400/40 text-red-200 disabled:opacity-40'
                  }`}
                >
                  <Skull className="w-3.5 h-3.5" />
                  <span>
                    {self.canBigBadWolfKill
                      ? activeNightMode === 'BIG_BAD_WOLF_KILL'
                        ? '2-ci Qurbana Kliklə (Sürü Səsinə Qayıt)'
                        : '2-ci Qurbanı Seç (Əlavə Hücum)'
                      : 'Canavar öldüyü üçün əlavə hücum deaktivdir'}
                  </span>
                </button>
              </div>
            )}

            {/* WOLF SEER (Görücü Canavar) */}
            {self.role === 'WOLF_SEER' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-rose-300">
                    👁️‍🗨️ Görücü Canavar:
                  </span>{' '}
                  Həm sürü ilə səs verə, həm də bir oyunçunun rolunu yoxlaya bilərsiniz.
                </div>

                <button
                  type="button"
                  disabled={self.hasSubmittedNightAction}
                  onClick={() =>
                    onSetActiveNightMode(
                      activeNightMode === 'WOLF_SEER_INSPECT'
                        ? 'DEFAULT'
                        : 'WOLF_SEER_INSPECT'
                    )
                  }
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                    activeNightMode === 'WOLF_SEER_INSPECT'
                      ? 'bg-purple-500 text-white border-purple-200'
                      : 'bg-purple-600/25 hover:bg-purple-600/40 border-purple-400/40 text-purple-200 disabled:opacity-40'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    {self.hasSubmittedNightAction
                      ? 'Bu gecə yoxlama aparılıb'
                      : activeNightMode === 'WOLF_SEER_INSPECT'
                      ? 'Yoxlamaq üçün oyunçuya kliklə (Ləğv et)'
                      : 'Rol Yoxla (Inspect Mode)'}
                  </span>
                </button>
              </div>
            )}

            {/* WHITE WOLF (Ağ Canavar) */}
            {self.role === 'WHITE_WOLF' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  <span className="font-bold text-indigo-300">
                    🐻‍❄️ Ağ Canavar:
                  </span>{' '}
                  Sürü ilə səs verin; cüt gecələrdə isə digər bir Canavarı öldürə bilərsiniz.
                </div>

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
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                    activeNightMode === 'WHITE_WOLF_KILL'
                      ? 'bg-indigo-500 text-slate-950 border-indigo-200'
                      : 'bg-indigo-500/25 hover:bg-indigo-500/40 border-indigo-400/40 text-indigo-200 disabled:opacity-40'
                  }`}
                >
                  <Skull className="w-3.5 h-3.5" />
                  <span>
                    {room.nightNumber % 2 === 0
                      ? activeNightMode === 'WHITE_WOLF_KILL'
                        ? 'Canavara Kliklə (Ləğv et)'
                        : `Canavara Xəyanət Et (Gecə ${room.nightNumber})`
                      : 'Tək Hücum Cüt Gecələrdə Açılır'}
                  </span>
                </button>
              </div>
            )}

            {/* LITTLE GIRL (Kiçik Qız) */}
            {self.role === 'LITTLE_GIRL' && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleLittleGirlPeek(!self.isPeeking)}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                      self.isPeeking
                        ? 'bg-teal-500 text-slate-950 border-teal-200 shadow-[0_0_20px_rgba(20,184,166,0.5)]'
                        : 'bg-teal-500/20 hover:bg-teal-500/35 border-teal-400/40 text-teal-200'
                    }`}
                  >
                    {self.isPeeking ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> İzləməni Dayandır
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Canavar Söhbətinə Bax (Peek)
                      </>
                    )}
                  </button>
                  <span className="text-xs text-slate-300">
                    {self.isPeeking
                      ? 'Canavar söhbətini gizlicə oxuyursunuz!'
                      : 'Canavarların yazışmasını anonim oxumaq üçün klikləyin.'}
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-[180px]">
                  <span className="text-[11px] font-bold text-amber-300">
                    İfşa Riski: {self.exposureLevel}%
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        self.exposureLevel > 60
                          ? 'bg-rose-500'
                          : self.exposureLevel > 30
                          ? 'bg-amber-400'
                          : 'bg-teal-400'
                      }`}
                      style={{ width: `${self.exposureLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Other Roles Night Instructions */}
            {self.role !== 'WITCH' &&
              self.role !== 'BLACK_WOLF' &&
              self.role !== 'BIG_BAD_WOLF' &&
              self.role !== 'WOLF_SEER' &&
              self.role !== 'WHITE_WOLF' &&
              self.role !== 'LITTLE_GIRL' &&
              !(self.role === 'THIEF' && room.nightNumber === 1 && self.thiefExtraRoles) && (
                <div className="text-xs text-indigo-200 flex items-center gap-2">
                  <span>{ROLE_CATALOG[self.role].icon}</span>
                  <span>
                    {self.role === 'SEER'
                      ? '🔮 Kahin: Rolunu öyrənmək üçün tonqal ətrafındakı bir oyunçuya klikləyin.'
                      : self.role === 'GUARD'
                      ? '🛡️ Mühafizəçi: Bu gecə canavarlardan qorumaq üçün bir oyunçuya klikləyin.'
                      : self.role === 'FOX'
                      ? self.foxPowerLost
                        ? '🦊 Tülkü: Qoxu qabiliyyətinizi itirmisiniz.'
                        : '🦊 Tülkü: Bir oyunçuya klikləyərək onu və sağ/sol qonşularını (3 nəfəri) iyləyin.'
                      : self.role === 'MEDIUM'
                      ? '👻 Ruhçağıran: Ruh Söhbəti (Ghost Chat) tabında ölülərlə danışın və ya ölən oyunçunun məzarına klikləyib rolunu öyrənin.'
                      : self.role === 'CROW'
                      ? '🐦‍⬛ Qarğa: Sabahkı səsvermədə +2 avtomatik səs vermək üçün bir oyunçunu lənətləyin.'
                      : self.role === 'CUPID' && room.nightNumber === 1
                      ? '💘 Kupidon: Aşiqlər (Lovers) olaraq birləşdirmək üçün növbə ilə 2 oyunçuya klikləyin.'
                      : self.role === 'WILD_CHILD' && room.nightNumber === 1
                      ? '🐾 Vəhşi Uşaq: Özünüzə Kumir (Role Model) seçmək üçün bir oyunçuya klikləyin.'
                      : self.role === 'SERIAL_KILLER'
                      ? '🗡️ Zərbəçi (Qatil): Bu gecə aradan götürmək üçün bir hədəfə klikləyin.'
                      : self.role === 'WEREWOLF'
                      ? '🐺 Canavar: Sürü söhbətində məsləhətləşin və qurbana səs verin.'
                      : self.role === 'SISTERS'
                      ? '🤝 Qardaşlar: Qardaş Söhbəti tabında bir-birinizlə gizlicə danışa bilərsiniz.'
                      : '🌙 Gecə düşüb... Xüsusi rollar öz həmlələrini edərkən tonqal ətrafında gözləyin.'}
                  </span>
                </div>
              )}
          </div>
        )}
      </div>
    );
  }

  // 4. DAWN SUMMARY Banner (Respects revealDeadRoles!)
  if (room.phase === 'DAWN_SUMMARY') {
    return (
      <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 backdrop-blur-md space-y-2 shadow-xl">
        {self?.wasInfectedToWolf && (
          <div className="px-3 py-2 rounded-xl bg-red-600/30 border border-red-400/60 text-red-100 text-xs font-bold">
            🐺 Yoluxucu Ata Canavar sizi gecə yoluxdurdu! Artıq Canavar Sürüsünün üzvüsünüz!
          </div>
        )}
        {room.lastNightCasualties.length === 0 ? (
          <p className="text-sm font-bold text-amber-200">
            🌅 Səhər açıldı — gecə sakit keçdi, heç kim ölmədi!
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
              🌅 Gecənin Qurbanları
            </p>
            <div className="flex flex-wrap gap-2">
              {room.lastNightCasualties.map((c) => {
                const roleMeta =
                  c.role !== 'UNKNOWN' ? ROLE_CATALOG[c.role] : null;
                return (
                  <div
                    key={c.playerId}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-100 flex items-center gap-2"
                  >
                    <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    {roleMeta ? (
                      <span>
                        <strong>{c.nickname}</strong> öldürüldü — Rolu:{' '}
                        <strong className="text-amber-300">
                          {roleMeta.icon} {roleMeta.nameAz} ({roleMeta.nameEn})
                        </strong>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <strong>{c.nickname}</strong> öldürüldü —{' '}
                        <strong className="text-slate-300 flex items-center gap-1">
                          Rolu gizlidir <Lock className="w-3 h-3 inline" />
                        </strong>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. DAY DISCUSSION Toolbar ("End Discussion Early" >50% skip vote)
  if (room.phase === 'DAY_DISCUSSION') {
    const hasVotedSkip = Boolean(
      self && room.skipDiscussionVotes.includes(self.playerId)
    );

    return (
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="text-xs text-slate-200">
          <span className="font-bold text-amber-300">
            ☀️ Gün {room.dayNumber} Müzakirəsi:
          </span>{' '}
          Səsvermə başlamazdan əvvəl kimin Canavar olduğunu müzakirə edin.
        </div>

        {isAlive && (
          <button
            type="button"
            onClick={onToggleSkipDiscussion}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              hasVotedSkip
                ? 'bg-amber-500 text-slate-950 border-amber-200 shadow'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>
              Müzakirəni Bitir ({room.skipDiscussionVotes.length}/{skipThreshold}{' '}
              tələb olunur)
            </span>
          </button>
        )}
      </div>
    );
  }

  // 6. DAY VOTING Toolbar ("Skip Vote" button)
  if (room.phase === 'DAY_VOTING') {
    const myVote = self ? room.dayVotes[self.playerId] : null;
    const skipVotesCount = Object.values(room.dayVotes).filter(
      (v) => v === 'SKIP'
    ).length;

    return (
      <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="text-xs text-slate-200 flex items-center gap-2">
          <Vote className="w-4 h-4 text-rose-400" />
          <span>
            <strong>Gün {room.dayNumber} Səsverməsi:</strong> Şübhəli oyunçuya
            klikləyərək səs verin (Şerifin səsi 2x sayılır).
          </span>
        </div>

        {isAlive && (
          <button
            type="button"
            onClick={() => onCastDayVote(myVote === 'SKIP' ? null : 'SKIP')}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              myVote === 'SKIP'
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
            }`}
          >
            Səsi Keç / Skip ({skipVotesCount})
          </button>
        )}
      </div>
    );
  }

  // 7. EXECUTION REVEAL Banner (Respects revealDeadRoles!)
  if (room.phase === 'EXECUTION_REVEAL') {
    const executed = room.lastExecutedPlayer;
    const roleMeta =
      executed && executed.role !== 'UNKNOWN'
        ? ROLE_CATALOG[executed.role]
        : null;

    return (
      <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 backdrop-blur-md shadow-xl">
        {executed ? (
          <div className="flex items-center gap-3 text-xs sm:text-sm text-rose-100">
            <Skull className="w-5 h-5 text-rose-400 shrink-0" />
            {roleMeta ? (
              <span>
                ⚖️ <strong>{executed.nickname}</strong> kənd səsverməsi ilə edam
                edildi — Rolu:{' '}
                <strong className="text-amber-300">
                  {roleMeta.icon} {roleMeta.nameAz} ({roleMeta.nameEn})
                </strong>
              </span>
            ) : (
              <span>
                ⚖️ <strong>{executed.nickname}</strong> kənd səsverməsi ilə edam
                edildi — <strong>Rolu gizlidir 🔒</strong>
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm font-bold text-amber-200">
            ⚖️ Səsvermə bərabərliklə bitdi — bu gün heç kim edam edilmədi!
          </p>
        )}
      </div>
    );
  }

  return null;
};
