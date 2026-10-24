import { Setlist, Song } from '@/types';

const STORAGE_KEY_SETLISTS = 'live_metronomo_setlists_v2';
const STORAGE_KEY_ACTIVE_ID = 'live_metronomo_active_setlist_id_v2';
const LEGACY_STORAGE_KEY = 'live_metronomo_setlist_v1';

export const DEFAULT_SETLISTS: Setlist[] = [
  {
    id: 'setlist-rock-live',
    name: 'Scaletta Live (Rock & Groove)',
    songs: [
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
    ],
  },
  {
    id: 'setlist-prove-studio',
    name: 'Prove & Esercizi Ritmici',
    songs: [
      {
        id: 'song-ex-1',
        title: 'Riscaldamento Groove 100',
        bpm: 100,
        timeSignature: '4/4',
        subdivision: 'eighth',
        soundPreset: 'woodblock',
        notes: 'Coordinazione cassa/rullante',
        colorTag: '#06b6d4',
      },
      {
        id: 'song-ex-2',
        title: 'Shuffle Blues 85',
        bpm: 85,
        timeSignature: '12/8',
        subdivision: 'triplet',
        soundPreset: 'cowbell',
        notes: 'Terzine blues swingate',
        colorTag: '#3b82f6',
      },
      {
        id: 'song-ex-3',
        title: 'Up-tempo Rock 145',
        bpm: 145,
        timeSignature: '4/4',
        subdivision: 'quarter',
        soundPreset: 'digital',
        notes: 'Tenuta del tempo su brani veloci',
        colorTag: '#ec4899',
      },
    ],
  },
];

export function loadSetlistsData(): { setlists: Setlist[]; activeId: string } {
  if (typeof window === 'undefined') {
    return { setlists: DEFAULT_SETLISTS, activeId: DEFAULT_SETLISTS[0].id };
  }

  try {
    const rawSetlists = localStorage.getItem(STORAGE_KEY_SETLISTS);
    const rawActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);

    if (rawSetlists) {
      const parsed = JSON.parse(rawSetlists);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeId = rawActiveId && parsed.some((s) => s.id === rawActiveId)
          ? rawActiveId
          : parsed[0].id;
        return { setlists: parsed, activeId };
      }
    }

    // Retrocompatibilità con la vecchia v1 (array singolo di canzoni)
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacySongs: Song[] = JSON.parse(legacyRaw);
      if (Array.isArray(legacySongs) && legacySongs.length > 0) {
        const migrated: Setlist[] = [
          {
            id: 'setlist-migrated',
            name: 'La Mia Scaletta',
            songs: legacySongs,
          },
          ...DEFAULT_SETLISTS.slice(1),
        ];
        saveSetlistsData(migrated, migrated[0].id);
        return { setlists: migrated, activeId: migrated[0].id };
      }
    }

    saveSetlistsData(DEFAULT_SETLISTS, DEFAULT_SETLISTS[0].id);
    return { setlists: DEFAULT_SETLISTS, activeId: DEFAULT_SETLISTS[0].id };
  } catch (err) {
    console.error('Errore lettura scalette da localStorage:', err);
    return { setlists: DEFAULT_SETLISTS, activeId: DEFAULT_SETLISTS[0].id };
  }
}

export function saveSetlistsData(setlists: Setlist[], activeId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SETLISTS, JSON.stringify(setlists));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeId);
  } catch (err) {
    console.error('Errore salvataggio scalette su localStorage:', err);
  }
}

export function exportSingleSetlistAsJson(setlist: Setlist): string {
  return JSON.stringify({ version: 2, type: 'single_setlist', data: setlist }, null, 2);
}

export function exportAllSetlistsAsJson(setlists: Setlist[]): string {
  return JSON.stringify({ version: 2, type: 'all_setlists', data: setlists }, null, 2);
}

export function importSetlistJson(jsonStr: string): { type: 'single' | 'all'; data: any } | null {
  try {
    const parsed = JSON.parse(jsonStr);

    // Formato v2 esplicito
    if (parsed && parsed.version === 2) {
      if (parsed.type === 'single_setlist' && parsed.data?.id && Array.isArray(parsed.data?.songs)) {
        return { type: 'single', data: parsed.data };
      }
      if (parsed.type === 'all_setlists' && Array.isArray(parsed.data)) {
        return { type: 'all', data: parsed.data };
      }
    }

    // Se è un array di setlist
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].songs) {
      return { type: 'all', data: parsed };
    }

    // Se è un singolo oggetto Setlist
    if (parsed && parsed.name && Array.isArray(parsed.songs)) {
      return { type: 'single', data: parsed };
    }

    // Se è un vecchio array di Song (v1)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title && parsed[0].bpm) {
      return {
        type: 'single',
        data: {
          id: `setlist-${Date.now()}`,
          name: 'Scaletta Importata',
          songs: parsed,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}
