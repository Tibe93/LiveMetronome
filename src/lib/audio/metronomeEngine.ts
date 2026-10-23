import { BeatEvent, SoundPreset, Subdivision, TimeSignature } from '@/types';

class MetronomeEngine {
  private audioCtx: AudioContext | null = null;
  private isRunning: boolean = false;
  private bpm: number = 120;
  private timeSignature: TimeSignature = '4/4';
  private subdivision: Subdivision = 'quarter';
  private soundPreset: SoundPreset = 'woodblock';
  private volume: number = 0.9;

  // Lookahead scheduler
  private lookaheadMs: number = 25;
  private scheduleAheadSec: number = 0.1; // 100ms
  private nextNoteTime: number = 0;
  private currentBeatInMeasure: number = 0; // 0-indexed
  private currentSubdivisionInBeat: number = 0; // 0-indexed
  private timerId: number | null = null;

  // Callbacks
  private onBeatCallback: ((event: BeatEvent) => void) | null = null;

  constructor() {
    // Lazy initialize AudioContext on user action (vital for iOS)
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public async unlockAudio(): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Piccolo buffer silenzioso per garantire l'attivazione della catena audio iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      return true;
    } catch (err) {
      console.warn('Audio unlock error:', err);
      return false;
    }
  }

  public setOnBeatCallback(cb: (event: BeatEvent) => void) {
    this.onBeatCallback = cb;
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(30, Math.min(320, Math.round(newBpm)));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setTimeSignature(ts: TimeSignature) {
    this.timeSignature = ts;
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionInBeat = 0;
  }

  public setSubdivision(sub: Subdivision) {
    this.subdivision = sub;
    this.currentSubdivisionInBeat = 0;
  }

  public setSoundPreset(preset: SoundPreset) {
    this.soundPreset = preset;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private getBeatsPerMeasure(): number {
    switch (this.timeSignature) {
      case '2/4': return 2;
      case '3/4': return 3;
      case '4/4': return 4;
      case '5/4': return 5;
      case '6/8': return 6;
      case '7/8': return 7;
      case '12/8': return 12;
      default: return 4;
    }
  }

  private getSubdivisionFactor(): number {
    switch (this.subdivision) {
      case 'quarter': return 1;
      case 'eighth': return 2;
      case 'triplet': return 3;
      case 'sixteenth': return 4;
      default: return 1;
    }
  }

  private isBeatAccent(beatIndex: number): boolean {
    if (this.timeSignature === '6/8') {
      return beatIndex === 0 || beatIndex === 3;
    }
    if (this.timeSignature === '12/8') {
      return beatIndex === 0 || beatIndex === 3 || beatIndex === 6 || beatIndex === 9;
    }
    return beatIndex === 0;
  }

  public start() {
    if (this.isRunning) return;
    const ctx = this.getAudioContext();
    this.isRunning = true;
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionInBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionInBeat = 0;
  }

  private scheduler() {
    const ctx = this.getAudioContext();
    const beatsPerMeasure = this.getBeatsPerMeasure();
    const subFactor = this.getSubdivisionFactor();

    // Schedula tutti i beat e suddivisioni compresi nella finestra di lookahead
    while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadSec) {
      const isSub = this.currentSubdivisionInBeat > 0;
      const isAccent = !isSub && this.isBeatAccent(this.currentBeatInMeasure);

      this.scheduleNote(
        this.nextNoteTime,
        isAccent,
        isSub,
        this.currentBeatInMeasure + 1,
        beatsPerMeasure,
        this.currentSubdivisionInBeat
      );

      // Avanzamento temporale della suddivisione
      // Durata di 1 quarto = 60 / bpm
      // Durata di ogni tick = (60 / bpm) / subFactor
      const secondsPerBeat = 60.0 / this.bpm;
      const secondsPerSub = secondsPerBeat / subFactor;
      this.nextNoteTime += secondsPerSub;

      // Avanza indici
      this.currentSubdivisionInBeat++;
      if (this.currentSubdivisionInBeat >= subFactor) {
        this.currentSubdivisionInBeat = 0;
        this.currentBeatInMeasure = (this.currentBeatInMeasure + 1) % beatsPerMeasure;
      }
    }
  }

  private scheduleNote(
    time: number,
    isAccent: boolean,
    isSubdivision: boolean,
    beatNum: number,
    totalBeats: number,
    subIndex: number
  ) {
    const ctx = this.getAudioContext();

    // Riproduci suono sintetico a bassissima latenza
    this.playSynthesizedSound(ctx, time, isAccent, isSubdivision);

    // Emetti evento per sincronizzazione visiva (usando requestAnimationFrame e timestamp)
    if (this.onBeatCallback) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isRunning && this.onBeatCallback) {
          this.onBeatCallback({
            beatNumber: beatNum,
            totalBeats: totalBeats,
            isAccent: isAccent,
            isSubdivision: isSubdivision,
            subdivisionIndex: subIndex,
            time: time,
          });
        }
      }, delayMs);
    }
  }

  private playSynthesizedSound(ctx: AudioContext, time: number, isAccent: boolean, isSub: boolean) {
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    // Livello volume
    const baseGain = this.volume * (isSub ? 0.35 : isAccent ? 1.0 : 0.7);
    masterGain.gain.setValueAtTime(0.001, time);
    masterGain.gain.exponentialRampToValueAtTime(baseGain, time + 0.002);

    switch (this.soundPreset) {
      case 'woodblock': {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isAccent ? 1300 : isSub ? 800 : 1000, time);
        filter.Q.setValueAtTime(10, time);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 1200 : isSub ? 750 : 950, time);
        osc.frequency.exponentialRampToValueAtTime(300, time + 0.04);

        osc.connect(filter);
        filter.connect(masterGain);

        masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
        osc.start(time);
        osc.stop(time + 0.05);
        break;
      }

      case 'digital': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 1200 : isSub ? 600 : 880, time);
        osc.connect(masterGain);

        masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
        osc.start(time);
        osc.stop(time + 0.04);
        break;
      }

      case 'cowbell': {
        // Doppio oscillatore disarmonico
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(isAccent ? 800 : 587, time);
        osc2.frequency.setValueAtTime(isAccent ? 1100 : 845, time);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, time);
        filter.Q.setValueAtTime(3, time);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);

        masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.1);
        osc2.stop(time + 0.1);
        break;
      }

      case 'drumkit': {
        if (isAccent) {
          // Cassa sintetica (Kick)
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(45, time + 0.08);
          osc.connect(masterGain);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
          osc.start(time);
          osc.stop(time + 0.13);
        } else {
          // Hi-Hat / Rullante sintetico (White noise)
          const bufferSize = ctx.sampleRate * 0.05;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(isSub ? 5000 : 3000, time);

          whiteNoise.connect(filter);
          filter.connect(masterGain);

          masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
          whiteNoise.start(time);
          whiteNoise.stop(time + 0.06);
        }
        break;
      }

      case 'click':
      default: {
        // Click analogico breve
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isAccent ? 2400 : isSub ? 1200 : 1800, time);
        osc.connect(masterGain);

        masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.015);
        osc.start(time);
        osc.stop(time + 0.02);
        break;
      }
    }
  }
}

export const metronomeEngine = new MetronomeEngine();
