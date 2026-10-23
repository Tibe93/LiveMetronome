# Direttiva: Motore Metronomo ad Alta Precisione

## Obiettivo
Fornire un metronomo per prove e concerti con temporizzazione a zero jitter, supporto per suddivisioni ritmiche, tempi composti/dispari, preset di suoni percussivi e indicatori visivi ad alto contrasto per batteristi e musicisti.

## Architettura Audio (Lookahead Scheduler)
Su browser mobili (iOS Safari), l'Event Loop di JavaScript subisce jitter a causa di garbage collection e rendering. Il motore del metronomo deve implementare il pattern standard Web Audio Lookahead:
1. **Clock di riferimento**: Utilizzare esclusivamente `audioContext.currentTime` (clock hardware audio ad alta precisione).
2. **Scheduler a finestra scorrevole**:
   - Intervallo di tick di scheduling: 25ms.
   - Finestra di lookahead: 100ms in anticipo.
   - Tutti gli eventi audio (note on, gain envelopes, filtri) vengono schedulati in anticipo sul clock hardware audio.
3. **Sincronizzazione Visiva**:
   - Gli eventi visivi (cambio beat, flash visivo) vengono emessi tramite `requestAnimationFrame` confrontando il tempo corrente con il tempo del beat schedulato, garantendo un perfetto sync audio-visivo a 60/120 Hz (ProMotion su iPhone).

## Funzionalità
- **Range BPM**: 30 - 300 BPM con controlli rapidi (+1, -1, +5, -5, slider, direct input).
- **Tap Tempo**: Algoritmo a media mobile con reset automatico dopo 2 secondi di inattività.
- **Metriche (Time Signatures)**: 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 12/8 con accenti configurabili (primo beat marcato).
- **Suddivisioni Ritmiche**:
  - Quarti (1/4)
  - Ottavi (1/8)
  - Sedicesimi (1/16)
  - Terzine (1/8T)
  - Swing/Shuffle regolabile
- **Sintesi Sonora Client-Side (Zero Asset Lag)**:
  - *Woodblock*: Oscillatore a onda quadra/sinusoidale filtrata a 800Hz / 1200Hz con decadimento esponenziale ultra-rapido.
  - *Digital Beep*: Onda sinusoidale pura (880Hz / 440Hz) ad alto impatto.
  - *Cowbell sintetico*: Sintesi a doppio oscillatore sfasato con passa-banda a 800Hz.
  - *Click analogico*: Impulso di rumore bianco filtrato con envelope brevissimo (10ms).
  - *Drum Kit*: Cassa sintetica (pitch drop rapido da 150Hz a 40Hz) e Hi-Hat (rumore bianco passa-alto).
- **Visual Flasher & Stage Mode**:
  - Flash a tutto schermo opzionale per il batterista (visibile anche senza cuffie con la coda dell'occhio).
  - Indicatori a LED dei singoli quarti/ottavi della misura con differenziazione cromatica dell'accento (es. Verde/Arancione/Bianco).
- **Screen Wake Lock API**:
  - Attivazione automatica di `navigator.wakeLock.request('screen')` durante il funzionamento per prevenire lo spegnimento dello schermo dell'iPhone.
  - Riacquisizione automatica al ritorno in primo piano (`visibilitychange`).
