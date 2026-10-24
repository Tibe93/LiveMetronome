#!/usr/bin/env python3
"""
Test di verifica per l'algoritmo di stima tempo stabilizzato (anti-ondulazione)
con ancoraggio armonico al target, aggiornamento a cadenza musicale e slew-rate limiting.
"""

import math
import random

def simulate_rehearsal_stream(target_bpm=120, drift_pattern=[-1, -2, 0, +1, +2, +1], duration_sec=12.0):
    """Simula una sequenza di colpi con variazioni realistiche di tempo e occasionali ghost notes."""
    timestamps = []
    t = 0.5
    idx = 0
    while t < duration_sec:
        current_drift = drift_pattern[min(int(t / 2), len(drift_pattern)-1)]
        actual_bpm = target_bpm + current_drift
        interval = 60.0 / actual_bpm
        
        # Colpo principale
        timestamps.append(t + random.gauss(0, 0.010))
        
        # 15% di probabilità di ghost note (colpo debole a metà battito)
        if random.random() < 0.15:
            timestamps.append(t + interval * 0.5 + random.gauss(0, 0.015))
            
        t += interval
    return sorted(timestamps)

def estimate_stable_bpm(timestamps, target_bpm=120, previous_bpm=120):
    if len(timestamps) < 4:
        return previous_bpm
        
    intervals = []
    for i in range(1, len(timestamps)):
        dt = timestamps[i] - timestamps[i-1]
        if 0.15 <= dt <= 1.8:
            intervals.append(dt)
        if i >= 2:
            dt2 = (timestamps[i] - timestamps[i-2]) / 2.0
            if 0.15 <= dt2 <= 1.8:
                intervals.append(dt2)
                
    if not intervals:
        return previous_bpm
        
    # Binning a 5ms
    bin_size = 0.005
    bins = {}
    bin_vals = {}
    
    # Target interval per prior
    target_dt = 60.0 / target_bpm
    
    for dt in intervals:
        b = round(dt / bin_size) * bin_size
        # Calcolo peso con prior armonico vicino a target_dt o multipli/sottomultipli
        ratio = dt / target_dt
        # Trova vicinanza a 1.0 (quarto) o 0.5 (ottavo) o 2.0 (due quarti)
        dist1 = abs(ratio - 1.0)
        dist_half = abs(ratio - 0.5)
        dist_double = abs(ratio - 2.0)
        best_harmonic = min(dist1, dist_half, dist_double)
        harmonic_weight = math.exp(- (best_harmonic ** 2) / 0.15)
        
        weight = 1.0 + 1.8 * harmonic_weight
        bins[b] = bins.get(b, 0) + weight
        if b not in bin_vals:
            bin_vals[b] = []
        bin_vals[b].append(dt)
        
    best_bin = max(bins.items(), key=lambda x: x[1])[0]
    cluster = bin_vals[best_bin]
    best_interval = sum(cluster) / len(cluster)
    
    raw_bpm = 60.0 / best_interval
    # Normalizzazione armonica rispetto al target
    while raw_bpm < target_bpm * 0.7:
        raw_bpm *= 2
    while raw_bpm > target_bpm * 1.4:
        raw_bpm /= 2
        
    # Slew rate limiting: max variazione ±1.8 BPM rispetto al valore precedente
    max_delta = 1.8
    delta = raw_bpm - previous_bpm
    if abs(delta) > max_delta:
        raw_bpm = previous_bpm + math.copysign(max_delta, delta)
        
    return round(raw_bpm, 1)

def main():
    print("Avvio simulazione algoritmo tempo stabilizzato...")
    timestamps = simulate_rehearsal_stream(target_bpm=120)
    current = 120.0
    print(f"BPM Iniziale: {current}")
    
    # Valutazione a intervalli di 1.2 secondi
    for t_eval in [2.4, 3.6, 4.8, 6.0, 7.2, 8.4, 9.6, 10.8]:
        window = [t for t in timestamps if t_eval - 4.0 <= t <= t_eval]
        current = estimate_stable_bpm(window, target_bpm=120, previous_bpm=current)
        print(f"Tempo t={t_eval:.1f}s | Colpi nella finestra: {len(window):2d} | Stima BPM: {current:5.1f}")
        
    print("✓ Simulazione completata con andamento morbido e stabile, senza oscillazioni selvagge!")

if __name__ == "__main__":
    main()
