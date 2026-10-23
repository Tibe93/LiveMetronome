# Direttiva: PWA & Ottimizzazione per iPhone (iOS Safari)

## Obiettivo
Configurare l'applicazione come Progressive Web App (PWA) ottimizzata al 100% per iPhone, eliminando barre di navigazione del browser, gestendo l'audio unlock di Safari, e fornendo indicazioni di installazione one-tap.

## Specifiche Tecniche iOS
1. **Manifest PWA**:
   - `display: "standalone"` (elimina URL bar e bottoni di Safari quando aggiunta alla schermata Home).
   - `theme_color: "#0a0a0c"` e `background_color: "#0a0a0c"`.
   - Icone ad alta risoluzione (192x192, 512x512) e icona specifica per Apple touch (`apple-touch-icon`).
2. **Meta Tag Safari iOS**:
   - `<meta name="apple-mobile-web-app-capable" content="yes" />`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`
   - `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />` (gestione corretta del notch / Dynamic Island tramite `safe-area-inset-*`).
3. **Sblocco Audio Safari (AudioContext Unlock)**:
   - iOS Safari sospende per default l'AudioContext fino a una vera interazione utente (`touchstart` o `click`).
   - All'avvio dell'app o alla prima pressione di play/tap, eseguire una riproduzione silenziosa di sblocco (`audioCtx.resume()`).
4. **HTTPS per Microfono**:
   - iOS impedisce tassativamente `getUserMedia` se la connessione non è cifrata HTTPS (a eccezione di `localhost`).
   - Quando distribuita su Vercel (o tunnel HTTPS), l'accesso al microfono è nativo e sicuro.
5. **Prompt di Installazione**:
   - Banner intuitivo che spiega all'utente come toccare l'icona "Condividi" di Safari e selezionare "Aggiungi a schermata Home".
