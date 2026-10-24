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

## Gestione Audio iOS Safari (Modalità Silenzioso & Volume)
1. **Bypass Interruttore Silenzioso iOS (Mute Switch)**:
   - Di default, l'AudioContext in Safari viene classificato come sessione `Ambient` e viene silenziato se l'interruttore fisico di silenzioso è attivo.
   - Per bypassare il silenzioso e farsi sentire sempre come un'app di riproduzione musicale, si impiega un tag HTML5 `<audio>` invisibile con loop inaudibile e categoria di riproduzione `Playback`.
2. **Prevenzione Abbassamento Volume con Microfono (Voice Ducking)**:
   - All'attivazione di `getUserMedia`, iOS Safari commuta l'audio session su `PlayAndRecord`, attenuando l'uscita altoparlante.
   - Per contrastare questo calo:
     - Inserire una catena di Master Dynamics Compressor (`DynamicsCompressorNode`) e Boost Gain (guadagno 2.5x - 4x con soft clipping) per rendere il click percussivo estremamente penetrante e ad alto volume.
     - Ottimizzare la sintesi con transitori ad alta pressione sonora.
3. **Persistenza Stream Microfono**:
   - Mantenere lo stream audio attivo disabilitando i track (`track.enabled = false`) anziché chiamare `track.stop()`, evitando di richiedere nuovamente l'autorizzazione all'utente ogni volta che attiva/disattiva il microfono.
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
