export interface TempoDetectionResult {
  detectedBpm: number | null;
  confidence: number; // 0 - 100%
  audioLevel: number; // 0 - 100
  isHit: boolean;
  transientCount: number;
}

export class TempoDetector {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private analyserLow: AnalyserNode | null = null;
  private analyserMid: AnalyserNode | null = null;

  private isListening: boolean = false;
  private sensitivity: number = 0.5; // 0 (meno sensibile) a 1 (molto sensibile)
  private animationFrameId: number | null = null;

  // Onset tracking
  private recentHitTimes: number[] = [];
  private lastHitTime: number = 0;
  private refractoryPeriodSec: number = 0.18; // Minimo intervallo tra due colpi (~330 BPM max)
  private energyHistory: number[] = [];
  private currentSmoothedBpm: number | null = null;

  // Callbacks
  private onResultCallback: ((res: TempoDetectionResult) => void) | null = null;

  constructor() {}

  public setSensitivity(val: number) {
    this.sensitivity = Math.max(0.1, Math.min(1.0, val));
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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia non supportato su questo dispositivo/browser');
      }

      // Richiesta audio raw senza cancellazione d'eco per catturare la batteria
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // Filtro passa-basso per cassa/basso (< 160Hz)
      this.lowpassFilter = this.audioCtx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(160, this.audioCtx.currentTime);
      this.lowpassFilter.Q.setValueAtTime(1.5, this.audioCtx.currentTime);

      this.analyserLow = this.audioCtx.createAnalyser();
      this.analyserLow.fftSize = 512;
      this.analyserLow.smoothingTimeConstant = 0.3;

      // Filtro passa-banda per rullante e attacco plettrate (1000 - 3500 Hz)
      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'bandpass';
      this.midFilter.frequency.setValueAtTime(2000, this.audioCtx.currentTime);
      this.midFilter.Q.setValueAtTime(1.2, this.audioCtx.currentTime);

      this.analyserMid = this.audioCtx.createAnalyser();
      this.analyserMid.fftSize = 512;
      this.analyserMid.smoothingTimeConstant = 0.3;

      // Collega la sorgente ai due analizzatori in parallelo
      this.sourceNode.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyserLow);

      this.sourceNode.connect(this.midFilter);
      this.midFilter.connect(this.analyserMid);

      this.isListening = true;
      this.recentHitTimes = [];
      this.lastHitTime = 0;
      this.energyHistory = [];
      this.currentSmoothedBpm = null;

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
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
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

    // Calcolo energia RMS istantanea
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
    // Pesa maggiormente le basse frequenze (cassa), con supporto rullante
    const instantEnergy = rmsLow * 0.7 + rmsMid * 0.3;

    // Mantieni storico recente per calcolare la soglia adattiva
    this.energyHistory.push(instantEnergy);
    if (this.energyHistory.length > 40) {
      this.energyHistory.shift();
    }

    // Media mobile del rumore di fondo
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    // Soglia adattiva dinamica basata su sensibilità
    // Sensibilità 1.0 -> soglia più bassa (molto reattiva); Sensibilità 0.1 -> richiede colpi molto netti
    const thresholdMultiplier = 1.3 + (1.0 - this.sensitivity) * 1.8;
    const dynamicThreshold = Math.max(0.015, avgEnergy * thresholdMultiplier);

    const now = this.audioCtx.currentTime;
    let isHit = false;

    // Rileva transiente se l'energia supera la soglia ed è passato il periodo refrattario
    if (instantEnergy > dynamicThreshold && now - this.lastHitTime > this.refractoryPeriodSec) {
      isHit = true;
      this.lastHitTime = now;
      this.recentHitTimes.push(now);

      // Conserva solo i colpi degli ultimi 6 secondi
      const cutoff = now - 6.0;
      this.recentHitTimes = this.recentHitTimes.filter((t) => t >= cutoff);
    }

    // Stima BPM dai colpi accumulati
    const { bpm, confidence } = this.calculateBpmFromHits();

    if (bpm !== null) {
      // Smoothing esponenziale per evitare scatti improvvisi mantenendo reattività
      if (this.currentSmoothedBpm === null) {
        this.currentSmoothedBpm = bpm;
      } else {
        // Se la variazione è moderata (< 15 BPM), smooth del 25%; se c'è cambio netto di tempo, adatta più velocemente
        const diff = Math.abs(bpm - this.currentSmoothedBpm);
        const alpha = diff > 15 ? 0.45 : 0.22;
        this.currentSmoothedBpm = this.currentSmoothedBpm * (1 - alpha) + bpm * alpha;
      }
    }

    if (this.onResultCallback) {
      const audioLevel = Math.min(100, Math.round(instantEnergy * 250));
      this.onResultCallback({
        detectedBpm: this.currentSmoothedBpm ? Math.round(this.currentSmoothedBpm * 10) / 10 : null,
        confidence: confidence,
        audioLevel: audioLevel,
        isHit: isHit,
        transientCount: this.recentHitTimes.length,
      });
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private calculateBpmFromHits(): { bpm: number | null; confidence: number } {
    if (this.recentHitTimes.length < 3) {
      return { bpm: null, confidence: 0 };
    }

    const intervals: number[] = [];
    for (let i = 1; i < this.recentHitTimes.length; i++) {
      const dt = this.recentHitTimes[i] - this.recentHitTimes[i - 1];
      if (dt >= 0.2 && dt <= 1.5) {
        intervals.push(dt);
      }
      if (i >= 2) {
        const dt2 = (this.recentHitTimes[i] - this.recentHitTimes[i - 2]) / 2.0;
        if (dt2 >= 0.2 && dt2 <= 1.5) {
          intervals.push(dt2);
        }
      }
    }

    if (intervals.length === 0) {
      return { bpm: null, confidence: 0 };
    }

    // Istogramma a 5ms di risoluzione con media intracluster (validato da test_dsp_logic.py)
    const binSize = 0.005;
    const bins: { [key: number]: number } = {};
    const binValues: { [key: number]: number[] } = {};

    for (const dt of intervals) {
      const b = Math.round(dt / binSize) * binSize;
      bins[b] = (bins[b] || 0) + 1;
      if (!binValues[b]) binValues[b] = [];
      binValues[b].push(dt);
    }

    let bestBin = 0;
    let maxCount = -1;
    for (const [binStr, count] of Object.entries(bins)) {
      const b = parseFloat(binStr);
      if (count > maxCount) {
        maxCount = count;
        bestBin = b;
      }
    }

    if (maxCount <= 0 || !binValues[bestBin]) {
      return { bpm: null, confidence: 0 };
    }

    const cluster = binValues[bestBin];
    const bestInterval = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    let rawBpm = 60.0 / bestInterval;

    // Normalizzazione d'ottava (range musicale 50 - 240 BPM)
    while (rawBpm < 50) rawBpm *= 2;
    while (rawBpm > 240) rawBpm /= 2;

    // Calcolo Confidence: rapporto tra intervalli coerenti col tempo e totale
    const tolerance = bestInterval * 0.12; // ±12%
    const matchingCount = intervals.filter((dt) => Math.abs(dt - bestInterval) <= tolerance).length;
    const confidence = Math.min(100, Math.round((matchingCount / intervals.length) * 100));

    return { bpm: rawBpm, confidence };
  }
}

export const tempoDetector = new TempoDetector();
