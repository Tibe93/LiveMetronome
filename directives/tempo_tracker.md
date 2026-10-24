# Direttiva: Real-Time Audio Tempo Tracker (BPM Detection)

## Obiettivo
Ascoltare l'ambiente acustico tramite il microfono dell'iPhone/dispositivo durante le prove con la band, rilevare gli impulsi ritmici (batteria in primis, chitarra/basso quando la batteria non suona) e tracciare in tempo reale i BPM effettivi con un grafico interattivo a 60fps e confronto con il tempo target.

## Modalità di Ingresso Microfono
1. **Modalità Acustica Standard**:
   - Ponderazione kick/basso (<160Hz) e rullante (1-3.5kHz).
2. **Modalità Batteria Elettronica / Pad a Basso Volume**:
   - Tapping di bacchette su pad in gomma/mesh produce transienti ad alta frequenza (1kHz - 6kHz) con ampiezza microfonica molto bassa.
   - Aggiunta di un preamplificatore digitale software (`GainNode` con guadagno fino a 10x) e abbassamento del noise floor a `0.001` per catturare i colpi anche a basso volume.
   - Cursore di sensibilità con scala logaritmica e visualizzazione in tempo reale della barra di soglia rispetto all'energia del segnale.

## Pipeline DSP di Rilevamento Onset & Stabilizzazione BPM (Anti-Ondulazione)
1. **Rilevamento Transienti Robusto**:
   - Dynamic Adaptive Thresholding sul flusso energetico differenziale (Spectral Flux e derivata prima dell'energia).
   - Periodo refrattario calibrato (160ms) per evitare doppi inneschi sui rimbalzi di bacchetta.
2. **Stabilizzazione Temporale & Frequenza di Aggiornamento Calibrata**:
   - Per evitare che il grafico onduli freneticamente su e giù ad ogni secondo per singole ghost notes o piatti, la stima BPM viene calcolata su finestre scorrevoli di 3-5 secondi con aggiornamento ogni 1.0 - 1.5 secondi.
   - **Anchor di Tempo (Harmonic Prior)**: Se è impostato un BPM target, l'algoritmo cerca preferenzialmente periodicità armoniche coerenti col tempo target evitando salti d'ottava o oscillazioni spurie.
   - **Filtro Mediano e Slew-Rate Limiting**: La variazione massima ammessa tra due letture consecutive è limitata (ad es. max ±1.5 BPM per secondo), producendo una curva stabile e musicale.

## Visualizzazione Canvas 60fps Fluida e Modalità Fullscreen
- **Disaccoppiamento da React**: Il rendering del Canvas gira in un loop `requestAnimationFrame` continuo a 60fps/120fps, alimentato da un ring buffer mutabile, eliminando i rallentamenti e gli scatti dei re-render di React.
- **Scorrimento Orizzontale Continuo**: Il tempo scorre linearmente con interpolazione morbida (curva continua e morbida anziché spezzata a scatti).
- **Modalità Palco Fullscreen**:
  - Sezione superiore: BPM attuali giganti con scostamento e colore di stato (Verde, Giallo, Rosso).
  - Sezione centrale: Grafico a tutta larghezza/altezza con linea del target e griglia.
  - Sezione inferiore: Titolo brano, BPM di riferimento e tasti di cambio rapido brano.
