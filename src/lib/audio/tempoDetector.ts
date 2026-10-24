import { TrackerMode } from '@/types';

export interface TempoDetectionResult {
  detectedBpm: number | null;
  confidence: number; // 0 - 100%
  audioLevel: number; // 0 - 100
  thresholdLevel: number; // 0 - 100
  isHit: boolean;
  transientCount: number;
}

export class TempoDetector {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private preGainNode: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private analyserLow: AnalyserNode | null = null;
  private analyserMid: AnalyserNode | null = null;

  private isListening: boolean = false;
  private mode: TrackerMode = 'acoustic';
  private sensitivity: number = 0.65; // 0.1 a 1.0
  private targetBpm: number = 120;
  private animationFrameId: number | null = null;

  // Onset tracking
  private recentHitTimes: number[] = [];
  private lastHitTime: number = 0;
  private refractoryPeriodSec: number = 0.16; // 160ms (~375 BPM max)
  private energyHistory: number[] = [];

  // Stabilizzazione & Cadenza Musicale
  private currentSmoothedBpm: number | null = null;
  private lastEvaluationTime: number = 0;
  private evaluationIntervalSec: number = 1.1; // Valutazione ogni 1.1 secondi per stabilità

  // Callbacks
  private onResultCallback: ((res: TempoDetectionResult) => void) | null = null;

  constructor() {}

  public setMode(mode: TrackerMode) {
    this.mode = mode;
    this.updateGain();
  }

  public getMode(): TrackerMode {
    return this.mode;
  }

  public setSensitivity(val: number) {
    this.sensitivity = Math.max(0.05, Math.min(1.0, val));
    this.updateGain();
  }

  public setTargetBpm(bpm: number) {
    this.targetBpm = Math.max(30, Math.min(300, bpm));
  }

  private updateGain() {
    if (!this.preGainNode || !this.audioCtx) return;
    // In modalità elettronica, i pad hanno segnale basso: guadagno fino a 10x
    // In modalità acustica, il volume è alto: guadagno 1x - 2.5x
    const multiplier = this.mode === 'electronic' ? 1.0 + this.sensitivity * 9.0 : 0.8 + this.sensitivity * 1.8;
    this.preGainNode.gain.setValueAtTime(multiplier, this.audioCtx.currentTime);
  }

  public setOnResult(cb: (res: TempoDetectionResult) => void) {
    this.onResultCallback = cb;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public async start(): Promise<boolean> {
    if (this.isListening) return true;

    try {
      if (!this.mediaStream || !this.mediaStream.getTracks().some((t) => t.readyState === 'live')) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Microfono non supportato su questo browser.');
        }

        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      const activeStream = this.mediaStream;
      if (!activeStream) {
        throw new Error('Impossibile inizializzare lo stream microfonico.');
      }

      // Riabilita le tracce audio
      activeStream.getTracks().forEach((t) => {
        t.enabled = true;
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Ricrea o riconnetti la sorgente
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch {}
      }
      this.sourceNode = this.audioCtx.createMediaStreamSource(activeStream);

      // Preamplificatore digitale regolabile
      this.preGainNode = this.audioCtx.createGain();
      this.updateGain();

      // Ramo 1: Cassa / Basse frequenze (< 180Hz)
      this.lowpassFilter = this.audioCtx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(180, this.audioCtx.currentTime);
      this.lowpassFilter.Q.setValueAtTime(1.5, this.audioCtx.currentTime);

      this.analyserLow = this.audioCtx.createAnalyser();
      this.analyserLow.fftSize = 512;
      this.analyserLow.smoothingTimeConstant = 0.2;

      // Ramo 2: Rullante, plettrate e click pad elettronici (1000 - 4500 Hz)
      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'bandpass';
      this.midFilter.frequency.setValueAtTime(2200, this.audioCtx.currentTime);
      this.midFilter.Q.setValueAtTime(1.2, this.audioCtx.currentTime);

      this.analyserMid = this.audioCtx.createAnalyser();
      this.analyserMid.fftSize = 512;
      this.analyserMid.smoothingTimeConstant = 0.2;

      // Connessione audio graph
      this.sourceNode.connect(this.preGainNode);
      this.preGainNode.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyserLow);

      this.preGainNode.connect(this.midFilter);
      this.midFilter.connect(this.analyserMid);

      this.isListening = true;
      this.recentHitTimes = [];
      this.lastHitTime = 0;
      this.energyHistory = [];
      this.currentSmoothedBpm = this.targetBpm;
      this.lastEvaluationTime = this.audioCtx.currentTime;

      this.loop();
      return true;
    } catch (err) {
      console.error('Errore avvio tempo detector dal microfono:', err);
      this.stop();
      throw err;
    }
  }

