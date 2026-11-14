import React, { useState } from 'react';
import {
  Bot,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Info,
  Link2,
  Minus,
  Play,
  Plus,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  ALL_22_ROLES,
  NEUTRAL_ROLES,
  ROLE_CATALOG,
  ROLE_PRESETS,
  RolePreset,
  VILLAGE_ROLES,
  WEREWOLF_ROLES,
} from '../constants/roles';
import {
  PhaseTimers,
  RoleType,
  SanitizedRoomState,
} from '../types/game';
import { soundEngine } from '../services/soundEngine';

interface LobbyConfigPanelProps {
  room: SanitizedRoomState;
  onUpdateConfig: (update: {
    timers?: Partial<PhaseTimers>;
    enabledRoles?: Partial<Record<RoleType, number>>;
    revealDeadRoles?: boolean;
  }) => void;
  onAddBot: () => void;
  onStartGame: () => void;
}

export const LobbyConfigPanel: React.FC<LobbyConfigPanelProps> = ({
  room,
  onUpdateConfig,
  onAddBot,
  onStartGame,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const selfPlayer =
    room.players.find((p) => p.id === room.self?.playerId) ?? null;
  const isHost = Boolean(selfPlayer?.isHost);
  const playerCount = room.players.length;
  const canStart = playerCount >= 4 && playerCount <= 16;

  const totalConfiguredRoles = ALL_22_ROLES.reduce(
    (sum, roleKey) => sum + (room.config.enabledRoles[roleKey] ?? 0),
    0
  );

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const adjustRoleCount = (role: RoleType, delta: number) => {
    if (!isHost) return;
    soundEngine.play('CLICK');
    const current = room.config.enabledRoles[role] ?? 0;
    const next = Math.max(0, Math.min(12, current + delta));
    onUpdateConfig({
      enabledRoles: {
        ...room.config.enabledRoles,
        [role]: next,
      },
    });
  };

  const applyPreset = (preset: RolePreset) => {
    if (!isHost) return;
    soundEngine.play('CLICK');
    const nextRoles: Record<RoleType, number> = {} as Record<RoleType, number>;
    for (const r of ALL_22_ROLES) {
      nextRoles[r] = preset.roles[r] ?? 0;
    }
    nextRoles.ANGEL = 0;
    onUpdateConfig({ enabledRoles: nextRoles });
  };

  const toggleRevealDeadRoles = () => {
    if (!isHost) return;
    soundEngine.play('CLICK');
    onUpdateConfig({
      revealDeadRoles: !room.config.revealDeadRoles,
    });
  };

  const adjustTimer = (key: keyof PhaseTimers, val: number) => {
    if (!isHost) return;
    onUpdateConfig({
      timers: {
        ...room.config.timers,
        [key]: val,
      },
    });
  };

  const factionSections: {
    title: string;
    subtitle: string;
    headerColor: string;
    roles: RoleType[];
  }[] = [
    {
      title: 'A. Kəndlilər (Village Team — 12 Rol)',
      subtitle: 'Bütün Canavarlar və qatil neytrallar öldükdə qazanır',
      headerColor: 'text-emerald-300',
      roles: VILLAGE_ROLES,
    },
    {
      title: 'B. Canavarlar (Werewolf Team — 5 Rol)',
      subtitle: 'Canavarların sayı kəndlilərə bərabər və ya çox olduqda qazanır',
      headerColor: 'text-rose-400',
      roles: WEREWOLF_ROLES,
    },
    {
      title: 'C. Neytral & Xüsusi Rollar (Neutral & Special — 5 Rol)',
      subtitle: 'Müstəqil qələbə şərtləri və xüsusi mexanikalar',
      headerColor: 'text-amber-300',
      roles: NEUTRAL_ROLES,
    },
  ];

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md p-4 sm:p-5 space-y-6 shadow-2xl">
      {/* Room Code & Shareable Invite Link */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-amber-300/90 font-bold">
            Otaq Dəvət Kodu (Invite Code)
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl font-black tracking-widest text-white font-mono">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Kod
                </>
              )}
            </button>
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 flex items-center gap-1 transition"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Kopyalandı!
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" /> Dəvət Linki
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-bold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span>{playerCount} / 16 Oyunçu</span>
          </div>

          {isHost && playerCount < 16 && (
            <button
              type="button"
              onClick={onAddBot}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Bot className="w-4 h-4" /> + Bot Əlavə Et
            </button>
          )}
        </div>
      </div>

      {/* Host Setting Toggle: Reveal Dead Players' Roles (revealDeadRoles) */}
      <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
              room.config.revealDeadRoles
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            }`}
          >
            {room.config.revealDeadRoles ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">
                Ölən oyunçuların rolunu göstər
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                (Reveal Dead Players&apos; Roles)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Aktiv olduqda gecə və ya səsvermə ilə ölən oyunçunun rolu hamıya açıqlanır.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={room.config.revealDeadRoles}
          disabled={!isHost}
          onClick={toggleRevealDeadRoles}
          className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            room.config.revealDeadRoles ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
          style={{ width: '52px' }}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              room.config.revealDeadRoles ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Quick-Fill Role Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Hazır Rol Paketləri (Quick Presets)
          </span>
          <span className="text-[11px] text-slate-400">
            Seçilmiş Kartlar:{' '}
            <strong className="text-amber-300">{totalConfiguredRoles}</strong>{' '}
            (Oyunçu sayına avtomatik uyğunlaşır: {playerCount})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ROLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!isHost}
              onClick={() => applyPreset(preset)}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 disabled:opacity-60 border border-slate-800 hover:border-amber-500/40 text-left transition group"
            >
              <div className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                ⚡ {preset.label}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                {preset.subtitle}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* All 22 Roles Grouped by Faction */}
      <div className="space-y-5">
        <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-300">
          <Settings className="w-3.5 h-3.5 text-amber-400" /> 22 Klassik Agrou Rolu (Role Builder)
        </div>

        {factionSections.map((section) => (
          <div key={section.title} className="space-y-2.5">
            <div className="border-b border-slate-800 pb-1">
              <h4 className={`text-xs font-black uppercase tracking-wider ${section.headerColor}`}>
                {section.title}
              </h4>
              <p className="text-[11px] text-slate-400">{section.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {section.roles.map((roleKey) => {
                const meta = ROLE_CATALOG[roleKey];
                const count = room.config.enabledRoles[roleKey] ?? 0;

                return (
                  <div
                    key={roleKey}
                    title={`${meta.name}: ${meta.description}`}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition ${
                      count > 0
                        ? 'bg-slate-950/95 border-amber-500/45 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/70 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{meta.icon}</span>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-bold truncate ${meta.colorClass}`}
                          >
                            {meta.nameAz}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {meta.nameEn}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => adjustRoleCount(roleKey, -1)}
                            disabled={count <= 0}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                        <span className="w-5 text-center text-xs font-extrabold text-white">
                          {count}
                        </span>
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => adjustRoleCount(roleKey, 1)}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-snug line-clamp-2 flex items-start gap-1">
                      <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                      <span>{meta.description}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Phase Timers Configuration */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-400" /> Faza Vaxtları (Phase Timers)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Gecə (Night)</span>
              <span className="font-bold text-indigo-300">
                {room.config.timers.nightPhase}s
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={90}
              step={5}
              disabled={!isHost}
              value={room.config.timers.nightPhase}
              onChange={(e) => adjustTimer('nightPhase', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Müzakirə (Discussion)</span>
              <span className="font-bold text-amber-300">
                {room.config.timers.dayDiscussion}s
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              disabled={!isHost}
              value={room.config.timers.dayDiscussion}
              onChange={(e) =>
                adjustTimer('dayDiscussion', Number(e.target.value))
              }
              className="w-full accent-amber-500"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Səsvermə (Voting)</span>
              <span className="font-bold text-rose-300">
                {room.config.timers.dayVoting}s
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={90}
              step={5}
              disabled={!isHost}
              value={room.config.timers.dayVoting}
              onChange={(e) => adjustTimer('dayVoting', Number(e.target.value))}
              className="w-full accent-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Start Game Action Bar */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {canStart
            ? 'Tonqal hazırdır — oyuna başlaya bilərsiniz!'
            : `Başlamaq üçün ən azı ${4 - playerCount} oyunçu (və ya bot) lazımdır (min 4).`}
        </p>

        {isHost ? (
          <button
            type="button"
            disabled={!canStart}
            onClick={onStartGame}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Oyuna Başla ({playerCount} Oyunçu)</span>
          </button>
        ) : (
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-semibold">
            Otaq sahibinin oyunu başlatması gözlənilir...
          </div>
        )}
      </div>
    </div>
  );
};
