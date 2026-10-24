'use client';

import React, { useState, useRef } from 'react';
import {
  ListMusic,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
  Check,
  X,
  Copy,
  SkipBack,
  SkipForward,
  FolderOpen,
} from 'lucide-react';
import { Setlist, Song, SoundPreset, Subdivision, TimeSignature } from '@/types';

interface SetlistDrawerProps {
  setlists: Setlist[];
  activeSetlistId: string;
  onSelectSetlist: (id: string) => void;
  onCreateSetlist: (name: string) => void;
  onRenameSetlist: (id: string, newName: string) => void;
  onDeleteSetlist: (id: string) => void;
  onDuplicateSetlist: (id: string) => void;

  songs: Song[];
  currentSongIndex: number;
  onSelectSong: (index: number) => void;
  onAddSong: (song: Omit<Song, 'id'>) => void;
  onUpdateSong: (song: Song) => void;
  onDeleteSong: (id: string) => void;
  onMoveSong: (index: number, direction: 'up' | 'down') => void;
  onNextSong: () => void;
  onPrevSong: () => void;

  onExportActive: () => void;
  onExportAll: () => void;
  onImportFile: (content: string) => boolean;
}

export const SetlistDrawer: React.FC<SetlistDrawerProps> = ({
  setlists,
  activeSetlistId,
  onSelectSetlist,
  onCreateSetlist,
  onRenameSetlist,
  onDeleteSetlist,
  onDuplicateSetlist,
  songs,
  currentSongIndex,
  onSelectSong,
  onAddSong,
  onUpdateSong,
  onDeleteSong,
  onMoveSong,
  onNextSong,
  onPrevSong,
  onExportActive,
  onExportAll,
  onImportFile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManagingSetlists, setIsManagingSetlists] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State Brano
  const [formTitle, setFormTitle] = useState('');
  const [formBpm, setFormBpm] = useState(120);
  const [formTimeSig, setFormTimeSig] = useState<TimeSignature>('4/4');
  const [formSub, setFormSub] = useState<Subdivision>('quarter');
  const [formPreset, setFormPreset] = useState<SoundPreset>('woodblock');
  const [formNotes, setFormNotes] = useState('');
  const [formColor, setFormColor] = useState('#10b981');

  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];
  const currentSong = songs[currentSongIndex] || null;

  const handleOpenCreateSong = () => {
    setFormTitle(`Brano ${songs.length + 1}`);
    setFormBpm(120);
    setFormTimeSig('4/4');
    setFormSub('quarter');
    setFormPreset('woodblock');
    setFormNotes('');
    setFormColor('#10b981');
    setIsCreatingSong(true);
    setEditingSong(null);
  };

  const handleOpenEditSong = (song: Song) => {
    setFormTitle(song.title);
    setFormBpm(song.bpm);
    setFormTimeSig(song.timeSignature);
    setFormSub(song.subdivision);
    setFormPreset(song.soundPreset);
    setFormNotes(song.notes || '');
    setFormColor(song.colorTag || '#10b981');
    setEditingSong(song);
    setIsCreatingSong(false);
  };

  const handleSaveSongForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingSong) {
      onUpdateSong({
        ...editingSong,
        title: formTitle.trim(),
        bpm: Number(formBpm),
        timeSignature: formTimeSig,
        subdivision: formSub,
        soundPreset: formPreset,
        notes: formNotes.trim(),
        colorTag: formColor,
      });
      setEditingSong(null);
    } else {
      onAddSong({
        title: formTitle.trim(),
        bpm: Number(formBpm),
        timeSignature: formTimeSig,
        subdivision: formSub,
        soundPreset: formPreset,
        notes: formNotes.trim(),
        colorTag: formColor,
      });
      setIsCreatingSong(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = onImportFile(content);
        if (ok) {
          setImportNotice('✓ Scaletta importata con successo!');
        } else {
          setImportNotice('✗ Formato JSON non valido.');
        }
        setTimeout(() => setImportNotice(null), 3500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 shadow-xl flex flex-col gap-3">
      {/* Intestazione Scaletta & Selettore Scaletta Attiva */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <ListMusic className="w-5 h-5 text-cyan-400 shrink-0" />
          <select
            value={activeSetlistId}
            onChange={(e) => onSelectSetlist(e.target.value)}
            className="bg-zinc-950 border border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 max-w-full"
          >
            {setlists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.songs.length} brani)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsManagingSetlists(!isManagingSetlists)}
            className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium flex items-center gap-1"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Gestisci Scalette
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
          >
            {isOpen ? 'Chiudi' : 'Modifica Brani'}
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs text-center font-semibold">
          {importNotice}
        </div>
      )}

      {/* Pannello Gestione Scalette Multiple (Crea, Rinomina, Elimina, Import/Export) */}
      {isManagingSetlists && (
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-zinc-300">
              Archivio Scalette Band
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" /> Importa JSON
              </button>
              <button
                onClick={onExportActive}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Esporta Questa
              </button>
              <button
                onClick={onExportAll}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
                title="Backup di tutte le scalette"
              >
                <Download className="w-3.5 h-3.5" /> Backup Tutto
              </button>
            </div>
          </div>

          {/* Crea Nuova Scaletta */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nome nuova scaletta (es. Tour Estate)"
              value={newSetlistName}
              onChange={(e) => setNewSetlistName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => {
                if (newSetlistName.trim()) {
                  onCreateSetlist(newSetlistName.trim());
                  setNewSetlistName('');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Crea
            </button>
          </div>

          {/* Elenco Scalette Esistenti */}
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pt-1">
            {setlists.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                  s.id === activeSetlistId
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                <span
                  onClick={() => onSelectSetlist(s.id)}
                  className="cursor-pointer font-semibold truncate flex-1"
                >
                  {s.name} ({s.songs.length} brani)
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDuplicateSetlist(s.id)}
                    title="Duplica scaletta"
                    className="p-1 text-zinc-400 hover:text-cyan-300"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const newN = prompt('Rinomina scaletta:', s.name);
                      if (newN && newN.trim()) {
                        onRenameSetlist(s.id, newN.trim());
                      }
                    }}
                    title="Rinomina"
                    className="p-1 text-zinc-400 hover:text-cyan-300"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (setlists.length <= 1) {
                        alert('Devi mantenere almeno una scaletta.');
                        return;
                      }
                      if (confirm(`Eliminare la scaletta "${s.name}"?`)) {
                        onDeleteSetlist(s.id);
                      }
                    }}
                    disabled={setlists.length <= 1}
                    title="Elimina"
                    className="p-1 text-zinc-400 hover:text-rose-400 disabled:opacity-20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controller Cambio Brano Rapido sul Palco */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
        <button
          onClick={onPrevSong}
          disabled={songs.length <= 1}
          className="flex-1 max-w-[90px] py-3 px-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-zinc-200 flex items-center justify-center gap-1 font-bold text-xs transition-all"
        >
          <SkipBack className="w-4 h-4" /> PREV
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-2 overflow-hidden">
          {currentSong ? (
            <>
              <div className="flex items-center gap-2 max-w-full">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentSong.colorTag || '#10b981' }}
                />
                <span className="font-bold text-base md:text-lg text-white truncate">
                  {currentSong.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                <span className="font-bold text-cyan-400">{currentSong.bpm} BPM</span>
                <span>•</span>
                <span>{currentSong.timeSignature}</span>
                {currentSong.notes && (
                  <>
                    <span>•</span>
                    <span className="truncate italic text-zinc-400 max-w-[180px]">
                      {currentSong.notes}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <span className="text-zinc-500 text-xs italic">Nessun brano in scaletta</span>
          )}
        </div>

        <button
          onClick={onNextSong}
          disabled={songs.length <= 1}
          className="flex-1 max-w-[90px] py-3 px-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-cyan-300 border border-cyan-500/40 flex items-center justify-center gap-1 font-bold text-xs transition-all"
        >
          NEXT <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Lista Brani della Scaletta Attiva */}
      {isOpen && (
        <div className="flex flex-col gap-3 pt-2 border-t border-zinc-800/80 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400 font-medium">
              Brani in: <strong className="text-white">{activeSetlist?.name}</strong>
            </span>
            <button
              onClick={handleOpenCreateSong}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Aggiungi Brano
            </button>
          </div>

          {/* Form Crea / Modifica Brano */}
          {(isCreatingSong || editingSong) && (
            <form
              onSubmit={handleSaveSongForm}
              className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-700/80 flex flex-col gap-3 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-300">
                  {editingSong ? 'Modifica Brano' : 'Nuovo Brano'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingSong(false);
                    setEditingSong(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Titolo Brano</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="es. Highway to Hell"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">BPM</label>
                    <input
                      type="number"
                      min="30"
                      max="300"
                      required
                      value={formBpm}
                      onChange={(e) => setFormBpm(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Metrica</label>
                    <select
                      value={formTimeSig}
                      onChange={(e) => setFormTimeSig(e.target.value as TimeSignature)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                    >
                      <option value="4/4">4/4</option>
                      <option value="3/4">3/4</option>
                      <option value="2/4">2/4</option>
                      <option value="6/8">6/8</option>
                      <option value="5/4">5/4</option>
                      <option value="7/8">7/8</option>
                      <option value="12/8">12/8</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Suddivisione</label>
                  <select
                    value={formSub}
                    onChange={(e) => setFormSub(e.target.value as Subdivision)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="quarter">Quarti (1/4)</option>
                    <option value="eighth">Ottavi (1/8)</option>
                    <option value="sixteenth">Sedicesimi (1/16)</option>
                    <option value="triplet">Terzine (1/8T)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Preset Suono</label>
                  <select
                    value={formPreset}
                    onChange={(e) => setFormPreset(e.target.value as SoundPreset)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="woodblock">Woodblock</option>
                    <option value="digital">Beep Digitale</option>
                    <option value="cowbell">Cowbell</option>
                    <option value="click">Click Analogico</option>
                    <option value="drumkit">Drum Kit (Cassa/Hi-hat)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Note di Palco</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="es. Attacco chitarra 4 battute"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingSong(false);
                    setEditingSong(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Salva Brano
                </button>
              </div>
            </form>
          )}

          {/* Elenco Brani Scorrevole */}
          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
            {songs.map((song, index) => {
              const isSelected = index === currentSongIndex;

              return (
                <div
                  key={song.id}
                  className={`flex items-center justify-between p-2 rounded-xl transition-colors border ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/50'
                      : 'bg-zinc-950/40 border-zinc-800 hover:bg-zinc-800/40'
                  }`}
                >
                  <div
                    onClick={() => onSelectSong(index)}
                    className="flex-1 flex items-center gap-2.5 cursor-pointer min-w-0"
                  >
                    <span className="text-xs font-mono font-bold text-zinc-500 w-4">
                      {index + 1}.
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: song.colorTag || '#10b981' }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">{song.title}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                        <span className="text-cyan-400 font-semibold">{song.bpm} BPM</span>
                        <span>•</span>
                        <span>{song.timeSignature}</span>
                        {song.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate italic text-zinc-400">{song.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Azioni riga brano */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onMoveSong(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onMoveSong(index, 'down')}
                      disabled={index === songs.length - 1}
                      className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditSong(song)}
                      className="p-1 text-zinc-400 hover:text-cyan-400"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteSong(song.id)}
                      className="p-1 text-zinc-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
