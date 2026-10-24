import { BeatEvent, SoundPreset, Subdivision, TimeSignature } from '@/types';

class MetronomeEngine {
  private audioCtx: AudioContext | null = null;
  private isRunning: boolean = false;
  private bpm: number = 120;
  private timeSignature: TimeSignature = '4/4';
  private subdivision: Subdivision = 'quarter';
  private soundPreset: SoundPreset = 'woodblock';
  private volume: number = 0.95;

  // Catena Audio di Uscita ad Alto Volume & Anti-Ducking
  private masterBus: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private boostNode: GainNode | null = null;

  // Elemento Audio HTML5 per bypassare l'interruttore silenzioso su iOS (Session Category: Playback)
  private silentAudioElement: HTMLAudioElement | null = null;

  // Lookahead scheduler
  private lookaheadMs: number = 25;
  private scheduleAheadSec: number = 0.1; // 100ms
  private nextNoteTime: number = 0;
  private currentBeatInMeasure: number = 0; // 0-indexed
  private currentSubdivisionInBeat: number = 0; // 0-indexed
  private timerId: number | null = null;

  // Callbacks
  private onBeatCallback: ((event: BeatEvent) => void) | null = null;

  constructor() {}

  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.setupMasterBus();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private setupMasterBus() {
    if (!this.audioCtx) return;

    // Master Gain iniziale
    this.masterBus = this.audioCtx.createGain();
    this.masterBus.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);

    // Dynamics Compressor per rendere il click percussivo, denso e punchy
    this.compressorNode = this.audioCtx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-14, this.audioCtx.currentTime);
    this.compressorNode.knee.setValueAtTime(4, this.audioCtx.currentTime);
    this.compressorNode.ratio.setValueAtTime(12, this.audioCtx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.001, this.audioCtx.currentTime);
    this.compressorNode.release.setValueAtTime(0.035, this.audioCtx.currentTime);

    // Boost Gain Node per contrastare l'attenuazione di iOS quando il microfono è attivo
    this.boostNode = this.audioCtx.createGain();
    // 2.6x di boost del volume
    this.boostNode.gain.setValueAtTime(2.6, this.audioCtx.currentTime);

    // Connessione: masterBus -> compressor -> boost -> destination
    this.masterBus.connect(this.compressorNode);
    this.compressorNode.connect(this.boostNode);
    this.boostNode.connect(this.audioCtx.destination);
  }

  /**
   * Bypass interruttore Silenzioso iOS:
   * Avvia una traccia inaudibile HTML5 che forza Safari a trattare la pagina
   * in modalità 'Playback', ignorando il tasto silenzioso hardware di iPhone.
   */
  public async unlockAudio(): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (typeof window !== 'undefined' && !this.silentAudioElement) {
        // Breve file WAV silenzioso in base64
        const silenceDataUri =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        this.silentAudioElement = new Audio(silenceDataUri);
        this.silentAudioElement.loop = true;
        (this.silentAudioElement as any).playsInline = true;
        this.silentAudioElement.setAttribute('playsinline', '');
        this.silentAudioElement.setAttribute('webkit-playsinline', '');
      }

      if (this.silentAudioElement) {
        try {
          await this.silentAudioElement.play();
        } catch {
          // Ignora se non necessario
        }
      }

      // Piccolo buffer di sblocco Web Audio
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
    if (this.masterBus && this.audioCtx) {
      this.masterBus.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
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
    if (this.silentAudioElement) {
      try {
        this.silentAudioElement.pause();
      } catch {}
    }
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionInBeat = 0;
  }

  private scheduler() {
    const ctx = this.getAudioContext();
    const beatsPerMeasure = this.getBeatsPerMeasure();
    const subFactor = this.getSubdivisionFactor();

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

      const secondsPerBeat = 60.0 / this.bpm;
      const secondsPerSub = secondsPerBeat / subFactor;
      this.nextNoteTime += secondsPerSub;

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

    this.playSynthesizedSound(ctx, time, isAccent, isSubdivision);

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
    if (!this.masterBus) this.setupMasterBus();
    const destinationBus = this.masterBus || ctx.destination;

    const noteGain = ctx.createGain();
    noteGain.connect(destinationBus);

    // Dinamica ad alta energia
    const baseGain = isSub ? 0.45 : isAccent ? 1.4 : 1.0;
    noteGain.gain.setValueAtTime(0.001, time);
    noteGain.gain.exponentialRampToValueAtTime(baseGain, time + 0.001);

    switch (this.soundPreset) {
      case 'woodblock': {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isAccent ? 1400 : isSub ? 850 : 1100, time);
        filter.Q.setValueAtTime(12, time);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 1350 : isSub ? 800 : 1050, time);
        osc.frequency.exponentialRampToValueAtTime(320, time + 0.04);

        osc.connect(filter);
        filter.connect(noteGain);

        noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.055);
        break;
      }

      case 'digital': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 1400 : isSub ? 700 : 950, time);
        osc.connect(noteGain);

        noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
        osc.start(time);
        osc.stop(time + 0.045);
        break;
      }

      case 'cowbell': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(isAccent ? 850 : 620, time);
        osc2.frequency.setValueAtTime(isAccent ? 1150 : 890, time);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(950, time);
        filter.Q.setValueAtTime(3.5, time);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(noteGain);

        noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.1);
        osc2.stop(time + 0.1);
        break;
      }

      case 'drumkit': {
        if (isAccent) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(170, time);
          osc.frequency.exponentialRampToValueAtTime(45, time + 0.08);
          osc.connect(noteGain);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
          osc.start(time);
          osc.stop(time + 0.13);
        } else {
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
          filter.frequency.setValueAtTime(isSub ? 5000 : 3200, time);

          whiteNoise.connect(filter);
          filter.connect(noteGain);

          noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
          whiteNoise.start(time);
          whiteNoise.stop(time + 0.06);
        }
        break;
      }

      case 'click':
      default: {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isAccent ? 2600 : isSub ? 1300 : 2000, time);
        osc.connect(noteGain);

        noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.018);
        osc.start(time);
        osc.stop(time + 0.022);
        break;
      }
    }
  }
}

export const metronomeEngine = new MetronomeEngine();
