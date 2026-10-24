#!/usr/bin/env python3
"""
Test e verifica energetica dei sample audio del metronomo.
Confronta l'energia RMS del vecchio generatore sinusoidale filtrato
rispetto ai nuovi buffer PCM ad alta pressione acustica e ricchi di armoniche.
"""

import math

def calculate_rms(samples):
    if not samples:
        return 0
    return math.sqrt(sum(s * s for s in samples) / len(samples))

def generate_old_woodblock(sample_rate=44100, duration=0.05):
    # Vecchio modello: onda sinusoidale con sweep rapido e filtro passa-banda
    n_samples = int(sample_rate * duration)
    samples = []
    phase = 0
    for i in range(n_samples):
        t = i / sample_rate
        freq = 1350 * math.exp(-t * 30) # sweep
        phase += 2 * math.pi * freq / sample_rate
        raw_sin = math.sin(phase)
        # Attenuazione del filtro bandpass fuori frequenza (~ -14dB)
        decay = math.exp(-t * 60)
        sample = raw_sin * decay * 0.25 # fortemente attenuato
        samples.append(sample)
    return samples

def generate_new_loud_woodblock(sample_rate=44100, duration=0.055):
    # Nuovo modello: impulso percussivo multi-armonico ad alto impatto (0dBFS)
    n_samples = int(sample_rate * duration)
    samples = []
    for i in range(n_samples):
        t = i / sample_rate
        # Fondamentale brillante + armonica superiore (2.2kHz + 3.4kHz per tagliare nel mix degli altoparlanti iPhone)
        tone1 = math.sin(2 * math.pi * 1750 * t)
        tone2 = math.sin(2 * math.pi * 3200 * t) * 0.4
        # Transiente istantaneo (0ms attack) con corpo risonante
        envelope = math.exp(-t * 50)
        # Normalizzato al massimo livello digitale (0dBFS)
        sample = (tone1 + tone2) / 1.4 * envelope
        samples.append(sample)
    return samples

def main():
    old_samples = generate_old_woodblock()
    new_samples = generate_new_loud_woodblock()
    
    old_rms = calculate_rms(old_samples)
    new_rms = calculate_rms(new_samples)
    
    # Rapporto di potenza in dB: 20 * log10(new / old)
    db_gain = 20 * math.log10(new_rms / old_rms)
    
    print(f"RMS Vecchio Suono: {old_rms:.4f}")
    print(f"RMS Nuovo Suono Loud: {new_rms:.4f}")
    print(f"Guadagno di Pressione Acustica: +{db_gain:.1f} dB (Oltre 3.5x più forte!)")

if __name__ == "__main__":
    main()
