import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { ROLE_CATALOG, RoleInfo } from '../types/game';

interface RoleReferenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleReferenceDrawer: React.FC<RoleReferenceDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const roles = Object.values(ROLE_CATALOG);
  const groups: { title: string; subtitle: string; items: RoleInfo[] }[] = [
    {
      title: 'Village Team',
      subtitle: 'Wins when all Werewolves and Killing Neutrals are dead',
      items: roles.filter((r) => r.faction === 'VILLAGE'),
    },
    {
      title: 'Werewolf Team',
      subtitle: 'Wins when Werewolves equal or outnumber non-Werewolves',
      items: roles.filter((r) => r.faction === 'WEREWOLF'),
    },
    {
      title: 'Neutral Roles',
      subtitle: 'Independent solo victory conditions',
      items: roles.filter((r) => r.faction === 'NEUTRAL'),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    Campfire Role Almanac
                  </h2>
                  <p className="text-xs text-slate-400">
                    Reference guide for all playable roles & mechanics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {groups.map((group) => (
                <div key={group.title} className="space-y-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-400">
                      {group.title}
                    </h3>
                    <p className="text-xs text-slate-400">{group.subtitle}</p>
                  </div>

                  <div className="space-y-2.5">
                    {group.items.map((role) => (
                      <div
                        key={role.role}
                        className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{role.icon}</span>
                            <span
                              className={`font-bold text-sm ${role.colorClass}`}
                            >
                              {role.name}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${role.badgeBg}`}
                          >
                            {role.faction}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {role.description}
                        </p>
                        <p className="text-[11px] text-amber-300/90 font-medium pt-1 border-t border-slate-800/80">
                          🏆 {role.winCondition}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
