import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ROLE_CATALOG, RoleType } from '../types/game';
import { Sparkles, ShieldAlert } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div className="max-w-md w-full flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 text-center"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Fate Drawn From The Fire
          </span>
          <h2 className="mt-2 text-2xl font-extrabold text-white">
            Your Secret Identity
          </h2>
        </motion.div>

        {/* 3D Flipping Card Container */}
        <div className="relative w-72 h-96 [perspective:1200px]">
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.85, type: 'spring', bounce: 0.25 }}
            className="w-full h-full relative [transform-style:preserve-3d]"
          >
            {/* Front of Card (Face Down Tarot Back) */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-900/90 via-slate-900 to-indigo-950 border-2 border-amber-500/50 shadow-2xl flex flex-col items-center justify-center p-6 [backface-visibility:hidden]">
              <div className="w-24 h-24 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-5xl mb-4 animate-pulse">
                🔥
              </div>
              <p className="text-sm font-bold uppercase tracking-widest text-amber-300">
                Campfire Wolves
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Revealing your role...
              </p>
            </div>

            {/* Back of Card (Face Up Secret Role) */}
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-400/60 shadow-[0_0_50px_rgba(251,191,36,0.25)] flex flex-col items-center justify-between p-6 text-center [backface-visibility:hidden]"
              style={{ transform: 'rotateY(180deg)' }}
            >
              <div
                className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${meta.badgeBg}`}
              >
                {meta.faction} FACTION
              </div>

              <div className="my-2 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center text-5xl shadow-inner mb-3">
                  {meta.icon}
                </div>
                <h3 className={`text-2xl font-black ${meta.colorClass}`}>
                  {meta.name}
                </h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {meta.description}
                </p>
              </div>

              <div className="w-full p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Win Condition
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  {meta.winCondition}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <p className="mt-5 text-xs text-slate-400">
          Night 1 begins in{' '}
          <span className="text-amber-300 font-bold">{secondsRemaining}s</span>
        </p>
      </div>
    </div>
  );
};
