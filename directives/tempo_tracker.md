# Direttiva: Real-Time Audio Tempo Tracker (BPM Detection)

## Obiettivo
Ascoltare l'ambiente acustico tramite il microfono dell'iPhone/dispositivo durante le prove con la band, rilevare gli impulsi ritmici (batteria in primis, chitarra/basso quando la batteria non suona) e tracciare in tempo reale i BPM effettivi con un grafico interattivo a 60fps e confronto con il tempo target.

## Requisiti di Acquisizione Audio (Microfono)
- Utilizzare `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 } })`.
- *Motivazione*: I filtri di soppressione rumore ed echo cancellation dei telefoni tagliano i transitori della batteria e comprimono la dinamica, rendendo impossibile rilevare i colpi di cassa e rullante. I parametri `raw` garantiscono la massima fedeltà impulsiva.
- Richiesta permessi gestita con UI chiara e fallback in caso di negazione.

## Pipeline DSP di Rilevamento Onset & BPM
1. **Filtro Pre-enfasi e Separazione di Banda**:
   - Ramo Basso (Kick/Batteria): Biquad Low-pass a ~150Hz per isolare la cassa della batteria.
   - Ramo Medio-Alto (Snare/Chitarre ritmiche/Plettrate): Biquad Band-pass a 1000-3500Hz per catturare rullante e attacco delle plettrate.
2. **Onset Detection Function (ODF)**:
   - Calcolo dell'energia RMS istantanea e Spectral Flux su finestre brevi (512-1024 campioni, ~11-23ms).
   - Dynamic Adaptive Thresholding: la soglia si adatta al volume medio della stanza per rilevare i picchi (transienti) senza scattare su rumori di fondo costanti.
3. **Stima del Tempo e Inter-Onset Interval (IOI)**:
   - Memorizzazione dei timestamp dei transienti rilevati in un buffer circolare (ultimi 4-8 secondi).
   - Raggruppamento degli intervalli tra transienti successivi e calcolo dell'autocorrelazione / istogramma IOI ad alta risoluzione (binning a 5ms).
   - Calcolo della media pesata intracluster dei valori reali nel bin dominante per evitare errori di discretizzazione su BPM elevati (>140 BPM).
   - Mappatura dell'intervallo su BPM compresi nel range musicale plausibile (tipicamente 50-240 BPM), con correzione d'ottava (half/double tempo octave correction).
4. **Filtro di Smoothing & Confidence**:
   - Moving median filter per eliminare outlier (es. singolo colpo di piatto o stacco).
   - Calcolo del Confidence Score (% di affidabilità del battito rilevato).

## Grafico in Tempo Reale (Visualizzazione 60fps su Canvas)
- **Visualizzazione continua**:
   - Linea orizzontale di riferimento: BPM Target (impostato dall'utente o dal brano in scaletta).
   - Linea continua dinamica: BPM rilevati istante per istante.
   - Banda di tolleranza colorata:
     - Verde: entro ±2 BPM (tempo perfetto).
     - Giallo/Arancione: scostamento tra 2 e 5 BPM (leggera accelerazione o rallentamento).
     - Rosso: oltre 5 BPM (tempo instabile o evidente corsa/trascinamento).
   - Indicatore numerico gigante: "+2 BPM (ACCELERA)" o "-3 BPM (RALLENTA)".
   - Indicatore di colpo in tempo reale (LED o barra che lampeggia ad ogni transiente rilevato per verificare visivamente la cattura del microfono).
