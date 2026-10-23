import { Song } from '@/types';

const STORAGE_KEY = 'live_metronomo_setlist_v1';

export const DEFAULT_SETLIST: Song[] = [
  {
    id: 'song-1',
    title: 'Highway to Hell',
    bpm: 116,
    timeSignature: '4/4',
    subdivision: 'quarter',
    soundPreset: 'woodblock',
    notes: 'Intro chitarra 4 battute prima della batteria',
    colorTag: '#ef4444',
  },
  {
    id: 'song-2',
    title: 'Superstition',
    bpm: 100,
    timeSignature: '4/4',
    subdivision: 'sixteenth',
    soundPreset: 'cowbell',
    notes: 'Groove clavinet e cassa dritta',
    colorTag: '#f59e0b',
  },
  {
    id: 'song-3',
    title: 'Hysteria',
    bpm: 118,
    timeSignature: '4/4',
    subdivision: 'eighth',
    soundPreset: 'digital',
    notes: 'Riff basso continuo in sedicesimi',
    colorTag: '#10b981',
  },
  {
    id: 'song-4',
    title: 'Take Five',
    bpm: 174,
    timeSignature: '5/4',
    subdivision: 'quarter',
    soundPreset: 'woodblock',
    notes: 'Tempo dispari in 5/4 (3+2)',
    colorTag: '#3b82f6',
  },
  {
    id: 'song-5',
    title: 'Gravity',
    bpm: 68,
    timeSignature: '6/8',
    subdivision: 'triplet',
    soundPreset: 'click',
    notes: 'Lento e dinamico, attenzione ai ritornelli',
    colorTag: '#8b5cf6',
  },
];

export function loadSetlist(): Song[] {
  if (typeof window === 'undefined') return DEFAULT_SETLIST;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveSetlist(DEFAULT_SETLIST);
      return DEFAULT_SETLIST;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SETLIST;
  } catch (err) {
    console.error('Errore lettura scaletta da localStorage:', err);
    return DEFAULT_SETLIST;
  }
}

export function saveSetlist(songs: Song[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch (err) {
    console.error('Errore salvataggio scaletta su localStorage:', err);
  }
}

export function exportSetlistAsJson(songs: Song[]): string {
  return JSON.stringify(songs, null, 2);
}

export function importSetlistFromJson(jsonStr: string): Song[] | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.every((s) => s.id && s.title && s.bpm)) {
      saveSetlist(parsed);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
