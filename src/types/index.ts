export type SoundPreset = 'woodblock' | 'digital' | 'cowbell' | 'click' | 'drumkit';

export type Subdivision = 'quarter' | 'eighth' | 'sixteenth' | 'triplet';

export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8' | '5/4' | '7/8' | '12/8';

export type TrackerMode = 'acoustic' | 'electronic';

export interface Song {
  id: string;
  title: string;
  bpm: number;
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  soundPreset: SoundPreset;
  notes?: string;
  colorTag?: string;
}

export interface Setlist {
  id: string;
  name: string;
  songs: Song[];
}

export interface TrackerPoint {
  timeOffset: number; // millisecondi dall'inizio sessione
  detectedBpm: number;
  targetBpm: number;
  drift: number; // detectedBpm - targetBpm
  confidence: number;
}

export interface BeatEvent {
  beatNumber: number; // 1-indexed
  totalBeats: number;
  isAccent: boolean;
  isSubdivision: boolean;
  subdivisionIndex?: number;
  time: number;
}
