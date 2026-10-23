'use client';

import React from 'react';
import { BeatEvent } from '@/types';

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

  return (
    <>
      {/* Overlay flash a tutto schermo per il batterista */}
      {fullscreenFlash && isFlashing && (
        <div
          className={`fixed inset-0 pointer-events-none z-50 transition-opacity duration-75 ${
            isAccent
              ? 'bg-emerald-400/35 opacity-100'
              : 'bg-cyan-400/20 opacity-100'
          }`}
        />
      )}

      <div className="flex flex-col items-center justify-center w-full my-3">
        {/* Griglia dei pallini del tempo */}
        <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap max-w-full px-2">
          {Array.from({ length: totalBeats }, (_, idx) => {
            const beatNum = idx + 1;
            const isActive = currentBeat?.beatNumber === beatNum && !currentBeat.isSubdivision;
            const isFirst = beatNum === 1;

            return (
              <div
                key={beatNum}
                className={`relative flex items-center justify-center transition-all duration-75 rounded-full ${
                  isFirst
                    ? 'w-11 h-11 md:w-14 md:h-14 font-black text-lg md:text-xl'
                    : 'w-9 h-9 md:w-12 md:h-12 font-bold text-base md:text-lg'
                } ${
                  isActive
                    ? isFirst
                      ? 'bg-emerald-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.9)] scale-110 ring-4 ring-emerald-300'
                      : 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.8)] scale-105 ring-2 ring-cyan-200'
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                }`}
              >
                {beatNum}
              </div>
            );
          })}
        </div>

        {/* Toggle rapido Stage Fullscreen Flash */}
        <div className="mt-2.5">
          <button
            onClick={onToggleFullscreenFlash}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
              fullscreenFlash
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-700/50 hover:text-zinc-200'
            }`}
          >
            {fullscreenFlash ? '⚡ Flash Batterista ON' : '⚡ Flash Schermo Batterista'}
          </button>
        </div>
      </div>
    </>
  );
};
