import React, { useState } from 'react';
import {
  Check,
  Copy,
  Flame,
  Lock,
  Play,
  Plus,
  ShieldCheck,
  Sliders,
  Sparkles,
  Unlock,
  Users,
} from 'lucide-react';
import {
  computeQuotaPreview,
  NEUTRAL_ROLES,
  NORMAL_SPECIAL_ROLES,
  QETIL_SPECIAL_ROLES,
  ROLE_CATALOG,
} from '../constants/roles';
import {
  PhaseTimers,
  RoleType,
  SanitizedRoomState,
} from '../types/game';

interface LobbyConfigPanelProps {
  room: SanitizedRoomState;
  isHost?: boolean;
  onUpdateConfig: (update: {
    timers?: Partial<PhaseTimers>;
    enabledRoles?: Partial<Record<RoleType, boolean>>;
    allowWebRTC?: boolean;
    revealDeadRoles?: boolean;
  }) => void;
  onAddBot: () => void;
  onStartGame: () => void;
  error?: string | null;
}

export const LobbyConfigPanel: React.FC<LobbyConfigPanelProps> = ({
  room,
  isHost: isHostProp,
  onUpdateConfig,
  onAddBot,
  onStartGame,
  error = null,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isHost =
    isHostProp ??
    Boolean(room.players.find((p) => p.id === room.self?.playerId)?.isHost);

  const playerCount = room.players.length;
  const quotaPreview = computeQuotaPreview(
    playerCount,
    room.config.enabledRoles
  );

  const inviteUrl = `${window.location.origin}/?room=${room.roomCode}`;

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const toggleRole = (role: RoleType) => {
    if (!isHost) return;
    onUpdateConfig({
      enabledRoles: {
        [role]: !room.config.enabledRoles[role],
      },
    });
  };

  const applyAllEnabledPreset = () => {
    if (!isHost) return;
    onUpdateConfig({
      enabledRoles: {
        VILLAGER: true,
        SEER: true,
        WITCH: true,
        GUARD: true,
        HUNTER: true,
        LITTLE_GIRL: true,
        WEREWOLF: true,
        BLACK_WOLF: true,
        MYSTIC_WOLF: true,
        ANGEL: true,
        WHITE_WOLF: true,
        ARSONIST: true,
      },
    });
  };

  const applyPureClassicPreset = () => {
    if (!isHost) return;
    onUpdateConfig({
      enabledRoles: {
        VILLAGER: true,
        SEER: true,
        WITCH: true,
        GUARD: false,
        HUNTER: true,
        LITTLE_GIRL: false,
        WEREWOLF: true,
        BLACK_WOLF: false,
        MYSTIC_WOLF: false,
        ANGEL: false,
        WHITE_WOLF: false,
        ARSONIST: false,
      },
    });
  };

  const renderToggleCard = (roleKey: RoleType, accentClass: string) => {
    const info = ROLE_CATALOG[roleKey];
    const isEnabled = Boolean(room.config.enabledRoles[roleKey]);

    return (
      <button
        key={roleKey}
        type="button"
        disabled={!isHost}
        onClick={() => toggleRole(roleKey)}
        className={`w-full text-left rounded-xl p-2.5 border transition-all flex items-start justify-between gap-2.5 ${
          isEnabled
            ? `${accentClass} shadow-sm`
            : 'bg-slate-900/50 border-slate-800/80 opacity-60 hover:opacity-85'
        } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base leading-none">{info.icon}</span>
            <span className="text-xs font-semibold text-slate-100 truncate">
              {info.displayName}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950/60 text-slate-300 border border-slate-700/60">
              Maks. 1
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug mt-1 line-clamp-2">
            {info.shortDescription}
          </p>
        </div>

        {/* Boolean ON/OFF Switch */}
        <div
          className={`shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
            isEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
          }`}
          aria-checked={isEnabled}
          role="switch"
        >
          <span className="w-4 h-4 rounded-full bg-white shadow" />
        </div>
      </button>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/85 border border-slate-700/60 backdrop-blur-md p-4 flex flex-col gap-4 shadow-2xl">
      {/* Room Code & Invite Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
            Tonqal Lobbisi (4–16 Oyunçu)
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-2xl font-bold tracking-widest text-white">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Kodu kopyala"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition flex items-center gap-1"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Dəvət Linki
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Users className="w-4 h-4 text-amber-400" />
            <span>{playerCount} / 16</span>
          </div>

          {isHost && playerCount < 16 && (
            <button
              type="button"
              onClick={onAddBot}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/70 text-xs font-semibold text-amber-300 flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Bot Əlavə Et
            </button>
          )}
        </div>
      </div>

      {/* Automatic Faction Quota Preview Banner */}
      <div className="rounded-xl bg-gradient-to-br from-slate-950/90 to-slate-900 border border-amber-500/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span>
              Avtomatik Komanda Kvota Paylanması (
              {playerCount < 4
                ? `Min 4 oyunçu üçün önizləmə`
                : `${playerCount} oyunçu`}
              )
            </span>
          </div>
          {isHost && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={applyAllEnabledPreset}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-semibold text-amber-200 transition"
              >
                Hamısını Aç
              </button>
              <button
                type="button"
                onClick={applyPureClassicPreset}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-slate-300 transition"
              >
                Klassik Sadə
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">
              Normal (Kənd)
            </div>
            <div className="text-lg font-extrabold text-emerald-300">
              {quotaPreview.adjustedNormal}
            </div>
            <div className="text-[10px] text-emerald-200/70">
              {quotaPreview.enabledNormalSpecialCount} xüsusi aktiv
            </div>
          </div>

          <div className="rounded-lg bg-red-950/40 border border-red-500/30 px-2.5 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wider text-red-300/80 font-semibold">
              Qətil (Canavar)
            </div>
            <div className="text-lg font-extrabold text-red-300">
              {quotaPreview.baseQuota.qetil}
            </div>
            <div className="text-[10px] text-red-200/70">
              {quotaPreview.enabledQetilSpecialCount} xüsusi aktiv
            </div>
          </div>

          <div className="rounded-lg bg-violet-950/40 border border-violet-500/30 px-2.5 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wider text-violet-300/80 font-semibold">
              Tərəfsiz (Neutral)
            </div>
            <div className="text-lg font-extrabold text-violet-300">
              {quotaPreview.enabledTerefsizCount}
            </div>
            <div className="text-[10px] text-violet-200/70">
              Kvota: {quotaPreview.baseQuota.terefsiz} yer
            </div>
          </div>
        </div>

        {quotaPreview.terefsizShortage > 0 && (
          <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
            ℹ️ Tərəfsiz rollarından kifayət qədər aktiv rol olmadığı üçün{' '}
            <strong>+{quotaPreview.terefsizShortage}</strong> boş yer avtomatik{' '}
            <strong>Normal</strong> komandasına əlavə edildi.
          </p>
        )}
      </div>

      {/* Host Core Toggle: Reveal Dead Roles */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {room.config.revealDeadRoles ? (
            <Unlock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-xs font-semibold text-slate-100">
              Ölən oyunçuların rolunu göstər
            </div>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
              Aktiv olduqda gecə və ya səsvermə ilə ölən oyunçunun rolu hamıya
              açıqlanır.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!isHost}
          onClick={() =>
            onUpdateConfig({
              revealDeadRoles: !room.config.revealDeadRoles,
            })
          }
          className={`shrink-0 w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
            room.config.revealDeadRoles
              ? 'bg-emerald-500 justify-end'
              : 'bg-slate-700 justify-start'
          } ${!isHost ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
          role="switch"
          aria-checked={room.config.revealDeadRoles}
        >
          <span className="w-5 h-5 rounded-full bg-white shadow" />
        </button>
      </div>

      {/* Role Toggle Builder (Boolean ON/OFF, Max 1 Special Role Each) */}
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        {/* 1. Normal Team */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-400 px-1">
            <span>🌾 Normal Komandası ({quotaPreview.adjustedNormal} yer)</span>
            <span className="text-slate-400 font-normal normal-case">
              Qalan yerlər: Kəndli
            </span>
          </div>
          <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span>{ROLE_CATALOG.VILLAGER.icon}</span>
              <span className="font-semibold text-emerald-200">
                {ROLE_CATALOG.VILLAGER.displayName}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              Avtomatik Doldurucu
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {NORMAL_SPECIAL_ROLES.map((r) =>
              renderToggleCard(
                r,
                'bg-emerald-950/35 border-emerald-500/45 hover:border-emerald-400/70'
              )
            )}
          </div>
        </div>

        {/* 2. Qətil Team */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-400 px-1">
            <span>🐺 Qətil Komandası ({quotaPreview.baseQuota.qetil} yer)</span>
            <span className="text-slate-400 font-normal normal-case">
              Qalan yerlər: Canavar
            </span>
          </div>
          <div className="rounded-xl bg-red-950/20 border border-red-500/20 px-2.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span>{ROLE_CATALOG.WEREWOLF.icon}</span>
              <span className="font-semibold text-red-200">
                {ROLE_CATALOG.WEREWOLF.displayName}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-semibold">
              Avtomatik Doldurucu
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {QETIL_SPECIAL_ROLES.map((r) =>
              renderToggleCard(
                r,
                'bg-red-950/35 border-red-500/45 hover:border-red-400/70'
              )
            )}
          </div>
        </div>

        {/* 3. Tərəfsiz Team */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-violet-400 px-1">
            <span>
              🎭 Tərəfsizlər (Kvota: {quotaPreview.baseQuota.terefsiz} yer)
            </span>
            <span className="text-slate-400 font-normal normal-case">
              6+ oyunçudan etibarən
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {NEUTRAL_ROLES.map((r) =>
              renderToggleCard(
                r,
                'bg-violet-950/35 border-violet-500/45 hover:border-violet-400/70'
              )
            )}
          </div>
        </div>
      </div>

      {/* Phase Timers */}
      <div className="rounded-xl bg-slate-950/55 border border-slate-800 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Mərhələ Taymerləri</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              🌙 Gecə: {room.config.timers.nightPhase}s
            </label>
            <input
              type="range"
              min={15}
              max={90}
              step={5}
              disabled={!isHost}
              value={room.config.timers.nightPhase}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { nightPhase: Number(e.target.value) },
                })
              }
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              ☀️ Müzakirə: {room.config.timers.dayDiscussion}s
            </label>
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              disabled={!isHost}
              value={room.config.timers.dayDiscussion}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { dayDiscussion: Number(e.target.value) },
                })
              }
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              🗳️ Səsvermə: {room.config.timers.dayVoting}s
            </label>
            <input
              type="range"
              min={15}
              max={60}
              step={5}
              disabled={!isHost}
              value={room.config.timers.dayVoting}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { dayVoting: Number(e.target.value) },
                })
              }
              className="w-full accent-amber-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Start Game Action */}
      {isHost ? (
        <button
          type="button"
          disabled={playerCount < 4 || playerCount > 16}
          onClick={onStartGame}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
            playerCount >= 4 && playerCount <= 16
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {playerCount < 4 ? (
            <>
              <ShieldCheck className="w-4 h-4" />
              Başlamaq üçün ən azı 4 oyunçu lazımdır ({playerCount}/4)
            </>
          ) : (
            <>
              <Flame className="w-4 h-4" />
              <Play className="w-4 h-4 fill-current" />
              Oyunu Başlat ({playerCount} Oyunçu)
            </>
          )}
        </button>
      ) : (
        <div className="w-full py-3 rounded-xl bg-slate-800/70 border border-slate-700 text-center text-xs text-slate-300 font-medium">
          ⏳ Otaq rəhbərinin oyunu başlatması gözlənilir...
        </div>
      )}
    </div>
  );
};