  public stop() {
    this.isListening = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Disabilita l'acquisizione senza distruggere lo stream: in questo modo Safari NON richiederà l'autorizzazione di nuovo!
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    this.recentHitTimes = [];
    this.currentSmoothedBpm = null;
  }

  private loop = () => {
    if (!this.isListening || !this.audioCtx || !this.analyserLow || !this.analyserMid) {
      return;
    }

    const bufferLength = this.analyserLow.frequencyBinCount;
    const timeDataLow = new Uint8Array(bufferLength);
    const timeDataMid = new Uint8Array(bufferLength);

    this.analyserLow.getByteTimeDomainData(timeDataLow);
    this.analyserMid.getByteTimeDomainData(timeDataMid);

    // Calcolo energia RMS istantanea sui due rami
    let sumLow = 0;
    let sumMid = 0;
    for (let i = 0; i < bufferLength; i++) {
      const vLow = (timeDataLow[i] - 128) / 128;
      const vMid = (timeDataMid[i] - 128) / 128;
      sumLow += vLow * vLow;
      sumMid += vMid * vMid;
    }

    const rmsLow = Math.sqrt(sumLow / bufferLength);
    const rmsMid = Math.sqrt(sumMid / bufferLength);

    // In modalità elettronica, i pad hanno quasi tutta energia sui medio-alti (click della bacchetta)
    const instantEnergy = this.mode === 'electronic'
      ? rmsMid * 0.75 + rmsLow * 0.25
      : rmsLow * 0.65 + rmsMid * 0.35;

    // Aggiornamento noise floor dinamico
    this.energyHistory.push(instantEnergy);
    if (this.energyHistory.length > 50) {
      this.energyHistory.shift();
    }
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;

    // Calcolo soglia adattiva con floor ultra-basso per batteria elettronica
    const minFloor = this.mode === 'electronic' ? 0.0015 : 0.008;
    // Maggiore è la sensibilità (0.05 -> 1.0), minore è la distanza della soglia dal rumore medio
    const thresholdFactor = 1.15 + (1.0 - this.sensitivity) * 1.5;
    const dynamicThreshold = Math.max(minFloor, avgEnergy * thresholdFactor);

    const now = this.audioCtx.currentTime;
    let isHit = false;

    // Rileva transiente se l'energia supera la soglia e dopo il periodo refrattario
    if (instantEnergy > dynamicThreshold && now - this.lastHitTime > this.refractoryPeriodSec) {
      isHit = true;
      this.lastHitTime = now;
      this.recentHitTimes.push(now);

      // Conserva gli ultimi 5.5 secondi di colpi
      const cutoff = now - 5.5;
      this.recentHitTimes = this.recentHitTimes.filter((t) => t >= cutoff);
    }

    // Valutazione BPM a cadenza musicale (ogni 1.1s) per evitare oscillazioni esponenziali frenetiche
    let confidence = 0;
    if (now - this.lastEvaluationTime >= this.evaluationIntervalSec) {
      this.lastEvaluationTime = now;
      const res = this.calculateStableBpmFromHits();
      if (res.bpm !== null) {
        confidence = res.confidence;
        if (this.currentSmoothedBpm === null) {
          this.currentSmoothedBpm = res.bpm;
        } else {
          // Slew-rate limiting: massima variazione consentita di ±1.8 BPM per valutazione
          const delta = res.bpm - this.currentSmoothedBpm;
          const maxDelta = 1.8;
          if (Math.abs(delta) > maxDelta) {
            this.currentSmoothedBpm = this.currentSmoothedBpm + Math.sign(delta) * maxDelta;
          } else {
            // Smooth leggero
            this.currentSmoothedBpm = this.currentSmoothedBpm * 0.6 + res.bpm * 0.4;
          }
        }
      }
    }

    if (this.onResultCallback) {
      const audioLevel = Math.min(100, Math.round(instantEnergy * 300));
      const thresholdLevel = Math.min(100, Math.round(dynamicThreshold * 300));

      this.onResultCallback({
        detectedBpm: this.currentSmoothedBpm ? Math.round(this.currentSmoothedBpm * 10) / 10 : null,
        confidence,
        audioLevel,
        thresholdLevel,
        isHit,
        transientCount: this.recentHitTimes.length,
      });
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private calculateStableBpmFromHits(): { bpm: number | null; confidence: number } {
    if (this.recentHitTimes.length < 4) {
      return { bpm: null, confidence: 0 };
    }

    const intervals: number[] = [];
    for (let i = 1; i < this.recentHitTimes.length; i++) {
      const dt = this.recentHitTimes[i] - this.recentHitTimes[i - 1];
      if (dt >= 0.18 && dt <= 1.6) {
        intervals.push(dt);
      }
      if (i >= 2) {
        const dt2 = (this.recentHitTimes[i] - this.recentHitTimes[i - 2]) / 2.0;
        if (dt2 >= 0.18 && dt2 <= 1.6) {
          intervals.push(dt2);
        }
      }
    }

    if (intervals.length < 3) {
      return { bpm: null, confidence: 0 };
    }

    // Binning a 5ms con prior armonico centrato sul targetBpm
    const binSize = 0.005;
    const bins: { [key: number]: number } = {};
    const binValues: { [key: number]: number[] } = {};
    const targetDt = 60.0 / this.targetBpm;

    for (const dt of intervals) {
      const b = Math.round(dt / binSize) * binSize;
      const ratio = dt / targetDt;
      const dist1 = Math.abs(ratio - 1.0);
      const distHalf = Math.abs(ratio - 0.5);
      const distDouble = Math.abs(ratio - 2.0);
      const bestHarmonic = Math.min(dist1, distHalf, distDouble);
      const harmonicWeight = Math.exp(-(bestHarmonic * bestHarmonic) / 0.16);
      const weight = 1.0 + 1.8 * harmonicWeight;

      bins[b] = (bins[b] || 0) + weight;
      if (!binValues[b]) binValues[b] = [];
      binValues[b].push(dt);
    }

    let bestBin = 0;
    let maxWeight = -1;
    for (const [binStr, weight] of Object.entries(bins)) {
      const b = parseFloat(binStr);
      if (weight > maxWeight) {
        maxWeight = weight;
        bestBin = b;
      }
    }

    if (maxWeight <= 0 || !binValues[bestBin]) {
      return { bpm: null, confidence: 0 };
    }

    const cluster = binValues[bestBin];
    const bestInterval = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    let rawBpm = 60.0 / bestInterval;

    // Normalizzazione armonica rispetto al target
    while (rawBpm < this.targetBpm * 0.65) rawBpm *= 2;
    while (rawBpm > this.targetBpm * 1.45) rawBpm /= 2;

    const tolerance = bestInterval * 0.10;
    const matchingCount = intervals.filter((dt) => Math.abs(dt - bestInterval) <= tolerance).length;
    const confidence = Math.min(100, Math.round((matchingCount / intervals.length) * 100));

    return { bpm: rawBpm, confidence };
  }
}

export const tempoDetector = new TempoDetector();
