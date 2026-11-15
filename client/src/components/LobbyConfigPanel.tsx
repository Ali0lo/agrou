import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Flame,
  Lock,
  Mic,
  Play,
  Plus,
  ShieldCheck,
  Sliders,
  Sparkles,
  Table,
  Unlock,
  Users,
} from 'lucide-react';
import {
  ALL_PLAYABLE_ROLES,
  computeQuotaPreview,
  FACTION_QUOTA_TABLE,
  NEUTRAL_ROLES,
  NORMAL_SPECIAL_ROLES,
  QATIL_SPECIAL_ROLES,
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
  const [showQuotaTable, setShowQuotaTable] = useState(false);

  const isHost =
    isHostProp ??
    Boolean(room.players.find((p) => p.id === room.self?.playerId)?.isHost);

  const playerCount = room.players.length;
  const quotaPreview = computeQuotaPreview(
    playerCount,
    room.config.enabledRoles
  );

  const allSpecialsCount =
    NORMAL_SPECIAL_ROLES.length +
    QATIL_SPECIAL_ROLES.length +
    NEUTRAL_ROLES.length;
  const activeSpecialsCount =
    quotaPreview.enabledNormalSpecialCount +
    quotaPreview.enabledQatilSpecialCount +
    NEUTRAL_ROLES.filter((r) => Boolean(room.config.enabledRoles[r])).length;

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
    const enabledRoles = Object.fromEntries(
      ALL_PLAYABLE_ROLES.map((r) => [r, true])
    ) as Record<RoleType, boolean>;
    onUpdateConfig({ enabledRoles });
  };

  const applyPureClassicPreset = () => {
    if (!isHost) return;
    const classicSet = new Set<RoleType>([
      'VILLAGER',
      'SEER',
      'WITCH',
      'HUNTER',
      'WEREWOLF',
    ]);
    const enabledRoles = Object.fromEntries(
      ALL_PLAYABLE_ROLES.map((r) => [r, classicSet.has(r)])
    ) as Record<RoleType, boolean>;
    onUpdateConfig({ enabledRoles });
  };

  const applyNoNeutralsPreset = () => {
    if (!isHost) return;
    const neutralSet = new Set<RoleType>(NEUTRAL_ROLES);
    const updated = { ...room.config.enabledRoles };
    for (const r of neutralSet) {
      updated[r] = false;
    }
    updated.VILLAGER = true;
    updated.WEREWOLF = true;
    onUpdateConfig({ enabledRoles: updated });
  };

  const renderBaseFillerCard = (roleKey: RoleType, accentClass: string) => {
    const info = ROLE_CATALOG[roleKey];
    return (
      <div
        key={roleKey}
        className={`w-full text-left rounded-xl p-3 border ${accentClass} shadow-sm flex items-start justify-between gap-2.5`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base leading-none">{info.icon}</span>
            <span className="text-xs font-bold text-slate-100">
              {info.displayName}
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/40 inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              AUTO-FILL
            </span>
          </div>
          <p className="text-[11px] text-slate-300/85 leading-snug mt-1.5">
            {info.shortDescription}
          </p>
        </div>

        <div
          className="shrink-0 mt-0.5 w-10 h-5 rounded-full bg-slate-800 border border-slate-600/80 flex items-center justify-center text-slate-300"
          title="Avtomatik Doldurucu (Bağlana bilməz)"
        >
          <Lock className="w-3 h-3" />
        </div>
      </div>
    );
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
        className={`w-full text-left rounded-xl p-3 border transition-all flex items-start justify-between gap-2.5 ${
          isEnabled
            ? `${accentClass} shadow-sm`
            : 'bg-slate-950/60 border-slate-800/80 opacity-65 hover:opacity-90'
        } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base leading-none">{info.icon}</span>
            <span className="text-xs font-bold text-slate-100">
              {info.displayName}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950/70 text-slate-300 border border-slate-700/60">
              Maks. 1
            </span>
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                isEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isEnabled ? 'Açıq (ON)' : 'Bağlı (OFF)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300/85 leading-snug mt-1.5">
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
    <div className="rounded-2xl bg-slate-900/90 border border-slate-700/60 backdrop-blur-md p-4 sm:p-5 flex flex-col gap-4 shadow-2xl">
      {/* Room Code & Invite Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
            Oyun Ayarları və Rollar — Lobbi (4–16 Oyunçu)
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-2xl font-bold tracking-widest text-white">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
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
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition flex items-center gap-1 cursor-pointer"
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
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/70 text-xs font-semibold text-amber-300 flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Bot Əlavə Et
            </button>
          )}
        </div>
      </div>

      {/* Automatic Faction Quota Preview Banner */}
      <div className="rounded-xl bg-gradient-to-br from-slate-950/90 to-slate-900 border border-amber-500/30 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span>
              Avtomatik Komanda Kvota Paylanması (
              {playerCount < 4
                ? 'Min 4 oyunçu üçün önizləmə'
                : `${playerCount} oyunçu`}
              )
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isHost && (
              <>
                <button
                  type="button"
                  onClick={applyAllEnabledPreset}
                  className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-semibold text-amber-200 transition cursor-pointer"
                >
                  Hamısını Aç
                </button>
                <button
                  type="button"
                  onClick={applyNoNeutralsPreset}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-slate-300 transition cursor-pointer"
                >
                  Tərəfsizləri Bağla
                </button>
                <button
                  type="button"
                  onClick={applyPureClassicPreset}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-slate-300 transition cursor-pointer"
                >
                  Klassik Sadə
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowQuotaTable((v) => !v)}
              className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-semibold text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <Table className="w-3 h-3 text-amber-400" />
              <span>4–16 Cədvəl</span>
              {showQuotaTable ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
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
              Qatil (Canavar)
            </div>
            <div className="text-lg font-extrabold text-red-300">
              {quotaPreview.baseQuota.qatil}
            </div>
            <div className="text-[10px] text-red-200/70">
              {quotaPreview.enabledQatilSpecialCount} xüsusi aktiv
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

        {showQuotaTable && (
          <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 text-[11px]">
            <div className="grid grid-cols-4 font-bold text-slate-400 border-b border-slate-800 pb-1 mb-1">
              <span>Oyunçu Sayı</span>
              <span className="text-emerald-400">Normal</span>
              <span className="text-red-400">Qatil</span>
              <span className="text-violet-400">Tərəfsiz</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {Object.entries(FACTION_QUOTA_TABLE).map(([cnt, q]) => {
                const isCurrent = Number(cnt) === quotaPreview.playerCount;
                return (
                  <div
                    key={cnt}
                    className={`grid grid-cols-4 py-0.5 px-1 rounded ${
                      isCurrent
                        ? 'bg-amber-500/15 text-amber-200 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    <span>{cnt} nəfər</span>
                    <span className="text-emerald-300">{q.normal}</span>
                    <span className="text-red-300">{q.qatil}</span>
                    <span className="text-violet-300">{q.terefsiz}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Host General Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Reveal Dead Players' Roles */}
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
                Ölən oyunçunun rolu səhər və edam zamanı hamıya açıqlanır.
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

        {/* Voice Indicator Setting */}
        <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Mic className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                Səs / Mikrafon İndikatoru
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Oyunçular çat panelindən danışma indikatorunu aktiv edə bilir.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!isHost}
            onClick={() =>
              onUpdateConfig({
                allowWebRTC: !room.config.allowWebRTC,
              })
            }
            className={`shrink-0 w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
              room.config.allowWebRTC
                ? 'bg-sky-500 justify-end'
                : 'bg-slate-700 justify-start'
            } ${!isHost ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
            role="switch"
            aria-checked={room.config.allowWebRTC}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow" />
          </button>
        </div>
      </div>

      {/* ALL 20 ROLES — Completely Expanded (2 AUTO-FILL + 18 Special Roles) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
              🎭 Bütün Rollar (20 Rol — 2 AUTO-FILL + 18 Xüsusi)
            </h3>
            <p className="text-[11px] text-slate-400">
              Baza doldurucu rollar avtomatik aktivdir; bütün xüsusi rolları Aç/Bağla
              edib oyunu başladın (hər xüsusi roldan maks. 1 ədəd).
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-[11px] font-bold text-amber-300">
            {activeSpecialsCount} / {allSpecialsCount} xüsusi aktiv • 2 AUTO-FILL
          </span>
        </div>

        {/* 1. Normal Team (10 Roles: VILLAGER AUTO-FILL + 9 Specials) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-400 px-1">
            <span>
              🌾 Normal Komandası — 10 Rol ({quotaPreview.adjustedNormal} yer)
            </span>
            <span className="text-slate-400 font-normal normal-case">
              Boş qalan yerlər: Kəndli (AUTO-FILL)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {renderBaseFillerCard(
              'VILLAGER',
              'bg-emerald-950/30 border-emerald-500/35'
            )}
            {NORMAL_SPECIAL_ROLES.map((r) =>
              renderToggleCard(
                r,
                'bg-emerald-950/35 border-emerald-500/45 hover:border-emerald-400/70'
              )
            )}
          </div>
        </div>

        {/* 2. Qatil Team (5 Roles: WEREWOLF AUTO-FILL + 4 Specials) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-400 px-1">
            <span>
              🐺 Qatil Komandası — 5 Rol ({quotaPreview.baseQuota.qatil} yer)
            </span>
            <span className="text-slate-400 font-normal normal-case">
              Boş qalan yerlər: Canavar (AUTO-FILL)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {renderBaseFillerCard(
              'WEREWOLF',
              'bg-red-950/30 border-red-500/35'
            )}
            {QATIL_SPECIAL_ROLES.map((r) =>
              renderToggleCard(
                r,
                'bg-red-950/35 border-red-500/45 hover:border-red-400/70'
              )
            )}
          </div>
        </div>

        {/* 3. Tərəfsiz Team (5 Roles) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-violet-400 px-1">
            <span>
              🎭 Tərəfsiz Komanda — 5 Rol (Kvota:{' '}
              {quotaPreview.baseQuota.terefsiz} yer)
            </span>
            <span className="text-slate-400 font-normal normal-case">
              6+ oyunçudan etibarən aktivləşir
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {NEUTRAL_ROLES.map((r) =>
              renderToggleCard(
                r,
                'bg-violet-950/35 border-violet-500/45 hover:border-violet-400/70'
              )
            )}
          </div>
        </div>
      </div>

      {/* All Phase Timers */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Bütün Mərhələ Taymerləri</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              🎭 Rol Açılışı: {room.config.timers.roleReveal}s
            </label>
            <input
              type="range"
              min={4}
              max={20}
              step={1}
              disabled={!isHost}
              value={room.config.timers.roleReveal}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { roleReveal: Number(e.target.value) },
                })
              }
              className="w-full accent-amber-500"
            />
          </div>
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
              🌅 Sübh Xülasəsi: {room.config.timers.dawnSummary}s
            </label>
            <input
              type="range"
              min={4}
              max={20}
              step={1}
              disabled={!isHost}
              value={room.config.timers.dawnSummary}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { dawnSummary: Number(e.target.value) },
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
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              ⚖️ Edam Nəticəsi: {room.config.timers.executionReveal}s
            </label>
            <input
              type="range"
              min={4}
              max={20}
              step={1}
              disabled={!isHost}
              value={room.config.timers.executionReveal}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { executionReveal: Number(e.target.value) },
                })
              }
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              🏹 Ovçu İntiqamı: {room.config.timers.hunterRevenge}s
            </label>
            <input
              type="range"
              min={10}
              max={30}
              step={1}
              disabled={!isHost}
              value={room.config.timers.hunterRevenge}
              onChange={(e) =>
                onUpdateConfig({
                  timers: { hunterRevenge: Number(e.target.value) },
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
          className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
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
          ⏳ Otaq rəhbərinin rolları seçib oyunu başlatması gözlənilir...
        </div>
      )}
    </div>
  );
};
