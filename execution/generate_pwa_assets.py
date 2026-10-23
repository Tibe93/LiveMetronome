#!/usr/bin/env python3
"""
Script di esecuzione per la generazione di asset PWA ad alta risoluzione (icone, manifest)
ottimizzati per iPhone e browser desktop.
"""

import os
from PIL import Image, ImageDraw

def create_metronome_icon(size: int, output_path: str):
    # Crea un'immagine RGBA
    img = Image.new("RGBA", (size, size), (10, 11, 15, 255))
    draw = ImageDraw.Draw(img)

    # Gradient/glow effect concentrico
    center = size / 2
    radius = size * 0.44

    # Bordo esterno arrotondato con bagliore neon ciano/smeraldo
    outer_box = [size * 0.06, size * 0.06, size * 0.94, size * 0.94]
    draw.rounded_rectangle(outer_box, radius=size * 0.22, fill=(17, 24, 39, 255), outline=(16, 185, 129, 255), width=max(2, int(size * 0.025)))

    # Sagoma metronomo stilizzata
    # Piramide metronomo
    poly_points = [
        (center, size * 0.22),           # apice
        (size * 0.72, size * 0.78),      # base destra
        (size * 0.28, size * 0.78)       # base sinistra
    ]
    draw.polygon(poly_points, fill=(31, 41, 55, 255), outline=(55, 65, 81, 255))

    # Scala graduata centrale (linee orizzontali)
    for y_rel in [0.42, 0.50, 0.58, 0.66]:
        y = size * y_rel
        width_ratio = (y_rel - 0.22) / (0.78 - 0.22)
        half_w = size * 0.22 * width_ratio * 0.75
        draw.line([(center - half_w, y), (center + half_w, y)], fill=(75, 85, 99, 255), width=max(1, int(size * 0.012)))

    # Asta del pendolo (inclinata dinamicamente a 15 gradi per dare il senso del tempo)
    pendulum_start = (center, size * 0.75)
    pendulum_end = (center + size * 0.16, size * 0.26)
    draw.line([pendulum_start, pendulum_end], fill=(59, 130, 246, 255), width=max(2, int(size * 0.028)))

    # Peso scorrevole del pendolo (accento color smeraldo brillante)
    weight_center = (center + size * 0.10, size * 0.44)
    w_size = size * 0.06
    draw.rectangle(
        [weight_center[0] - w_size, weight_center[1] - w_size * 0.7, weight_center[0] + w_size, weight_center[1] + w_size * 0.7],
        fill=(16, 185, 129, 255), outline=(255, 255, 255, 220), width=max(1, int(size * 0.012))
    )

    # Punto perno inferiore (luce blu neon)
    pivot_r = size * 0.035
    draw.ellipse([center - pivot_r, size * 0.75 - pivot_r, center + pivot_r, size * 0.75 + pivot_r], fill=(96, 165, 250, 255))

    # Onde audio di tracking attorno alla testa (simbolismo del microfono/ascolto)
    for r_scale in [0.18, 0.26]:
        arc_box = [center - size * r_scale, size * 0.22 - size * r_scale * 0.6, center + size * r_scale, size * 0.22 + size * r_scale * 1.4]
        draw.arc(arc_box, start=200, end=340, fill=(16, 185, 129, 180), width=max(1, int(size * 0.018)))

    img.save(output_path, "PNG")
    print(f"Generata icona: {output_path} ({size}x{size})")

def main():
    public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))
    os.makedirs(public_dir, exist_ok=True)

    create_metronome_icon(192, os.path.join(public_dir, "icon-192.png"))
    create_metronome_icon(512, os.path.join(public_dir, "icon-512.png"))
    create_metronome_icon(180, os.path.join(public_dir, "apple-touch-icon.png"))
    create_metronome_icon(64, os.path.join(public_dir, "favicon.png"))

if __name__ == "__main__":
    main()
