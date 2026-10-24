'use client';

import React from 'react';
import { BeatEvent } from '@/types';
import { Zap } from 'lucide-react';

interface VisualFlasherProps {
  currentBeat: BeatEvent | null;
  totalBeats: number;
  fullscreenFlash: boolean;
  onToggleFullscreenFlash: () => void;
}

export const VisualFlasher: React.FC<VisualFlasherProps> = ({
  currentBeat,
  totalBeats,
  fullscreenFlash,
  onToggleFullscreenFlash,
}) => {
  const isFlashing = currentBeat !== null;
  const isAccent = currentBeat?.isAccent ?? false;
  const isSub = currentBeat?.isSubdivision ?? false;

  // Solo beat veri (non suddivisioni) accendono i pallini
  const activeBeat = (!isSub && currentBeat?.beatNumber) ?? null;

  return (
    <>
      {/* Overlay flash a tutto schermo — z-index sopra tutto, pointer-events-none */}
      {fullscreenFlash && isFlashing && !isSub && (
        <div
          className={`fixed inset-0 pointer-events-none z-[200] ${
            isAccent
              ? 'bg-emerald-400/35'
              : 'bg-cyan-400/20'
          }`}
          style={{ transition: 'opacity 60ms ease-out' }}
        />
      )}

      {/* Sezione Indicatore Battute — compatta, sempre visibile */}
      <div className="w-full bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3 flex flex-col items-center gap-2.5 shadow-md">
        {/* Griglia pallini del tempo */}
        <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap max-w-full">
          {Array.from({ length: totalBeats }, (_, idx) => {
            const beatNum = idx + 1;
            const isActive = activeBeat === beatNum;
            const isFirst = beatNum === 1;

            return (
              <div
                key={beatNum}
                className={`relative flex items-center justify-center rounded-full select-none font-black ${
                  isFirst
                    ? 'w-12 h-12 md:w-14 md:h-14 text-lg md:text-xl'
                    : 'w-10 h-10 md:w-12 md:h-12 text-base md:text-lg'
                } ${
                  isActive
                    ? isFirst
                      ? 'bg-emerald-500 text-black shadow-[0_0_28px_rgba(16,185,129,0.95)] scale-115 ring-4 ring-emerald-300/70'
                      : 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.85)] scale-110 ring-2 ring-cyan-200/60'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                }`}
                style={{
                  transition: isActive ? 'none' : 'all 80ms ease-out',
                  transform: isActive ? (isFirst ? 'scale(1.15)' : 'scale(1.10)') : 'scale(1)',
                }}
              >
                {beatNum}
              </div>
            );
          })}
        </div>

        {/* Toggle Flash Batterista — riga compatta */}
        <button
          onClick={onToggleFullscreenFlash}
          className={`flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold transition-all border ${
            fullscreenFlash
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-900'
              : 'bg-zinc-900/60 text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:border-zinc-600'
          }`}
        >
          <Zap className={`w-3 h-3 ${fullscreenFlash ? 'text-emerald-400' : 'text-zinc-500'}`} />
          {fullscreenFlash ? 'Flash Batterista ON' : 'Flash Schermo Batterista'}
        </button>
      </div>
    </>
  );
};
