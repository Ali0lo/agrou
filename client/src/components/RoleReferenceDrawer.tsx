import React from 'react';
import { BookOpen, X } from 'lucide-react';
import {
  FACTION_QUOTA_TABLE,
  NEUTRAL_ROLES,
  ROLE_CATALOG,
  VILLAGE_ROLES,
  WEREWOLF_ROLES,
} from '../constants/roles';
import { RoleInfo } from '../types/game';

interface RoleReferenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleReferenceDrawer: React.FC<RoleReferenceDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const groups: { title: string; subtitle: string; items: RoleInfo[] }[] = [
    {
      title: '1. Normal Komandası (Village — 6 Rol)',
      subtitle:
        'Bütün Qətillər və ölümcül Tərəfsizlər (Ağ Canavar, Alovçu) məhv edildikdə qazanır',
      items: VILLAGE_ROLES.map((r) => ROLE_CATALOG[r]),
    },
    {
      title: '2. Qətil Komandası (Werewolf — 3 Rol)',
      subtitle:
        'Ölümcül Tərəfsizlər öldükdən sonra Qətillərin sayı qalanlara bərabər və ya çox olduqda qazanır',
      items: WEREWOLF_ROLES.map((r) => ROLE_CATALOG[r]),
    },
    {
      title: '3. Tərəfsiz Komanda (Neutral — 3 Rol)',
      subtitle:
        'Şəxsi qələbə şərtinə malik müstəqil oyunçular (6+ nəfərlik otaqlarda aktiv olur)',
      items: NEUTRAL_ROLES.map((r) => ROLE_CATALOG[r]),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-700/80 h-full overflow-y-auto p-5 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                Campfire Wolves — 12 Rol Bələdçisi
              </h2>
              <p className="text-xs text-slate-400">
                4–16 oyunçu üçün avtomatik kvota və rollar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Groups */}
        {groups.map((group) => (
          <div key={group.title} className="space-y-2.5">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                {group.title}
              </h3>
              <p className="text-[11px] text-slate-400">{group.subtitle}</p>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.role}
                  className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-xs font-bold text-slate-100">
                        {item.displayName}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeBg}`}
                    >
                      {item.isBaseFiller ? 'Doldurucu (∞)' : 'Maks. 1'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.shortDescription}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    💡 {item.abilityGuide}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Automatic Quota Table Reference */}
        <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
            Avtomatik Kvota Cədvəli (4–16 Oyunçu)
          </h3>
          <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-1">
            <span>Oyunçu</span>
            <span className="text-emerald-400">Normal</span>
            <span className="text-red-400">Qətil</span>
            <span className="text-violet-400">Tərəfsiz</span>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1 text-xs">
            {Object.entries(FACTION_QUOTA_TABLE).map(([count, q]) => (
              <div
                key={count}
                className="grid grid-cols-4 gap-1 py-0.5 border-b border-slate-900/80 text-slate-200"
              >
                <span className="font-bold">{count} nəfər</span>
                <span className="text-emerald-300">{q.normal}</span>
                <span className="text-red-300">{q.qetil}</span>
                <span className="text-violet-300">{q.terefsiz}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
