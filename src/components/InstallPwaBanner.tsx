'use client';

import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Smartphone } from 'lucide-react';

export const InstallPwaBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Verifica se è iOS Safari e non è già in modalità standalone (PWA installata)
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
      const isStandalone =
        (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;

      const hasDismissed = localStorage.getItem('live_metronomo_pwa_dismissed');

      setIsIos(isIosDevice);
      if (isIosDevice && !isStandalone && !hasDismissed) {
        setShow(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('live_metronomo_pwa_dismissed', 'true');
    }
  };

  if (!show) return null;

  return (
    <div className="w-full bg-gradient-to-r from-cyan-950/90 via-zinc-900/90 to-emerald-950/90 border border-cyan-500/40 rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-3 text-xs">
      <div className="flex items-start gap-2.5">
        <Smartphone className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="flex flex-col text-zinc-300">
          <span className="font-bold text-white text-xs">Installa su iPhone (App a schermo intero)</span>
          <span className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
            Tocca l&apos;icona <Share className="w-3 h-3 inline mx-0.5 text-cyan-400" /> Condividi di Safari e scegli{' '}
            <strong className="text-zinc-200 inline-flex items-center gap-0.5">
              <PlusSquare className="w-3 h-3" /> Aggiungi a schermata Home
            </strong>{' '}
            per le prove senza barre browser.
          </span>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
