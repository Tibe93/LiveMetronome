'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Activity,
  AlertCircle,
  Trash2,
  Sliders,
  Maximize2,
  X,
  Drum,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { Song, TrackerMode, TrackerPoint } from '@/types';

interface TempoTrackerGraphProps {
  isListening: boolean;
  detectedBpm: number | null;
  targetBpm: number;
  confidence: number;
  audioLevel: number;
  thresholdLevel: number;
  isHit: boolean;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  trackerMode: TrackerMode;
  onTrackerModeChange: (mode: TrackerMode) => void;
  onToggleListen: () => void;
  history: TrackerPoint[];
  onClearHistory: () => void;
  currentSong: Song | null;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  error?: string | null;
}

export const TempoTrackerGraph: React.FC<TempoTrackerGraphProps> = ({
  isListening,
  detectedBpm,
  targetBpm,
  confidence,
  audioLevel,
  thresholdLevel,
  isHit,
  sensitivity,
  onSensitivityChange,
  trackerMode,
  onTrackerModeChange,
  onToggleListen,
  history,
  onClearHistory,
  currentSong,
  onNextSong,
  onPrevSong,
  isPlaying,
  onTogglePlay,
  error,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inlineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Buffer mutabile per disaccoppiare il rendering 60fps dai cicli di render React
  const historyRef = useRef<TrackerPoint[]>([]);
  historyRef.current = history;
  const targetBpmRef = useRef<number>(targetBpm);
  targetBpmRef.current = targetBpm;
  const isListeningRef = useRef<boolean>(isListening);
  isListeningRef.current = isListening;

  // Blocco totale dello scroll del body quando in Fullscreen (evita rubber-banding su iOS)
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalWidth = document.body.style.width;
      const originalTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.touchAction = 'none';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsFullscreen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = originalWidth;
        document.body.style.touchAction = originalTouchAction;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isFullscreen]);

  // Calcolo scostamento rispetto al target
  const drift = detectedBpm !== null ? detectedBpm - targetBpm : null;

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
      statusText = 'ACCELERA (+ Lieve)';
      statusColor = 'text-amber-400';
      badgeBg = 'bg-amber-950/70 border-amber-500/50';
    } else if (drift > 5.0) {
      statusText = 'TROPPO VELOCE (+ Corsa)';
      statusColor = 'text-rose-400';
      badgeBg = 'bg-rose-950/70 border-rose-500/50';
    } else if (drift < -2.0 && drift >= -5.0) {
      statusText = 'RALLENTA (- Lieve)';
      statusColor = 'text-amber-400';
      badgeBg = 'bg-amber-950/70 border-amber-500/50';
    } else {
      statusText = 'TROPPO LENTO (- Trascina)';
      statusColor = 'text-rose-400';
      badgeBg = 'bg-rose-950/70 border-rose-500/50';
    }
  }

  // Disegno continuo Canvas a 60fps / 120fps (ProMotion iOS)
  const renderCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Gradiente sfondo stage dark
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0c0e16');
    bgGrad.addColorStop(1, '#06070b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const hist = historyRef.current;
    const target = targetBpmRef.current;
    const listening = isListeningRef.current;

    const yRange = 22;
    const yMin = target - yRange;
    const yMax = target + yRange;

    const bpmToY = (bpmVal: number) => {
      const clamped = Math.max(yMin, Math.min(yMax, bpmVal));
      const norm = (clamped - yMin) / (yMax - yMin);
      return height - norm * height;
    };

    // Griglia orizzontale
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    for (let b = Math.ceil(yMin / 5) * 5; b <= yMax; b += 5) {
      const y = bpmToY(b);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      ctx.fillStyle = b === target ? 'rgba(56, 189, 248, 0.85)' : 'rgba(113, 113, 122, 0.45)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${b}`, 8, y - 3);
    }

    // Fascia di tolleranza verde smeraldo (±2 BPM)
    const yUpper = bpmToY(target + 2);
    const yLower = bpmToY(target - 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.fillRect(0, yUpper, width, yLower - yUpper);

    // Linea TARGET tratteggiata ciano
    const yTarget = bpmToY(target);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, yTarget);
    ctx.lineTo(width, yTarget);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`TARGET ${target}`, width - 12, yTarget - 4);

    if (hist.length === 0) {
      ctx.fillStyle = 'rgba(161, 161, 170, 0.5)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        listening
          ? 'Suona la batteria o lo strumento per tracciare il tempo...'
          : 'Premi "Avvia Microfono" per iniziare il tracking live',
        width / 2,
        height / 2
      );
      ctx.restore();
      return;
    }

    // Curva fluida spline
    const maxVisible = 65;
    const displayPoints = hist.slice(-maxVisible);

    if (displayPoints.length >= 2) {
      ctx.lineWidth = 3.5;
      ctx.beginPath();

      const paddingLeft = 32;
      const paddingRight = 16;
      const plotWidth = width - paddingLeft - paddingRight;

      const coords = displayPoints.map((pt, i) => ({
        x: paddingLeft + (i / (displayPoints.length - 1)) * plotWidth,
        y: bpmToY(pt.detectedBpm),
        drift: pt.drift,
      }));

      ctx.moveTo(coords[0].x, coords[0].y);
      for (let i = 0; i < coords.length - 1; i++) {
        const xc = (coords[i].x + coords[i + 1].x) / 2;
        const yc = (coords[i].y + coords[i + 1].y) / 2;
        ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
      }
      const lastCoord = coords[coords.length - 1];
      ctx.lineTo(lastCoord.x, lastCoord.y);

      const lastDrift = Math.abs(lastCoord.drift);
      if (lastDrift <= 2.0) {
        ctx.strokeStyle = '#10b981';
      } else if (lastDrift <= 5.0) {
        ctx.strokeStyle = '#f59e0b';
      } else {
        ctx.strokeStyle = '#f43f5e';
      }
      ctx.stroke();

      // Punto finale pulsante
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(lastCoord.x, lastCoord.y, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = ctx.strokeStyle + '33';
      ctx.beginPath();
      ctx.arc(lastCoord.x, lastCoord.y, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (inlineCanvasRef.current) {
        renderCanvas(inlineCanvasRef.current);
      }
      if (fullscreenCanvasRef.current) {
        renderCanvas(fullscreenCanvasRef.current);
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  return (
    <>
      {/* ============================================================ */}
      {/* MODALITÀ A SCHERMO INTERO (STAGE FULLSCREEN PRO)              */}
      {/* ============================================================ */}
      {isFullscreen && (
        <div
          onTouchMove={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[100] bg-[#07080d] text-white flex flex-col justify-between overflow-hidden overscroll-none touch-none select-none"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)',
            paddingLeft: 'max(env(safe-area-inset-left, 0px), 14px)',
            paddingRight: 'max(env(safe-area-inset-right, 0px), 14px)',
          }}
        >
          {/* Sezione Superiore: BPM Giganti, Scostamento e Pulsante ESCI Evidente */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 gap-2">
            <div className="flex items-center gap-3 md:gap-5 flex-wrap">
              {/* Riquadro BPM Attuali */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                  BPM LIVE
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl md:text-7xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    {detectedBpm !== null ? detectedBpm.toFixed(1) : '--'}
                  </span>
                  <span className="text-xs text-zinc-400 font-bold">BPM</span>
                </div>
              </div>

              {/* Riquadro Scostamento */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                  SCOSTAMENTO
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-3xl md:text-5xl font-black font-mono tracking-tight ${
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
                  <div
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold uppercase ${badgeBg} ${statusColor}`}
                  >
                    {statusText}
                  </div>
                </div>
              </div>
            </div>

            {/* Pulsante ESCI Immediato ed Evidente */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-3 rounded-2xl bg-zinc-800/90 hover:bg-rose-950 border border-zinc-600 hover:border-rose-500 active:scale-95 text-white flex items-center gap-1.5 font-black text-xs md:text-sm shadow-xl transition-all"
              >
                <X className="w-5 h-5 text-rose-400" />
                <span>ESCI</span>
              </button>
            </div>
          </div>

          {/* Sezione Centrale: Grafico Fullscreen Fluido */}
          <div className="relative flex-1 min-h-0 w-full my-2.5 rounded-2xl overflow-hidden border border-zinc-800 bg-[#090a10]">
            <canvas ref={fullscreenCanvasRef} className="w-full h-full block" />
          </div>

          {/* Sezione Inferiore: Canzone, Tempo Target e Cambio Brano Stage */}
          <div className="flex items-center justify-between gap-2.5 p-2.5 md:p-3 rounded-2xl bg-zinc-900/95 border border-zinc-800">
            {onPrevSong && (
              <button
                onClick={onPrevSong}
                className="min-h-[48px] px-3 md:px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-black text-xs md:text-sm flex items-center gap-1.5 transition-all shrink-0"
              >
                <SkipBack className="w-4 h-4" /> PREV
              </button>
            )}

            <div className="flex-1 flex flex-col items-center justify-center text-center px-1 overflow-hidden">
              <span className="text-base md:text-xl font-black text-white truncate max-w-full">
                {currentSong?.title || 'Metronomo Libero'}
              </span>
              <div className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-xs font-mono text-zinc-400 mt-0.5">
                <span className="text-cyan-400 font-bold">Target: {targetBpm} BPM</span>
                <span>•</span>
                <span>{currentSong?.timeSignature || '4/4'}</span>
                {currentSong?.notes && (
                  <>
                    <span>•</span>
                    <span className="italic text-zinc-400 truncate max-w-[120px] md:max-w-xs">
                      {currentSong.notes}
                    </span>
                  </>
                )}
              </div>
            </div>

            {onTogglePlay && (
              <button
                onClick={onTogglePlay}
                className={`min-h-[48px] px-3.5 md:px-5 rounded-xl font-black text-xs md:text-sm active:scale-95 transition-all shrink-0 ${
                  isPlaying
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/40'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-950/40'
                }`}
              >
                {isPlaying ? 'STOP CLICK' : 'START CLICK'}
              </button>
            )}

            {onNextSong && (
              <button
                onClick={onNextSong}
                className="min-h-[48px] px-3 md:px-5 rounded-xl bg-cyan-600/40 hover:bg-cyan-600/60 border border-cyan-500/50 active:scale-95 text-cyan-200 font-black text-xs md:text-sm flex items-center gap-1.5 transition-all shrink-0"
              >
                NEXT <SkipForward className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALITÀ STANDARD (INLINE)                                   */}
      {/* ============================================================ */}
      <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 shadow-xl flex flex-col gap-3">
        {/* Intestazione */}
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
                title="Azzera cronologia"
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all active:scale-95"
            >
              <Maximize2 className="w-4 h-4" /> Schermo Intero
            </button>

            <button
              onClick={onToggleListen}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-black'
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

        {/* Selettore Modalità: Batteria Acustica vs Elettronica */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
          <button
            onClick={() => onTrackerModeChange('acoustic')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              trackerMode === 'acoustic'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Drum className="w-4 h-4 text-emerald-400" /> Acustica / Band
          </button>
          <button
            onClick={() => onTrackerModeChange('electronic')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              trackerMode === 'electronic'
                ? 'bg-cyan-950 text-cyan-300 shadow-sm border border-cyan-500/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" /> Elettronica (Pads Super-Sensibile)
          </button>
        </div>

        {/* Schede Dati Rilevamento Live */}
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

          {/* Indicatore Colpo Live & Livello Segnale vs Soglia */}
          <div className="flex flex-col justify-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] uppercase font-bold text-zinc-400 text-center">
              Transiente & Soglia
            </span>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform shrink-0 ${
                  isHit
                    ? 'bg-emerald-400 scale-125 shadow-[0_0_12px_#34d399]'
                    : 'bg-zinc-800'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${isHit ? 'bg-black' : 'bg-zinc-600'}`} />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-amber-400"
                    style={{ left: `${thresholdLevel}%` }}
                    title={`Soglia scatto: ${thresholdLevel}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>In: {audioLevel}%</span>
                  <span className="text-amber-400">Soglia: {thresholdLevel}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistica Tolleranza */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Stato Live</span>
            <span className={`text-xs font-bold text-center mt-1.5 ${statusColor}`}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Grafico Canvas Fluido Inline */}
        <div className="relative w-full h-44 rounded-xl overflow-hidden border border-zinc-800 bg-[#090a10]">
          <canvas ref={inlineCanvasRef} className="w-full h-full block" />
        </div>

        {/* Regolazione Sensibilità Microfono */}
        <div className="flex items-center justify-between gap-3 text-xs text-zinc-400 px-1 pt-1">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sensibilità Microfono:</span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-[220px]">
            <input
              type="range"
              min="0.05"
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
    </>
  );
};
