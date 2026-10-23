'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { metronomeEngine } from '@/lib/audio/metronomeEngine';
import { tempoDetector, TempoDetectionResult } from '@/lib/audio/tempoDetector';
import { requestWakeLock, releaseWakeLock, setupWakeLockAutoRenew } from '@/lib/audio/wakeLock';
import { loadSetlist, saveSetlist, exportSetlistAsJson, importSetlistFromJson } from '@/lib/storage/setlistStorage';
import { BeatEvent, Song, SoundPreset, Subdivision, TimeSignature, TrackerPoint } from '@/types';
import { MetronomeDisplay } from '@/components/MetronomeDisplay';
import { VisualFlasher } from '@/components/VisualFlasher';
import { TempoTrackerGraph } from '@/components/TempoTrackerGraph';
import { SetlistDrawer } from '@/components/SetlistDrawer';
import { InstallPwaBanner } from '@/components/InstallPwaBanner';
import { Volume2, Radio, Music2, Info } from 'lucide-react';

export default function Home() {
  // Metronomo State
  const [bpm, setBpm] = useState<number>(116);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  const [subdivision, setSubdivision] = useState<Subdivision>('quarter');
  const [soundPreset, setSoundPreset] = useState<SoundPreset>('woodblock');
  const [volume, setVolume] = useState<number>(0.9);
  const [currentBeat, setCurrentBeat] = useState<BeatEvent | null>(null);
  const [fullscreenFlash, setFullscreenFlash] = useState<boolean>(false);
  const [isWakeLocked, setIsWakeLocked] = useState<boolean>(false);

  // Scaletta / Setlist State
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);

  // Tempo Tracker State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isHit, setIsHit] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(0.6);
  const [trackerHistory, setTrackerHistory] = useState<TrackerPoint[]>([]);

  const sessionStartTimeRef = useRef<number>(0);
  const lastHistoryPointTimeRef = useRef<number>(0);

  // Carica scaletta salvata all'avvio
  useEffect(() => {
    const loaded = loadSetlist();
    setSongs(loaded);
    if (loaded.length > 0) {
      const first = loaded[0];
      setBpm(first.bpm);
      setTimeSignature(first.timeSignature);
      setSubdivision(first.subdivision);
      setSoundPreset(first.soundPreset);
      metronomeEngine.setBpm(first.bpm);
      metronomeEngine.setTimeSignature(first.timeSignature);
      metronomeEngine.setSubdivision(first.subdivision);
      metronomeEngine.setSoundPreset(first.soundPreset);
    }

    // Configura Wake Lock auto-rinnovo quando lo schermo torna visibile
    const cleanupWakeLock = setupWakeLockAutoRenew();

    return () => {
      cleanupWakeLock();
      metronomeEngine.stop();
      tempoDetector.stop();
      releaseWakeLock();
    };
  }, []);

  // Callback battuta emessa dal motore metronomo
  useEffect(() => {
    metronomeEngine.setOnBeatCallback((event: BeatEvent) => {
      setCurrentBeat(event);
      // Breve reset dello stato beat visivo dopo 80ms per consentire l'animazione pulsante
      window.setTimeout(() => {
        setCurrentBeat((prev) => (prev?.time === event.time ? null : prev));
      }, 90);
    });
  }, []);

  // Configurazione callback Tempo Detector dal microfono
  useEffect(() => {
    tempoDetector.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    tempoDetector.setOnResult((res: TempoDetectionResult) => {
      setDetectedBpm(res.detectedBpm);
      setConfidence(res.confidence);
      setAudioLevel(res.audioLevel);
      setIsHit(res.isHit);

      if (res.detectedBpm !== null) {
        const now = Date.now();
        // Aggiungi un punto alla cronologia ogni 250ms per mantenere il grafico pulito e fluido
        if (now - lastHistoryPointTimeRef.current >= 250) {
          lastHistoryPointTimeRef.current = now;
          const timeOffset = now - sessionStartTimeRef.current;
          const drift = res.detectedBpm - bpm;

          setTrackerHistory((prev) => {
            const next = [
              ...prev,
              {
                timeOffset,
                detectedBpm: res.detectedBpm!,
                targetBpm: bpm,
                drift,
                confidence: res.confidence,
              },
            ];
            // Mantieni al massimo 120 punti (circa 30 secondi di sessione attiva)
            return next.length > 120 ? next.slice(-120) : next;
          });
        }
      }
    });
  }, [bpm]);

  // Gestione Wake Lock attiva/disattiva
  const updateWakeLockState = useCallback(async (shouldLock: boolean) => {
    if (shouldLock) {
      const success = await requestWakeLock();
      setIsWakeLocked(success);
    } else {
      await releaseWakeLock();
      setIsWakeLocked(false);
    }
  }, []);

  // Toggle Metronomo Play/Stop
  const handleTogglePlay = async () => {
    if (isPlaying) {
      metronomeEngine.stop();
      setIsPlaying(false);
      setCurrentBeat(null);
      if (!isListening) {
        await updateWakeLockState(false);
      }
    } else {
      await metronomeEngine.unlockAudio();
      metronomeEngine.setBpm(bpm);
      metronomeEngine.setTimeSignature(timeSignature);
      metronomeEngine.setSubdivision(subdivision);
      metronomeEngine.setSoundPreset(soundPreset);
      metronomeEngine.setVolume(volume);
      metronomeEngine.start();
      setIsPlaying(true);
      await updateWakeLockState(true);
    }
  };

  // Toggle Microfono Tempo Tracker
  const handleToggleListen = async () => {
    if (isListening) {
      tempoDetector.stop();
      setIsListening(false);
      setDetectedBpm(null);
      setAudioLevel(0);
      setIsHit(false);
      if (!isPlaying) {
        await updateWakeLockState(false);
      }
    } else {
      setMicError(null);
      try {
        await tempoDetector.start();
        setIsListening(true);
        sessionStartTimeRef.current = Date.now();
        await updateWakeLockState(true);
      } catch (err: any) {
        setMicError(
          err.message ||
            'Impossibile accedere al microfono. Assicurati di usare HTTPS e concedere i permessi su Safari.'
        );
        setIsListening(false);
      }
    }
  };

  // Cambio BPM
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    metronomeEngine.setBpm(newBpm);
  };

  // Cambio Metrica
  const handleTimeSignatureChange = (ts: TimeSignature) => {
    setTimeSignature(ts);
    metronomeEngine.setTimeSignature(ts);
  };

  // Cambio Suddivisione
  const handleSubdivisionChange = (sub: Subdivision) => {
    setSubdivision(sub);
    metronomeEngine.setSubdivision(sub);
  };

  // Cambio Suono
  const handleSoundPresetChange = (preset: SoundPreset) => {
    setSoundPreset(preset);
    metronomeEngine.setSoundPreset(preset);
  };

  // Cambio Volume
  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    metronomeEngine.setVolume(vol);
  };

  // Selezione brano da scaletta
  const handleSelectSong = (index: number) => {
    if (index < 0 || index >= songs.length) return;
    const song = songs[index];
    setCurrentSongIndex(index);
    setBpm(song.bpm);
    setTimeSignature(song.timeSignature);
    setSubdivision(song.subdivision);
    setSoundPreset(song.soundPreset);

    metronomeEngine.setBpm(song.bpm);
    metronomeEngine.setTimeSignature(song.timeSignature);
    metronomeEngine.setSubdivision(song.subdivision);
    metronomeEngine.setSoundPreset(song.soundPreset);
  };

  // Cambio rapido brano Next / Prev
  const handleNextSong = () => {
    if (songs.length === 0) return;
    const nextIndex = (currentSongIndex + 1) % songs.length;
    handleSelectSong(nextIndex);
  };

  const handlePrevSong = () => {
    if (songs.length === 0) return;
    const prevIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    handleSelectSong(prevIndex);
  };

  // Modifiche Scaletta
  const handleAddSong = (newSongData: Omit<Song, 'id'>) => {
    const newSong: Song = {
      ...newSongData,
      id: `song-${Date.now()}`,
    };
    const updated = [...songs, newSong];
    setSongs(updated);
    saveSetlist(updated);
  };

  const handleUpdateSong = (updatedSong: Song) => {
    const updated = songs.map((s) => (s.id === updatedSong.id ? updatedSong : s));
    setSongs(updated);
    saveSetlist(updated);
    if (songs[currentSongIndex]?.id === updatedSong.id) {
      setBpm(updatedSong.bpm);
      setTimeSignature(updatedSong.timeSignature);
      setSubdivision(updatedSong.subdivision);
      setSoundPreset(updatedSong.soundPreset);
      metronomeEngine.setBpm(updatedSong.bpm);
      metronomeEngine.setTimeSignature(updatedSong.timeSignature);
      metronomeEngine.setSubdivision(updatedSong.subdivision);
      metronomeEngine.setSoundPreset(updatedSong.soundPreset);
    }
  };

  const handleDeleteSong = (id: string) => {
    const updated = songs.filter((s) => s.id !== id);
    setSongs(updated);
    saveSetlist(updated);
    if (currentSongIndex >= updated.length) {
      setCurrentSongIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleMoveSong = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= songs.length) return;
    const updated = [...songs];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setSongs(updated);
    saveSetlist(updated);
    if (currentSongIndex === index) {
      setCurrentSongIndex(targetIndex);
    } else if (currentSongIndex === targetIndex) {
      setCurrentSongIndex(index);
    }
  };

  // Esporta / Importa JSON Scaletta
  const handleExportSongs = () => {
    const jsonStr = exportSetlistAsJson(songs);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scaletta-live-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSongs = (jsonStr: string): boolean => {
    const imported = importSetlistFromJson(jsonStr);
    if (imported) {
      setSongs(imported);
      setCurrentSongIndex(0);
      handleSelectSong(0);
      return true;
    }
    return false;
  };

  // Calcola numero battiti per misura per il flasher visivo
  const getMeasureBeats = (): number => {
    switch (timeSignature) {
      case '2/4': return 2;
      case '3/4': return 3;
      case '4/4': return 4;
      case '5/4': return 5;
      case '6/8': return 6;
      case '7/8': return 7;
      case '12/8': return 12;
      default: return 4;
    }
  };

  // Gestione tasti di scelta rapida (Spazio = Play/Stop, Frecce = Cambio brano)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se l'utente sta digitando in un input o select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextSong();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSong();
      } else if (e.key === 't' || e.key === 'T') {
        // Tap tempo rapido da tastiera
        metronomeEngine.unlockAudio();
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleListen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isListening, songs, currentSongIndex, bpm, timeSignature, subdivision, soundPreset, volume]);

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col items-center justify-start p-3 md:p-6 pb-20 max-w-2xl mx-auto gap-4">
      {/* Banner Notifica Installazione iPhone PWA */}
      <InstallPwaBanner />

      {/* Header Band Live */}
      <header className="w-full flex items-center justify-between py-1 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-black font-black shadow-lg shadow-cyan-950/40">
            <Music2 className="w-5 h-5 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
              LIVE METRONOME
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase">
                Stage Edition
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">
              Metronomo & Real-Time Tempo Tracker da microfono
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
          {isWakeLocked && (
            <div
              title="Screen Wake Lock attivo (schermo non si spegne)"
              className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded-lg border border-emerald-800/40 font-mono"
            >
              <Radio className="w-3 h-3 animate-ping" />
              <span>LIVE</span>
            </div>
          )}
        </div>
      </header>

      {/* Visual Flasher Battute per Batterista & Band */}
      <VisualFlasher
        currentBeat={currentBeat}
        totalBeats={getMeasureBeats()}
        fullscreenFlash={fullscreenFlash}
        onToggleFullscreenFlash={() => setFullscreenFlash(!fullscreenFlash)}
      />

      {/* Modulo 1: Metronomo Display & Controlli */}
      <MetronomeDisplay
        bpm={bpm}
        onBpmChange={handleBpmChange}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        timeSignature={timeSignature}
        onTimeSignatureChange={handleTimeSignatureChange}
        subdivision={subdivision}
        onSubdivisionChange={handleSubdivisionChange}
        soundPreset={soundPreset}
        onSoundPresetChange={handleSoundPresetChange}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        onTapTempo={() => {}}
        isWakeLocked={isWakeLocked}
      />

      {/* Modulo 2: Tempo Tracker Microfono in Tempo Reale */}
      <TempoTrackerGraph
        isListening={isListening}
        detectedBpm={detectedBpm}
        targetBpm={bpm}
        confidence={confidence}
        audioLevel={audioLevel}
        isHit={isHit}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
        onToggleListen={handleToggleListen}
        history={trackerHistory}
        onClearHistory={() => setTrackerHistory([])}
        error={micError}
      />

      {/* Modulo 3: Scaletta Brani Live (Setlist) */}
      <SetlistDrawer
        songs={songs}
        currentSongIndex={currentSongIndex}
        onSelectSong={handleSelectSong}
        onAddSong={handleAddSong}
        onUpdateSong={handleUpdateSong}
        onDeleteSong={handleDeleteSong}
        onMoveSong={handleMoveSong}
        onNextSong={handleNextSong}
        onPrevSong={handlePrevSong}
        onImportSongs={handleImportSongs}
        onExportSongs={handleExportSongs}
      />

      {/* Footer Scorciatoie da Tastiera / Pedale Bluetooth */}
      <footer className="w-full text-center text-[11px] text-zinc-400 pt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">Spazio</kbd> Play/Stop</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">→</kbd> Brano Successivo</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">←</kbd> Brano Precedente</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">M</kbd> Toggle Mic</span>
      </footer>
    </main>
  );
}
