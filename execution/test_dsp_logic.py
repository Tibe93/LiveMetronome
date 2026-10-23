#!/usr/bin/env python3
"""
Test e validazione deterministica dell'algoritmo di stima BPM (IOI e autocorrelazione).
Verifica che la logica converga accuratamente sul tempo effettivo simulato con jitter umano.
"""

import math
import random

def simulate_drum_beat(target_bpm=125, duration_sec=5.0, jitter_std=0.015, miss_rate=0.05):
    """Genera timestamp di colpi di cassa a un target_bpm con jitter umano e possibili colpi mancati."""
    interval = 60.0 / target_bpm
    current_time = 0.5
    timestamps = []
    
    while current_time < duration_sec:
        # Eventuale salto di un colpo
        if random.random() > miss_rate:
            # Aggiunta jitter casuale tipico di un batterista umano (±15ms)
            noisy_time = current_time + random.gauss(0, jitter_std)
            timestamps.append(noisy_time)
        current_time += interval
        
    return sorted(timestamps)

def estimate_bpm_from_timestamps(timestamps, min_bpm=50, max_bpm=240):
    """
    Algoritmo matematico per stimare i BPM dalla lista di timestamp dei transienti.
    Calcola gli Inter-Onset Intervals (IOI), analizza i cluster e l'istogramma pesato.
    """
    if len(timestamps) < 3:
        return None
        
    # Calcolo delta t tra colpi consecutivi (e colpi a distanza 2)
    intervals = []
    for i in range(1, len(timestamps)):
        dt = timestamps[i] - timestamps[i-1]
        if 0.2 <= dt <= 1.5:  # Range 40 - 300 BPM
            intervals.append(dt)
        if i >= 2:
            dt2 = (timestamps[i] - timestamps[i-2]) / 2.0
            if 0.2 <= dt2 <= 1.5:
                intervals.append(dt2)
                
    if not intervals:
        return None
        
    # Istogramma con bin di 0.005s (~5ms di risoluzione)
    bin_size = 0.005
    bins = {}
    bin_values = {}
    for dt in intervals:
        b = round(dt / bin_size) * bin_size
        bins[b] = bins.get(b, 0) + 1
        if b not in bin_values:
            bin_values[b] = []
        bin_values[b].append(dt)
        
    # Trova il bin con il punteggio massimo
    best_bin = max(bins.items(), key=lambda x: x[1])[0]
    # Calcola la media dei valori reali che sono caduti in questo bin per evitare errori di discretizzazione
    cluster_vals = bin_values[best_bin]
    best_interval = sum(cluster_vals) / len(cluster_vals)
    raw_bpm = 60.0 / best_interval
    
    # Octave check (normalizzazione nel range plausibile 50-240 BPM)
    while raw_bpm < min_bpm:
        raw_bpm *= 2
    while raw_bpm > max_bpm:
        raw_bpm /= 2
        
    return round(raw_bpm, 1)

def main():
    print("Avvio test simulazione DSP tempo tracking...")
    test_cases = [80, 100, 120, 135, 160]
    all_passed = True
    
    for target in test_cases:
        hits = simulate_drum_beat(target_bpm=target, duration_sec=6.0, jitter_std=0.012)
        est = estimate_bpm_from_timestamps(hits)
        diff = abs(est - target) if est else 999
        print(f"Target: {target:3d} BPM | Rilevati {len(hits)} colpi | Stimato: {est:5.1f} BPM | Errore: {diff:.1f} BPM")
        if diff > 3.0:
            all_passed = False
            
    if all_passed:
        print("✓ Tutti i test matematici del modello DSP sono superati con successo!")
    else:
        print("✗ Alcuni test hanno superato la soglia di tolleranza.")
        exit(1)

if __name__ == "__main__":
    main()
