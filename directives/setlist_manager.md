# Direttiva: Gestione Scaletta Live & Modalità Concerto

## Obiettivo
Consentire alla band di memorizzare l'intera scaletta del concerto o delle prove, passando rapidamente da un brano al successivo con un solo tocco, caricando istantaneamente BPM target, metrica, suddivisione e note di palco.

## Modello Dati Scaletta e Brano
Una scaletta (`Setlist`) contiene:
- `id`: stringa univoca
- `name`: nome della scaletta (es. "Tour Live 2026", "Prove Rock", "Acoustic Set")
- `songs`: array di `Song`

Ogni brano nella scaletta contiene:
- `id`: stringa univoca (UUID/timestamp)
- `title`: nome del brano (es. "Song 1", "Highway to Hell")
- `bpm`: intero (es. 128)
- `timeSignature`: stringa o oggetto (es. "4/4", "3/4", "6/8")
- `subdivision`: tipo di suddivisione (quarti, ottavi, terzine, sedicesimi)
- `soundPreset`: preset audio preferito (Woodblock, Beep, Cowbell, ecc.)
- `bars`: numero di battute previste o conteggio preliminare (opzionale)
- `notes`: note per il musicista (es. "Attacco solo chitarra per 4 battute", "Finale rallentando")
- `colorTag`: colore identificativo per rapida distinzione visiva

## Gestione Scalette Multiple
- Menu a tendina per selezionare rapidamente la scaletta attiva durante prove o concerti.
- Creazione nuova scaletta, rinomina, duplicazione e cancellazione.
- Esportazione ed importazione flessibile: possibilità di scaricare/caricare singole scalette o l'intero archivio in formato `.json`.

## Controlli Live sul Palco
- **Pulsanti Extra-Large "Prev" e "Next"**: Facilmente cliccabili anche con lo smartphone posizionato sull'asta del microfono o sul supporto batteria.
- **Passaggio Rapido**: Cambio brano a caldo con opzione di auto-start o standby del click.
- **Supporto Tastiera / Pedale Bluetooth**: Gestione eventi tastiera (Freccia destra / Spazio / PageDown) per consentire l'avanzamento brani tramite pedaliere voltapagina Bluetooth (es. AirTurn, PageFlip).
- **Import / Export**: Salvataggio su `localStorage` persistente + esportazione/importazione JSON per condividere la scaletta tra i membri della band via WhatsApp o Cloud.
