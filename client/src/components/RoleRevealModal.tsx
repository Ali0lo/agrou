import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ROLE_CATALOG, RoleType } from '../types/game';

interface RoleRevealModalProps {
  role: RoleType;
  secondsRemaining: number;
}

export const RoleRevealModal: React.FC<RoleRevealModalProps> = ({
  role,
  secondsRemaining,
}) => {
  const [flipped, setFlipped] = useState(false);
  const meta = ROLE_CATALOG[role];

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 650);
    return () => clearTimeout(t);
  }, []);

  const factionGradient =
    meta.faction === 'VILLAGE'
      ? 'from-emerald-950 via-slate-900 to-slate-950 border-emerald-400/60'
      : meta.faction === 'WEREWOLF'
        ? 'from-red-950 via-slate-900 to-slate-950 border-red-500/70'
        : 'from-violet-950 via-slate-900 to-slate-950 border-amber-400/60';

  const factionSubtitle =
    meta.faction === 'VILLAGE'
      ? 'Normal (Kənd Komandası)'
      : meta.faction === 'WEREWOLF'
        ? 'Qətil (Canavar Komandası)'
        : 'Tərəfsiz (Solo Komanda)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div className="max-w-md w-full flex flex-col items-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-300 mb-3">
          GİZLİ ŞƏXSİYYƏT TƏYİN OLUNDU • {secondsRemaining}s
        </div>

        <motion.div
          initial={{ rotateY: 180, scale: 0.9 }}
          animate={{ rotateY: flipped ? 0 : 180, scale: 1 }}
          transition={{ duration: 0.7, type: 'spring', stiffness: 120 }}
          className={`w-full rounded-3xl border-2 bg-gradient-to-br ${factionGradient} p-6 shadow-2xl text-center`}
        >
          <div className="text-6xl mb-3 drop-shadow-lg">{meta.icon}</div>

          <span
            className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${meta.badgeBg}`}
          >
            {factionSubtitle}
          </span>

          <h2 className="text-2xl font-extrabold text-white mt-3">
            {meta.displayName}
          </h2>

          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            {meta.shortDescription}
          </p>

          <div className="mt-5 rounded-xl bg-slate-950/75 border border-slate-700/70 p-3 text-left">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              🏆 Qələbə Şərti
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-snug">
              {meta.winCondition}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
