import React from 'react';
import { motion } from 'framer-motion';
import { GamePhase } from '../types/game';

interface CampfireSvgProps {
  phase: GamePhase;
  isSleepingVillager: boolean;
}

export const CampfireSvg: React.FC<CampfireSvgProps> = ({
  phase,
  isSleepingVillager,
}) => {
  const isNight = phase === 'NIGHT_PHASE';
  const isDawn = phase === 'DAWN_SUMMARY';

  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {/* Dynamic Ambient Radial Aura */}
      <motion.div
        animate={{
          scale: isNight ? [1, 1.08, 1] : [1, 1.15, 1],
          opacity: isNight ? [0.35, 0.5, 0.35] : [0.55, 0.8, 0.55],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute inset-0 m-auto w-52 h-52 rounded-full blur-3xl transition-colors duration-1000 ${
          isNight
            ? 'bg-indigo-600/40'
            : isDawn
            ? 'bg-amber-400/50'
            : 'bg-orange-500/50'
        }`}
      />

      <svg
        viewBox="0 0 200 200"
        className="w-36 h-36 md:w-44 md:h-44 relative z-10 overflow-visible"
      >
        <defs>
          <radialGradient id="fireGlow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor={isNight ? '#818cf8' : '#fbbf24'}
              stopOpacity="0.6"
            />
            <stop
              offset="60%"
              stopColor={isNight ? '#312e81' : '#ea580c'}
              stopOpacity="0.2"
            />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="outerFlameDay" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="55%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>

          <linearGradient id="outerFlameNight" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="55%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#c7d2fe" />
          </linearGradient>
        </defs>

        {/* Ground Glow Circle */}
        <circle cx="100" cy="135" r="70" fill="url(#fireGlow)" />

        {/* Stone Ring */}
        <ellipse cx="52" cy="154" rx="13" ry="8" fill="#334155" />
        <ellipse cx="75" cy="162" rx="15" ry="9" fill="#475569" />
        <ellipse cx="102" cy="164" rx="16" ry="9" fill="#334155" />
        <ellipse cx="128" cy="161" rx="15" ry="9" fill="#475569" />
        <ellipse cx="149" cy="153" rx="13" ry="8" fill="#334155" />

        {/* Crossed Firewood Logs */}
        <g transform="translate(100, 145)">
          <rect
            x="-46"
            y="-8"
            width="92"
            height="15"
            rx="7"
            transform="rotate(16)"
            fill="#5c3a21"
            stroke="#3b2313"
            strokeWidth="2"
          />
          <rect
            x="-46"
            y="-8"
            width="92"
            height="15"
            rx="7"
            transform="rotate(-16)"
            fill="#70482a"
            stroke="#3b2313"
            strokeWidth="2"
          />
        </g>

        {/* Outer Flame */}
        <motion.path
          d="M100 45 C125 75, 140 105, 128 135 C120 150, 80 150, 72 135 C60 105, 75 75, 100 45 Z"
          fill={isNight ? 'url(#outerFlameNight)' : 'url(#outerFlameDay)'}
          animate={
            isSleepingVillager
              ? {
                  scaleY: [0.55, 0.65, 0.55],
                  scaleX: [0.85, 0.92, 0.85],
                  y: [22, 18, 22],
                }
              : {
                  scaleY: [0.95, 1.08, 0.92, 1.04, 0.95],
                  scaleX: [0.96, 1.03, 0.94, 1.02, 0.96],
                  rotate: [-2, 2, -1.5, 1.5, -2],
                }
          }
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '100px', originY: '140px' }}
        />

        {/* Middle Flame */}
        <motion.path
          d="M100 68 C116 90, 125 112, 118 134 C112 145, 88 145, 82 134 C75 112, 84 90, 100 68 Z"
          fill={isNight ? '#818cf8' : '#fb923c'}
          animate={{
            scaleY: isSleepingVillager ? [0.6, 0.72, 0.6] : [0.92, 1.12, 0.92],
            rotate: [2, -3, 2],
          }}
          transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '100px', originY: '140px' }}
        />

        {/* Core Flame */}
        <motion.path
          d="M100 92 C110 106, 114 120, 109 134 C105 141, 95 141, 91 134 C86 120, 90 106, 100 92 Z"
          fill={isNight ? '#e0e7ff' : '#fef08a'}
          animate={{
            scale: isSleepingVillager ? [0.7, 0.85, 0.7] : [0.95, 1.15, 0.95],
          }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '100px', originY: '138px' }}
        />

        {/* Floating Sparks / Embers */}
        {[
          { cx: 88, delay: 0 },
          { cx: 112, delay: 0.7 },
          { cx: 98, delay: 1.4 },
          { cx: 106, delay: 2.0 },
        ].map((spark, idx) => (
          <motion.circle
            key={idx}
            cx={spark.cx}
            cy={115}
            r={2.5}
            fill={isNight ? '#a5b4fc' : '#fde047'}
            animate={{
              y: [-5, -65],
              x: [0, idx % 2 === 0 ? -12 : 12],
              opacity: [0, 0.9, 0],
              scale: [0.6, 1.2, 0.3],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              delay: spark.delay,
              ease: 'easeOut',
            }}
          />
        ))}
      </svg>

      {/* Sleeping Zzz overlay anchored outside layout flow so SVG stays dead-center */}
      {isSleepingVillager && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-3 py-1 rounded-full bg-indigo-950/90 border border-indigo-400/30 text-xs text-indigo-200 flex items-center gap-1.5 shadow-lg"
          >
            <span className="animate-bounce">💤</span>
            <span>Kənd yatır... Gecənin səslərini dinlə</span>
          </motion.div>
        </div>
      )}
    </div>
  );
};
