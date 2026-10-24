'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { metronomeEngine } from '@/lib/audio/metronomeEngine';
import { tempoDetector, TempoDetectionResult } from '@/lib/audio/tempoDetector';
import { requestWakeLock, releaseWakeLock, setupWakeLockAutoRenew } from '@/lib/audio/wakeLock';
import {
  loadSetlistsData,
  saveSetlistsData,
  exportSingleSetlistAsJson,
  exportAllSetlistsAsJson,
  importSetlistJson,
} from '@/lib/storage/setlistStorage';
import {
  BeatEvent,
  Setlist,
  Song,
  SoundPreset,
  Subdivision,
  TimeSignature,
  TrackerMode,
  TrackerPoint,
} from '@/types';
import { MetronomeDisplay } from '@/components/MetronomeDisplay';
import { VisualFlasher } from '@/components/VisualFlasher';
import { TempoTrackerGraph } from '@/components/TempoTrackerGraph';
import { SetlistDrawer } from '@/components/SetlistDrawer';
import { InstallPwaBanner } from '@/components/InstallPwaBanner';
import { Radio, Music2 } from 'lucide-react';

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

  // Scalette Multiple State
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string>('');
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);

  // Tempo Tracker State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [trackerMode, setTrackerMode] = useState<TrackerMode>('acoustic');
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [thresholdLevel, setThresholdLevel] = useState<number>(20);
  const [isHit, setIsHit] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(0.65);
  const [trackerHistory, setTrackerHistory] = useState<TrackerPoint[]>([]);

  const sessionStartTimeRef = useRef<number>(0);
  const lastHistoryPointTimeRef = useRef<number>(0);

  // Scaletta e Brano attivi
  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];
  const activeSongs = activeSetlist ? activeSetlist.songs : [];
  const currentSong = activeSongs[currentSongIndex] || null;

  // Caricamento iniziale scalette
  useEffect(() => {
    const { setlists: loadedSetlists, activeId } = loadSetlistsData();
    setSetlists(loadedSetlists);
    setActiveSetlistId(activeId);

    const active = loadedSetlists.find((s) => s.id === activeId) || loadedSetlists[0];
    if (active && active.songs.length > 0) {
      const first = active.songs[0];
      setBpm(first.bpm);
      setTimeSignature(first.timeSignature);
      setSubdivision(first.subdivision);
      setSoundPreset(first.soundPreset);

      metronomeEngine.setBpm(first.bpm);
      metronomeEngine.setTimeSignature(first.timeSignature);
      metronomeEngine.setSubdivision(first.subdivision);
      metronomeEngine.setSoundPreset(first.soundPreset);
      tempoDetector.setTargetBpm(first.bpm);
    }

    const cleanupWakeLock = setupWakeLockAutoRenew();

    return () => {
      cleanupWakeLock();
      metronomeEngine.stop();
      tempoDetector.stop();
      releaseWakeLock();
    };
  }, []);

  // Aggiornamento impostazioni tempoDetector
  useEffect(() => {
    tempoDetector.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    tempoDetector.setMode(trackerMode);
  }, [trackerMode]);

  useEffect(() => {
    tempoDetector.setTargetBpm(bpm);
  }, [bpm]);

  // Callback battuta emessa dal motore metronomo
  useEffect(() => {
    metronomeEngine.setOnBeatCallback((event: BeatEvent) => {
      setCurrentBeat(event);
      window.setTimeout(() => {
        setCurrentBeat((prev) => (prev?.time === event.time ? null : prev));
      }, 90);
    });
  }, []);

  // Callback dal tempo detector
  useEffect(() => {
    tempoDetector.setOnResult((res: TempoDetectionResult) => {
      setDetectedBpm(res.detectedBpm);
      setConfidence(res.confidence);
      setAudioLevel(res.audioLevel);
      setThresholdLevel(res.thresholdLevel);
      setIsHit(res.isHit);

      if (res.detectedBpm !== null) {
        const now = Date.now();
        // Aggiungi un punto ogni 300ms per mantenere la timeline pulita
        if (now - lastHistoryPointTimeRef.current >= 300) {
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
            return next.length > 150 ? next.slice(-150) : next;
          });
        }
      }
    });
  }, [bpm]);

  // Gestione Wake Lock
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

  // Cambio BPM manuale
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    metronomeEngine.setBpm(newBpm);
    tempoDetector.setTargetBpm(newBpm);
  };

  // Selezione brano
  const handleSelectSong = (index: number) => {
    if (index < 0 || index >= activeSongs.length) return;
    const song = activeSongs[index];
    setCurrentSongIndex(index);
    setBpm(song.bpm);
    setTimeSignature(song.timeSignature);
    setSubdivision(song.subdivision);
    setSoundPreset(song.soundPreset);

    metronomeEngine.setBpm(song.bpm);
    metronomeEngine.setTimeSignature(song.timeSignature);
    metronomeEngine.setSubdivision(song.subdivision);
    metronomeEngine.setSoundPreset(song.soundPreset);
    tempoDetector.setTargetBpm(song.bpm);
  };

  const handleNextSong = () => {
    if (activeSongs.length === 0) return;
    const nextIndex = (currentSongIndex + 1) % activeSongs.length;
    handleSelectSong(nextIndex);
  };

  const handlePrevSong = () => {
    if (activeSongs.length === 0) return;
    const prevIndex = (currentSongIndex - 1 + activeSongs.length) % activeSongs.length;
    handleSelectSong(prevIndex);
  };

  // Gestione Scaletta Attiva & Operazioni
  const handleSelectSetlist = (id: string) => {
    setActiveSetlistId(id);
    saveSetlistsData(setlists, id);
    const setlist = setlists.find((s) => s.id === id);
    if (setlist && setlist.songs.length > 0) {
      setCurrentSongIndex(0);
      const first = setlist.songs[0];
      handleBpmChange(first.bpm);
      setTimeSignature(first.timeSignature);
      setSubdivision(first.subdivision);
      setSoundPreset(first.soundPreset);
      metronomeEngine.setTimeSignature(first.timeSignature);
      metronomeEngine.setSubdivision(first.subdivision);
      metronomeEngine.setSoundPreset(first.soundPreset);
    }
  };

  const handleCreateSetlist = (name: string) => {
    const newSetlist: Setlist = {
      id: `setlist-${Date.now()}`,
      name,
      songs: [],
    };
    const updated = [...setlists, newSetlist];
    setSetlists(updated);
    handleSelectSetlist(newSetlist.id);
  };

  const handleRenameSetlist = (id: string, newName: string) => {
    const updated = setlists.map((s) => (s.id === id ? { ...s, name: newName } : s));
    setSetlists(updated);
    saveSetlistsData(updated, activeSetlistId);
  };

  const handleDeleteSetlist = (id: string) => {
    const updated = setlists.filter((s) => s.id !== id);
    if (updated.length === 0) return;
    setSetlists(updated);
    const newActiveId = id === activeSetlistId ? updated[0].id : activeSetlistId;
    handleSelectSetlist(newActiveId);
  };

  const handleDuplicateSetlist = (id: string) => {
    const target = setlists.find((s) => s.id === id);
    if (!target) return;
    const duplicated: Setlist = {
      id: `setlist-${Date.now()}`,
      name: `${target.name} (Copia)`,
      songs: target.songs.map((s) => ({ ...s, id: `song-${Date.now()}-${Math.random()}` })),
    };
    const updated = [...setlists, duplicated];
    setSetlists(updated);
    handleSelectSetlist(duplicated.id);
  };

  // Modifica canzoni nella scaletta corrente
  const updateCurrentSetlistSongs = (newSongs: Song[]) => {
    const updated = setlists.map((s) =>
      s.id === activeSetlistId ? { ...s, songs: newSongs } : s
    );
    setSetlists(updated);
    saveSetlistsData(updated, activeSetlistId);
  };

  const handleAddSong = (newSongData: Omit<Song, 'id'>) => {
    const newSong: Song = {
      ...newSongData,
      id: `song-${Date.now()}`,
    };
    const updated = [...activeSongs, newSong];
    updateCurrentSetlistSongs(updated);
  };

  const handleUpdateSong = (updatedSong: Song) => {
    const updated = activeSongs.map((s) => (s.id === updatedSong.id ? updatedSong : s));
    updateCurrentSetlistSongs(updated);
    if (activeSongs[currentSongIndex]?.id === updatedSong.id) {
      handleBpmChange(updatedSong.bpm);
      setTimeSignature(updatedSong.timeSignature);
      setSubdivision(updatedSong.subdivision);
      setSoundPreset(updatedSong.soundPreset);
      metronomeEngine.setTimeSignature(updatedSong.timeSignature);
      metronomeEngine.setSubdivision(updatedSong.subdivision);
      metronomeEngine.setSoundPreset(updatedSong.soundPreset);
    }
  };

  const handleDeleteSong = (id: string) => {
    const updated = activeSongs.filter((s) => s.id !== id);
    updateCurrentSetlistSongs(updated);
    if (currentSongIndex >= updated.length) {
      setCurrentSongIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleMoveSong = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeSongs.length) return;
    const updated = [...activeSongs];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateCurrentSetlistSongs(updated);
    if (currentSongIndex === index) {
      setCurrentSongIndex(targetIndex);
    } else if (currentSongIndex === targetIndex) {
      setCurrentSongIndex(index);
    }
  };

  // Export & Import
  const handleExportActive = () => {
    if (!activeSetlist) return;
    const json = exportSingleSetlistAsJson(activeSetlist);
    downloadJsonFile(json, `${activeSetlist.name.toLowerCase().replace(/\s+/g, '_')}.json`);
  };

  const handleExportAll = () => {
    const json = exportAllSetlistsAsJson(setlists);
    downloadJsonFile(json, `backup_scalette_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleImportFile = (content: string): boolean => {
    const parsed = importSetlistJson(content);
    if (!parsed) return false;

    if (parsed.type === 'single') {
      const importedSetlist: Setlist = {
        ...parsed.data,
        id: `setlist-${Date.now()}`,
      };
      const updated = [...setlists, importedSetlist];
      setSetlists(updated);
      handleSelectSetlist(importedSetlist.id);
      return true;
    } else if (parsed.type === 'all' && Array.isArray(parsed.data)) {
      const updated = [...parsed.data];
      setSetlists(updated);
      if (updated.length > 0) {
        handleSelectSetlist(updated[0].id);
      }
      return true;
    }
    return false;
  };

  const downloadJsonFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  // Gestione tasti di scelta rapida
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        metronomeEngine.unlockAudio();
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleListen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isListening, activeSongs, currentSongIndex, bpm, timeSignature, subdivision, soundPreset, volume]);

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col items-center justify-start p-3 md:p-6 pb-20 max-w-2xl mx-auto gap-4">
      {/* Banner Installazione iPhone PWA */}
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
                Stage Pro
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
        onTimeSignatureChange={(ts) => {
          setTimeSignature(ts);
          metronomeEngine.setTimeSignature(ts);
        }}
        subdivision={subdivision}
        onSubdivisionChange={(sub) => {
          setSubdivision(sub);
          metronomeEngine.setSubdivision(sub);
        }}
        soundPreset={soundPreset}
        onSoundPresetChange={(preset) => {
          setSoundPreset(preset);
          metronomeEngine.setSoundPreset(preset);
        }}
        volume={volume}
        onVolumeChange={(vol) => {
          setVolume(vol);
          metronomeEngine.setVolume(vol);
        }}
        onTapTempo={() => {}}
        isWakeLocked={isWakeLocked}
      />

      {/* Modulo 2: Tempo Tracker Microfono con Modalità Fullscreen & Batteria Elettronica */}
      <TempoTrackerGraph
        isListening={isListening}
        detectedBpm={detectedBpm}
        targetBpm={bpm}
        confidence={confidence}
        audioLevel={audioLevel}
        thresholdLevel={thresholdLevel}
        isHit={isHit}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
        trackerMode={trackerMode}
        onTrackerModeChange={setTrackerMode}
        onToggleListen={handleToggleListen}
        history={trackerHistory}
        onClearHistory={() => setTrackerHistory([])}
        currentSong={currentSong}
        onNextSong={handleNextSong}
        onPrevSong={handlePrevSong}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        error={micError}
      />

      {/* Modulo 3: Gestione Scalette Multiple (Setlists) & Brani Live */}
      <SetlistDrawer
        setlists={setlists}
        activeSetlistId={activeSetlistId}
        onSelectSetlist={handleSelectSetlist}
        onCreateSetlist={handleCreateSetlist}
        onRenameSetlist={handleRenameSetlist}
        onDeleteSetlist={handleDeleteSetlist}
        onDuplicateSetlist={handleDuplicateSetlist}
        songs={activeSongs}
        currentSongIndex={currentSongIndex}
        onSelectSong={handleSelectSong}
        onAddSong={handleAddSong}
        onUpdateSong={handleUpdateSong}
        onDeleteSong={handleDeleteSong}
        onMoveSong={handleMoveSong}
        onNextSong={handleNextSong}
        onPrevSong={handlePrevSong}
        onExportActive={handleExportActive}
        onExportAll={handleExportAll}
        onImportFile={handleImportFile}
      />

      {/* Footer Scorciatoie */}
      <footer className="w-full text-center text-[11px] text-zinc-400 pt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">Spazio</kbd> Play/Stop</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px">→</kbd> Brano Successivo</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">←</kbd> Brano Precedente</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">M</kbd> Toggle Mic</span>
      </footer>
    </main>
  );
}
