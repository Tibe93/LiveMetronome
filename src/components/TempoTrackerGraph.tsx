'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, AlertCircle, Trash2, Sliders } from 'lucide-react';
import { TrackerPoint } from '@/types';

interface TempoTrackerGraphProps {
  isListening: boolean;
  detectedBpm: number | null;
  targetBpm: number;
  confidence: number;
  audioLevel: number;
  isHit: boolean;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  onToggleListen: () => void;
  history: TrackerPoint[];
  onClearHistory: () => void;
  error?: string | null;
}

export const TempoTrackerGraph: React.FC<TempoTrackerGraphProps> = ({
  isListening,
  detectedBpm,
  targetBpm,
  confidence,
  audioLevel,
  isHit,
  sensitivity,
  onSensitivityChange,
  onToggleListen,
  history,
  onClearHistory,
  error,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Calcola scostamento rispetto al target
  const drift = detectedBpm !== null ? detectedBpm - targetBpm : null;
  const absDrift = drift !== null ? Math.abs(drift) : null;

  // Determina stato del tempo per la band
  let statusText = 'In attesa di battito...';
  let statusColor = 'text-zinc-400';
  let badgeBg = 'bg-zinc-800/80 border-zinc-700';

  if (drift !== null) {
    const abs = Math.abs(drift);
    if (abs <= 2.0) {
      statusText = 'TEMPO PERFETTO';
      statusColor = 'text-emerald-400';
      badgeBg = 'bg-emerald-950/70 border-emerald-500/50';
    } else if (drift > 2.0 && drift <= 5.0) {
      statusText = 'ACCELERA LEGGERMENTE';
      statusColor = 'text-amber-400';
      badgeBg = 'bg-amber-950/70 border-amber-500/50';
    } else if (drift > 5.0) {
      statusText = 'TROPPO VELOCE (+ CORSA)';
      statusColor = 'text-rose-400';
      badgeBg = 'bg-rose-950/70 border-rose-500/50';
    } else if (drift < -2.0 && drift >= -5.0) {
      statusText = 'RALLENTA LEGGERMENTE';
      statusColor = 'text-amber-400';
      badgeBg = 'bg-amber-950/70 border-amber-500/50';
    } else {
      statusText = 'TROPPO LENTO (- TRASCINA)';
      statusColor = 'text-rose-400';
      badgeBg = 'bg-rose-950/70 border-rose-500/50';
    }
  }

  // Rendering del grafico su HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Pulisci sfondo
    ctx.clearRect(0, 0, width, height);

    // Gradiente sfondo scuro moderno
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, 'rgba(15, 17, 26, 0.95)');
    bgGrad.addColorStop(1, 'rgba(9, 10, 15, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Se non ci sono punti storici o non ascolta, disegna placeholder
    if (history.length === 0) {
      ctx.fillStyle = 'rgba(113, 113, 122, 0.4)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isListening ? 'Suona la batteria o uno strumento per tracciare il tempo...' : 'Premi "Avvia Microfono" per iniziare il tracking live',
        width / 2,
        height / 2
      );
      return;
    }

    // Range BPM dell'asse Y (centrato sul target ± 25 BPM o dinamico)
    const yCenterBpm = targetBpm;
    const yRange = 25; // Target ± 25 BPM
    const yMin = yCenterBpm - yRange;
    const yMax = yCenterBpm + yRange;

    const bpmToY = (bpm: number) => {
      const clamped = Math.max(yMin, Math.min(yMax, bpm));
      const normalized = (clamped - yMin) / (yMax - yMin);
      return height - normalized * height;
    };

    // Disegna griglia orizzontale
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let b = yMin; b <= yMax; b += 10) {
      const y = bpmToY(b);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(113, 113, 122, 0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${b}`, 6, y - 3);
    }

    // Disegna zona di tolleranza verde attorno al target (±2 BPM)
    const yTargetUpper = bpmToY(targetBpm + 2);
    const yTargetLower = bpmToY(targetBpm - 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(0, yTargetUpper, width, yTargetLower - yTargetUpper);

    // Disegna linea TARGET BPM
    const yTarget = bpmToY(targetBpm);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yTarget);
    ctx.lineTo(width, yTarget);
    ctx.stroke();
    ctx.setLineDash([]);

    // Etichetta Target
    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`TARGET ${targetBpm}`, width - 8, yTarget - 4);

    // Disegna linea DETECTED BPM dai dati storici
    const maxVisiblePoints = 50;
    const displayData = history.slice(-maxVisiblePoints);

    if (displayData.length > 1) {
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let i = 0; i < displayData.length; i++) {
        const pt = displayData[i];
        const x = (i / (displayData.length - 1)) * (width - 24) + 12;
        const y = bpmToY(pt.detectedBpm);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Colore dinamico della traccia
      const lastPoint = displayData[displayData.length - 1];
      const lastDrift = Math.abs(lastPoint.drift);
      if (lastDrift <= 2.0) {
        ctx.strokeStyle = '#10b981'; // Smeraldo
      } else if (lastDrift <= 5.0) {
        ctx.strokeStyle = '#f59e0b'; // Ambra
      } else {
        ctx.strokeStyle = '#f43f5e'; // Rosso
      }
      ctx.stroke();

      // Disegna punto corrente finale con alone
      const lastX = width - 12;
      const lastY = bpmToY(lastPoint.detectedBpm);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Alone
      ctx.fillStyle = ctx.strokeStyle + '33';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [history, targetBpm, isListening]);

  return (
    <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 shadow-xl flex flex-col gap-3">
      {/* Intestazione e Controlli Tracker */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-200">
            Tempo Tracking Microfono (Live)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              title="Azzera storico grafico"
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onToggleListen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-md active:scale-95 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-900/40'
                : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-900/40'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" /> Stop Mic
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" /> Avvia Microfono
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Rilevamento in Tempo Reale & Scostamento BPM */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* BPM Rilevati */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <span className="text-[10px] uppercase font-bold text-zinc-400">BPM Rilevati</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              {detectedBpm !== null ? detectedBpm.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-zinc-400 font-medium">BPM</span>
          </div>
        </div>

        {/* Scostamento dal Target */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <span className="text-[10px] uppercase font-bold text-zinc-400">Scostamento Target</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-3xl font-black font-mono tracking-tight ${
                drift === null
                  ? 'text-zinc-500'
                  : Math.abs(drift) <= 2
                  ? 'text-emerald-400'
                  : Math.abs(drift) <= 5
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {drift !== null ? (drift > 0 ? `+${drift.toFixed(1)}` : drift.toFixed(1)) : '0.0'}
            </span>
            <span className="text-xs text-zinc-400 font-medium">Δ</span>
          </div>
        </div>

        {/* Affidabilità / Confidence */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <span className="text-[10px] uppercase font-bold text-zinc-400">Affidabilità Segnale</span>
          <div className="w-full mt-2">
            <div className="flex justify-between text-xs font-mono mb-1 text-zinc-300">
              <span>Match</span>
              <span className="font-bold">{confidence}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  confidence > 70
                    ? 'bg-emerald-500'
                    : confidence > 40
                    ? 'bg-amber-500'
                    : 'bg-zinc-600'
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Indicatore Colpo Live & Input Level */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <span className="text-[10px] uppercase font-bold text-zinc-400">Transiente Batteria</span>
          <div className="flex items-center gap-3 mt-1.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-75 ${
                isHit
                  ? 'bg-emerald-400 scale-125 shadow-[0_0_15px_rgba(52,211,153,0.9)]'
                  : 'bg-zinc-800 scale-100'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${isHit ? 'bg-black' : 'bg-zinc-600'}`} />
            </div>
            <div className="flex flex-col text-[11px] text-zinc-400 font-mono">
              <span>Livello: {audioLevel}%</span>
              <span className={isHit ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                {isHit ? 'COLPO!' : 'in ascolto'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner di Stato Scostamento (Ibrido / Coach) */}
      <div
        className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${badgeBg} ${statusColor}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-ping" />
          {statusText}
        </span>
        <span className="font-mono text-[11px] opacity-80">
          Target impostato: {targetBpm} BPM
        </span>
      </div>

      {/* Grafico Canvas */}
      <div className="relative w-full h-44 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Regolazione Sensibilità Microfono */}
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400 px-1 pt-1">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <span>Sensibilità Microfono Sala Prove:</span>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={sensitivity}
            onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="font-mono text-zinc-200 w-8 text-right">
            {Math.round(sensitivity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
