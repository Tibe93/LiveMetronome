'use client';

import React, { useRef } from 'react';
import {
  Play,
  Square,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Sparkles,
  Music,
  Clock,
  Radio,
} from 'lucide-react';
import { SoundPreset, Subdivision, TimeSignature } from '@/types';

interface MetronomeDisplayProps {
  bpm: number;
  onBpmChange: (newBpm: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  timeSignature: TimeSignature;
  onTimeSignatureChange: (ts: TimeSignature) => void;
  subdivision: Subdivision;
  onSubdivisionChange: (sub: Subdivision) => void;
  soundPreset: SoundPreset;
  onSoundPresetChange: (preset: SoundPreset) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onTapTempo: () => void;
  isWakeLocked: boolean;
}

export const MetronomeDisplay: React.FC<MetronomeDisplayProps> = ({
  bpm,
  onBpmChange,
  isPlaying,
  onTogglePlay,
  timeSignature,
  onTimeSignatureChange,
  subdivision,
  onSubdivisionChange,
  soundPreset,
  onSoundPresetChange,
  volume,
  onVolumeChange,
  onTapTempo,
  isWakeLocked,
}) => {
  const tapTimesRef = useRef<number[]>([]);

  const handleTap = () => {
    const now = performance.now();
    const times = tapTimesRef.current;

    // Se sono passati più di 2.2 secondi dall'ultimo tap, azzera
    if (times.length > 0 && now - times[times.length - 1] > 2200) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 5) {
      tapTimesRef.current.shift();
    }

    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgIntervalMs);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        onBpmChange(calculatedBpm);
      }
    }

    onTapTempo();
  };

  const adjustBpm = (delta: number) => {
    onBpmChange(Math.max(30, Math.min(300, bpm + delta)));
  };

  return (
    <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 shadow-xl flex flex-col gap-4">
      {/* Barra Superiore: Stato Schermo Attivo & Quick Tags */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold uppercase tracking-wider text-zinc-300">
            Metronomo Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isWakeLocked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
              <Radio className="w-3 h-3 animate-pulse" /> Schermo ON (iPhone)
            </span>
          )}
        </div>
      </div>

      {/* BPM Display Gigante per Visibilità da Palco */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-7xl md:text-8xl font-black font-mono tracking-tighter text-white select-none drop-shadow-[0_0_35px_rgba(255,255,255,0.15)]">
            {bpm}
          </span>
          <span className="text-sm md:text-base font-bold text-zinc-400 uppercase tracking-widest">
            BPM
          </span>
        </div>

        {/* Pulsanti Rapidi Regolazione BPM (+1, -1, +5, -5) */}
        <div className="flex items-center justify-center gap-2 mt-2 w-full max-w-sm">
          <button
            onClick={() => adjustBpm(-5)}
            className="flex-1 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-zinc-300 font-mono font-bold text-xs transition-all"
          >
            -5
          </button>
          <button
            onClick={() => adjustBpm(-1)}
            className="flex-1 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-mono font-bold text-xs transition-all flex items-center justify-center gap-0.5"
          >
            <Minus className="w-3.5 h-3.5" /> 1
          </button>
          <button
            onClick={() => adjustBpm(1)}
            className="flex-1 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-mono font-bold text-xs transition-all flex items-center justify-center gap-0.5"
          >
            <Plus className="w-3.5 h-3.5" /> 1
          </button>
          <button
            onClick={() => adjustBpm(5)}
            className="flex-1 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-zinc-300 font-mono font-bold text-xs transition-all"
          >
            +5
          </button>
        </div>

        {/* Slider BPM Continuo */}
        <div className="w-full max-w-md mt-3 px-2">
          <input
            type="range"
            min="30"
            max="260"
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="w-full accent-cyan-400 h-2 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Pulsanti Principali: TAP TEMPO & GIANT PLAY/STOP */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleTap}
          className="py-4 px-3 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 border border-zinc-700/80 flex flex-col items-center justify-center transition-all shadow-md"
        >
          <span className="text-sm font-black tracking-wider text-cyan-300 uppercase">
            TAP TEMPO
          </span>
          <span className="text-[10px] text-zinc-400 mt-0.5">Tocca al ritmo della band</span>
        </button>

        <button
          onClick={onTogglePlay}
          className={`py-4 px-3 rounded-2xl active:scale-95 flex flex-col items-center justify-center transition-all shadow-xl font-black tracking-wider uppercase text-base ${
            isPlaying
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/50'
              : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-950/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <>
                <Square className="w-5 h-5 fill-current" /> STOP
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" /> START
              </>
            )}
          </div>
          <span className="text-[10px] font-normal opacity-85 mt-0.5">
            {isPlaying ? 'Ferma click' : 'Avvia metronomo'}
          </span>
        </button>
      </div>

      {/* Metrica, Suddivisione, Suono e Volume */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-800/80">
        {/* Metrica / Time Signature */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">
            Metrica (Misura)
          </label>
          <select
            value={timeSignature}
            onChange={(e) => onTimeSignatureChange(e.target.value as TimeSignature)}
            className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="4/4">4/4 (Standard)</option>
            <option value="3/4">3/4 (Valzer)</option>
            <option value="2/4">2/4 (Marcia)</option>
            <option value="6/8">6/8 (Doppio accento)</option>
            <option value="5/4">5/4 (Dispari 3+2)</option>
            <option value="7/8">7/8 (Dispari)</option>
            <option value="12/8">12/8 (Blues/Slow)</option>
          </select>
        </div>

        {/* Suddivisione */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">Suddivisione</label>
          <select
            value={subdivision}
            onChange={(e) => onSubdivisionChange(e.target.value as Subdivision)}
            className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="quarter">Quarti (1/4)</option>
            <option value="eighth">Ottavi (1/8)</option>
            <option value="sixteenth">Sedicesimi (1/16)</option>
            <option value="triplet">Terzine (1/8T)</option>
          </select>
        </div>

        {/* Preset Suono */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">Suono Metronomo</label>
          <select
            value={soundPreset}
            onChange={(e) => onSoundPresetChange(e.target.value as SoundPreset)}
            className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="woodblock">Woodblock (Legno)</option>
            <option value="digital">Beep Elettronico</option>
            <option value="cowbell">Cowbell</option>
            <option value="click">Click Analogico</option>
            <option value="drumkit">Drum Kit (Cassa/Hi-hat)</option>
          </select>
        </div>

        {/* Volume */}
        <div>
          <div className="flex justify-between text-[11px] font-medium text-zinc-400 mb-1">
            <span>Volume Click</span>
            <span className="font-mono text-zinc-200">{Math.round(volume * 100)}%</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-2 rounded-xl bg-zinc-950 border border-zinc-700/80">
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
